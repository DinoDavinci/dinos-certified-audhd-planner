import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Search,
  Trash2,
  Pencil,
} from "lucide-react";

import {
  getQuestProgress,
  isQuestComplete,
  isQuestInactive,
  questTypeClass,
} from "../../models/appModel";

function getDirectFolderChildren(folders, parentId) {
  return (folders || [])
    .filter((folder) => (folder.parentId || null) === (parentId || null))
    .sort((a, b) => getProjectPathBaseName(a.id).localeCompare(getProjectPathBaseName(b.id)));
}

function getDirectFolderQuests(quests, folderId) {
  return (quests || [])
    .filter((quest) => (quest.folderId || null) === (folderId || null))
    .sort((a, b) => {
      const completeCompare = Number(isQuestComplete(a)) - Number(isQuestComplete(b));
      if (completeCompare !== 0) return completeCompare;
      return (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99") || a.title.localeCompare(b.title);
    });
}

function countFolderContents(folders, quests, folderId) {
  const childFolders = getDirectFolderChildren(folders, folderId);
  const directQuests = getDirectFolderQuests(quests, folderId);
  return childFolders.length + directQuests.length;
}

function normalizeProjectRelativePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function getProjectPathBaseName(path) {
  const normalized = normalizeProjectRelativePath(path);
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function joinProjectRelativePath(folderId, fileName) {
  const cleanFolderId = normalizeProjectRelativePath(folderId);
  const cleanFileName = getProjectPathBaseName(fileName);
  return cleanFolderId ? `${cleanFolderId}/${cleanFileName}` : cleanFileName;
}

function getProjectPathParent(path) {
  const normalized = normalizeProjectRelativePath(path);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

function isProjectPathDescendant(path, possibleAncestorPath) {
  const normalizedPath = normalizeProjectRelativePath(path);
  const normalizedAncestor = normalizeProjectRelativePath(possibleAncestorPath);

  return Boolean(
    normalizedPath &&
    normalizedAncestor &&
    normalizedPath.startsWith(`${normalizedAncestor}/`)
  );
}

const DIRECTORY_DRAG_HOLD_MS = 180;
const FORCE_DIRECTORY_REARRANGE_MODE = false;

export default function QuestBoardTab({
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
  folders = [],
  activeQuestId,
  selectedFolderId = null,
  setSelectedFolderId,
  expandedFolders = {},
  setExpandedFolders,
  dueBadge,
  createQuest,
  createQuestFolder,
  renameQuestFolder,
  deleteQuestFolder,
  moveQuestToFolder,
  moveQuestFolderToFolder,
  selectQuest,
  projectRootPath = "",
  projectLoadSummary = "",
  chooseQuestProjectFolder,
  refreshQuestProjectFolder,
}) {
  const [interactionMode, setInteractionMode] = useState(
    FORCE_DIRECTORY_REARRANGE_MODE ? "rearrange" : "normal"
  );
  const isRearrangeMode = interactionMode === "rearrange";
  const interactionClassName = isRearrangeMode
    ? "quest-directory-rearrange"
    : "quest-directory-normal";
  const [dropIndicator, setDropIndicator] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [directorySelection, setDirectorySelection] = useState(null);
  const [pendingOverwriteMove, setPendingOverwriteMove] = useState(null);
  const [pendingFolderRename, setPendingFolderRename] = useState(null);
  const directoryContentRef = useRef(null);
  const dragStateRef = useRef(null);
  const pendingPressRef = useRef(null);
  const dragHoldTimerRef = useRef(null);
  const dropIndicatorRef = useRef(null);
  const latestDirectoryDataRef = useRef({
    folders,
    quests,
    renameQuestFolder,
    moveQuestToFolder,
    moveQuestFolderToFolder,
    setExpandedFolders,
  });

  useEffect(() => {
    latestDirectoryDataRef.current = {
      folders,
      quests,
      renameQuestFolder,
      moveQuestToFolder,
      moveQuestFolderToFolder,
      setExpandedFolders,
    };
  }, [folders, quests, renameQuestFolder, moveQuestToFolder, moveQuestFolderToFolder, setExpandedFolders]);

  useEffect(() => {
    if (dragStateRef.current || pendingPressRef.current) return;

    setDirectorySelection(
      selectedFolderId
        ? { kind: "folder", id: selectedFolderId }
        : { kind: "root", id: "root" }
    );
  }, [selectedFolderId]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    dropIndicatorRef.current = dropIndicator;
  }, [dropIndicator]);

  useEffect(() => {
    function handleWindowPointerMove(event) {
      const activeDrag = dragStateRef.current;
      if (!activeDrag) return;
      if (activeDrag.pointerId !== event.pointerId) return;

      const nextIndicator = getDirectoryDropIndicatorFromPoint(event, directoryContentRef.current);
      dropIndicatorRef.current = nextIndicator;
      setDropIndicator(nextIndicator);
    }

    function handleWindowPointerUp(event) {
      const activeDrag = dragStateRef.current;
      const pendingPress = pendingPressRef.current;
      const pointerId = activeDrag?.pointerId ?? pendingPress?.pointerId;

      if (pointerId == null || pointerId !== event.pointerId) return;
      finishDirectoryPress(event);
    }

    function handleWindowPointerCancel(event) {
      const activeDrag = dragStateRef.current;
      const pendingPress = pendingPressRef.current;
      const pointerId = activeDrag?.pointerId ?? pendingPress?.pointerId;

      if (pointerId == null || pointerId !== event.pointerId) return;
      cancelDirectoryPress();
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    };
  }, []);

  function updateDirectoryDropIndicator(event, id, forcedZone = null) {
    if (!isRearrangeMode || !id) return;
    if (!dragStateRef.current) return;

    const nextIndicator =
      getDirectoryDropIndicatorFromPoint(event, directoryContentRef.current) ||
      getDirectoryDropIndicator(
        event,
        directoryContentRef.current,
        id,
        forcedZone
      );

    if (!nextIndicator) return;

    dropIndicatorRef.current = nextIndicator;
    setDropIndicator(nextIndicator);
  }

  function clearDirectoryDropIndicator() {
    if (dragStateRef.current) return;

    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }

  function getMoveDebugPreview() {
    const source = dragStateRef.current || dragState;
    const target = dropIndicatorRef.current || dropIndicator;
    const latest = latestDirectoryDataRef.current;
    const latestFolders = latest.folders || [];
    const latestQuests = latest.quests || [];

    if (!source) {
      return {
        level: "idle",
        kind: "idle",
        text: "not dragging",
        detail: "Hold a quest row, then hover a target.",
      };
    }

    const moveTarget = resolveDirectoryMoveTarget(target);

    if (!moveTarget.ok) {
      return {
        level: "bad",
        kind: "illegal",
        text: `Move debug: illegal (${moveTarget.reason || "unknown"})`,
        detail: `source=${source.kind}:${source.id || "(missing)"} target=${target?.id || "(none)"}`,
      };
    }

    if (source.kind === "folder") {
      const folder = latestFolders.find((item) => item.id === source.id);

      if (!folder) {
        return {
          level: "bad",
          kind: "missing-folder-source",
          text: "Move debug: source folder not found",
          detail: `source=${source.id || "(missing)"}`,
        };
      }

      const sourcePath = normalizeProjectRelativePath(folder.id);
      const sourceParent = getProjectPathParent(sourcePath);
      const folderName = getProjectPathBaseName(sourcePath);
      const destinationParent = moveTarget.folderId ? normalizeProjectRelativePath(moveTarget.folderId) : "";
      const destinationPath = joinProjectRelativePath(destinationParent || null, folderName);

      if ((sourceParent || null) === (destinationParent || null)) {
        return {
          level: "bad",
          kind: "same-folder",
          text: "Move debug: same parent / no-op",
          detail: `source=${sourcePath} target=${moveTarget.folderId || "root"} destination=${destinationPath}`,
        };
      }

      if (destinationParent && destinationParent === sourcePath) {
        return {
          level: "bad",
          kind: "folder-into-self",
          text: "Move debug: folder into itself",
          detail: `source=${sourcePath} destinationParent=${destinationParent}`,
        };
      }

      if (destinationParent && isProjectPathDescendant(destinationParent, sourcePath)) {
        return {
          level: "bad",
          kind: "folder-into-child",
          text: "Move debug: folder into child",
          detail: `source=${sourcePath} destinationParent=${destinationParent}`,
        };
      }

      const mergeTarget = latestFolders.find((item) =>
        normalizeProjectRelativePath(item.id) === normalizeProjectRelativePath(destinationPath)
      );

      if (mergeTarget) {
        return {
          level: "bad",
          kind: "folder-merge-risk",
          text: "Move debug: folder merge rejected",
          detail: `source=${sourcePath} target=${moveTarget.folderId || "root"} destination=${destinationPath}`,
          sourcePath,
          destinationPath,
        };
      }

      return {
        level: "ok",
        kind: "legal-folder-move",
        text: "Move debug: legal folder move",
        detail: `source=${sourcePath} target=${moveTarget.folderId || "root"} destination=${destinationPath}`,
        sourcePath,
        destinationPath,
      };
    }

    if (source.kind !== "quest") {
      return {
        level: "bad",
        kind: "illegal-source",
        text: `Move debug: illegal source (${source.kind || "missing"})`,
        detail: `source=${source.id || "(missing)"}`,
      };
    }

    const quest = latestQuests.find((item) => item.id === source.id);

    if (!quest) {
      return {
        level: "bad",
        kind: "missing-source",
        text: "Move debug: source quest not found",
        detail: `source=${source.id || "(missing)"}`,
      };
    }

    const sourcePath = normalizeProjectRelativePath(quest.projectRelativePath || quest.id);
    const fileName = getProjectPathBaseName(sourcePath);
    const destinationPath = joinProjectRelativePath(moveTarget.folderId || null, fileName);
    const sourceFolder = quest.folderId || null;
    const destinationFolder = moveTarget.folderId || null;

    if ((sourceFolder || null) === (destinationFolder || null)) {
      return {
        level: "bad",
        kind: "same-folder",
        text: "Move debug: same folder / no-op",
        detail: `source=${sourcePath} destination=${destinationPath}`,
      };
    }

    const collisionQuest = latestQuests.find((item) => {
      const itemPath = normalizeProjectRelativePath(item.projectRelativePath || item.id);
      return item.id !== quest.id && itemPath === destinationPath;
    });

    if (collisionQuest) {
      return {
        level: "bad",
        kind: "overwrite-risk",
        text: "Move debug: overwrite risk",
        detail: `source=${sourcePath} destination=${destinationPath} existing=${normalizeProjectRelativePath(collisionQuest.projectRelativePath || collisionQuest.id)}`,
        sourcePath,
        destinationPath,
        existingPath: normalizeProjectRelativePath(collisionQuest.projectRelativePath || collisionQuest.id),
      };
    }

    return {
      level: "ok",
      kind: "legal-quest-move",
      text: "Move debug: legal quest move",
      detail: `source=${sourcePath} destination=${destinationPath}`,
      sourcePath,
      destinationPath,
    };
  }

  function beginDirectoryPress(event, source) {
    if (!source?.id || !source?.kind) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    clearDirectoryDragHoldTimer();

    const nextPendingPress = {
      ...source,
      pointerId: event.pointerId,
      startedAtClientX: event.clientX,
      startedAtClientY: event.clientY,
    };

    setDirectorySelection({ kind: source.kind, id: source.id });
    source.selectDirectory?.();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pendingPressRef.current = nextPendingPress;

    dragHoldTimerRef.current = window.setTimeout(() => {
      const pendingPress = pendingPressRef.current;
      if (!pendingPress || pendingPress.pointerId !== event.pointerId) return;

      dragStateRef.current = pendingPress;
      setInteractionMode("rearrange");
      setDragState(pendingPress);
    }, DIRECTORY_DRAG_HOLD_MS);
  }

  function finishDirectoryPress(event) {
    const pendingPress = pendingPressRef.current;
    const activeDrag = dragStateRef.current;

    event.preventDefault();
    event.stopPropagation();
    clearDirectoryDragHoldTimer();

    if (activeDrag) {
      finishDirectoryDrag(event, activeDrag);
      return;
    }

    if (pendingPress) {
      pendingPress.select?.();
      pendingPressRef.current = null;
    }
  }

  function finishDirectoryDrag(event, activeDrag = dragStateRef.current) {
    if (!activeDrag) return;

    const releaseTarget =
      getDirectoryDropIndicatorFromPoint(event, directoryContentRef.current) ||
      dropIndicatorRef.current;

    const moveTarget = resolveDirectoryMoveTarget(releaseTarget);

    if (moveTarget.ok) {
      applyDirectoryMove(activeDrag, moveTarget);
    } else {
    }

    activeDrag.select?.();

    pendingPressRef.current = null;
    dragStateRef.current = null;
    setDragState(null);
    setInteractionMode(FORCE_DIRECTORY_REARRANGE_MODE ? "rearrange" : "normal");
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }

  function resolveDirectoryMoveTarget(releaseTarget) {
    if (!releaseTarget?.id) {
      return { ok: false, reason: "missing-drop-target" };
    }

    const placement = releaseTarget.placement || releaseTarget.zone;

    if (releaseTarget.targetKind === "root" || releaseTarget.id === "root") {
      return {
        ok: true,
        folderId: null,
        placement: "inside-root",
        reason: "target-root",
      };
    }

    if (placement === "inside" || placement === "first-child") {
      if (releaseTarget.targetKind !== "folder") {
        return {
          ok: false,
          reason: "inside-target-is-not-folder",
          placement,
          targetKind: releaseTarget.targetKind,
        };
      }

      return {
        ok: true,
        folderId: releaseTarget.id,
        placement,
        reason: "target-folder-inside",
      };
    }

    return {
      ok: true,
      folderId: releaseTarget.targetParentId === "root" ? null : releaseTarget.targetParentId || null,
      placement,
      reason: "target-parent-folder",
    };
  }

  function applyDirectoryMove(activeDrag, moveTarget) {
    if (!activeDrag?.id || !moveTarget?.ok) return;
    if (activeDrag.kind === "root") return;

    const latest = latestDirectoryDataRef.current;
    const latestMoveQuestToFolder = latest.moveQuestToFolder;
    const latestMoveQuestFolderToFolder = latest.moveQuestFolderToFolder;
    const latestSetExpandedFolders = latest.setExpandedFolders;

    if (activeDrag.kind === "quest") {
      const preview = getMoveDebugPreview();

      console.warn("[Directory rearrange] quest move preview", {
        source: activeDrag,
        moveTarget,
        preview,
      });

      if (preview.kind === "overwrite-risk") {
        setPendingOverwriteMove({
          sourceId: activeDrag.id,
          folderId: moveTarget.folderId || null,
          sourcePath: preview.sourcePath || "",
          destinationPath: preview.destinationPath || "",
          existingPath: preview.existingPath || "",
          preview,
        });
        return;
      }

      if (preview.level !== "ok") {
        console.warn("[Directory rearrange] quest move blocked by preview", {
          source: activeDrag,
          moveTarget,
          preview,
        });
        return;
      }

      latestMoveQuestToFolder?.(activeDrag.id, moveTarget.folderId || null);
      return;
    }

    if (activeDrag.kind === "folder") {
      const preview = getMoveDebugPreview();

      console.warn("[Directory rearrange] folder move preview", {
        source: activeDrag,
        moveTarget,
        preview,
      });

      if (preview.level !== "ok") {
        console.warn("[Directory rearrange] folder move blocked by preview", {
          source: activeDrag,
          moveTarget,
          preview,
        });
        return;
      }

      latestMoveQuestFolderToFolder?.(activeDrag.id, moveTarget.folderId || null);
    }

    if (moveTarget.folderId) {
      latestSetExpandedFolders?.((old) => ({ ...old, [moveTarget.folderId]: true }));
    }
  }

  function getFolderRenameValidation(renameState = pendingFolderRename) {
    if (!renameState) {
      return { ok: false, message: "No folder selected." };
    }

    const latest = latestDirectoryDataRef.current;
    const latestFolders = latest.folders || [];
    const folder = latestFolders.find((item) => item.id === renameState.folderId);

    if (!folder) {
      return { ok: false, message: "Folder no longer exists." };
    }

    const rawName = String(renameState.name || "");
    const name = rawName;

    if (!name.trim()) {
      return { ok: false, message: "Name cannot be empty." };
    }

    if (name !== name.trim()) {
      return { ok: false, message: "Name cannot start or end with spaces." };
    }

    if (name === "." || name === "..") {
      return { ok: false, message: "Name cannot be . or ..." };
    }

    if (/[\\/:*?"<>|]/.test(name)) {
      return { ok: false, message: "Name contains an invalid filename character." };
    }

    if (name.startsWith(".") || name.endsWith(".")) {
      return { ok: false, message: "Name cannot start or end with a period." };
    }

    const parentId = folder.parentId || getProjectPathParent(folder.id);
    const destinationPath = joinProjectRelativePath(parentId || null, name);
    const normalizedDestinationPath = normalizeProjectRelativePath(destinationPath);
    const normalizedSourcePath = normalizeProjectRelativePath(folder.id);

    if (normalizedDestinationPath === normalizedSourcePath) {
      return { ok: true, message: "Name is valid.", destinationPath: normalizedDestinationPath };
    }

    const existingFolder = latestFolders.find((item) =>
      normalizeProjectRelativePath(item.id) === normalizedDestinationPath
    );

    if (existingFolder) {
      return { ok: false, message: "A folder with that name already exists." };
    }

    return { ok: true, message: "Name is valid.", destinationPath: normalizedDestinationPath };
  }

  function openFolderRenameModal(folder) {
    if (!folder?.id) return;

    setPendingFolderRename({
      folderId: folder.id,
      originalName: getProjectPathBaseName(folder.id) || "Untitled Folder",
      name: getProjectPathBaseName(folder.id) || "Untitled Folder",
    });
  }

  function cancelFolderRename() {
    setPendingFolderRename(null);
  }

  function confirmFolderRename() {
    const validation = getFolderRenameValidation();

    if (!validation.ok) return;

    const renameState = pendingFolderRename;
    if (!renameState?.folderId) return;

    const cleanName = String(renameState.name || "");

    setPendingFolderRename(null);
    latestDirectoryDataRef.current.renameQuestFolder?.(renameState.folderId, cleanName);
  }

  function cancelOverwriteMove() {
    setPendingOverwriteMove(null);
  }

  function confirmOverwriteMove() {
    const move = pendingOverwriteMove;
    if (!move?.sourceId) {
      setPendingOverwriteMove(null);
      return;
    }

    setPendingOverwriteMove(null);
    latestDirectoryDataRef.current.moveQuestToFolder?.(move.sourceId, move.folderId || null);
  }

  function cancelDirectoryPress() {
    const pendingPress = pendingPressRef.current;
    const activeDrag = dragStateRef.current;

    clearDirectoryDragHoldTimer();
    pendingPressRef.current = null;

    if (activeDrag) {
    } else if (pendingPress) {
    }

    dragStateRef.current = null;
    setDragState(null);
    setInteractionMode(FORCE_DIRECTORY_REARRANGE_MODE ? "rearrange" : "normal");
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }

  function clearDirectoryDragHoldTimer() {
    if (!dragHoldTimerRef.current) return;

    window.clearTimeout(dragHoldTimerRef.current);
    dragHoldTimerRef.current = null;
  }

  return (
    <div className={`tab-scene-margin library-scene quest-board-root ${interactionClassName}`}>
      <style>{`
        .quest-directory-move-debug {
          display: grid;
          gap: 0.15rem;
          border-radius: 0.3rem;
          border: 1px solid rgb(64 64 64);
          padding: 0.3rem 0.45rem;
          font-size: 0.68rem;
          font-weight: 750;
          line-height: 1.25;
          overflow: hidden;
        }
        .quest-directory-move-debug strong,
        .quest-directory-move-debug span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .quest-directory-move-debug-idle {
          background: rgba(64, 64, 64, 0.35);
          color: rgb(212 212 212);
        }
        .quest-directory-move-debug-ok {
          border-color: rgba(34, 197, 94, 0.75);
          background: rgba(22, 101, 52, 0.55);
          color: rgb(220 252 231);
        }
        .quest-directory-move-debug-bad {
          border-color: rgba(239, 68, 68, 0.78);
          background: rgba(127, 29, 29, 0.62);
          color: rgb(254 226 226);
        }
        .quest-directory-overwrite-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.58);
        }
        .quest-directory-overwrite-modal {
          width: min(34rem, calc(100vw - 2rem));
          display: grid;
          gap: 0.8rem;
          border-radius: 0.45rem;
          border: 1px solid rgb(82 82 82);
          background: rgb(23 23 23);
          padding: 1rem;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
        }
        .quest-directory-overwrite-modal-title {
          font-size: 1rem;
          font-weight: 900;
          color: rgb(245 245 245);
        }
        .quest-directory-overwrite-modal-body {
          display: grid;
          gap: 0.65rem;
          font-size: 0.8rem;
          color: rgb(212 212 212);
        }
        .quest-directory-overwrite-modal-body p {
          margin: 0;
        }
        .quest-directory-overwrite-modal-paths {
          display: grid;
          gap: 0.45rem;
        }
        .quest-directory-overwrite-modal-paths div {
          display: grid;
          gap: 0.15rem;
        }
        .quest-directory-overwrite-modal-paths span {
          font-size: 0.68rem;
          font-weight: 850;
          color: rgb(163 163 163);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .quest-directory-overwrite-modal-paths code {
          overflow: hidden;
          border-radius: 0.3rem;
          background: rgba(0, 0, 0, 0.35);
          padding: 0.3rem 0.45rem;
          color: rgb(229 229 229);
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .quest-directory-overwrite-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        .quest-directory-overwrite-cancel,
        .quest-directory-overwrite-confirm {
          border-radius: 0.35rem;
          border: 1px solid rgb(64 64 64);
          padding: 0.38rem 0.7rem;
          font-size: 0.78rem;
          font-weight: 850;
        }
        .quest-directory-overwrite-cancel {
          background: rgb(38 38 38);
          color: rgb(229 229 229);
        }
        .quest-directory-overwrite-confirm {
          border-color: rgba(239, 68, 68, 0.72);
          background: rgba(127, 29, 29, 0.9);
          color: rgb(254 226 226);
        }
        .quest-directory-rename-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.58);
        }
        .quest-directory-rename-modal {
          width: min(30rem, calc(100vw - 2rem));
          display: grid;
          gap: 0.8rem;
          border-radius: 0.45rem;
          border: 1px solid rgb(82 82 82);
          background: rgb(23 23 23);
          padding: 1rem;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
        }
        .quest-directory-rename-modal-title {
          font-size: 1rem;
          font-weight: 900;
          color: rgb(245 245 245);
        }
        .quest-directory-rename-modal-body {
          display: grid;
          gap: 0.5rem;
        }
        .quest-directory-rename-field {
          display: grid;
          gap: 0.3rem;
          font-size: 0.74rem;
          font-weight: 850;
          color: rgb(212 212 212);
        }
        .quest-directory-rename-field input {
          width: 100%;
          border-radius: 0.35rem;
          border: 1px solid rgb(64 64 64);
          background: rgb(10 10 10);
          padding: 0.45rem 0.55rem;
          font-size: 0.85rem;
          color: rgb(245 245 245);
        }
        .quest-directory-rename-validation {
          font-size: 0.76rem;
          font-weight: 850;
        }
        .quest-directory-rename-validation-ok {
          color: rgb(134 239 172);
        }
        .quest-directory-rename-validation-bad {
          color: rgb(252 165 165);
        }
        .quest-directory-rename-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        .quest-directory-rename-cancel,
        .quest-directory-rename-confirm {
          border-radius: 0.35rem;
          border: 1px solid rgb(64 64 64);
          padding: 0.38rem 0.7rem;
          font-size: 0.78rem;
          font-weight: 850;
        }
        .quest-directory-rename-cancel {
          background: rgb(38 38 38);
          color: rgb(229 229 229);
        }
        .quest-directory-rename-confirm {
          background: rgb(229 229 229);
          color: rgb(23 23 23);
        }
        .quest-directory-rename-confirm:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
      `}</style>
      <div className="quest-board-toolbar">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
            <input className="field py-2 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="" />
          </div>

          <select className="field py-2" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option>All</option>
            {allTags.map((tag) => <option key={tag}>{tag}</option>)}
          </select>

          <label className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
            <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
            Hide complete
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} />
            Show disabled
          </label>
        </div>

        <div className="quest-directory-toolbar-row">
          <button onClick={() => createQuest(selectedFolderId)} className="quest-directory-create-button"><Plus size={16} /> Quest</button>
          <button onClick={() => createQuestFolder(selectedFolderId)} className="quest-directory-create-button"><Plus size={16} /> Folder</button>
        </div>

        <div className="quest-directory-project-row">
          <button
            type="button"
            className="quest-directory-project-button"
            onClick={chooseQuestProjectFolder}
          >
            Choose Project
          </button>
          <button
            type="button"
            className="quest-directory-project-button"
            onClick={() => refreshQuestProjectFolder?.()}
            disabled={!projectRootPath}
          >
            Refresh
          </button>
        </div>

        <div className="quest-directory-project-status" title={projectRootPath || "No project folder selected"}>
          {projectRootPath ? projectRootPath : "No project folder selected"}
          {projectLoadSummary ? <span>{projectLoadSummary}</span> : null}
        </div>

        {(() => {
          const preview = getMoveDebugPreview();
          return (
            <div
              className={`quest-directory-move-debug quest-directory-move-debug-${preview.level}`}
              title={preview.detail}
            >
              <strong>{preview.text}</strong>
              <span>{preview.detail}</span>
            </div>
          );
        })()}
      </div>

      {pendingOverwriteMove && (
        <div className="quest-directory-overwrite-modal-backdrop">
          <div className="quest-directory-overwrite-modal" role="dialog" aria-modal="true">
            <div className="quest-directory-overwrite-modal-title">Overwrite quest file?</div>
            <div className="quest-directory-overwrite-modal-body">
              <p>A quest file already exists at the destination.</p>
              <div className="quest-directory-overwrite-modal-paths">
                <div>
                  <span>Moving</span>
                  <code>{pendingOverwriteMove.sourcePath || pendingOverwriteMove.sourceId}</code>
                </div>
                <div>
                  <span>Destination</span>
                  <code>{pendingOverwriteMove.destinationPath || "Unknown destination"}</code>
                </div>
                {pendingOverwriteMove.existingPath ? (
                  <div>
                    <span>Existing file</span>
                    <code>{pendingOverwriteMove.existingPath}</code>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="quest-directory-overwrite-modal-actions">
              <button type="button" className="quest-directory-overwrite-cancel" onClick={cancelOverwriteMove}>
                Cancel
              </button>
              <button type="button" className="quest-directory-overwrite-confirm" onClick={confirmOverwriteMove}>
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFolderRename && (() => {
        const validation = getFolderRenameValidation();
        return (
          <div className="quest-directory-rename-modal-backdrop">
            <div className="quest-directory-rename-modal" role="dialog" aria-modal="true">
              <div className="quest-directory-rename-modal-title">Rename folder</div>
              <div className="quest-directory-rename-modal-body">
                <label className="quest-directory-rename-field">
                  <span>Folder name</span>
                  <input
                    value={pendingFolderRename.name}
                    onChange={(event) => setPendingFolderRename((old) => old ? { ...old, name: event.target.value } : old)}
                    autoFocus
                  />
                </label>
                <div className={`quest-directory-rename-validation ${validation.ok ? "quest-directory-rename-validation-ok" : "quest-directory-rename-validation-bad"}`}>
                  {validation.message}
                </div>
              </div>
              <div className="quest-directory-rename-modal-actions">
                <button type="button" className="quest-directory-rename-cancel" onClick={cancelFolderRename}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="quest-directory-rename-confirm"
                  onClick={confirmFolderRename}
                  disabled={!validation.ok}
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="scene-contents-panel quest-board-contents-panel">
        <div className="scene-contents-margin quest-board-contents-margin">
          <div
            className={`quest-directory-tree ${interactionClassName}`}
            ref={directoryContentRef}
            onMouseLeave={clearDirectoryDropIndicator}
          >
            {dropIndicator && <DirectoryDropIndicator indicator={dropIndicator} />}
            <InboxSection
              quests={quests}
              folders={folders}
              activeQuestId={activeQuestId}
              selectedFolderId={selectedFolderId}
              setSelectedFolderId={setSelectedFolderId}
              expandedFolders={expandedFolders}
              setExpandedFolders={setExpandedFolders}
              dueBadge={dueBadge}
              selectQuest={selectQuest}
              renameQuestFolder={renameQuestFolder}
              openFolderRenameModal={openFolderRenameModal}
              deleteQuestFolder={deleteQuestFolder}
              moveQuestToFolder={moveQuestToFolder}
              moveQuestFolderToFolder={moveQuestFolderToFolder}
              updateDropIndicator={updateDirectoryDropIndicator}
              beginDirectoryPress={beginDirectoryPress}
              directorySelection={directorySelection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxSection({
  quests,
  folders,
  activeQuestId,
  selectedFolderId,
  setSelectedFolderId,
  expandedFolders,
  setExpandedFolders,
  dueBadge,
  selectQuest,
  renameQuestFolder,
  openFolderRenameModal,
  deleteQuestFolder,
  moveQuestToFolder,
  moveQuestFolderToFolder,
  updateDropIndicator,
  beginDirectoryPress,
  directorySelection,
}) {
  const rootFolders = getDirectFolderChildren(folders, null);
  const inboxQuests = getDirectFolderQuests(quests, null);
  const count = rootFolders.length + inboxQuests.length;

  return (
    <div className="quest-directory-section">
      <div
        className={`quest-directory-item quest-directory-folder-item quest-directory-root-item quest-directory-inbox-row ${directorySelection?.kind === "root" || (!directorySelection && selectedFolderId == null) ? "quest-directory-folder-selected" : ""}`}
        data-directory-row-id="root"
        data-directory-row-kind="root"
        data-directory-parent-id=""
        data-directory-can-contain="true"
        onMouseMove={(event) => updateDropIndicator?.(event, "root", "inside-root")}
        onPointerDown={(event) => beginDirectoryPress?.(event, {
          kind: "root",
          id: "root",
          title: "root",
          selectDirectory: () => setSelectedFolderId(null),
          select: () => setSelectedFolderId(null),
        })}
      >
        <button
          type="button"
          className="quest-directory-folder-main"
          onClick={() => setSelectedFolderId(null)}
          title="Select root"
        >
          <FolderOpen size={16} />
          <span className="quest-directory-folder-title">root</span>
          <span className="quest-directory-folder-count">{count}</span>
        </button>
      </div>

      <div className="quest-directory-children">
        {rootFolders.map((folder, index) => (
          <QuestFolderNode
            key={folder.id}
            folder={folder}
            isLastSibling={index === rootFolders.length - 1 && inboxQuests.length === 0}
            folders={folders}
            quests={quests}
            activeQuestId={activeQuestId}
            selectedFolderId={selectedFolderId}
            setSelectedFolderId={setSelectedFolderId}
            expandedFolders={expandedFolders}
            setExpandedFolders={setExpandedFolders}
            dueBadge={dueBadge}
            selectQuest={selectQuest}
            renameQuestFolder={renameQuestFolder}
            openFolderRenameModal={openFolderRenameModal}
            deleteQuestFolder={deleteQuestFolder}
            moveQuestToFolder={moveQuestToFolder}
            moveQuestFolderToFolder={moveQuestFolderToFolder}
            updateDropIndicator={updateDropIndicator}
            beginDirectoryPress={beginDirectoryPress}
            directorySelection={directorySelection}
            depth={0}
          />
        ))}

        {inboxQuests.map((quest) => (
          <QuestDirectoryCard
            key={quest.id}
            quest={quest}
            activeQuestId={activeQuestId}
            dueBadge={dueBadge}
            selectQuest={selectQuest}
            moveQuestToFolder={moveQuestToFolder}
            folders={folders}
            updateDropIndicator={updateDropIndicator}
            beginDirectoryPress={beginDirectoryPress}
            directorySelection={directorySelection}
          />
        ))}
      </div>
    </div>
  );
}

function QuestFolderNode({
  folder,
  isLastSibling = false,
  folders,
  quests,
  activeQuestId,
  selectedFolderId,
  setSelectedFolderId,
  expandedFolders,
  setExpandedFolders,
  dueBadge,
  selectQuest,
  renameQuestFolder,
  openFolderRenameModal,
  deleteQuestFolder,
  moveQuestToFolder,
  moveQuestFolderToFolder,
  updateDropIndicator,
  beginDirectoryPress,
  directorySelection,
  depth = 0,
}) {
  const open = expandedFolders[folder.id] ?? true;
  const childFolders = getDirectFolderChildren(folders, folder.id);
  const directQuests = getDirectFolderQuests(quests, folder.id);
  const count = countFolderContents(folders, quests, folder.id);

  return (
    <div className="quest-directory-folder quest-directory-branch-node quest-directory-folder-branch-node">
      <div className="quest-directory-row-wrap">
        <div className="quest-directory-disclosure-gutter">
          <button
            type="button"
            className="tree-disclosure"
            onClick={(event) => {
              event.stopPropagation();
              setExpandedFolders({ ...expandedFolders, [folder.id]: !open });
            }}
            title={open ? "Collapse folder" : "Expand folder"}
          >
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        <div
          className={`quest-directory-item quest-directory-folder-item quest-directory-folder-row ${
            (
              directorySelection?.kind === "folder" &&
              directorySelection?.id === folder.id
            ) ||
            (
              !directorySelection &&
              selectedFolderId === folder.id
            )
              ? "quest-directory-folder-selected"
              : ""
          }`}
          data-directory-row-id={folder.id}
          data-directory-row-kind="folder"
          data-directory-parent-id={folder.parentId || "root"}
          data-directory-can-contain="true"
          data-directory-open={open ? "true" : "false"}
          data-directory-has-children={(childFolders.length > 0 || directQuests.length > 0) ? "true" : "false"}
          onMouseMove={(event) => updateDropIndicator?.(event, folder.id)}
          onPointerDown={(event) => beginDirectoryPress?.(event, {
            kind: "folder",
            id: folder.id,
            title: getProjectPathBaseName(folder.id) || "Untitled Folder",
            selectDirectory: () => setSelectedFolderId(folder.id),
            select: () => setSelectedFolderId(folder.id),
          })}
        >
          <button
            type="button"
            className="quest-directory-folder-main"
            onClick={() => setSelectedFolderId(folder.id)}
            title="Select folder"
          >
          {open ? <FolderOpen size={16} /> : <Folder size={16} />}
          <span className="quest-directory-folder-title">{getProjectPathBaseName(folder.id) || "Untitled Folder"}</span>
          <span className="quest-directory-folder-count">{count}</span>
        </button>

        <div className="quest-directory-folder-actions">
          <button
            type="button"
            className="tree-icon-button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              openFolderRenameModal?.(folder);
            }}
            title="Rename folder"
          >
            <Pencil size={14} />
          </button>

          <button
            type="button"
            className="tree-icon-button danger-tree-button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              deleteQuestFolder(folder.id);
            }}
            title="Delete empty folder"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      </div>

      {open && (
        <div className="quest-directory-children">
          {childFolders.map((child, index) => (
            <QuestFolderNode
              key={child.id}
              folder={child}
              isLastSibling={index === childFolders.length - 1 && directQuests.length === 0}
              folders={folders}
              quests={quests}
              activeQuestId={activeQuestId}
              selectedFolderId={selectedFolderId}
              setSelectedFolderId={setSelectedFolderId}
              expandedFolders={expandedFolders}
              setExpandedFolders={setExpandedFolders}
              dueBadge={dueBadge}
              selectQuest={selectQuest}
              renameQuestFolder={renameQuestFolder}
              openFolderRenameModal={openFolderRenameModal}
              deleteQuestFolder={deleteQuestFolder}
              moveQuestToFolder={moveQuestToFolder}
              moveQuestFolderToFolder={moveQuestFolderToFolder}
              updateDropIndicator={updateDropIndicator}
              beginDirectoryPress={beginDirectoryPress}
              directorySelection={directorySelection}
              depth={depth + 1}
            />
          ))}

          {directQuests.map((quest) => (
            <QuestDirectoryCard
              key={quest.id}
              quest={quest}
              activeQuestId={activeQuestId}
              dueBadge={dueBadge}
              selectQuest={selectQuest}
              moveQuestToFolder={moveQuestToFolder}
              folders={folders}
              updateDropIndicator={updateDropIndicator}
              beginDirectoryPress={beginDirectoryPress}
              directorySelection={directorySelection}
            />
          ))}
        </div>
      )}

      {open && isLastSibling && (
        <div
          className="quest-directory-subtree-end-drop-zone"
          data-directory-subtree-end-for={folder.id}
          onMouseMove={(event) => updateDropIndicator?.(event, folder.id, "subtree-after")}
          aria-hidden="true"
        />
      )}
    </div>
  );
}


function getDirectoryDropZoneFromElement(event, rowElement) {
  const rect = rowElement.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const ratio = rect.height > 0 ? y / rect.height : 0.5;

  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

function getDirectoryDropIndicator(event, directoryContentElement, id, forcedZone = null) {
  const rowElement = event.currentTarget?.closest?.("[data-directory-row-id]");
  return getDirectoryDropIndicatorForElement(event, directoryContentElement, rowElement, id, forcedZone);
}

function getDirectoryDropIndicatorFromPoint(event, directoryContentElement) {
  if (!directoryContentElement) return null;

  const rootRow = directoryContentElement.querySelector('[data-directory-row-id="root"]');

  if (rootRow) {
    const rootRect = rootRow.getBoundingClientRect();
    const pointerIsInsideRoot =
      event.clientX >= rootRect.left &&
      event.clientX <= rootRect.right &&
      event.clientY >= rootRect.top &&
      event.clientY <= rootRect.bottom;

    if (pointerIsInsideRoot) {
      return getDirectoryDropIndicatorForElement(
        event,
        directoryContentElement,
        rootRow,
        "root",
        "inside-root"
      );
    }
  }

  const hitElement = document.elementFromPoint(event.clientX, event.clientY);
  if (!hitElement || !directoryContentElement.contains(hitElement)) return null;

  const subtreeEndElement = hitElement.closest?.(".quest-directory-subtree-end-drop-zone");
  if (subtreeEndElement && directoryContentElement.contains(subtreeEndElement)) {
    const id = subtreeEndElement.dataset.directorySubtreeEndFor;
    return getDirectoryDropIndicatorForElement(
      event,
      directoryContentElement,
      subtreeEndElement,
      id,
      "subtree-after"
    );
  }

  const rowElement = hitElement.closest?.("[data-directory-row-id]");
  if (!rowElement || !directoryContentElement.contains(rowElement)) return null;

  return getDirectoryDropIndicatorForElement(
    event,
    directoryContentElement,
    rowElement,
    rowElement.dataset.directoryRowId
  );
}

function getDirectoryDropIndicatorForElement(event, directoryContentElement, rowElement, id, forcedZone = null) {
  if (!directoryContentElement || !rowElement || !id) return null;

  const contentRect = directoryContentElement.getBoundingClientRect();
  const rowElements = Array.from(directoryContentElement.querySelectorAll("[data-directory-row-id]"));

  if (forcedZone === "subtree-after") {
    const sourceRow = findDirectoryRowById(rowElements, id);
    const targetRow = sourceRow || rowElement;
    const rowRect = targetRow.getBoundingClientRect();
    const colliderRect = rowElement.getBoundingClientRect();

    return {
      id,
      zone: "after",
      type: "boundary",
      top: colliderRect.top + colliderRect.height / 2 - contentRect.top,
      left: rowRect.left - contentRect.left,
      width: rowRect.width,
      placement: "subtree-after",
      targetKind: targetRow.dataset.directoryRowKind || "",
      targetParentId: targetRow.dataset.directoryParentId || "",
    };
  }

  const targetRow = rowElement;
  const rowRect = targetRow.getBoundingClientRect();

  let zone = forcedZone || getDirectoryDropZoneFromElement(event, rowElement);
  const canContain = targetRow.dataset.directoryCanContain === "true";

  const requestedRootInside = zone === "inside-root";

  if (requestedRootInside) {
    zone = "inside";
  }

  if (zone === "inside" && !canContain) {
    zone = "after";
  }

  if (zone === "inside") {
    return {
      id,
      zone,
      type: "inside",
      top: rowRect.top - contentRect.top,
      left: rowRect.left - contentRect.left,
      width: rowRect.width,
      height: rowRect.height,
      placement: requestedRootInside ? "inside-root" : "inside",
      targetKind: targetRow.dataset.directoryRowKind || "",
      targetParentId: targetRow.dataset.directoryParentId || "",
    };
  }

  const rowIndex = rowElements.indexOf(targetRow);
  const previousRow = rowIndex > 0 ? rowElements[rowIndex - 1] : null;
  const nextRow = rowIndex >= 0 && rowIndex < rowElements.length - 1 ? rowElements[rowIndex + 1] : null;
  const isExpandedContainer =
    targetRow.dataset.directoryCanContain === "true" &&
    targetRow.dataset.directoryOpen === "true" &&
    targetRow.dataset.directoryHasChildren === "true";

  let boundaryY = zone === "before" ? rowRect.top : rowRect.bottom;
  let boundaryRow = targetRow;
  let placement = zone;

  if (zone === "before" && previousRow) {
    const previousRect = previousRow.getBoundingClientRect();
    boundaryY = (previousRect.bottom + rowRect.top) / 2;
  }

  if (zone === "after" && isExpandedContainer && nextRow) {
    const nextRect = nextRow.getBoundingClientRect();
    boundaryY = (rowRect.bottom + nextRect.top) / 2;
    boundaryRow = nextRow;
    placement = "first-child";
  } else if (zone === "after" && nextRow) {
    const nextRect = nextRow.getBoundingClientRect();
    boundaryY = (rowRect.bottom + nextRect.top) / 2;
  }

  const boundaryRect = boundaryRow.getBoundingClientRect();

  return {
    id,
    zone,
    type: "boundary",
    top: boundaryY - contentRect.top,
    left: boundaryRect.left - contentRect.left,
    width: boundaryRect.width,
    placement,
    targetKind: targetRow.dataset.directoryRowKind || "",
    targetParentId: targetRow.dataset.directoryParentId || "",
  };
}

function findDirectoryRowById(rowElements, id) {
  return rowElements.find((rowElement) => rowElement.dataset.directoryRowId === id) || null;
}

function DirectoryDropIndicator({ indicator }) {
  if (!indicator) return null;

  const style = {
    top: `${indicator.top}px`,
    left: `${indicator.left}px`,
    width: `${indicator.width}px`,
  };

  if (indicator.type === "inside") {
    style.height = `${indicator.height}px`;
  }

  const className = indicator.type === "inside"
    ? "quest-directory-drop-overlay quest-directory-drop-overlay-inside"
    : "quest-directory-drop-overlay quest-directory-drop-overlay-boundary";

  return <div className={className} style={style} />;
}

function QuestDirectoryCard({ quest, activeQuestId, dueBadge, selectQuest, moveQuestToFolder, folders, updateDropIndicator, beginDirectoryPress, directorySelection }) {
  const progress = getQuestProgress(quest);
  const complete = isQuestComplete(quest);
  const inactive = isQuestInactive(quest);

  return (
    <div className="quest-directory-quest-card quest-directory-branch-node quest-directory-quest-branch-node">
      <button
        type="button"
        onClick={() => selectQuest(quest)}
        onMouseMove={(event) => updateDropIndicator?.(event, quest.id)}
        onPointerDown={(event) => beginDirectoryPress?.(event, {
          kind: "quest",
          id: quest.id,
          title: quest.title || "Untitled Quest",
          selectDirectory: () => {},
          select: () => selectQuest(quest),
        })}
        data-directory-row-id={quest.id}
        data-directory-row-kind="quest"
        data-directory-parent-id={quest.folderId || "root"}
        data-directory-can-contain="false"
        className={`quest-directory-item quest-directory-quest-item ${questTypeClass(quest)} ${complete || inactive ? "quest-directory-quest-muted" : ""} ${directorySelection?.kind === "quest" && directorySelection?.id === quest.id ? "quest-directory-quest-selected" : ""}`}
      >
        <div className="quest-directory-quest-header">
          <div className="quest-directory-quest-main">
            <FileText size={16} />
            <span className="quest-directory-quest-title">{quest.title || "Untitled Quest"}</span>
          </div>

          <div className="quest-directory-quest-actions">
            {dueBadge(quest)}
          </div>
        </div>

        <div className="quest-directory-quest-progress-track">
          <div className="quest-directory-quest-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </button>
    </div>
  );
}


