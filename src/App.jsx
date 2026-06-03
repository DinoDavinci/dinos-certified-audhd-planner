import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  STORAGE_KEY,
  LAST_TICK_KEY,
  DEFAULT_TAGS,
  todayString,
  resetTaskSubtree,
  makeTask,
  makeQuest,
  makeRoutine,
  reconcileTodayQuestForRoutine,
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
  addQuestCompletionCard,
  getFocusPathInfo,
  updateQuestTree,
  addTaskToTree,
  deleteTaskFromTree,
  moveTaskInTree,
  seedData,
  normalizeData,
  runDailyMaintenance,
  selectionKey,
  getTreeContext,
} from "./models/appModel";

import {
  downloadJsonFile,
  makeAllDataExport,
  makeQuestFileExport,
  makeRoutineFileExport,
  rawDataFromPlannerPayload,
  rawQuestFromQuestPayload,
  rawRoutineFromRoutinePayload,
  readJsonFile,
  slugifyFilename,
} from "./utils/fileIO";

import QuestBoardPanel from "./components/QuestBoardPanel";
import RoutinePanel from "./components/RoutinePanel";
import ExportPanel from "./components/ExportPanel";
import FocusPanel from "./components/focus/FocusPanel";
import TreePanel from "./components/tree/TreePanel";
import InspectorPanel from "./components/inspector/InspectorPanel";
import DockContainer from "./components/layout/DockContainer";
import { DOCK_IDS, PANEL_IDS } from "./layout/panelLayout";

const RIGHT_DOCK_SPLIT_RESERVE = "0.575rem";

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
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("All");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [treeEditMode, setTreeEditMode] = useState(false);
  const [rightSplit, setRightSplit] = useState(62);
  const [leftPanelWidth, setLeftPanelWidth] = useState(360);
  const [rightPanelWidth, setRightPanelWidth] = useState(430);
  const [expandedKanbanCards, setExpandedKanbanCards] = useState({});

  const quests = data.quests || [];
  const routines = data.routines || [];
  const activeQuest = quests.find((quest) => quest.id === data.activeQuestId) || quests[0] || null;
  const selectedRoutineForExport = selection.type === "routine"
    ? routines.find((routine) => routine.id === selection.id) || null
    : null;
  const focusPathInfo = getFocusPathInfo(activeQuest, data.activeBranchTaskId);
  const actionable = nextTasksInList(focusPathInfo.root?.tasks || [], focusPathInfo.root?.mode || "all");
  const focusBoard = addQuestCompletionCard(
    buildFocusBoardFromRoot(focusPathInfo.root),
    activeQuest
  );

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayString();
      const lastTick = localStorage.getItem(LAST_TICK_KEY);

      if (lastTick !== today) {
        setData((old) => runDailyMaintenance(old));
        localStorage.setItem(LAST_TICK_KEY, today);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set(DEFAULT_TAGS);
    quests.forEach((quest) => (quest.tags || []).forEach((tag) => set.add(tag)));
    routines.forEach((routine) => (routine.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [quests, routines]);

  const filteredQuests = useMemo(() => {
    return quests
      .filter((quest) => {
        const text = `${quest.title} ${quest.description} ${(quest.tags || []).join(" ")}`.toLowerCase();
        return (
          text.includes(search.toLowerCase()) &&
          (tagFilter === "All" || (quest.tags || []).includes(tagFilter)) &&
          (!hideCompleted || !isQuestComplete(quest))
        );
      })
      .sort((a, b) => {
        const completeCompare = Number(isQuestComplete(a)) - Number(isQuestComplete(b));
        if (completeCompare !== 0) return completeCompare;
        return (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99") || a.title.localeCompare(b.title);
      });
  }, [quests, search, tagFilter, hideCompleted]);

  const filteredRoutines = useMemo(() => {
    return routines
      .filter((routine) => {
        const text = `${routine.title} ${routine.description} ${(routine.tags || []).join(" ")}`.toLowerCase();
        return text.includes(search.toLowerCase()) && (tagFilter === "All" || (routine.tags || []).includes(tagFilter));
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [routines, search, tagFilter]);

  function createQuest() {
    const quest = makeQuest({ title: "New Quest" });
    setData((old) => ({ ...old, quests: [quest, ...old.quests] }));
    setSelection({ type: "quest", id: quest.id });
  }

  function createRoutine() {
    const routine = makeRoutine({ title: "New Routine" });
    setData((old) => ({ ...old, routines: [routine, ...old.routines] }));
    setSelection({ type: "routine", id: routine.id });
  }

  
function createQuestTask(questId, parentId = null) {
    const task = makeTask({ title: "New Task" });

    setData((old) => ({
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

    if (parentId) setExpanded((old) => ({ ...old, [parentId]: true }));
    setSelection({ type: "task", questId, id: task.id });
  }

  function createRoutineTask(routineId, parentId = null) {
    const task = makeTask({ title: "New Task" });

    setData((old) => {
      let updatedRoutine = null;
      const routines = old.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        const questTemplate = routine.questTemplate || {};
        const rootTask = questTemplate.rootTask || {};
        updatedRoutine = {
          ...routine,
          questTemplate: {
            ...questTemplate,
            rootTask: {
              ...rootTask,
              completed: false,
              children: addTaskToTree(rootTask.children || [], parentId, task),
            },
          },
        };
        return updatedRoutine;
      });

      return {
        ...old,
        routines,
        quests: updatedRoutine
          ? reconcileTodayQuestForRoutine(old.quests, updatedRoutine)
          : old.quests,
      };
    });

    if (parentId) setExpanded((old) => ({ ...old, [parentId]: true }));
    setSelection({ type: "routineTask", routineId, id: task.id });
  }

  function deleteQuest(questId) {
    setData((old) => {
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

  function deleteRoutine(routineId) {
    setData((old) => ({
      ...old,
      quests: old.quests.filter((quest) => quest.routineId !== routineId),
      routines: old.routines.filter((routine) => routine.id !== routineId),
    }));

    setSelection({ type: "none" });
  }

  
function deleteQuestTask(questId, taskId) {
    setData((old) => ({
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

  function deleteRoutineTask(routineId, taskId) {
    setData((old) => {
      let updatedRoutine = null;
      const routines = old.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        const questTemplate = routine.questTemplate || {};
        const rootTask = questTemplate.rootTask || {};
        updatedRoutine = {
          ...routine,
          questTemplate: {
            ...questTemplate,
            rootTask: {
              ...rootTask,
              completed: false,
              children: deleteTaskFromTree(rootTask.children || [], taskId),
            },
          },
        };
        return updatedRoutine;
      });

      return {
        ...old,
        routines,
        quests: updatedRoutine
          ? reconcileTodayQuestForRoutine(old.quests, updatedRoutine)
          : old.quests,
      };
    });

    setSelection({ type: "routine", id: routineId });
  }

  
function moveQuestTask(questId, taskId, direction) {
    setData((old) => ({
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

  function moveRoutineTask(routineId, taskId, direction) {
    setData((old) => {
      let updatedRoutine = null;
      const routines = old.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        const questTemplate = routine.questTemplate || {};
        const rootTask = questTemplate.rootTask || {};
        updatedRoutine = {
          ...routine,
          questTemplate: {
            ...questTemplate,
            rootTask: {
              ...rootTask,
              children: moveTaskInTree(rootTask.children || [], taskId, direction),
            },
          },
        };
        return updatedRoutine;
      });

      return {
        ...old,
        routines,
        quests: updatedRoutine
          ? reconcileTodayQuestForRoutine(old.quests, updatedRoutine)
          : old.quests,
      };
    });
  }

  
function toggleTask(questId, taskId) {
    setData((old) => ({
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
            completedAt: completed ? todayString() : "",
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
    setData((old) => ({
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
    setData((old) => ({ ...old, activeQuestId: questId, activeBranchTaskId: null }));
  }

  function setBranchFocus(taskId) {
    setData((old) => ({ ...old, activeBranchTaskId: taskId }));
  }

  function clearBranchFocus() {
    setData((old) => ({ ...old, activeBranchTaskId: null }));
  }

  
function completeQuest(questId) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;
        if (!isQuestReadyToComplete(quest)) return quest;

        return {
          ...quest,
          status: "completed",
          completedAt: todayString(),
          rootTask: {
            ...quest.rootTask,
            completed: true,
          },
        };
      }),
    }));
  }

  
function restoreQuest(questId) {
    setData((old) => ({
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

  function exportJson() {
    const date = todayString();
    downloadJsonFile(makeAllDataExport(data), `quest-planner-${date}.json`);
  }

  function exportQuestFile(quest = activeQuest) {
    if (!quest) return;

    const date = todayString();
    const filename = `${slugifyFilename(quest.title)}-${date}.quest.json`;
    downloadJsonFile(makeQuestFileExport(quest), filename);
  }

  async function importQuestFile(file) {
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const rawQuest = rawQuestFromQuestPayload(parsed);
      const normalized = normalizeData({ quests: [rawQuest], routines: [] });
      const importedQuest = normalized.quests[0];

      if (!importedQuest) throw new Error("No quest found in file.");

      setData((old) => {
        const existing = (old.quests || []).some((quest) => quest.id === importedQuest.id);
        const quests = existing
          ? old.quests.map((quest) => (quest.id === importedQuest.id ? importedQuest : quest))
          : [importedQuest, ...(old.quests || [])];

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
      setExpanded({});
      setTreeEditMode(false);
      setExpandedKanbanCards({});
    } catch (error) {
      window.alert("Could not load that quest file. It may not be a valid quest scene export.");
    }
  }

  function exportRoutineFile(routine = selectedRoutineForExport) {
    if (!routine) return;

    const date = todayString();
    const filename = `${slugifyFilename(routine.title, "routine")}-${date}.routine.json`;
    downloadJsonFile(makeRoutineFileExport(routine), filename);
  }

  async function importRoutineFile(file) {
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const rawRoutine = rawRoutineFromRoutinePayload(parsed);
      const normalized = normalizeData({ quests: [], routines: [rawRoutine] });
      const importedRoutine = normalized.routines[0];

      if (!importedRoutine) throw new Error("No routine found in file.");

      setData((old) => {
        const existing = (old.routines || []).some((routine) => routine.id === importedRoutine.id);
        const routines = existing
          ? old.routines.map((routine) => (routine.id === importedRoutine.id ? importedRoutine : routine))
          : [importedRoutine, ...(old.routines || [])];

        const nextData = runDailyMaintenance({
          ...old,
          routines,
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
        localStorage.setItem(LAST_TICK_KEY, todayString());
        return nextData;
      });

      setSelection({ type: "routine", id: importedRoutine.id });
      setHistory([{ type: "routine", id: importedRoutine.id }]);
      setHistoryIndex(0);
      setExpanded({});
      setTreeEditMode(false);
      setExpandedKanbanCards({});
    } catch (error) {
      window.alert("Could not load that routine file. It may not be a valid routine template export.");
    }
  }

  async function importJsonFile(file) {
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const rawData = rawDataFromPlannerPayload(parsed);
      const imported = runDailyMaintenance(normalizeData(rawData));

      setData(imported);
      setSelection({ type: "quest", id: imported.activeQuestId || imported.quests[0]?.id || null });
      setHistory([{ type: "quest", id: imported.activeQuestId || imported.quests[0]?.id || null }]);
      setHistoryIndex(0);
      setExpanded({});
      setTreeEditMode(false);
      setExpandedKanbanCards({});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      localStorage.setItem(LAST_TICK_KEY, todayString());
    } catch (error) {
      window.alert("Could not load that JSON file. It may not be a valid quest planner export.");
    }
  }

  function resetToDefaults() {
    const confirmed = window.confirm("Reset all quests and routines to the default state? This clears the saved app data in this browser.");
    if (!confirmed) return;

    const resetData = runDailyMaintenance(normalizeData(seedData));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_TICK_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetData));
    localStorage.setItem(LAST_TICK_KEY, todayString());

    setData(resetData);
    setSelection({ type: "quest", id: resetData.activeQuestId || resetData.quests[0]?.id || null });
    setHistory([{ type: "quest", id: resetData.activeQuestId || resetData.quests[0]?.id || null }]);
    setHistoryIndex(0);
    setExpanded({});
    setTreeEditMode(false);
    setExpandedKanbanCards({});
  }

  function runMaintenanceNow() {
    setData((old) => runDailyMaintenance(old));
    localStorage.setItem(LAST_TICK_KEY, todayString());
  }

  function dueBadge(item) {
    const today = todayString();
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
          quests={filteredQuests}
          routines={filteredRoutines}
          activeQuestId={data.activeQuestId}
          dueBadge={dueBadge}
          createQuest={createQuest}
          createRoutine={createRoutine}
          exportJson={exportJson}
          importJsonFile={importJsonFile}
          exportQuestFile={exportQuestFile}
          importQuestFile={importQuestFile}
          hasActiveQuest={Boolean(activeQuest)}
          exportRoutineFile={exportRoutineFile}
          importRoutineFile={importRoutineFile}
          hasSelectedRoutine={Boolean(selectedRoutineForExport)}
          resetToDefaults={resetToDefaults}
          selectQuest={(quest) => setSelection({ type: "quest", id: quest.id })}
          selectRoutine={(routine) => setSelection({ type: "routine", id: routine.id })}
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
          actionable={actionable}
          focusBoard={focusBoard}
          focusPathInfo={focusPathInfo}
          branchFocusId={data.activeBranchTaskId}
          setBranchFocus={setBranchFocus}
          clearBranchFocus={clearBranchFocus}
          dueBadge={dueBadge}
          selectQuest={(quest) => setSelection({ type: "quest", id: quest.id })}
          selectTask={(task) => setSelection({ type: "task", questId: activeQuest.id, id: task.id })}
          toggleTask={(rowOrTask) => {
            const task = rowOrTask.task || rowOrTask;
            return (((rowOrTask.kind === "questCompletion" || rowOrTask.kind === "rootTask") || rowOrTask.kind === "rootTask") || rowOrTask.kind === "rootTask")
              ? completeQuest(activeQuest.id)
              : toggleTask(activeQuest.id, task.id);
          }}
          uncompleteTask={(rowOrTask) => {
            const task = rowOrTask.task || rowOrTask;
            return (((rowOrTask.kind === "questCompletion" || rowOrTask.kind === "rootTask") || rowOrTask.kind === "rootTask") || rowOrTask.kind === "rootTask")
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
          setData={setData}
          setSelection={setSelection}
          allTags={allTags}
          activeQuest={activeQuest}
          activeQuestId={data.activeQuestId}
          expanded={expanded}
          setExpanded={setExpanded}
          treeEditMode={treeEditMode}
          setTreeEditMode={setTreeEditMode}
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
          createRoutineTask={createRoutineTask}
          deleteQuest={deleteQuest}
          deleteRoutine={deleteRoutine}
          deleteQuestTask={deleteQuestTask}
          deleteRoutineTask={deleteRoutineTask}
          moveQuestTask={moveQuestTask}
          moveRoutineTask={moveRoutineTask}
          toggleTask={toggleTask}
          runMaintenanceNow={runMaintenanceNow}
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
  quests,
  routines,
  activeQuestId,
  dueBadge,
  createQuest,
  createRoutine,
  exportJson,
  importJsonFile,
  exportQuestFile,
  importQuestFile,
  hasActiveQuest,
  exportRoutineFile,
  importRoutineFile,
  hasSelectedRoutine,
  resetToDefaults,
  selectQuest,
  selectRoutine,
}) {
  const tabs = [
    {
      id: PANEL_IDS.QUEST_BOARD,
      title: "Quest Board",
      content: (
        <QuestBoardPanel
          search={search}
          setSearch={setSearch}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          allTags={allTags}
          hideCompleted={hideCompleted}
          setHideCompleted={setHideCompleted}
          quests={quests}
          activeQuestId={activeQuestId}
          dueBadge={dueBadge}
          createQuest={createQuest}
          selectQuest={selectQuest}
        />
      ),
    },
    {
      id: PANEL_IDS.ROUTINE_PANEL,
      title: "Routines",
      content: (
        <RoutinePanel
          search={search}
          setSearch={setSearch}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          allTags={allTags}
          routines={routines}
          createRoutine={createRoutine}
          selectRoutine={selectRoutine}
        />
      ),
    },
    {
      id: PANEL_IDS.EXPORT_PANEL,
      title: "Save/Load",
      content: (
        <ExportPanel
          exportJson={exportJson}
          importJsonFile={importJsonFile}
          exportQuestFile={exportQuestFile}
          importQuestFile={importQuestFile}
          hasActiveQuest={hasActiveQuest}
          exportRoutineFile={exportRoutineFile}
          importRoutineFile={importRoutineFile}
          hasSelectedRoutine={hasSelectedRoutine}
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
      content: <FocusPanel {...focusProps} />,
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

function TopRightDock({ activePanelId, setActivePanelId, rightSplit, inspectorProps }) {
  const tabs = [
    {
      id: PANEL_IDS.INSPECTOR_PANEL,
      title: "Inspector",
      content: <InspectorPanel {...inspectorProps} embedded />,
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
      content: <TreePanel {...treePanelProps} embedded />,
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
    treeEditMode,
    setTreeEditMode,
    rightSplit,
    setRightSplit,
    setSelection,
    createQuestTask,
    createRoutineTask,
    deleteQuestTask,
    deleteRoutineTask,
    moveQuestTask,
    moveRoutineTask,
    toggleTask,
  } = props;

  const treeContext = getTreeContext(selection, data, activeQuest);
  const effectiveTreeEditMode = treeContext.quest?.locked ? false : treeEditMode;
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
          effectiveTreeEditMode,
          treeEditMode,
          setTreeEditMode,
          rightSplit,
          selection,
          expanded,
          setExpanded,
          setSelection,
          createQuestTask,
          createRoutineTask,
          deleteQuestTask,
          deleteRoutineTask,
          moveQuestTask,
          moveRoutineTask,
          toggleTask,
        }}
      />
    </aside>
  );
}


function PanelTitleBar({ title, children, className = "" }) {
  return (
    <div className={`panel-title-bar ${className}`}>
      <div className="panel-title-text">{title}</div>
      {children && <div className="panel-title-actions">{children}</div>}
    </div>
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
        gap: 0.2rem;
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
      .inspector-title-routine {
        background: rgb(120 53 15);
        border-bottom-color: rgb(217 119 6);
      }
      .inspector-title-routineTask {
        background: rgb(120 53 15);
        border-bottom-color: rgb(217 119 6);
      }
      .inspector-toolbar {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
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
      .inspector-selection-badge {
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
      .inspector-selection-badge.inspector-title-routine,
      .inspector-selection-badge.inspector-title-routineTask {
        border-color: rgb(217 119 6);
        background: rgb(120 53 15);
        color: rgb(254 215 170);
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
      .tree-scene-root {
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
      .inspector-tab-content-debug > .inspector-tab-root {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 0;
      }
      .inspector-tab-root {
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
      .inspector-tab-root.inspector-tab-root-embedded {
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
      .routine-tree {
        border-color: rgb(217 119 6);
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
      .tree-mode-pill {
        display: inline-flex;
        border-radius: 0.35rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgb(64 64 64);
        color: rgb(229 229 229);
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
        margin-left: 1.35rem;
        padding-left: 0.55rem;
        display: grid;
        gap: 0.15rem;
        width: calc(100% - 1.35rem);
        min-width: 0;
      }
      .tree-row-wrap.tree-node-child::after {
        content: "";
        position: absolute;
        left: calc(-0.55rem - 12px);
        top: -0.15rem;
        bottom: calc(50% - 1px);
        width: 2px;
        background: ${TREE_BRANCH_LINE_COLOR};
        opacity: 1;
      }
      .tree-node-wrap:not(:last-child) > .tree-row-wrap.tree-node-child::after {
        bottom: -0.15rem;
      }
      .tree-row-wrap.tree-node-child::before {
        content: "";
        position: absolute;
        left: calc(-0.55rem - 12px);
        top: 0.78rem;
        width: calc(0.55rem + 12px);
        height: 2px;
        background: ${TREE_BRANCH_LINE_COLOR};
        opacity: 1;
      }
      .tree-row-wrap.tree-node-child.tree-row-leaf::before {
        width: calc(1.9rem + 12px);
      }
      .tree-row {
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
      .tree-row:hover {
        border-color: transparent;
        background: rgba(59, 130, 246, 0.18);
      }
      .tree-row-selected,
      .tree-row-selected:hover {
        border-color: rgba(255, 255, 255, 0.82);
        background: rgba(59, 130, 246, 0.18);
      }
      .tree-root-row {
        margin-bottom: 0.5rem;
        font-weight: 800;
        justify-content: center;
      }
      .tree-scene-header .tree-root-row {
        margin-bottom: 0;
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
      .tree-root-routine {
        border-color: rgb(217 119 6);
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
      .tree-root-root-quest-type-regular {
        border-width: 2px;
      }
      .tree-root-root-quest-type-routine {
        border-width: 2px;
      }
      .tree-root-root-quest-type-cooldown {
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
      .tree-root-root-quest-type-cooldown {
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
      .selection-routine {
        border-color: rgb(126 34 206);
      }
      .selection-routine .selection-type-label {
        background: rgb(88 28 135);
        color: rgb(233 213 255);
      }
      .selection-routineTask {
        border-color: rgb(147 51 234);
      }
      .selection-routineTask .selection-type-label {
        background: rgb(107 33 168);
        color: rgb(243 232 255);
      }
      .focus-scene-root {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .focus-empty-message {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0.5rem;
      }
      .focus-panel-content {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0;
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
      .focus-description-text {
        margin-top: 0.25rem;
        white-space: pre-wrap;
        font-size: 1rem;
        line-height: 1.5;
        color: rgb(212 212 212);
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
      .recommended-task-row {
        margin-top: 0.5rem;
        min-height: 3rem;
        padding-right: 8.5rem;
      }
      .recommended-task-text {
        min-width: 0;
        text-align: left;
      }
      .recommended-action-button {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        min-width: 7.5rem;
      }
      .focus-recommend-panel {
        position: relative;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.9rem;
      
      
        padding-right: 9.5rem;
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
        gap: 0.2rem;
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
        gap: 0.2rem;
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
