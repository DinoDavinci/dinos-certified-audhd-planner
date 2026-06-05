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
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
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
  const directoryContentRef = useRef(null);
  const dragStateRef = useRef(null);
  const pendingPressRef = useRef(null);
  const dragHoldTimerRef = useRef(null);
  const dropIndicatorRef = useRef(null);

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

    if (releaseTarget.targetKind === "root") {
      return {
        ok: true,
        folderId: null,
        placement,
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

    if (activeDrag.kind === "quest") {
      moveQuestToFolder?.(activeDrag.id, moveTarget.folderId || null);
    }

    if (activeDrag.kind === "folder") {
      moveQuestFolderToFolder?.(activeDrag.id, moveTarget.folderId || null);
    }

    if (moveTarget.folderId) {
      setExpandedFolders((old) => ({ ...old, [moveTarget.folderId]: true }));
    }
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
      </div>

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
        onMouseMove={(event) => updateDropIndicator?.(event, "root")}
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
          className={`quest-directory-item quest-directory-folder-item quest-directory-folder-row ${directorySelection?.kind === "folder" && directorySelection?.id === folder.id ? "quest-directory-folder-selected" : ""}`}
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
            title: folder.title || "Untitled Folder",
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
          <span className="quest-directory-folder-title">{folder.title || "Untitled Folder"}</span>
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
              renameQuestFolder(folder.id);
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
  const sourceRow = findDirectoryRowById(rowElements, id);
  const targetRow = sourceRow || rowElement;
  const rowRect = targetRow.getBoundingClientRect();

  if (forcedZone === "subtree-after") {
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

  let zone = forcedZone || getDirectoryDropZoneFromElement(event, rowElement);
  const canContain = targetRow.dataset.directoryCanContain === "true";

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
      placement: "inside",
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


