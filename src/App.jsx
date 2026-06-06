import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  STORAGE_KEY,
  LAST_TICK_KEY,
  DEFAULT_TAGS,
  todayString,
  resetTaskSubtree,
  makeTask,
  makeQuest,
  makeQuestFolder,
  isTaskComplete,
  hasCountTarget,
  getCountProgress,
  areTaskChildrenComplete,
  isTaskReadyToComplete,
  clearAncestorCompletionById,
  isQuestComplete,
  isQuestReadyToComplete,
  nextTasksInList,
  buildFocusBoardFromRoot,
  buildExecutionBoardFromRoot,
  addQuestCompletionCard,
  getFocusPathInfo,
  updateQuestTree,
  addTaskToTree,
  deleteTaskFromTree,
  moveTaskInTree,
  moveTaskToTreeLocation,
  seedData,
  normalizeData,
  runDailyMaintenance,
  selectionKey,
  getTreeContext,
  renameQuestFolderInList,
  deleteQuestFolderFromList,
  moveQuestToFolderInList,
  isFolderDescendantInList,
  moveQuestFolderToFolderInList,
} from "./models/appModel";

import {
  downloadJsonFile,
  makeAllDataExport,
  makeQuestFileExport,
  rawDataFromPlannerPayload,
  rawQuestFromQuestPayload,
  readJsonFile,
  slugifyFilename,
} from "./utils/fileIO";

import {
  checkQuestMoveDestinationInProject,
  chooseProjectRootDirectory,
  createFolderInProject,
  createQuestFileInProject,
  deleteEmptyFolderInProject,
  deleteQuestFileInProject,
  getSavedProjectRootPath,
  moveFolderInProject,
  moveQuestFileInProject,
  renameQuestFileInProject,
  renameFolderInProject,
  scanQuestProjectDirectory,
  updateQuestFileInProject,
} from "./utils/projectDirectoryIO";

import QuestBoardTab from "./components/quest-board/QuestBoardTab";
import ExportOptionsTab from "./components/export-options/ExportOptionsTab";
import DebugTab from "./components/debug/DebugTab";
import FocusTab from "./components/focus-tab/FocusTab";
import TreeViewTab from "./components/tree-view/TreeViewTab";
import InspectorTab from "./components/inspector/InspectorTab";
import DockContainer from "./components/layout/DockContainer";
import { DOCK_IDS, PANEL_IDS } from "./layout/panelLayout";

const RIGHT_DOCK_SPLIT_RESERVE = "0.575rem";

function isQuestCompletionRow(row) {
  return row?.kind === "questCompletion" || row?.kind === "rootTask";
}

function getProjectPathBaseName(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function joinProjectRelativePath(folderId, fileName) {
  const cleanFileName = getProjectPathBaseName(fileName);
  const cleanFolderId = String(folderId || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  return cleanFolderId ? `${cleanFolderId}/${cleanFileName}` : cleanFileName;
}

function normalizeProjectRelativePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function getProjectPathParent(path) {
  const normalized = normalizeProjectRelativePath(path);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

function makeVirtualFolderId(parentId, name) {
  const cleanName = String(name || "").trim();
  const cleanParentId = normalizeProjectRelativePath(parentId || null);

  return cleanParentId ? `${cleanParentId}/${cleanName}` : cleanName;
}

function getVirtualFolderName(folderId) {
  return getProjectPathBaseName(folderId);
}

function isValidVirtualFolderName(name) {
  const value = String(name || "");
  return Boolean(
    value.trim() &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !/[\\/:*?"<>|]/.test(value) &&
    !value.startsWith(".") &&
    !value.endsWith(".")
  );
}

function getInvalidVirtualFolderNameMessage(name) {
  const value = String(name || "");

  if (!value.trim()) return "Folder name cannot be empty.";
  if (value !== value.trim()) return "Folder name cannot start or end with spaces.";
  if (value === "." || value === "..") return "Folder name cannot be . or ...";
  if (/[\\/:*?"<>|]/.test(value)) return "Folder name contains an invalid filename character.";
  if (value.startsWith(".") || value.endsWith(".")) return "Folder name cannot start or end with a period.";

  return "";
}

function renameVirtualFolderPath(folders, quests, folderId, nextName) {
  const oldId = normalizeProjectRelativePath(folderId);
  const parentId = getProjectPathParent(oldId);
  const nextId = makeVirtualFolderId(parentId, nextName);

  if (!oldId || !nextId || oldId === nextId) {
    return { folders, quests, nextFolderId: oldId || nextId };
  }

  function remapFolderId(value) {
    const normalized = normalizeProjectRelativePath(value);

    if (normalized === oldId) return nextId;
    if (normalized.startsWith(`${oldId}/`)) return `${nextId}/${normalized.slice(oldId.length + 1)}`;

    return value || null;
  }

  return {
    folders: (folders || []).map((folder) => ({
      ...folder,
      id: remapFolderId(folder.id),
      parentId: folder.parentId ? remapFolderId(folder.parentId) : null,
      title: undefined,
      updatedAt: new Date().toISOString(),
    })),
    quests: (quests || []).map((quest) => ({
      ...quest,
      folderId: quest.folderId ? remapFolderId(quest.folderId) : null,
    })),
    nextFolderId: nextId,
  };
}

function moveVirtualFolderPath(folders, quests, folderId, nextParentId) {
  const oldId = normalizeProjectRelativePath(folderId);
  const cleanNextParentId = normalizeProjectRelativePath(nextParentId || null);
  const folderName = getProjectPathBaseName(oldId);
  const nextId = makeVirtualFolderId(cleanNextParentId || null, folderName);

  if (!oldId || !nextId || oldId === nextId) {
    return { moved: false, reason: "same-parent/no-op", folders, quests, nextFolderId: oldId || nextId };
  }

  if (cleanNextParentId && (cleanNextParentId === oldId || cleanNextParentId.startsWith(`${oldId}/`))) {
    return { moved: false, reason: "folder-into-self-or-child", folders, quests, nextFolderId: oldId };
  }

  const collision = (folders || []).some((folder) =>
    normalizeProjectRelativePath(folder.id) !== oldId &&
    normalizeProjectRelativePath(folder.id) === nextId
  );

  if (collision) {
    return { moved: false, reason: "folder-merge-risk", folders, quests, nextFolderId: oldId };
  }

  function remapFolderId(value) {
    const normalized = normalizeProjectRelativePath(value);

    if (normalized === oldId) return nextId;
    if (normalized.startsWith(`${oldId}/`)) return `${nextId}/${normalized.slice(oldId.length + 1)}`;

    return value || null;
  }

  return {
    moved: true,
    reason: "moved",
    folders: (folders || []).map((folder) => {
      const normalizedId = normalizeProjectRelativePath(folder.id);
      const isMovedRoot = normalizedId === oldId;

      return {
        ...folder,
        id: remapFolderId(folder.id),
        parentId: isMovedRoot
          ? (cleanNextParentId || null)
          : (folder.parentId ? remapFolderId(folder.parentId) : null),
        title: undefined,
        updatedAt: new Date().toISOString(),
      };
    }),
    quests: (quests || []).map((quest) => ({
      ...quest,
      folderId: quest.folderId ? remapFolderId(quest.folderId) : null,
    })),
    nextFolderId: nextId,
  };
}

export default function App() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let loaded = seedData;

    if (saved) {
      try {
        loaded = normalizeData(JSON.parse(saved));
      } catch {
        loaded = seedData;
      }
    }

    const maintained = runDailyMaintenance(loaded);
    localStorage.setItem(LAST_TICK_KEY, todayString());
    return maintained;
  });

  const [libraryTab, setLibraryTab] = useState(PANEL_IDS.QUEST_BOARD);
  const [centerTab, setCenterTab] = useState(PANEL_IDS.FOCUS_PANEL || "focusPanel");
  const [topRightTab, setTopRightTab] = useState(PANEL_IDS.INSPECTOR_PANEL);
  const [bottomRightTab, setBottomRightTab] = useState(PANEL_IDS.TREE_VIEW_PANEL);
  const [selection, setSelectionRaw] = useState({ type: "quest", id: data.activeQuestId || data.quests[0]?.id || null });
  const [history, setHistory] = useState([{ type: "quest", id: data.activeQuestId || data.quests[0]?.id || null }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [focusHistory, setFocusHistory] = useState([{
    questId: data.activeQuestId || data.quests[0]?.id || null,
    branchTaskId: null,
  }]);
  const [focusHistoryIndex, setFocusHistoryIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("All");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [expanded, setExpanded] = useState({});
  const [rightSplit, setRightSplit] = useState(62);
  const [leftPanelWidth, setLeftPanelWidth] = useState(360);
  const [rightPanelWidth, setRightPanelWidth] = useState(430);
  const [expandedKanbanCards, setExpandedKanbanCards] = useState({});
  const [debugDateOverrideEnabled, setDebugDateOverrideEnabled] = useState(false);
  const [debugDateOverrideDate, setDebugDateOverrideDate] = useState(todayString());
  const [projectRootPath, setProjectRootPath] = useState(() => getSavedProjectRootPath());
  const [projectLoadSummary, setProjectLoadSummary] = useState("");
  const dataRef = useRef(data);
  const projectSaveQueueRef = useRef({});

  function stripProjectTransientQuestFields(quest) {
    const {
      projectDirty,
      projectFilePath,
      projectRelativePath,
      sourceQuestId,
      ...persistentQuest
    } = quest || {};

    return persistentQuest;
  }

  function hasPersistentQuestChange(before, after) {
    return JSON.stringify(stripProjectTransientQuestFields(before)) !==
      JSON.stringify(stripProjectTransientQuestFields(after));
  }

  function markChangedProjectQuestsDirty(oldData, nextData) {
    if (!projectRootPath || !nextData) return nextData;

    const previousQuestsById = new Map((oldData?.quests || []).map((quest) => [quest.id, quest]));

    return {
      ...nextData,
      quests: (nextData.quests || []).map((quest) => {
        if (!quest?.projectRelativePath) return quest;

        const previousQuest = previousQuestsById.get(quest.id);
        if (!previousQuest) return quest;
        if (!hasPersistentQuestChange(previousQuest, quest)) return quest;

        return {
          ...quest,
          projectDirty: true,
        };
      }),
    };
  }

  function setDataWithProjectDirty(updater) {
    setData((old) => {
      const next = typeof updater === "function" ? updater(old) : updater;
      return markChangedProjectQuestsDirty(old, next);
    });
  }

  async function writeQuestFileSnapshotNow(questSnapshot, options = {}) {
    const { silent = false } = options;

    if (!projectRootPath || !questSnapshot) return false;

    if (!questSnapshot.projectRelativePath) {
      if (!silent) {
        window.alert("Could not save quest file because its project path is missing.");
        await loadQuestProjectFolder(projectRootPath, { activeQuestId: questSnapshot.id });
      }
      return false;
    }

    try {
      await updateQuestFileInProject(
        projectRootPath,
        questSnapshot.projectRelativePath,
        questSnapshot
      );

      setData((old) => {
        const nextData = {
          ...old,
          quests: (old.quests || []).map((item) => {
            if (item.id !== questSnapshot.id) return item;

            // Only clear the dirty flag if the current in-memory quest still
            // matches the exact snapshot that was saved. If the user changed
            // the quest again while the save was in flight, keep it dirty.
            if (hasPersistentQuestChange(questSnapshot, item)) return item;

            return { ...item, projectDirty: false };
          }),
        };

        dataRef.current = nextData;
        return nextData;
      });

      return true;
    } catch (error) {
      console.error(silent ? "Could not autosave quest file." : "Could not save quest file.", error);

      if (!silent) {
        const message = typeof error === "string" ? error : error?.message || "Unknown error.";
        window.alert(`Could not save quest file.

${message}`);
      }

      return false;
    }
  }

  function queueQuestFileSnapshotSave(questSnapshot, options = {}) {
    if (!projectRootPath || !questSnapshot?.id || !questSnapshot?.projectRelativePath) {
      return Promise.resolve(false);
    }

    const key = questSnapshot.id;
    const previous = projectSaveQueueRef.current[key] || Promise.resolve();

    const next = previous
      .catch(() => false)
      .then(() => writeQuestFileSnapshotNow(questSnapshot, options));

    projectSaveQueueRef.current[key] = next;

    next.finally(() => {
      if (projectSaveQueueRef.current[key] === next) {
        delete projectSaveQueueRef.current[key];
      }
    });

    return next;
  }

  function setDataWithProjectDirtyAndAutosaveQuest(questId, updater) {
    setData((old) => {
      const rawNext = typeof updater === "function" ? updater(old) : updater;
      const next = markChangedProjectQuestsDirty(old, rawNext);
      const questToAutosave = (next.quests || []).find((quest) =>
        quest.id === questId &&
        quest.projectRelativePath &&
        quest.projectDirty
      );

      dataRef.current = next;

      if (questToAutosave) {
        window.setTimeout(() => {
          queueQuestFileSnapshotSave(questToAutosave, { silent: true });
        }, 0);
      }

      return next;
    });
  }

  function getQuestIdForSelectionState(selectionState = selection) {
    if (selectionState?.type === "quest") return selectionState.id || null;
    if (selectionState?.type === "task") return selectionState.questId || null;
    return null;
  }

  function setDataWithProjectDirtyAndAutosaveSelection(updater) {
    const questId = getQuestIdForSelectionState();

    if (!questId) {
      setDataWithProjectDirty(updater);
      return;
    }

    setDataWithProjectDirtyAndAutosaveQuest(questId, updater);
  }

  function getAppDate() {
    return debugDateOverrideEnabled && debugDateOverrideDate
      ? debugDateOverrideDate
      : todayString();
  }

  function runMaintenanceForDate(date = getAppDate()) {
    setDataWithProjectDirty((old) => runDailyMaintenance(old, date));
    localStorage.setItem(LAST_TICK_KEY, date);
  }

  const quests = data.quests || [];
  const activeQuest = quests.find((quest) => quest.id === data.activeQuestId) || quests[0] || null;
  const focusPathInfo = getFocusPathInfo(activeQuest, data.activeBranchTaskId);
  const actionable = nextTasksInList(focusPathInfo.root?.tasks || [], focusPathInfo.root?.mode || "all");
  const focusBoard = buildExecutionBoardFromRoot(focusPathInfo.root);

  function setSelection(next) {
    setSelectionRaw(next);

    setHistory((old) => {
      const trimmed = old.slice(0, historyIndex + 1);
      const last = trimmed[trimmed.length - 1];

      if (selectionKey(last) === selectionKey(next)) return old;

      const nextHistory = [...trimmed, next];
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }

  function goBack() {
    if (historyIndex <= 0) return;
    const i = historyIndex - 1;
    setHistoryIndex(i);
    setSelectionRaw(history[i]);
  }

  function goForward() {
    if (historyIndex >= history.length - 1) return;
    const i = historyIndex + 1;
    setHistoryIndex(i);
    setSelectionRaw(history[i]);
  }

  function focusHistoryKey(item) {
    return `${item?.questId || ""}:${item?.branchTaskId || ""}`;
  }

  function applyFocusTarget(target, options = {}) {
    const nextTarget = {
      questId: target.questId || null,
      branchTaskId: target.branchTaskId || null,
    };

    setDataWithProjectDirty((old) => ({
      ...old,
      activeQuestId: nextTarget.questId,
      activeBranchTaskId: nextTarget.branchTaskId,
    }));

    if (options.record === false) return;

    setFocusHistory((old) => {
      const trimmed = old.slice(0, focusHistoryIndex + 1);
      const last = trimmed[trimmed.length - 1];

      if (focusHistoryKey(last) === focusHistoryKey(nextTarget)) return old;

      const nextHistory = [...trimmed, nextTarget];
      setFocusHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }

  function goFocusBack() {
    if (focusHistoryIndex <= 0) return;
    const i = focusHistoryIndex - 1;
    const target = focusHistory[i];
    setFocusHistoryIndex(i);
    applyFocusTarget(target, { record: false });
  }

  function goFocusForward() {
    if (focusHistoryIndex >= focusHistory.length - 1) return;
    const i = focusHistoryIndex + 1;
    const target = focusHistory[i];
    setFocusHistoryIndex(i);
    applyFocusTarget(target, { record: false });
  }

  useEffect(() => {
    dataRef.current = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = getAppDate();
      const lastTick = localStorage.getItem(LAST_TICK_KEY);

      if (lastTick !== today) {
        setDataWithProjectDirty((old) => runDailyMaintenance(old, today));
        localStorage.setItem(LAST_TICK_KEY, today);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [debugDateOverrideEnabled, debugDateOverrideDate]);

  useEffect(() => {
    runMaintenanceForDate();
  }, [debugDateOverrideEnabled, debugDateOverrideDate]);

  useEffect(() => {
    if (!projectRootPath) return;

    loadQuestProjectFolder(projectRootPath);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set(DEFAULT_TAGS);
    quests.forEach((quest) => (quest.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [quests]);

  const filteredQuests = useMemo(() => {
    return quests
      .filter((quest) => {
        const text = `${quest.title} ${quest.description} ${(quest.tags || []).join(" ")}`.toLowerCase();
        return (
          text.includes(search.toLowerCase()) &&
          (tagFilter === "All" || (quest.tags || []).includes(tagFilter)) &&
          (!hideCompleted || !isQuestComplete(quest)) &&
          (showDisabled || quest.status !== "inactive")
        );
      })
      .sort((a, b) => {
        const completeCompare = Number(isQuestComplete(a)) - Number(isQuestComplete(b));
        if (completeCompare !== 0) return completeCompare;
        return (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99") || a.title.localeCompare(b.title);
      });
  }, [quests, search, tagFilter, hideCompleted, showDisabled]);

  async function createQuest(folderId = selectedFolderId) {
    const title = window.prompt("Quest title:", "New Quest");
    if (!title || !title.trim()) return;

    const cleanTitle = title.trim();

    const quest = {
      ...makeQuest({ title: cleanTitle }),
      folderId: folderId || null,
    };

    if (projectRootPath) {
      try {
        const createdPath = await createQuestFileInProject(projectRootPath, folderId || null, quest);
        await loadQuestProjectFolder(projectRootPath, { activeQuestPath: createdPath });
        return;
      } catch (error) {
        console.error("Could not create quest file.", error);
        window.alert("Could not create quest file.");
        return;
      }
    }

    setDataWithProjectDirty((old) => ({ ...old, quests: [quest, ...old.quests] }));
    setSelection({ type: "quest", id: quest.id });
  }

  async function createQuestFolder(parentId = selectedFolderId) {
    const title = window.prompt("Folder name:", "New Folder");
    if (!title || !title.trim()) return;

    const cleanTitle = title.trim();

    if (projectRootPath) {
      try {
        const createdFolderId = await createFolderInProject(projectRootPath, parentId || null, cleanTitle);
        await loadQuestProjectFolder(projectRootPath);
        setSelectedFolderId(createdFolderId || null);
        if (parentId) setExpandedFolders((old) => ({ ...old, [parentId]: true }));
        if (createdFolderId) setExpandedFolders((old) => ({ ...old, [createdFolderId]: true }));
        return;
      } catch (error) {
        console.error("Could not create quest folder.", error);
        window.alert("Could not create quest folder.");
        return;
      }
    }

    const nextFolderId = makeVirtualFolderId(parentId || null, cleanTitle);

    if (!isValidVirtualFolderName(cleanTitle)) {
      window.alert(getInvalidVirtualFolderNameMessage(cleanTitle));
      return;
    }

    const existingSibling = (dataRef.current?.folders || data.folders || []).some((folder) =>
      normalizeProjectRelativePath(folder.id) === normalizeProjectRelativePath(nextFolderId)
    );

    if (existingSibling) {
      window.alert("A folder with that name already exists.");
      return;
    }

    const folder = {
      ...makeQuestFolder({
        title: cleanTitle,
        parentId: parentId || null,
      }),
      id: nextFolderId,
      title: undefined,
    };

    setDataWithProjectDirty((old) => ({
      ...old,
      folders: [...(old.folders || []), folder],
    }));

    setSelectedFolderId(folder.id);
    if (parentId) setExpandedFolders((old) => ({ ...old, [parentId]: true }));
  }

  async function renameQuestFolder(folderId, nextTitle = null) {
    const liveData = dataRef.current || data;
    const folder = (liveData.folders || []).find((item) => item.id === folderId);
    if (!folder) return;

    const title = nextTitle == null
      ? window.prompt("Rename folder:", getVirtualFolderName(folder.id) || "Untitled Folder")
      : nextTitle;

    if (!title || !title.trim()) return;

    const cleanTitle = title.trim();

    if (projectRootPath) {
      try {
        const renamedFolderId = await renameFolderInProject(projectRootPath, folderId, cleanTitle);
        const parentId = getProjectPathParent(renamedFolderId);
        await loadQuestProjectFolder(projectRootPath, {
          activeFolderId: renamedFolderId || null,
          expandedFolderIds: [parentId, renamedFolderId].filter(Boolean),
        });
        return;
      } catch (error) {
        console.error("Could not rename quest folder.", error);
        window.alert("Could not rename quest folder.");
        await loadQuestProjectFolder(projectRootPath, { activeFolderId: folderId });
        return;
      }
    }

    if (!isValidVirtualFolderName(cleanTitle)) {
      window.alert(getInvalidVirtualFolderNameMessage(cleanTitle));
      return;
    }

    const parentId = getProjectPathParent(folderId);
    const nextFolderId = makeVirtualFolderId(parentId || null, cleanTitle);

    const existingSibling = (liveData.folders || []).some((item) =>
      normalizeProjectRelativePath(item.id) !== normalizeProjectRelativePath(folderId) &&
      normalizeProjectRelativePath(item.id) === normalizeProjectRelativePath(nextFolderId)
    );

    if (existingSibling) {
      window.alert("A folder with that name already exists.");
      return;
    }

    const renameResult = renameVirtualFolderPath(liveData.folders || [], liveData.quests || [], folderId, cleanTitle);

    const nextData = {
      ...liveData,
      folders: renameResult.folders,
      quests: renameResult.quests,
    };

    dataRef.current = nextData;
    setData(nextData);
    setSelectedFolderId(renameResult.nextFolderId || null);

    setExpandedFolders((old) => {
      const next = {};
      for (const [key, value] of Object.entries(old || {})) {
        const normalized = normalizeProjectRelativePath(key);
        if (normalized === normalizeProjectRelativePath(folderId)) {
          next[renameResult.nextFolderId] = value;
        } else if (normalized.startsWith(`${normalizeProjectRelativePath(folderId)}/`)) {
          next[`${renameResult.nextFolderId}/${normalized.slice(normalizeProjectRelativePath(folderId).length + 1)}`] = value;
        } else {
          next[key] = value;
        }
      }
      next[renameResult.nextFolderId] = true;
      return next;
    });
  }

  async function deleteQuestFolder(folderId) {
    const liveData = dataRef.current || data;
    const folders = liveData.folders || [];
    const quests = liveData.quests || [];

    const hasChildren = folders.some((folder) => folder.parentId === folderId);
    const hasQuests = quests.some((quest) => quest.folderId === folderId);

    if (hasChildren || hasQuests) {
      window.alert("This folder is not empty. Move or remove its contents first.");
      return;
    }

    const confirmed = window.confirm("Delete this empty folder?");
    if (!confirmed) return;

    if (projectRootPath) {
      try {
        const parentFolderId = await deleteEmptyFolderInProject(projectRootPath, folderId);
        await loadQuestProjectFolder(projectRootPath, {
          activeFolderId: parentFolderId || null,
          expandedFolderIds: [parentFolderId].filter(Boolean),
        });
        return;
      } catch (error) {
        console.error("Could not delete quest folder.", error);
        const message = typeof error === "string"
          ? error
          : error?.message || "Unknown error.";
        window.alert(`Could not delete quest folder.\n\n${message}`);
        await loadQuestProjectFolder(projectRootPath, { activeFolderId: folderId });
        return;
      }
    }

    setDataWithProjectDirty((old) => ({
      ...old,
      folders: deleteQuestFolderFromList(old.folders || [], folderId),
    }));

    if (selectedFolderId === folderId) setSelectedFolderId(null);
  }

  async function moveQuestToFolder(questId, folderId) {
    if (projectRootPath) {
      try {
        const liveData = dataRef.current || data;
        const currentQuest = (liveData.quests || []).find((item) => item.id === questId);

        if (!currentQuest?.projectRelativePath) {
          console.warn("Could not move quest file because its project path is missing before save.", {
            questId,
            folderId,
            currentQuest,
          });
          window.alert("Could not move quest file because its project path is missing.");
          await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
          return;
        }

        if ((currentQuest.folderId || null) === (folderId || null)) {
          return;
        }

        // Save current in-memory progress/title/task state to disk before moving.
        await updateQuestFileInProject(
          projectRootPath,
          currentQuest.projectRelativePath,
          currentQuest
        );

        const sourceFileName = getProjectPathBaseName(currentQuest.projectRelativePath);
        const destinationRelativePath = joinProjectRelativePath(folderId || null, sourceFileName);
        const normalizedDestinationPath = normalizeProjectRelativePath(destinationRelativePath);

        // Ask the backend directly whether the destination path exists. This is more reliable
        // than trying to infer collision from the scanned quest list.
        const preflight = await checkQuestMoveDestinationInProject(
          projectRootPath,
          currentQuest.projectRelativePath,
          folderId || null
        );

        let overwrite = false;

        if (preflight?.exists && !preflight?.sameSource) {
          const confirmed = window.confirm(
            `A quest file already exists at the destination:\n\n${preflight.destinationRelativePath || normalizedDestinationPath}\n\nOverwrite it?`
          );

          if (!confirmed) return;

          overwrite = true;
        }

        let result = await moveQuestFileInProject(
          projectRootPath,
          currentQuest.projectRelativePath,
          folderId || null,
          overwrite
        );

        // Belt-and-suspenders: Rust can still return collision if the file appeared
        // between preflight and move, or if a platform-specific edge case occurs.
        if (result?.collision) {
          const confirmed = window.confirm(
            `A quest file already exists at the destination:\n\n${result.destinationRelativePath || normalizedDestinationPath}\n\nOverwrite it?`
          );

          if (!confirmed) return;

          result = await moveQuestFileInProject(
            projectRootPath,
            currentQuest.projectRelativePath,
            folderId || null,
            true
          );
        }

        await loadQuestProjectFolder(projectRootPath, {
          activeQuestId: result?.destinationRelativePath || normalizedDestinationPath,
        });

        if (folderId) {
          setExpandedFolders((old) => ({ ...old, [folderId]: true }));
        }

        return;
      } catch (error) {
        console.error("Could not move quest file.", error);
        window.alert("Could not move quest file.");
        await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
        return;
      }
    }

    setDataWithProjectDirty((old) => ({
      ...old,
      quests: moveQuestToFolderInList(old.quests || [], questId, folderId),
    }));
  }

  async function moveQuestFolderToFolder(folderId, parentId) {
    if (!folderId) return;

    const liveData = dataRef.current || data;
    const nextParentId = parentId || null;

    if (folderId === nextParentId) {
      window.alert("A folder cannot be moved into itself.");
      return;
    }

    if (nextParentId && isFolderDescendantInList(liveData.folders || [], nextParentId, folderId)) {
      window.alert("A folder cannot be moved into one of its own child folders.");
      return;
    }

    if (projectRootPath) {
      try {
        const movedFolderId = await moveFolderInProject(projectRootPath, folderId, nextParentId);
        await loadQuestProjectFolder(projectRootPath, {
          activeFolderId: movedFolderId || null,
          expandedFolderIds: [nextParentId, movedFolderId].filter(Boolean),
        });

        return;
      } catch (error) {
        console.error("Could not move quest folder.", error);
        window.alert("Could not move quest folder.");
        await loadQuestProjectFolder(projectRootPath);
        return;
      }
    }

    const moveResult = moveVirtualFolderPath(
      liveData.folders || [],
      liveData.quests || [],
      folderId,
      nextParentId
    );

    if (!moveResult.moved) {
      if (moveResult.reason === "folder-merge-risk") {
        window.alert("A folder with that name already exists at the destination.");
      }
      return;
    }

    const nextData = {
      ...liveData,
      folders: moveResult.folders,
      quests: moveResult.quests,
    };

    dataRef.current = nextData;
    setData(nextData);
    setSelectedFolderId(moveResult.nextFolderId || null);

    setExpandedFolders((old) => {
      const next = {};
      const oldPrefix = normalizeProjectRelativePath(folderId);
      const newPrefix = normalizeProjectRelativePath(moveResult.nextFolderId);

      for (const [key, value] of Object.entries(old || {})) {
        const normalized = normalizeProjectRelativePath(key);

        if (normalized === oldPrefix) {
          next[newPrefix] = value;
        } else if (normalized.startsWith(`${oldPrefix}/`)) {
          next[`${newPrefix}/${normalized.slice(oldPrefix.length + 1)}`] = value;
        } else {
          next[key] = value;
        }
      }

      if (nextParentId) next[nextParentId] = true;
      if (moveResult.nextFolderId) next[moveResult.nextFolderId] = true;

      return next;
    });
  }

  async function chooseQuestProjectFolder() {
    try {
      const selected = await chooseProjectRootDirectory();
      if (!selected) return;

      setProjectRootPath(selected);
      await loadQuestProjectFolder(selected);
    } catch (error) {
      console.error("Could not choose quest project folder.", error);
      window.alert("Could not choose quest project folder.");
    }
  }

  async function refreshQuestProjectFolder(rootPath = projectRootPath) {
    if (!rootPath) {
      window.alert("Choose a quest project folder first.");
      return;
    }

    await loadQuestProjectFolder(rootPath);
  }

  async function loadQuestProjectFolder(rootPath, options = {}) {
    try {
      const scanned = await scanQuestProjectDirectory(rootPath);
      const preferredActiveQuestId = options.activeQuestId || null;
      const preferredActiveQuestPath = options.activeQuestPath || null;
      const pathMatchedQuest = preferredActiveQuestPath
        ? scanned.quests.find((quest) =>
            quest.projectFilePath === preferredActiveQuestPath ||
            quest.projectRelativePath === preferredActiveQuestPath
          )
        : null;
      const nextActiveQuestId = pathMatchedQuest?.id ||
        (scanned.quests.some((quest) => quest.id === preferredActiveQuestId)
          ? preferredActiveQuestId
          : scanned.quests[0]?.id || null);

      const nextData = {
        ...dataRef.current,
        folders: scanned.folders,
        quests: scanned.quests,
        activeQuestId: nextActiveQuestId,
        activeBranchTaskId: null,
      };

      dataRef.current = nextData;
      setData(nextData);

      const nextSelectedFolderId = options.activeFolderId || null;
      const nextExpandedFolders = {};

      for (const folderId of options.expandedFolderIds || []) {
        if (folderId) nextExpandedFolders[folderId] = true;
      }

      setSelection({ type: nextActiveQuestId ? "quest" : "none", id: nextActiveQuestId });
      setHistory([{ type: nextActiveQuestId ? "quest" : "none", id: nextActiveQuestId }]);
      setHistoryIndex(0);
      setFocusHistory([{ questId: nextActiveQuestId, branchTaskId: null }]);
      setFocusHistoryIndex(0);
      setSelectedFolderId(nextSelectedFolderId);
      setExpandedFolders(nextExpandedFolders);
      setExpanded({});
      setExpandedKanbanCards({});

      const errorText = scanned.errors.length > 0
        ? `, ${scanned.errors.length} file error(s)`
        : "";

      setProjectLoadSummary(
        `Loaded ${scanned.quests.length} quest(s), ${scanned.folders.length} folder(s)${errorText}.`
      );

      if (scanned.errors.length > 0) {
        console.warn("Quest project loaded with errors.", scanned.errors);
      }
    } catch (error) {
      console.error("Could not load quest project folder.", error);
      window.alert("Could not load quest project folder.");
    }
  }



function createQuestTask(questId, parentId = null) {
    const task = makeTask({ title: "New Task" });

    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              status: "active",
              completedAt: "",
              rootTask: {
                ...quest.rootTask,
                completed: false,
                children: addTaskToTree(quest.rootTask?.children || [], parentId, task),
              },
            }
          : quest
      ),
    }));

    const questRootId = quests.find((quest) => quest.id === questId)?.rootTask?.id || null;
    const expandedId = parentId || questRootId;
    if (expandedId) setExpanded((old) => ({ ...old, [expandedId]: true }));
    setSelection({ type: "task", questId, id: task.id });
  }


async function deleteQuest(questId) {
    if (projectRootPath) {
      const liveData = dataRef.current || data;
      const quest = (liveData.quests || []).find((item) => item.id === questId);

      if (!quest) return;

      if (!quest.projectRelativePath) {
        console.warn("Could not delete quest file because its project path is missing.", {
          questId,
          quest,
        });
        window.alert("Could not delete quest file because its project path is missing.");
        await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
        return;
      }

      const confirmed = window.confirm(
        `Delete this quest file?

${quest.projectRelativePath}

This removes the file from the project folder.`
      );

      if (!confirmed) return;

      try {
        const parentFolderId = await deleteQuestFileInProject(
          projectRootPath,
          quest.projectRelativePath
        );

        await loadQuestProjectFolder(projectRootPath, {
          activeFolderId: parentFolderId || quest.folderId || null,
          expandedFolderIds: [parentFolderId || quest.folderId].filter(Boolean),
        });
        return;
      } catch (error) {
        console.error("Could not delete quest file.", error);
        const message = typeof error === "string"
          ? error
          : error?.message || "Unknown error.";
        window.alert(`Could not delete quest file.

${message}`);
        await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
        return;
      }
    }

    setDataWithProjectDirty((old) => {
      const quests = old.quests.filter((quest) => quest.id !== questId);
      return {
        ...old,
        quests,
        activeQuestId: old.activeQuestId === questId ? quests[0]?.id || null : old.activeQuestId,
        activeBranchTaskId: old.activeQuestId === questId ? null : old.activeBranchTaskId,
      };
    });

    setSelection({ type: "none" });
  }


async function renameQuestFile(questId, nextBaseName) {
    const cleanBaseName = String(nextBaseName || "").trim();
    if (!projectRootPath || !cleanBaseName) return;
    const liveData = dataRef.current || data;
    const quest = (liveData.quests || []).find((item) => item.id === questId);
    if (!quest) return;
    if (!quest.projectRelativePath) {
      window.alert("Could not rename quest file because its project path is missing.");
      await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
      return;
    }
    try {
      await updateQuestFileInProject(projectRootPath, quest.projectRelativePath, quest);
      const renamedPath = await renameQuestFileInProject(projectRootPath, quest.projectRelativePath, `${cleanBaseName}.quest.json`);
      await loadQuestProjectFolder(projectRootPath, {
        activeQuestPath: renamedPath,
        expandedFolderIds: [getProjectPathParent(renamedPath)].filter(Boolean),
      });
    } catch (error) {
      console.error("Could not rename quest file.", error);
      const message = typeof error === "string" ? error : error?.message || "Unknown error.";
      window.alert(`Could not rename quest file.\n\n${message}`);
      await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
    }
  }


async function saveQuestFile(questId) {
    if (!projectRootPath) return;

    const liveData = dataRef.current || data;
    const quest = (liveData.quests || []).find((item) => item.id === questId);

    if (!quest) return;

    await queueQuestFileSnapshotSave(quest, { silent: false });
  }


function deleteQuestTask(questId, taskId) {
    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              status: "active",
              completedAt: "",
              rootTask: {
                ...quest.rootTask,
                completed: false,
                children: deleteTaskFromTree(quest.rootTask?.children || [], taskId),
              },
            }
          : quest
      ),
    }));

    setSelection({ type: "quest", id: questId });
  }


function moveQuestTask(questId, taskId, direction) {
    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              rootTask: {
                ...quest.rootTask,
                children: moveTaskInTree(quest.rootTask?.children || [], taskId, direction),
              },
            }
          : quest
      ),
    }));
  }


function moveQuestTaskToLocation(questId, sourceTaskId, targetTaskId, placement) {
    if (!questId || !sourceTaskId || !targetTaskId) return;

    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;
        if (quest.locked) return quest;

        const rootTask = quest.rootTask || {};
        const moveResult = moveTaskToTreeLocation(
          rootTask.children || [],
          sourceTaskId,
          targetTaskId,
          placement,
          { rootId: rootTask.id }
        );

        if (!moveResult.moved) {
          console.warn("[Tree rearrange] quest move rejected during mutation", {
            questId,
            sourceTaskId,
            targetTaskId,
            placement,
            reason: moveResult.reason,
          });
          return quest;
        }

        return {
          ...quest,
          status: "active",
          completedAt: "",
          rootTask: {
            ...rootTask,
            completed: false,
            children: moveResult.tasks,
          },
        };
      }),
    }));

    if (placement === "inside" || placement === "first-child") {
      setExpanded((old) => ({ ...old, [targetTaskId]: true }));
    }

    setSelection({ type: "task", questId, id: sourceTaskId });
  }


function toggleTask(questId, taskId) {
    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;

        const rootTask = quest.rootTask;
        if (!rootTask) return quest;

        if (rootTask.id === taskId) {
          if (!isTaskComplete(rootTask) && !isTaskReadyToComplete(rootTask)) return quest;

          const completed = !isTaskComplete(rootTask);
          return {
            ...quest,
            status: completed ? "completed" : "active",
            completedAt: completed ? getAppDate() : "",
            rootTask: {
              ...rootTask,
              completed,
              countProgress: 0,
            },
          };
        }

        let nextCompleted = null;
        let children = updateQuestTree(rootTask.children || [], taskId, (task) => {
          const taskChildren = task.children || [];
          if (taskChildren.length > 0 && !areTaskChildrenComplete(task)) return task;

          if (hasCountTarget(task) && !task.completed) {
            const { target, progress } = getCountProgress(task);

            if (progress < target) {
              nextCompleted = null;
              return {
                ...task,
                countProgress: Math.min(target, progress + 1),
                completed: false,
              };
            }

            nextCompleted = true;
            return {
              ...task,
              completed: true,
              countProgress: target,
            };
          }

          nextCompleted = !task.completed;
          return {
            ...task,
            completed: nextCompleted,
            countProgress: nextCompleted ? getCountProgress(task).progress : 0,
          };
        });

        if (nextCompleted === false) {
          children = clearAncestorCompletionById(children, taskId);
        }

        return {
          ...quest,
          status: "active",
          completedAt: "",
          rootTask: {
            ...rootTask,
            completed: false,
            children,
          },
        };
      }),
    }));
  }

  
function uncompleteTask(questId, taskId) {
    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;

        const rootTask = quest.rootTask;
        if (!rootTask) return quest;

        if (rootTask.id === taskId) {
          return {
            ...quest,
            status: "active",
            completedAt: "",
            rootTask: resetTaskSubtree(rootTask),
          };
        }

        const resetTasksForTarget = updateQuestTree(rootTask.children || [], taskId, (task) => resetTaskSubtree(task));
        const children = clearAncestorCompletionById(resetTasksForTarget, taskId);

        return {
          ...quest,
          status: "active",
          completedAt: "",
          rootTask: {
            ...rootTask,
            completed: false,
            children,
          },
        };
      }),
    }));
  }

  function makeFocus(questId) {
    applyFocusTarget({ questId, branchTaskId: null });
  }

  function setBranchFocus(taskId) {
    applyFocusTarget({ questId: activeQuest?.id || data.activeQuestId || null, branchTaskId: taskId });
  }

  function clearBranchFocus() {
    applyFocusTarget({ questId: activeQuest?.id || data.activeQuestId || null, branchTaskId: null });
  }

  
function completeQuest(questId) {
    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;
        if (!isQuestReadyToComplete(quest)) return quest;

        return {
          ...quest,
          status: "completed",
          completedAt: getAppDate(),
          rootTask: {
            ...quest.rootTask,
            completed: true,
          },
        };
      }),
    }));
  }

  
function restoreQuest(questId) {
    setDataWithProjectDirtyAndAutosaveQuest(questId, (old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              status: "active",
              completedAt: "",
              rootTask: resetTaskSubtree(quest.rootTask),
            }
          : quest
      ),
    }));
  }

  async function exportJson() {
    try {
      const date = todayString();
      await downloadJsonFile(makeAllDataExport(data), `quest-planner-${date}.json`);
    } catch (error) {
      console.error("Could not export planner data.", error);
      window.alert("Could not export planner data.");
    }
  }

  async function exportQuestFile(quest = activeQuest) {
    if (!quest) return;

    try {
      const date = todayString();
      const filename = `${slugifyFilename(quest.title)}-${date}.quest.json`;
      await downloadJsonFile(makeQuestFileExport(quest), filename);
    } catch (error) {
      console.error("Could not export quest file.", error);
      window.alert("Could not export quest file.");
    }
  }

  async function importQuestFile(file) {
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const rawQuest = rawQuestFromQuestPayload(parsed);
      const normalized = normalizeData({ quests: [rawQuest] });
      const importedQuest = normalized.quests[0];

      if (!importedQuest) throw new Error("No quest found in file.");

      setDataWithProjectDirty((old) => {
        const existing = (old.quests || []).some((quest) => quest.id === importedQuest.id);
        const questForFolder = {
          ...importedQuest,
          folderId: selectedFolderId || importedQuest.folderId || null,
        };

        const quests = existing
          ? old.quests.map((quest) => (quest.id === importedQuest.id ? questForFolder : quest))
          : [questForFolder, ...(old.quests || [])];

        const nextData = {
          ...old,
          quests,
          activeQuestId: importedQuest.id,
          activeBranchTaskId: null,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
        localStorage.setItem(LAST_TICK_KEY, todayString());
        return nextData;
      });

      setSelection({ type: "quest", id: importedQuest.id });
      setHistory([{ type: "quest", id: importedQuest.id }]);
      setHistoryIndex(0);
      setFocusHistory([{ questId: importedQuest.id, branchTaskId: null }]);
      setFocusHistoryIndex(0);
      setSelectedFolderId(selectedFolderId || null);
      setExpandedFolders((old) => selectedFolderId ? { ...old, [selectedFolderId]: true } : old);
      setExpanded({});
      setExpandedKanbanCards({});
    } catch (error) {
      window.alert("Could not load that quest file. It may not be a valid quest scene export.");
    }
  }



async function importJsonFile(file) {
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const rawData = rawDataFromPlannerPayload(parsed);
      const imported = runDailyMaintenance(normalizeData(rawData));

      setData(imported);
      const importedFocusQuestId = imported.activeQuestId || imported.quests[0]?.id || null;
      setSelection({ type: "quest", id: importedFocusQuestId });
      setHistory([{ type: "quest", id: importedFocusQuestId }]);
      setHistoryIndex(0);
      setFocusHistory([{ questId: importedFocusQuestId, branchTaskId: imported.activeBranchTaskId || null }]);
      setFocusHistoryIndex(0);
      setSelectedFolderId(null);
      setExpandedFolders({});
      setExpanded({});
      setExpandedKanbanCards({});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      localStorage.setItem(LAST_TICK_KEY, todayString());
    } catch (error) {
      window.alert("Could not load that JSON file. It may not be a valid quest planner export.");
    }
  }

  function resetToDefaults() {
    const confirmed = window.confirm("Reset all quests to the default state? This clears the saved app data in this browser.");
    if (!confirmed) return;

    const resetData = runDailyMaintenance(normalizeData(seedData));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_TICK_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetData));
    localStorage.setItem(LAST_TICK_KEY, todayString());

    setData(resetData);
    const resetFocusQuestId = resetData.activeQuestId || resetData.quests[0]?.id || null;
    setSelection({ type: "quest", id: resetFocusQuestId });
    setHistory([{ type: "quest", id: resetFocusQuestId }]);
    setHistoryIndex(0);
    setFocusHistory([{ questId: resetFocusQuestId, branchTaskId: null }]);
    setFocusHistoryIndex(0);
    setSelectedFolderId(null);
    setExpandedFolders({});
    setExpanded({});
    setExpandedKanbanCards({});
  }

  function runMaintenanceNow() {
    runMaintenanceForDate();
  }

  function dueBadge(item) {
    const today = getAppDate();
    if (!item?.deadline) return null;
    if (item.deadline < today) return <span className="badge bg-red-950 text-red-200">Overdue</span>;
    if (item.deadline === today) return <span className="badge bg-amber-950 text-amber-200">Today</span>;
    return <span className="badge bg-neutral-800 text-neutral-300">Due {item.deadline}</span>;
  }

  function beginLeftPanelDrag(event) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = leftPanelWidth;

    function onMove(moveEvent) {
      const delta = moveEvent.clientX - startX;
      const next = Math.min(520, Math.max(240, startWidth + delta));
      setLeftPanelWidth(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function beginRightPanelDrag(event) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = rightPanelWidth;

    function onMove(moveEvent) {
      const delta = startX - moveEvent.clientX;
      const next = Math.min(620, Math.max(320, startWidth + delta));
      setRightPanelWidth(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="h-screen overflow-hidden bg-neutral-950 p-4 text-neutral-100">
      <div className="app-root">
        <LibraryPanel
          panelWidth={leftPanelWidth}
          tab={libraryTab}
          setTab={setLibraryTab}
          search={search}
          setSearch={setSearch}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          allTags={allTags}
          hideCompleted={hideCompleted}
          setHideCompleted={setHideCompleted}
          showDisabled={showDisabled}
          setShowDisabled={setShowDisabled}
          quests={filteredQuests}
          folders={data.folders || []}
          activeQuestId={data.activeQuestId}
          selectedFolderId={selectedFolderId}
          setSelectedFolderId={setSelectedFolderId}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
          dueBadge={dueBadge}
          createQuest={createQuest}
          createQuestFolder={createQuestFolder}
          renameQuestFolder={renameQuestFolder}
          deleteQuestFolder={deleteQuestFolder}
          moveQuestToFolder={moveQuestToFolder}
          moveQuestFolderToFolder={moveQuestFolderToFolder}
          exportJson={exportJson}
          importJsonFile={importJsonFile}
          exportQuestFile={exportQuestFile}
          importQuestFile={importQuestFile}
          hasActiveQuest={Boolean(activeQuest)}
          resetToDefaults={resetToDefaults}
          selectQuest={(quest) => {
            makeFocus(quest.id);
            setSelection({ type: "quest", id: quest.id });
          }}
          projectRootPath={projectRootPath}
          projectLoadSummary={projectLoadSummary}
          chooseQuestProjectFolder={chooseQuestProjectFolder}
          refreshQuestProjectFolder={refreshQuestProjectFolder}
        />

        <div
          className="column-splitter"
          onPointerDown={beginLeftPanelDrag}
          title="Drag to resize Library"
        />

        <CenterDock
          activePanelId={centerTab}
          setActivePanelId={setCenterTab}
          quest={activeQuest}
          focusBoard={focusBoard}
          focusPathInfo={focusPathInfo}
          goFocusBack={goFocusBack}
          goFocusForward={goFocusForward}
          canFocusGoBack={focusHistoryIndex > 0}
          canFocusGoForward={focusHistoryIndex < focusHistory.length - 1}
          setBranchFocus={setBranchFocus}
          clearBranchFocus={clearBranchFocus}
          selectQuest={(quest) => {
            setSelection({ type: "quest", id: quest.id });
          }}
          selectTask={(task) => setSelection({ type: "task", questId: activeQuest.id, id: task.id })}
          toggleTask={(rowOrTask) => {
            const task = rowOrTask.task || rowOrTask;
            return isQuestCompletionRow(rowOrTask)
              ? completeQuest(activeQuest.id)
              : toggleTask(activeQuest.id, task.id);
          }}
          uncompleteTask={(rowOrTask) => {
            const task = rowOrTask.task || rowOrTask;
            return isQuestCompletionRow(rowOrTask)
              ? restoreQuest(activeQuest.id)
              : uncompleteTask(activeQuest.id, task.id);
          }}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
        />


        <div
          className="column-splitter"
          onPointerDown={beginRightPanelDrag}
          title="Drag to resize Inspector / Tree column"
        />
        <RightPanel
          panelWidth={rightPanelWidth}
          topRightTab={topRightTab}
          setTopRightTab={setTopRightTab}
          bottomRightTab={bottomRightTab}
          setBottomRightTab={setBottomRightTab}
          selection={selection}
          data={data}
          setData={setDataWithProjectDirtyAndAutosaveSelection}
          setSelection={setSelection}
          allTags={allTags}
          activeQuest={activeQuest}
          expanded={expanded}
          setExpanded={setExpanded}
          rightSplit={rightSplit}
          setRightSplit={setRightSplit}
          goBack={goBack}
          goForward={goForward}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < history.length - 1}
          makeFocus={makeFocus}
          activeQuestId={data.activeQuestId}
          activeBranchTaskId={data.activeBranchTaskId}
          setBranchFocus={setBranchFocus}
          clearBranchFocus={clearBranchFocus}
          completeQuest={completeQuest}
          restoreQuest={restoreQuest}
          createQuestTask={createQuestTask}
          deleteQuest={deleteQuest}
          renameQuestFile={renameQuestFile}
          saveQuestFile={saveQuestFile}
          deleteQuestTask={deleteQuestTask}
          moveQuestTask={moveQuestTask}
          moveQuestTaskToLocation={moveQuestTaskToLocation}
          toggleTask={toggleTask}
          runMaintenanceNow={runMaintenanceNow}
          debugDateOverrideEnabled={debugDateOverrideEnabled}
          setDebugDateOverrideEnabled={setDebugDateOverrideEnabled}
          debugDateOverrideDate={debugDateOverrideDate}
          setDebugDateOverrideDate={setDebugDateOverrideDate}
          currentAppDate={getAppDate()}
        />
      </div>

      <DarkStyles />
    </div>
  );
}

function LibraryPanel({
  panelWidth,
  tab,
  setTab,
  search,
  setSearch,
  tagFilter,
  setTagFilter,
  allTags,
  hideCompleted,
  setHideCompleted,
  showDisabled,
  setShowDisabled,
  quests,
  folders,
  activeQuestId,
  selectedFolderId,
  setSelectedFolderId,
  expandedFolders,
  setExpandedFolders,
  dueBadge,
  createQuest,
  createQuestFolder,
  renameQuestFolder,
  deleteQuestFolder,
  moveQuestToFolder,
  moveQuestFolderToFolder,
  exportJson,
  importJsonFile,
  exportQuestFile,
  importQuestFile,
  hasActiveQuest,
  resetToDefaults,
  selectQuest,
  projectRootPath,
  projectLoadSummary,
  chooseQuestProjectFolder,
  refreshQuestProjectFolder,
}) {
  const tabs = [
    {
      id: PANEL_IDS.QUEST_BOARD,
      title: "Quest Board",
      content: (
        <QuestBoardTab
          search={search}
          setSearch={setSearch}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          allTags={allTags}
          hideCompleted={hideCompleted}
          setHideCompleted={setHideCompleted}
          showDisabled={showDisabled}
          setShowDisabled={setShowDisabled}
          quests={quests}
          folders={folders}
          activeQuestId={activeQuestId}
          selectedFolderId={selectedFolderId}
          setSelectedFolderId={setSelectedFolderId}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
          dueBadge={dueBadge}
          createQuest={createQuest}
          createQuestFolder={createQuestFolder}
          renameQuestFolder={renameQuestFolder}
          deleteQuestFolder={deleteQuestFolder}
          moveQuestToFolder={moveQuestToFolder}
          moveQuestFolderToFolder={moveQuestFolderToFolder}
          selectQuest={selectQuest}
          projectRootPath={projectRootPath}
          projectLoadSummary={projectLoadSummary}
          chooseQuestProjectFolder={chooseQuestProjectFolder}
          refreshQuestProjectFolder={refreshQuestProjectFolder}
        />
      ),
    },
    {
      id: PANEL_IDS.EXPORT_PANEL,
      title: "Save/Load",
      content: (
        <ExportOptionsTab
          exportJson={exportJson}
          importJsonFile={importJsonFile}
          exportQuestFile={exportQuestFile}
          importQuestFile={importQuestFile}
          hasActiveQuest={hasActiveQuest}
          resetToDefaults={resetToDefaults}
        />
      ),
    },
  ];

  return (
    <DockContainer
      dockId={DOCK_IDS.TOP_LEFT}
      tabs={tabs}
      activePanelId={tab}
      onActivePanelChange={setTab}
      className="library-col"
      style={{ flexBasis: `${panelWidth}px` }}
    />
  );
}


function CenterDock({ activePanelId, setActivePanelId, ...focusProps }) {
  const focusPanelId = PANEL_IDS.FOCUS_PANEL || "focusPanel";
  const tabs = [
    {
      id: focusPanelId,
      title: "Focus",
      content: <FocusTab {...focusProps} />,
    },
  ];

  return (
    <DockContainer
      dockId={DOCK_IDS.CENTER || "center"}
      tabs={tabs}
      activePanelId={activePanelId}
      onActivePanelChange={setActivePanelId}
      panelClassName="center-dock-wrapper"
    />
  );
}

function TopRightDock({ activePanelId, setActivePanelId, rightSplit, inspectorProps, debugProps }) {
  const tabs = [
    {
      id: PANEL_IDS.INSPECTOR_PANEL,
      title: "Inspector",
      content: <InspectorTab {...inspectorProps} embedded />,
    },
    {
      id: PANEL_IDS.DEBUG_PANEL,
      title: "Debug",
      content: <DebugTab {...debugProps} />,
    },
  ];

  return (
    <DockContainer
      dockId={DOCK_IDS.TOP_RIGHT}
      tabs={tabs}
      activePanelId={activePanelId}
      onActivePanelChange={setActivePanelId}
      panelClassName="top-right-dock-wrapper"
      style={{ flexBasis: `calc(${rightSplit}% - ${RIGHT_DOCK_SPLIT_RESERVE})` }}
    />
  );
}


function BottomRightDock({
  activePanelId,
  setActivePanelId,
  rightSplit,
  treePanelProps,
}) {
  const tabs = [
    {
      id: PANEL_IDS.TREE_VIEW_PANEL,
      title: "Tree View",
      content: <TreeViewTab {...treePanelProps} embedded />,
    },
  ];

  return (
    <DockContainer
      dockId={DOCK_IDS.BOTTOM_RIGHT}
      tabs={tabs}
      activePanelId={activePanelId}
      onActivePanelChange={setActivePanelId}
      panelClassName="bottom-right-dock-wrapper"
      style={{ flexBasis: `calc(${100 - rightSplit}% - ${RIGHT_DOCK_SPLIT_RESERVE})` }}
    />
  );
}

function RightPanel(props) {
  const {
    panelWidth,
    topRightTab,
    setTopRightTab,
    bottomRightTab,
    setBottomRightTab,
    selection,
    data,
    activeQuest,
    expanded,
    setExpanded,
    rightSplit,
    setRightSplit,
    setSelection,
    createQuestTask,
    deleteQuestTask,
    moveQuestTask,
    moveQuestTaskToLocation,
    toggleTask,
    runMaintenanceNow,
    debugDateOverrideEnabled,
    setDebugDateOverrideEnabled,
    debugDateOverrideDate,
    setDebugDateOverrideDate,
    currentAppDate,
  } = props;

  const treeContext = getTreeContext(selection, data, activeQuest);
  const rightColumnRef = useRef(null);

  function beginRightSplitDrag(event) {
    event.preventDefault();

    const startY = event.clientY;
    const startSplit = rightSplit;
    const rect = rightColumnRef.current?.getBoundingClientRect();
    const totalHeight = rect?.height || 1;

    function onMove(moveEvent) {
      const delta = moveEvent.clientY - startY;
      const deltaPercent = (delta / totalHeight) * 100;
      const next = Math.min(82, Math.max(28, startSplit + deltaPercent));
      setRightSplit(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <aside className="right-column" ref={rightColumnRef} style={{ flexBasis: `${panelWidth}px` }}>
      <TopRightDock
        activePanelId={topRightTab}
        setActivePanelId={setTopRightTab}
        rightSplit={rightSplit}
        inspectorProps={props}
        debugProps={{
          debugDateOverrideEnabled,
          setDebugDateOverrideEnabled,
          debugDateOverrideDate,
          setDebugDateOverrideDate,
          currentAppDate,
          runMaintenanceNow,
        }}
      />

      <div
        className="right-splitter"
        onPointerDown={beginRightSplitDrag}
        title="Drag to resize Inspector / Tree View"
      />

      <BottomRightDock
        activePanelId={bottomRightTab}
        setActivePanelId={setBottomRightTab}
        rightSplit={rightSplit}
        treePanelProps={{
          treeContext,
          rightSplit,
          selection,
          expanded,
          setExpanded,
          setSelection,
          createQuestTask,
                deleteQuestTask,
                moveQuestTask,
                moveQuestTaskToLocation,
                toggleTask,
        }}
      />
    </aside>
  );
}

function DarkStyles() {
  const USE_DEBUG_COLOR = false;
  const DEBUG_GREEN = "rgb(58 110 78)";
  const TAB_CONTENT_COLOR = USE_DEBUG_COLOR ? DEBUG_GREEN : "rgb(30 30 30)";
  const SCENE_CONTENTS_PANEL_COLOR = USE_DEBUG_COLOR ? "rgb(76 128 94)" : "rgba(0, 0, 0, 0.55)";
  const SCENE_SCROLL_BUFFER = "32px";
  const SCENE_SCROLL_GUTTER = "4px";
  const TREE_BRANCH_LINE_COLOR = "rgb(120 120 120)";
  const QUEST_DIRECTORY_ROW_STATE_BACKGROUND = "rgba(59, 130, 246, 0.18)";
  const QUEST_DIRECTORY_ROW_SELECTED_BORDER = "rgba(255, 255, 255, 0.82)";

  // Tab scene layout contract:
  // 1. TabContainer owns the tab bar, active tab color, content area panel, and 4px content padding.
  // 2. Tab scene roots should be plain layout containers, not panel surfaces.
  // 3. Most tab scenes should use a header/toolbar section plus a contents section.
  // 4. Contents sections should use .scene-contents-panel > .scene-contents-margin > scene-specific content.
  // 5. SCENE_CONTENTS_PANEL_COLOR is the shared body/contents panel color for tab scenes.
  // 6. SCENE_SCROLL_BUFFER is a shared value, but should only be applied by scenes that need extra bottom scroll room.
  // 7. SCENE_SCROLL_GUTTER adds extra right padding between content and the scrollbar.
  // 8. TREE_BRANCH_LINE_COLOR keeps tree branch connector lines easy to tune without hunting through CSS.
  // 9. Contents margins own vertical scrolling; scene-specific content sits inside that scroll area.

  return (
    <style>{`
      html, body, #root {
        height: 100%;
        margin: 0;
        overflow: hidden;
      }
      * {
        box-sizing: border-box;
      }
      .app-root {
        height: 100%;
        display: flex;
        gap: 0.35rem;
        overflow: hidden;
      }
      .column-splitter {
        flex: 0 0 0.45rem;
        cursor: col-resize;
        border: 1px solid transparent;
        background: rgb(23 23 23);
      }
      .column-splitter:hover {
        border-color: rgb(82 82 82);
        background: rgb(38 38 38);
      }
      .column-splitter::before {
        content: "";
        display: block;
        width: 1px;
        height: 3rem;
        margin: 2rem auto 0;
        background: rgb(82 82 82);
      }
      .panel {
        border-radius: 0.25rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(23 23 23);
        padding: 0;
        box-shadow: 0 20px 40px rgb(0 0 0 / 0.18);
        min-height: 0;
      }
      .panel-title-bar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        min-height: 1.55rem;
        border-bottom: 1px solid rgb(38 38 38);
        border-radius: 0.35rem 0.35rem 0 0;
        background: rgb(38 38 38);
        padding: 0.25rem 0.75rem;
      }
      .panel-title-text {
        font-size: 0.9rem;
        font-weight: 800;
        color: rgb(229 229 229);
      }
      .tab-container {
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .tab-container-bar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        align-items: stretch;
        justify-content: flex-start;
        gap: 0.25rem;
        min-height: 2.15rem;
        border-bottom: 1px solid rgb(64 64 64);
        border-radius: 0.35rem 0.35rem 0 0;
        background: rgb(38 38 38);
        padding: 0.25rem 0.35rem 0;
      }
      .tab-container-tab {
        align-self: stretch;
        display: inline-flex;
        align-items: center;
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 0.28rem 0.28rem 0 0;
        padding: 0.25rem 0.8rem;
        font-size: 0.85rem;
        font-weight: 800;
        color: rgb(163 163 163);
      }
      .tab-container-tab:hover {
        background: rgb(64 64 64);
        color: rgb(229 229 229);
      }
      .tab-container-tab-active {
        border-color: rgb(64 64 64);
        background: ${TAB_CONTENT_COLOR};
        color: rgb(245 245 245);
      }
      .tab-container-content {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        overflow: hidden;
        border: 1px solid rgb(64 64 64);
        border-top: none;
        border-radius: 0 0 0.35rem 0.35rem;
        background: ${TAB_CONTENT_COLOR};
        padding: 4px;
      }
      .tab-scene-root {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .tab-scene-margin {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0;
      }
      .scene-contents-panel {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
        border: none;
        border-radius: 0.28rem;
        background: ${SCENE_CONTENTS_PANEL_COLOR};
      }
      .scene-contents-margin {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
        padding: 4px;
        padding-right: calc(4px + ${SCENE_SCROLL_GUTTER});
        scrollbar-gutter: stable;
      }
      .focus-main-margin {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
        padding: 0;
      }
      .focus-main-vbox {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow: hidden;
      }
      .focus-toolbar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-height: 1.7rem;
        padding: 0;
      }
      .focus-toolbar-section,
      .focus-toolbar-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-width: 0;
      }
      .focus-contents-margin {
        padding-left: 32px;
        padding-right: calc(32px + ${SCENE_SCROLL_GUTTER});
        padding-top: 8px;
        padding-bottom: 8px;
      }
      .scene-contents-scroll {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-gutter: stable;
      }
      .library-scene {
        display: block;
      }
      .quest-board-root {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow: hidden;
      }
      .quest-board-toolbar {
        flex: 0 0 auto;
        display: grid;
        gap: 0.75rem;
        min-width: 0;
      }
      .quest-board-contents-panel {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
      .quest-board-contents-margin {
        display: block;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px;
        padding-right: calc(4px + ${SCENE_SCROLL_GUTTER});
        scrollbar-gutter: stable;
      }
      .quest-directory-toolbar-row {
        display: flex;
        gap: 0.4rem;
      }
      .quest-directory-toolbar-row > button {
        flex: 1 1 0;
      }
      .quest-directory-create-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        border-radius: 0.35rem;
        background: rgb(229 229 229);
        padding: 0.32rem 0.5rem;
        font-size: 0.78rem;
        font-weight: 800;
        color: rgb(23 23 23);
      }
      .quest-directory-create-button:hover {
        background: white;
      }
      .quest-directory-project-row {
        display: flex;
        gap: 0.4rem;
      }
      .quest-directory-project-button {
        flex: 1 1 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.35rem;
        background: rgb(23 23 23);
        border: 1px solid rgb(64 64 64);
        padding: 0.28rem 0.45rem;
        font-size: 0.74rem;
        font-weight: 800;
        color: rgb(229 229 229);
      }
      .quest-directory-project-button:hover {
        background: rgb(38 38 38);
      }
      .quest-directory-project-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .quest-directory-project-status {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
        overflow: hidden;
        border-radius: 0.3rem;
        border: 1px solid rgb(38 38 38);
        background: rgba(0, 0, 0, 0.22);
        padding: 0.3rem 0.45rem;
        font-size: 0.68rem;
        font-weight: 700;
        color: rgb(163 163 163);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .quest-directory-project-status span {
        color: rgb(212 212 212);
      }
      .quest-directory-tree {
        position: relative;
        display: grid;
        align-content: start;
        gap: 2px;
        width: 100%;
        min-width: 0;
      }

      .quest-directory-rearrange .quest-directory-item {
        cursor: default;
      }

      .quest-directory-rearrange .quest-directory-item:hover {
        box-shadow: none !important;
      }
      .quest-directory-drop-overlay {
        position: absolute;
        pointer-events: none;
        z-index: 20;
      }
      .quest-directory-drop-overlay-boundary {
        height: 2px;
        border-radius: 999px;
        background: rgba(96, 165, 250, 0.9);
        box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.45);
        transform: translateY(-1px);
      }
      .quest-directory-drop-overlay-inside {
        border-radius: 0.25rem;
        border: 2px solid rgba(96, 165, 250, 0.85);
        background: transparent;
        box-shadow: none;
      }
      .quest-directory-section {
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      .quest-directory-folder {
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      .quest-directory-row-wrap {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        min-width: 0;
        width: 100%;
      }
      .quest-directory-disclosure-gutter {
        flex: 0 0 var(--quest-directory-row-gutter);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 1.65rem;
      }
      .quest-directory-folder-row {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        min-width: 0;
        min-height: 1.55rem;
        border-radius: 0.25rem;
        border: 1px solid transparent;
        background: rgba(23, 23, 23, 0.65);
        padding: 0.12rem 0.25rem;
      }
      .quest-directory-item.quest-directory-folder-selected,
      .quest-directory-item.quest-directory-quest-selected {
        border-color: ${QUEST_DIRECTORY_ROW_SELECTED_BORDER};
        background: ${QUEST_DIRECTORY_ROW_STATE_BACKGROUND};
      }
      .quest-directory-folder-main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        text-align: left;
      }
      .quest-directory-folder-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.86rem;
        font-weight: 800;
        color: rgb(229 229 229);
      }
      .quest-directory-folder-count {
        flex: 0 0 auto;
        border-radius: 999px;
        background: rgb(64 64 64);
        padding: 0.04rem 0.35rem;
        font-size: 0.68rem;
        font-weight: 850;
        color: rgb(212 212 212);
      }
      .quest-directory-folder-actions {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
      }

      .quest-directory-children {
        --quest-directory-branch-color: ${TREE_BRANCH_LINE_COLOR};
        --quest-directory-branch-left: -4px;
        --quest-directory-elbow-width: 8px;
        --quest-directory-row-gutter: 1.05rem;
        --quest-directory-row-gap: 0.25rem;
        display: grid;
        gap: 2px;
        margin-left: 0.65rem;
        padding-left: 0.25rem;
        border-left: none;
        position: relative;
        width: calc(100% - 0.65rem);
        min-width: 0;
      }
      .quest-directory-branch-node {
        position: relative;
        --branch-center: 0.825rem;
      }
      .quest-directory-folder-branch-node {
        --branch-center: 0.825rem;
      }
      .quest-directory-quest-branch-node {
        --branch-center: 0.825rem;
      }
      .quest-directory-branch-node::before {
        content: "";
        position: absolute;
        left: var(--quest-directory-branch-left);
        top: var(--branch-center);
        width: var(--quest-directory-elbow-width);
        height: 2px;
        background: var(--quest-directory-branch-color);
        opacity: 1;
        pointer-events: none;
      }
      .quest-directory-branch-node::after {
        content: "";
        position: absolute;
        left: var(--quest-directory-branch-left);
        top: -2px;
        bottom: calc(100% - var(--branch-center) - 1px);
        width: 2px;
        background: var(--quest-directory-branch-color);
        opacity: 1;
        pointer-events: none;
      }
      .quest-directory-children > .quest-directory-branch-node:not(:last-child)::after {
        bottom: -2px;
      }
      .quest-directory-children > .quest-directory-branch-node:not(:last-child)::marker {
        display: none;
      }
      .quest-directory-inbox-row {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        min-height: 1.55rem;
        border-radius: 0.25rem;
        border: 1px solid transparent;
        background: rgba(23, 23, 23, 0.65);
        padding: 0.12rem 0.25rem;
      }

      .quest-directory-quest-card {
        width: 100%;
        position: relative;
        display: flex;
        align-items: flex-start;
        padding-left: calc(var(--quest-directory-row-gutter) + var(--quest-directory-row-gap) + 4px);
      }
      .quest-directory-item {
        width: 100%;
        min-width: 0;
        border-radius: 0.3rem;
        border: 1px solid transparent;
        transition: border-color 120ms ease, background 120ms ease, opacity 120ms ease;
      }
      .quest-directory-normal .quest-directory-item:hover {
        background: ${QUEST_DIRECTORY_ROW_STATE_BACKGROUND};
      }

      .quest-directory-normal .quest-directory-item.quest-directory-folder-selected:hover,
      .quest-directory-normal .quest-directory-item.quest-directory-quest-selected:hover {
        border-color: ${QUEST_DIRECTORY_ROW_SELECTED_BORDER};
        background: ${QUEST_DIRECTORY_ROW_STATE_BACKGROUND};
      }
      .quest-directory-folder-item {
        min-height: 1.65rem;
      }
      .quest-directory-root-item {
        background: rgba(23, 23, 23, 0.72);
      }
      .quest-directory-folder > .quest-directory-children {
        margin-top: 0.15rem;
      }
      .quest-directory-quest-item {
        flex: 1 1 auto;
        display: grid;
        gap: 0.22rem;
        min-width: 0;
        min-height: 2.15rem;
        background: rgba(23, 23, 23, 0.82);
        padding: 0.12rem 0.25rem 0.24rem;
        text-align: left;
      }
      .quest-directory-quest-branch-node::before {
        width: calc(
          var(--quest-directory-elbow-width)
          + var(--quest-directory-row-gutter)
          + var(--quest-directory-row-gap)
          + 0px
        );
      }
      .quest-directory-quest-muted {
        opacity: 0.68;
      }
      .quest-directory-quest-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.25rem;
        min-width: 0;
      }
      .quest-directory-subtree-end-drop-zone {
        min-height: 2px;
        width: 100%;
      }
      .quest-directory-quest-main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        text-align: left;
        color: rgb(212 212 212);
      }
      .quest-directory-quest-actions {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
      }
      .quest-directory-quest-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.86rem;
        font-weight: 800;
        color: rgb(229 229 229);
      }
      .quest-directory-quest-progress-track {
        height: 0.28rem;
        overflow: hidden;
        border-radius: 999px;
        background: rgb(38 38 38);
      }
      .quest-directory-quest-progress-fill {
        height: 100%;
        border-radius: inherit;
        background: rgb(229 229 229);
      }
      .quest-directory-quest-meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        min-height: 1rem;
      }
      .quest-directory-debug-select {
        opacity: 0.78;
      }
      .quest-board-list {
        display: grid;
        align-content: start;
        gap: 0.75rem;
        width: 100%;
        min-width: 0;
      }
      .export-options-root {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .export-options-scroll {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-gutter: stable;
      }
      .export-options-content {
        width: 100%;
        min-width: 0;
        padding: 8px;
      }
      .library-tab-bar {
        justify-content: flex-start;
        gap: 0.25rem;
        padding: 0.25rem 0.35rem 0;
        min-height: 2.15rem;
      }
      .library-title-tab {
        align-self: stretch;
        display: inline-flex;
        align-items: center;
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 0.28rem 0.28rem 0 0;
        padding: 0.25rem 0.8rem;
        font-size: 0.85rem;
        font-weight: 800;
        color: rgb(163 163 163);
      }
      .library-title-tab:hover {
        background: rgb(64 64 64);
        color: rgb(229 229 229);
      }
      .library-title-tab-active {
        border-color: rgb(64 64 64);
        background: rgb(23 23 23);
        color: rgb(245 245 245);
      }
      .panel-title-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .title-icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 0.35rem;
        color: rgb(229 229 229);
      }
      .title-icon-button:hover {
        background: rgb(64 64 64);
      }
      .title-secondary-button,
      .title-primary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.35rem;
        padding: 0.18rem 0.45rem;
        font-size: 0.75rem;
        font-weight: 800;
      }
      .title-secondary-button {
        background: rgb(23 23 23);
        color: rgb(229 229 229);
      }
      .title-secondary-button:hover {
        background: rgb(64 64 64);
      }
      .title-secondary-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .title-secondary-button:disabled:hover {
        background: rgb(23 23 23);
      }
      .title-primary-button {
        background: rgb(229 229 229);
        color: rgb(23 23 23);
      }
      .title-button-disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .main-action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .main-action-button {
        display: inline-flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border-radius: 0.32rem;
        background: rgb(229 229 229);
        padding: 0.75rem 1rem;
        font-size: 1rem;
        font-weight: 800;
        color: rgb(23 23 23);
      }
            .progress-action-button {
        min-height: 2.75rem;
      }


      .main-action-button:disabled {
        background: rgb(38 38 38);
        border-color: rgb(64 64 64);
        color: rgb(120 120 120);
        cursor: default;
        opacity: 0.75;
      }

      .main-action-button:disabled:hover {
        background: rgb(38 38 38);
        border-color: rgb(64 64 64);
        color: rgb(120 120 120);
      }

.main-action-button:hover {
        background: white;
      }
      .main-action-complete {
        display: inline-flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        border-radius: 0.32rem;
        border: 1px solid rgb(21 128 61);
        background: rgb(20 83 45);
        padding: 0.75rem 1rem;
        font-weight: 800;
        color: rgb(187 247 208);
      }
      .main-action-placeholder {
        flex: 1 1 auto;
        border-radius: 0.32rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.75rem 1rem;
        text-align: center;
        font-size: 0.9rem;
        font-weight: 700;
        color: rgb(163 163 163);
      }
      .danger-zone {
        margin-top: 1rem;
        border-top: 1px solid rgb(38 38 38);
        padding-top: 1rem;
      }
      .wiki-meta-block {
        display: grid;
        gap: 0.25rem;
        font-size: 0.78rem;
        line-height: 1.35;
        color: rgb(163 163 163);
      }
      .wiki-meta-line {
        color: rgb(163 163 163);
      }
      .wiki-meta-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .ancestry-path {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px;
      }
      .ancestry-path::before {
        content: "Path:";
        margin-right: 0.25rem;
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .ancestry-button {
        border-radius: 0.3rem;
        padding: 0 0.15rem;
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: rgb(82 82 82);
        text-underline-offset: 2px;
      }
      .ancestry-button:hover {
        color: white;
        text-decoration-color: white;
      }
      .wiki-link-button {
        border-radius: 0.3rem;
        padding: 0 0.15rem;
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: rgb(82 82 82);
        text-underline-offset: 2px;
      }
      .wiki-link-button:hover {
        color: white;
        text-decoration-color: white;
      }
      .ancestry-separator {
        color: rgb(115 115 115);
      }
      .inspector-title-quest {
        background: rgb(20 83 45);
        border-bottom-color: rgb(21 128 61);
      }
      .inspector-title-task {
        background: rgb(30 58 138);
        border-bottom-color: rgb(30 64 175);
      }
      .inspector-toolbar {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-width: 0;
        min-height: 1.7rem;
        padding: 0;
      }
      .inspector-toolbar-section,
      .inspector-toolbar-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-width: 0;
      }
      .inspector-toolbar-section {
        flex: 1 1 auto;
        overflow: hidden;
      }
      .inspector-toolbar-actions {
        flex: 0 0 auto;
      }
      .inspector-selection-badge,
      .inspector-filename-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 0.35rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(38 38 38);
        padding: 0.18rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 850;
        color: rgb(229 229 229);
      }
      .inspector-selection-badge {
        flex: 0 0 auto;
      }
      .inspector-filename-badge {
        flex: 1 1 auto;
        min-width: 0;
        max-width: none;
        background: rgb(24 24 27);
        color: rgb(163 163 163);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .inspector-selection-badge.inspector-title-quest {
        border-color: rgb(21 128 61);
        background: rgb(20 83 45);
        color: rgb(187 247 208);
      }
      .inspector-selection-badge.inspector-title-task {
        border-color: rgb(30 64 175);
        background: rgb(30 58 138);
        color: rgb(191 219 254);
      }
      .inspector-mode-content {
        display: grid;
        gap: 0.85rem;
      }
      .inspector-action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        border-radius: 0.32rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 0.65rem;
      }
      .focus-status-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 0.28rem;
        border: 1px solid rgb(21 128 61);
        background: rgb(20 83 45);
        padding: 0.5rem 0.75rem;
        font-weight: 700;
        color: rgb(187 247 208);
      }
      .panel-content {
        padding: 1rem;
      }
      .panel-scroll {
        overflow-y: auto;
        overflow-x: hidden;
      }
      .library-col {
        flex: 0 0 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .library-col > .tab-container {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .library-col > .tab-container > .tab-container-content {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .focus-col {
        flex: 1 1 auto;
        min-width: 420px;
      }
      .center-dock-wrapper {
        flex: 1 1 auto;
        min-width: 420px;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .center-dock-wrapper > .tab-container {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .center-dock-wrapper > .tab-container > .tab-container-content {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .top-right-dock-wrapper {
        flex: 0 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .top-right-dock-wrapper > .tab-container {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .top-right-dock-wrapper > .tab-container > .tab-container-content {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .inspector-panel-embedded {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
      }
      .bottom-right-dock-wrapper {
        flex: 0 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .bottom-right-dock-wrapper > .tab-container {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .bottom-right-dock-wrapper > .tab-container > .tab-container-content {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .tree-view-root {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow: hidden;
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .tree-scene-header {
        flex: 0 0 auto;
        display: grid;
        gap: 4px;
        min-width: 0;
      }
      .tree-scene-content {
        position: relative;
        display: grid;
        align-content: start;
        gap: 0.15rem;
        width: 100%;
        min-width: 0;
      }
      .tree-scene-content::after {
        content: "";
        display: block;
        height: ${SCENE_SCROLL_BUFFER};
      }
      .tree-contents-panel {
        flex: 1 1 auto;
      }
      .tree-contents-margin {
        overflow-y: auto;
        overflow-x: hidden;
      }
      .tree-toolbar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-height: 1.7rem;
      }
      .tree-toolbar-context,
      .tree-toolbar-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-width: 0;
      }
      .right-column {
        flex: 0 0 auto;
        min-width: 360px;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        overflow: hidden;
      }
      .right-splitter {
        flex: 0 0 0.45rem;
        cursor: row-resize;
        border: 1px solid transparent;
        background: rgb(23 23 23);
      }
      .right-splitter:hover {
        border-color: rgb(82 82 82);
        background: rgb(38 38 38);
      }
      .right-splitter::before {
        content: "";
        display: block;
        height: 1px;
        margin: 0.2rem auto 0;
        width: 3rem;
        background: rgb(82 82 82);
      }
      .inspector-tab-content-debug {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        overflow: hidden;
        background: rgb(35 80 56);
      }
      .inspector-tab-content-debug > .inspector-root {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
      }
      .inspector-root {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .inspector-root.inspector-root-embedded {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }

      .inspector-main-margin {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
        padding: 0;
      }
      .inspector-main-vbox {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow: hidden;
      }
      .inspector-relations-strip {
        flex: 0 0 auto;
        min-width: 0;
        border-radius: 0.28rem;
        background: rgba(0, 0, 0, 0.18);
        padding: 4px;
      }
      .inspector-contents-panel {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
      .inspector-contents-margin {
        display: block;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px;
        padding-right: calc(4px + ${SCENE_SCROLL_GUTTER});
        scrollbar-gutter: stable;
      }
      .inspector-scene-content {
        width: 100%;
        min-width: 0;
        padding: 2px;
      }
      .inspector-contents-scroll {
        width: 100%;
        min-width: 0;
        min-height: 0;
      }
      .tree-panel {
        flex: 0 0 auto;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .focus-tree {
        border-color: rgb(30 64 175);
      }
      .quest-tree {
        border-color: rgb(21 128 61);
              }
      .quest-type-regular-tree {
        border-color: rgb(21 128 61);
      }
      .quest-type-routine-tree {
        border-color: rgb(217 119 6);
      }
      .quest-type-cooldown-tree {
        border-color: rgb(126 34 206);
      }
      .quest-type-event-tree {
        border-color: rgb(37 99 235);
      }
      .tree-mode-pill {
        display: inline-flex;
        border-radius: 0.35rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgb(64 64 64);
        color: rgb(229 229 229);
      }
      .tree-drag-pill {
        border-radius: 999px;
        border: 1px solid rgb(59 130 246);
        background: rgb(30 58 138);
        padding: 0.1rem 0.45rem;
        font-size: 0.72rem;
        font-weight: 800;
        color: rgb(191 219 254);
      }
      .tree-edit-pill {
        display: inline-flex;
        border-radius: 0.35rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 800;
        background: rgb(234 179 8);
        color: rgb(23 23 23);
      }
      .tree-node-list {
        display: grid;
        gap: 0.15rem;
        width: 100%;
        min-width: 0;
      }
      .tree-node-wrap {
        position: relative;
        display: grid;
        gap: 0.15rem;
        width: 100%;
        min-width: 0;
      }
      .tree-row-wrap {
        position: relative;
        display: flex;
        align-items: stretch;
        gap: 0.25rem;
        width: 100%;
        min-width: 0;
      }
      .tree-children-group {
        position: relative;
        margin-left: calc(1.35rem - 8px);
        padding-left: 0.55rem;
        display: grid;
        gap: 0.15rem;
        width: calc(100% - 1.35rem);
        min-width: 0;
      }
      .tree-row-wrap.tree-node-child::after {
        content: "";
        position: absolute;
        left: calc(-0.55rem - 4px);
        top: -0.15rem;
        bottom: calc(50% - 1px);
        width: 2px;
        background: ${TREE_BRANCH_LINE_COLOR};
        opacity: 1;
      }
      .tree-node-wrap:not(:last-child) > .tree-row-wrap.tree-node-child::after {
        bottom: -0.15rem;
      }
      .tree-node-wrap:not(:last-child)::before {
        content: "";
        position: absolute;
        left: calc(-0.55rem - 4px);
        top: 0.78rem;
        bottom: -0.15rem;
        width: 2px;
        background: ${TREE_BRANCH_LINE_COLOR};
        opacity: 1;
        pointer-events: none;
      }
      .tree-root-node-wrap::before {
        display: none;
      }
      .tree-row-wrap.tree-node-child::before {
        content: "";
        position: absolute;
        left: calc(-0.55rem - 2px);
        top: 0.78rem;
        width: calc(0.55rem + 0px);
        height: 2px;
        background: ${TREE_BRANCH_LINE_COLOR};
        opacity: 1;
      }
      .tree-row-wrap.tree-node-child.tree-row-leaf::before {
        width: calc(1.9rem + 4px);
      }
      .tree-row {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        min-width: 0;
        min-height: 1.55rem;
        border-radius: 0.25rem;
        border: 1px solid transparent;
        background: transparent;
        padding: 0.12rem 0.3rem;
        cursor: pointer;
        flex: 1 1 auto;
      }
      .tree-row::before,
      .tree-row::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
      }
      .tree-row::before {
        z-index: -2;
        background: transparent;
      }
      .tree-row::after {
        z-index: -1;
        background: transparent;
      }
      .tree-row.tree-status-complete::before {
        background: rgba(34, 197, 94, 0.20);
      }
      .tree-row.tree-status-in-progress::before {
        background: rgba(234, 179, 8, 0.22);
      }
      .tree-row:hover {
        border-color: transparent;
        background: transparent;
      }
      .tree-row:hover::after {
        background: rgba(59, 130, 246, 0.18);
      }
      .tree-row-selected,
      .tree-row-selected:hover {
        border-color: rgba(255, 255, 255, 0.82);
        background: transparent;
      }
      .tree-row-selected::after,
      .tree-row-selected:hover::after {
        background: rgba(59, 130, 246, 0.18);
      }

      .tree-view-rearrange .tree-row:hover::after {
        background: transparent;
      }
      .tree-view-rearrange .tree-row {
        cursor: default;
      }
      .tree-view-rearrange.tree-drag-active,
      .tree-view-rearrange.tree-drag-active .tree-row,
      .tree-view-rearrange .tree-drag-active .tree-row {
        cursor: grabbing;
      }
      .tree-view-rearrange .tree-row-selected::after,
      .tree-view-rearrange .tree-row-selected:hover::after {
        background: rgba(59, 130, 246, 0.18);
      }
      .tree-drop-overlay {
        position: absolute;
        pointer-events: none;
        z-index: 20;
      }
      .tree-drop-overlay-boundary {
        height: 2px;
        border-radius: 999px;
        background: rgba(96, 165, 250, 0.9);
        box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.45);
        transform: translateY(-1px);
      }

      .tree-view-normal .tree-subtree-end-drop-zone {
        display: none;
      }
      .tree-subtree-end-drop-zone {
        height: 0.45rem;
        min-height: 0.45rem;
        margin-top: -0.15rem;
        margin-bottom: -0.15rem;
        background: transparent;
      }
      .tree-drop-overlay-inside {
        border-radius: 0.25rem;
        border: 2px solid rgba(96, 165, 250, 0.85);
        background: transparent;
        box-shadow: none;
      }
      .tree-root-row {
        margin-bottom: 0;
        font-weight: 800;
        justify-content: center;
      }
      .tree-root-node-wrap > .tree-children-group {
        margin-top: 0.15rem;
      }
      .tree-root-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.85rem;
        width: 100%;
        min-width: 0;
        text-align: center;
      }
      .tree-root-icon {
        flex: 0 0 auto;
        width: 1.35rem;
        text-align: center;
        color: rgb(229 229 229);
      }
      .tree-root-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: center;
      }
      .tree-root-quest {
        border-color: rgb(21 128 61);
      }
      .tree-root-focus {
        border-color: rgb(30 64 175);
      }
      .tree-root-quest-type-regular {
        border-color: rgb(21 128 61);
      }
      .tree-root-quest-type-routine {
        border-color: rgb(217 119 6);
      }
      .tree-root-quest-type-cooldown {
        border-color: rgb(126 34 206);
      }
      .tree-root-quest-type-event {
        border-color: rgb(37 99 235);
      }
      .tree-root-root-quest-type-regular {
        border-width: 2px;
      }
      .tree-root-root-quest-type-routine {
        border-width: 2px;
      }
      .tree-root-root-quest-type-cooldown {
        border-width: 2px;
      }
      .tree-root-root-quest-type-event {
        border-width: 2px;
      }
      .tree-root-quest,
      .tree-root-routine,
      .tree-root-focus,
      .tree-root-quest-type-regular,
      .tree-root-quest-type-routine,
      .tree-root-quest-type-cooldown,
      .tree-root-root-quest-type-regular,
      .tree-root-root-quest-type-routine,
      .tree-root-root-quest-type-cooldown,
      .tree-root-quest-type-event,
      .tree-root-root-quest-type-event {
        border-color: transparent;
        border-width: 1px;
      }
      .tree-root-row.tree-row-selected {
        border-color: rgba(255, 255, 255, 0.82);
      }
      .tree-row-complete {
        background: transparent;
      }
      .tree-row-complete:hover {
        background: rgba(59, 130, 246, 0.18);
      }
      .tree-row-edit {
        cursor: default;
      }
      .tree-row-main {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 0.35rem;
      }
      .tree-row-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.9rem;
        font-weight: 650;
      }
      .tree-count-suffix {
        color: rgb(163 163 163);
        font-weight: 650;
      }
      .tree-row-mode {
        flex: 0 0 auto;
        border-radius: 0.35rem;
        background: rgb(64 64 64);
        padding: 0.1rem 0.35rem;
        font-size: 0.65rem;
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .tree-row-buttons {
        display: flex;
        flex: 0 0 auto;
        gap: 0.25rem;
      }
            .tree-disclosure-gutter {
        display: inline-flex;
        flex: 0 0 1.35rem;
        align-items: center;
        justify-content: center;
      }
.tree-disclosure,
      .tree-icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 0.25rem;
        color: rgb(229 229 229);
      }
      .tree-disclosure-spacer {
        display: inline-flex;
        width: 1.35rem;
        height: 1.35rem;
        flex: 0 0 1.35rem;
      }

      .tree-disclosure:hover,
      .tree-icon-button:hover {
        background: rgb(64 64 64);
      }
      .danger-tree-button:hover {
        background: rgb(127 29 29);
      }
      .selection-type-card {
        margin-bottom: 1rem;
        border-radius: 0.25rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.75rem;
      }
      .selection-type-label {
        display: inline-flex;
        border-radius: 0.35rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .selection-type-title {
        margin-top: 0.5rem;
        font-size: 1rem;
        font-weight: 700;
        color: rgb(245 245 245);
      }
      .selection-quest {
        border-color: rgb(21 128 61);
      }
      .selection-quest .selection-type-label {
        background: rgb(20 83 45);
        color: rgb(187 247 208);
      }
      .selection-task {
        border-color: rgb(30 64 175);
      }
      .selection-task .selection-type-label {
        background: rgb(30 58 138);
        color: rgb(191 219 254);
      }
      .focus-tab-root {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .focus-empty-message {
        width: 100%;
        min-width: 0;
        min-height: 0;
        padding: 0.5rem;
      }
      .focus-panel-content {
        width: 100%;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: visible;
        padding: 0;
      }
      .focus-contents-panel {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
      }
      .focus-contents-margin {
        display: block;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .focus-scene-content {
        width: 100%;
        min-width: 0;
      }
      .focus-document-header {
        padding: 0.25rem 0 0;
      }
      .focus-document-title {
        display: block;
        font-size: 2rem;
        line-height: 1.1;
        font-weight: 900;
        color: rgb(245 245 245);
        text-align: left;
      }
      .focus-document-title-button {
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 3px;
      }
      .focus-document-title-button:hover {
        text-decoration-color: currentColor;
      }
      .focus-directory-path {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem;
        margin-top: 0.45rem;
        font-size: 1rem;
        color: rgb(212 212 212);
      }
      .focus-directory-link {
        text-align: left;
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 2px;
      }
      .focus-directory-link:hover {
        color: white;
        text-decoration-color: currentColor;
      }
      .focus-directory-separator {
        color: rgb(115 115 115);
      }
      .focus-relations {
        display: grid;
        gap: 0.25rem;
        margin-top: 0.45rem;
        font-size: 1rem;
        color: rgb(212 212 212);
      }
      .focus-relation-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
      }
      .focus-relation-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .focus-relation-muted {
        color: rgb(115 115 115);
      }
      .focus-relation-chip {
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 2px;
      }
      .focus-relation-chip:hover {
        color: white;
        text-decoration-color: currentColor;
      }
      .focus-description-section {
        margin-top: 0.85rem;
      }
      .focus-description-title {
        font-size: 1.2rem;
        font-weight: 900;
        color: rgb(245 245 245);
      }
      .focus-description-rich {
        display: grid;
        gap: 0.65rem;
        margin-top: 0.25rem;
      }
      .focus-description-text {
        margin: 0;
        white-space: pre-wrap;
        font-size: 1rem;
        line-height: 1.5;
        color: rgb(212 212 212);
      }
      .description-code-panel {
        overflow: hidden;
        border: 1px solid rgb(64 64 64);
        border-radius: 0.35rem;
        background: rgb(10 10 10);
      }
      .description-code-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        border-bottom: 1px solid rgb(38 38 38);
        background: rgb(23 23 23);
        padding: 0.35rem 0.5rem;
      }
      .description-code-language {
        font-size: 0.75rem;
        font-weight: 800;
        color: rgb(163 163 163);
      }
      .description-code-copy {
        border-radius: 0.28rem;
        background: rgb(38 38 38);
        padding: 0.15rem 0.45rem;
        font-size: 0.72rem;
        font-weight: 800;
        color: rgb(229 229 229);
      }
      .description-code-copy:hover {
        background: rgb(64 64 64);
        color: white;
      }
      .description-code-pre {
        margin: 0;
        max-height: 28rem;
        overflow: auto;
        padding: 0.75rem;
        white-space: pre;
        font-size: 0.88rem;
        line-height: 1.45;
        color: rgb(229 229 229);
      }
      .description-code-pre code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }
      .focus-path-header {
        padding: 0.25rem 0 0;
      }
      .focus-path-title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.25rem;
        font-size: 1.5rem;
        font-weight: 800;
      }
      .focus-path-title-link {
        color: rgb(245 245 245);
        text-align: left;
      }
      .focus-path-title-link:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .focus-path-title-separator {
        color: rgb(115 115 115);
      }
      .focus-branch-nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.45rem;
        font-size: 0.8rem;
      }
      .focus-branch-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .branch-progress-line {
        margin-top: 0.75rem;
      }
      .branch-progress-label {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.82rem;
        font-weight: 750;
        color: rgb(212 212 212);
      }
      .branch-progress-track {
        margin-top: 0.35rem;
        height: 0.45rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
      }
      .branch-progress-fill {
        height: 100%;
        background: rgb(212 212 212);
      }
      .focus-nav {
        display: grid;
        gap: 0.3rem;
        margin-top: 0.75rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.55rem;
        font-size: 0.8rem;
      }
      .focus-nav-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem;
      }
      .focus-nav-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .focus-nav-link {
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: rgb(82 82 82);
        text-underline-offset: 2px;
      }
      .focus-nav-link:hover {
        color: white;
        text-decoration-color: white;
      }
      .focus-nav-separator,
      .focus-nav-muted {
        color: rgb(115 115 115);
      }
      .focus-nav-chip {
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.1rem 0.35rem;
        color: rgb(212 212 212);
      }
      .focus-nav-chip:hover {
        background: rgb(38 38 38);
      }


      .complete-quest-celebration {
        display: flex;
        justify-content: center;
        margin: 1.5rem 1.5rem 1rem;
      }
      .recommended-complete-quest-button {
        width: min(38rem, 100%);
        border: 1px solid rgb(74 222 128);
        background: linear-gradient(135deg, rgb(22 101 52), rgb(34 140 84));
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 1.4rem rgba(34, 197, 94, 0.18);
        padding: 1.35rem 1.75rem;
        display: grid;
        grid-template-columns: 2rem minmax(0, 1fr) 2rem;
        align-items: center;
        justify-items: center;
        gap: 1rem;
        font-size: 1.2rem;
        font-weight: 950;
        letter-spacing: 0.02em;
      }
      .recommended-complete-quest-button:hover {
        background: linear-gradient(rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.14)), linear-gradient(135deg, rgb(22 101 52), rgb(34 140 84));
      }
      .recommended-complete-quest-button-done,
      .recommended-complete-quest-button-done:hover,
      .recommended-complete-quest-button-done:disabled {
        border-color: rgb(115 115 115);
        background: linear-gradient(135deg, rgb(64 64 64), rgb(82 82 82));
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
        color: rgb(229 229 229);
        cursor: default;
        opacity: 1;
      }
      .complete-quest-icon {
        color: rgb(220 252 231);
        font-size: 1rem;
        line-height: 1;
      }
      .recommended-complete-quest-button-done .complete-quest-icon {
        color: rgb(212 212 212);
      }
      .complete-quest-label {
        min-width: 0;
        text-align: center;
        white-space: nowrap;
      }

      .focus-board-toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1.25rem;
        margin-bottom: 0.45rem;
      }
      .focus-board-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.78rem;
        font-weight: 750;
        color: rgb(180 180 180);
        user-select: none;
      }
      .focus-board-toggle input {
        accent-color: rgb(212 212 212);
      }
      .execution-stack-card {
        flex: 0 0 auto;
        overflow: hidden;
        border: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
      }
      .execution-stack-card:hover {
        border-color: rgb(82 82 82);
      }
      .execution-stack-card-upcoming {
        opacity: 0.58;
      }
      .execution-stack-layer {
        border-bottom: 1px solid rgb(38 38 38);
      }
      .execution-stack-layer:last-child {
        border-bottom: 0;
      }
      .execution-stack-layer-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.35rem;
        min-height: 2rem;
        background: rgb(38 38 38);
        padding: 0.3rem 0.35rem;
      }
      .execution-stack-layer-depth-1 .execution-stack-layer-bar {
        background: rgb(31 31 31);
        padding-left: 0.7rem;
      }
      .execution-stack-layer-depth-2 .execution-stack-layer-bar {
        background: rgb(25 25 25);
        padding-left: 1.05rem;
      }
      .execution-stack-layer-depth-3 .execution-stack-layer-bar,
      .execution-stack-layer-depth-4 .execution-stack-layer-bar,
      .execution-stack-layer-depth-5 .execution-stack-layer-bar {
        background: rgb(20 20 20);
        padding-left: 1.4rem;
      }
      .execution-stack-layer-terminal .execution-stack-layer-bar {
        background: rgb(23 23 23);
      }
      .execution-stack-layer-main {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
      }
      .execution-stack-layer-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: rgb(212 212 212);
        text-align: left;
        font-size: 0.82rem;
        font-weight: 750;
      }
      .execution-stack-layer-title:hover {
        color: white;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .execution-stack-layer-meta {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.25rem;
        flex: 0 0 auto;
        color: rgb(163 163 163);
        font-size: 0.72rem;
        font-weight: 850;
      }
      .execution-stack-count-badge {
        border-radius: 999px;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.08rem 0.4rem;
        color: rgb(163 163 163);
        white-space: nowrap;
        font-size: 0.72rem;
        font-weight: 850;
      }
      .execution-stack-progress-pill,
      .execution-stack-done-pill,
      .execution-stack-upcoming-pill {
        border-radius: 999px;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.08rem 0.4rem;
        white-space: nowrap;
      }
      .execution-stack-done-pill {
        border-color: rgb(21 128 61);
        background: rgb(20 83 45);
        color: rgb(187 247 208);
      }
      .execution-stack-upcoming-pill {
        color: rgb(140 140 140);
      }
      .execution-stack-layer-body {
        border-top: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 0.5rem;
      }

      .focus-board {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        height: 50vh;
        min-height: 50vh;
        max-height: 50vh;
        overflow: hidden;
      }
      .focus-column {
        display: flex;
        min-width: 0;
        min-height: 0;
        height: 100%;
        max-height: 100%;
        flex-direction: column;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        overflow: hidden;
      }
      .focus-column-title {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        border-bottom: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.45rem 0.55rem;
        font-size: 0.85rem;
        font-weight: 800;
      }
      .focus-column-count {
        color: rgb(163 163 163);
        font-size: 0.75rem;
      }
      .focus-column-list {
        display: flex;
        flex: 1 1 0;
        min-height: 0;
        max-height: 100%;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.45rem;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .focus-card {
        flex: 0 0 auto;
        border: 1px solid rgb(38 38 38);
        background: rgb(23 23 23);
        overflow: hidden;
      
      }
      .focus-card-bar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.35rem;
        background: rgb(38 38 38);
        padding: 0.3rem 0.35rem;
        cursor: pointer;
      
      }
      .focus-card-body {
        border-top: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 0.5rem;
        white-space: pre-wrap;
        font-size: 0.78rem;
        line-height: 1.45;
        color: rgb(212 212 212);
      }
      .focus-card-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        flex: 0 0 auto;
      }
      .focus-card:hover {
        border-color: rgb(82 82 82);
      }
      .focus-card-bar:focus-visible {
        outline: 2px solid rgb(163 163 163);
        outline-offset: -2px;
      }


      .focus-card-title-line {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.3rem;
      }
      .focus-card-dropdown {
        flex: 0 0 auto;
      }
      .focus-card-progress-full {
        width: 100%;
        border-left: 0;
        border-right: 0;
        border-top: 1px solid rgb(38 38 38);
        border-bottom: 0;
        height: 0.42rem;
      }
      .focus-card-main {
        min-width: 0;
        text-align: left;
      }
      .focus-card-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .focus-path-links {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .focus-path-link {
        max-width: 100%;
        padding: 0 0.05rem;
        color: rgb(212 212 212);
        text-align: left;
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 2px;
      }
      .focus-path-link:hover {
        color: white;
        text-decoration-color: currentColor;
      }
      .focus-path-separator {
        color: rgb(115 115 115);
      }
      .focus-card-progress-bar {
        margin-top: 0.3rem;
        height: 0.35rem;
        overflow: hidden;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
      }
      .focus-card-progress-fill {
        height: 100%;
        background: rgb(163 163 163);
      }

      .focus-card-action-progress {
        border-color: rgb(245 158 11);
        background: rgb(180 95 18);
      }
      .focus-card-action-progress:hover {
        background: linear-gradient(rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.14)), rgb(180 95 18);
      }
      
      .focus-card-action-uncomplete:hover {
        border-color: rgb(248 113 113);
        background: rgb(185 45 45);
      }
.focus-card-action-complete {
        border-color: rgb(74 222 128);
        background: rgb(34 140 84);
      }
      .focus-card-action-complete:hover {
        background: linear-gradient(rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.14)), rgb(34 140 84);
      }
      .focus-card-done {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border: 1px solid rgb(64 64 64);
        color: rgb(212 212 212);
      }
      .focus-card-done:hover {
        color: inherit;
      }
      .focus-card-complete {
        color: rgb(163 163 163);
      }
      .focus-empty {
        font-size: 0.78rem;
        color: rgb(115 115 115);
        padding: 0.25rem;
      }

      .task-action-stack {
        display: grid;
        flex: 1 1 auto;
        gap: 0.45rem;
      }
      .counter-field {
        display: flex;
        align-items: stretch;
        gap: 0.35rem;
      }
      .counter-input {
        min-width: 0;
        text-align: center;
        appearance: textfield;
        -moz-appearance: textfield;
      }
      .counter-input::-webkit-outer-spin-button,
      .counter-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .counter-stepper {
        display: flex;
        flex: 0 0 1.7rem;
        flex-direction: column;
        gap: 2px;
      }
      .counter-stepper button {
        flex: 1 1 0;
        border: 1px solid rgb(64 64 64);
        background: rgb(38 38 38);
        font-size: 0.75rem;
        font-weight: 900;
        line-height: 1;
      }
      .counter-stepper button:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .inspector-progress-block {
        display: grid;
        gap: 0.35rem;
        width: 100%;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.65rem;
      }
      .inspector-progress-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        color: rgb(212 212 212);
        font-size: 0.8rem;
        font-weight: 800;
      }
      .inspector-progress-line {
        display: grid;
        gap: 0.3rem;
        width: 100%;
        color: rgb(212 212 212);
        font-size: 0.8rem;
        font-weight: 800;
      }
      .inspector-progress-bar {
        height: 0.5rem;
        overflow: hidden;
        border: 1px solid rgb(82 82 82);
        background: rgb(38 38 38);
      }
      .inspector-progress-fill {
        height: 100%;
        background: rgb(229 229 229);
        opacity: 0.28;
      }


      select.field {
        appearance: none;
        -webkit-appearance: none;
        background-color: rgb(23 23 23);
        color: rgb(245 245 245);
        border-color: rgb(64 64 64);
      }
      select.field option {
        background-color: rgb(23 23 23);
        color: rgb(245 245 245);
      }

      .field {
        width: 100%;
        border-radius: 0.28rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.5rem 0.75rem;
        color: rgb(245 245 245);
        outline: none;
      }
      .field:focus { border-color: rgb(163 163 163); }
      .field:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .locked-notice {
        border-radius: 0.28rem;
        border: 1px solid rgb(30 64 175);
        background: rgb(23 23 23);
        padding: 0.65rem;
        font-size: 0.85rem;
        color: rgb(191 219 254);
      }
      .cooldown-box {
        border-radius: 0.32rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 0.75rem;
      }
      .day-mask-row {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.35rem;
        margin-top: 0.35rem;
      }
      .day-button {
        border-radius: 0.25rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.35rem 0.25rem;
        font-size: 0.75rem;
        font-weight: 800;
        color: rgb(163 163 163);
      }
      .day-button:hover {
        background: rgb(38 38 38);
      }
      .day-button-active {
        border-color: rgb(126 34 206);
        background: rgb(88 28 135);
        color: rgb(243 232 255);
      }
      .primary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border-radius: 0.28rem;
        background: rgb(229 229 229);
        padding: 0.5rem 1rem;
        font-weight: 700;
        color: rgb(23 23 23);
      }
      .primary-button:hover { background: white; }
      .secondary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border-radius: 0.28rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.5rem 1rem;
        font-weight: 600;
        color: rgb(229 229 229);
      }
      .secondary-button:hover { background: rgb(38 38 38); }
      .danger-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border-radius: 0.28rem;
        border: 1px solid rgb(127 29 29);
        background: rgb(69 10 10);
        padding: 0.5rem 1rem;
        font-weight: 700;
        color: rgb(254 202 202);
      }
      .danger-button:hover { background: rgb(127 29 29); }
      .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.28rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.5rem;
        color: rgb(229 229 229);
      }
      .icon-button:hover { background: rgb(38 38 38); }
      .library-card {
        width: 100%;
        border-radius: 0.25rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 1rem;
      }
      .library-card:hover {
        background: rgb(38 38 38);
      }
      .quest-type-regular {
        border-color: rgb(21 128 61);
      }
      .quest-type-routine {
        border-color: rgb(217 119 6);
      }
      .quest-type-cooldown {
        border-color: rgb(126 34 206);
      }
      .quest-type-event {
        border-color: rgb(37 99 235);
      }
      .library-card-complete {
        border-color: rgb(64 64 64);
        background: rgb(23 23 23);
        color: rgb(163 163 163);
      }
      .library-card-complete:hover {
        background: rgb(38 38 38);
      }
      .library-card-complete .font-semibold {
        color: rgb(163 163 163);
      }
      .library-card-complete .text-neutral-400 {
        color: rgb(115 115 115);
      }
      .pill-complete {
        border-radius: 0.35rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgb(20 83 45);
        color: rgb(187 247 208);
      }
      .tab {
        border-radius: 0.25rem;
        padding: 0.5rem;
        color: rgb(163 163 163);
        font-weight: 700;
      }
      .tab-active {
        border-radius: 0.25rem;
        background: rgb(64 64 64);
        padding: 0.5rem;
        color: rgb(245 245 245);
        font-weight: 700;
      }
      .badge, .pill, .pill-blue, .pill-green, .pill-red {
        border-radius: 0.35rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .pill { background: rgb(38 38 38); color: rgb(212 212 212); }
      .pill-blue { background: rgb(30 58 138); color: rgb(191 219 254); }
      .pill-green { background: rgb(20 83 45); color: rgb(187 247 208); }
      .pill-red { background: rgb(127 29 29); color: rgb(254 202 202); }
    `}</style>
  );
}
