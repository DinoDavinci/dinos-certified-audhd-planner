import React, { useRef, useState } from "react";
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

function isFolderDescendant(folders, folderId, possibleAncestorId) {
  let current = (folders || []).find((folder) => folder.id === folderId) || null;
  const guard = new Set();

  while (current) {
    if (current.parentId === possibleAncestorId) return true;
    if (!current.parentId || guard.has(current.parentId)) return false;

    guard.add(current.parentId);
    current = (folders || []).find((folder) => folder.id === current.parentId) || null;
  }

  return false;
}

function getFolderDepth(folders, folderId) {
  let depth = 0;
  let current = (folders || []).find((folder) => folder.id === folderId) || null;
  const guard = new Set();

  while (current?.parentId) {
    if (guard.has(current.parentId)) break;
    guard.add(current.parentId);

    depth += 1;
    current = (folders || []).find((folder) => folder.id === current.parentId) || null;
  }

  return depth;
}

function getFolderMoveOptions(folders, movingFolderId) {
  return (folders || [])
    .filter((folder) => folder.id !== movingFolderId)
    .filter((folder) => !isFolderDescendant(folders, folder.id, movingFolderId))
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
    .map((folder) => {
      const depth = getFolderDepth(folders, folder.id);
      const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
      return {
        id: folder.id,
        label: `${prefix}${folder.title || "Untitled Folder"}`,
      };
    });
}

const DIRECTORY_DRAG_HOLD_MS = 180;
const FORCE_DIRECTORY_REARRANGE_MODE = true;

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
  const directoryContentRef = useRef(null);

  function updateDirectoryDropIndicator(event, id, forcedZone = null) {
    if (!isRearrangeMode || !id) return;

    const nextIndicator = getDirectoryDropIndicator(
      event,
      directoryContentRef.current,
      id,
      forcedZone
    );

    setDropIndicator(nextIndicator);
  }

  function clearDirectoryDropIndicator() {
    setDropIndicator(null);
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
          <button onClick={() => createQuest(selectedFolderId)} className="primary-button"><Plus size={18} /> Quest</button>
          <button onClick={() => createQuestFolder(selectedFolderId)} className="title-secondary-button"><Plus size={16} /> Folder</button>
        </div>

        <div className="quest-directory-mode-row">
          <span className="quest-directory-mode-pill">
            {isRearrangeMode ? "Directory Rearrange" : "Directory Normal"}
          </span>
        </div>
      </div>

      <div className="scene-contents-panel quest-board-contents-panel">
        <div className="scene-contents-margin quest-board-contents-margin">
          <div
            className="quest-directory-tree quest-directory-normal"
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
}) {
  const rootFolders = getDirectFolderChildren(folders, null);
  const inboxQuests = getDirectFolderQuests(quests, null);
  const count = rootFolders.length + inboxQuests.length;

  return (
    <div className="quest-directory-section">
      <div
        className={`quest-directory-item quest-directory-folder-item quest-directory-root-item quest-directory-inbox-row ${selectedFolderId == null ? "quest-directory-folder-selected" : ""}`}
        data-directory-row-id="root"
        data-directory-row-kind="root"
        data-directory-can-contain="true"
        onMouseMove={(event) => updateDropIndicator?.(event, "root")}
      >
        <button
          type="button"
          className="quest-directory-folder-main"
          onClick={() => setSelectedFolderId(null)}
          title="Select Inbox"
        >
          <FolderOpen size={16} />
          <span className="quest-directory-folder-title">Inbox</span>
          <span className="quest-directory-folder-count">{count}</span>
        </button>
      </div>

      <div className="quest-directory-children">
        {rootFolders.length === 0 && inboxQuests.length === 0 && (
          <div className="quest-directory-empty">No quests or folders in Inbox.</div>
        )}

        {rootFolders.map((folder) => (
          <QuestFolderNode
            key={folder.id}
            folder={folder}
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
          />
        ))}
      </div>
    </div>
  );
}

function QuestFolderNode({
  folder,
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
          className={`quest-directory-item quest-directory-folder-item quest-directory-folder-row ${selectedFolderId === folder.id ? "quest-directory-folder-selected" : ""}`}
          data-directory-row-id={folder.id}
          data-directory-row-kind="folder"
          data-directory-can-contain="true"
          onMouseMove={(event) => updateDropIndicator?.(event, folder.id)}
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
          <select
            className="quest-directory-folder-move-select"
            value={folder.parentId || ""}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => moveQuestFolderToFolder(folder.id, event.target.value || null)}
            title="Move folder"
          >
            <option value="">Root</option>
            {getFolderMoveOptions(folders, folder.id).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="tree-icon-button"
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
          {childFolders.map((child) => (
            <QuestFolderNode
              key={child.id}
              folder={child}
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
              depth={depth + 1}
            />
          ))}

          {directQuests.length === 0 && childFolders.length === 0 && (
            <div className="quest-directory-empty">Empty folder.</div>
          )}

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
            />
          ))}
        </div>
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
  if (!directoryContentElement || !id) return null;

  const rowElement = event.currentTarget?.closest?.("[data-directory-row-id]");
  if (!rowElement || !directoryContentElement.contains(rowElement)) return null;

  const contentRect = directoryContentElement.getBoundingClientRect();
  const rowElements = Array.from(directoryContentElement.querySelectorAll("[data-directory-row-id]"));
  const targetRow = rowElements.find((element) => element.dataset.directoryRowId === id) || rowElement;
  const rowRect = targetRow.getBoundingClientRect();
  const canContain = targetRow.dataset.directoryCanContain === "true";
  let zone = forcedZone || getDirectoryDropZoneFromElement(event, targetRow);

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
    };
  }

  const rowIndex = rowElements.indexOf(targetRow);
  const previousRow = rowIndex > 0 ? rowElements[rowIndex - 1] : null;
  const nextRow = rowIndex >= 0 && rowIndex < rowElements.length - 1 ? rowElements[rowIndex + 1] : null;

  let boundaryY = zone === "before" ? rowRect.top : rowRect.bottom;

  if (zone === "before" && previousRow) {
    const previousRect = previousRow.getBoundingClientRect();
    boundaryY = (previousRect.bottom + rowRect.top) / 2;
  }

  if (zone === "after" && nextRow) {
    const nextRect = nextRow.getBoundingClientRect();
    boundaryY = (rowRect.bottom + nextRect.top) / 2;
  }

  return {
    id,
    zone,
    type: "boundary",
    top: boundaryY - contentRect.top,
    left: rowRect.left - contentRect.left,
    width: rowRect.width,
  };
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

function QuestDirectoryCard({ quest, activeQuestId, dueBadge, selectQuest, moveQuestToFolder, folders, updateDropIndicator }) {
  const progress = getQuestProgress(quest);
  const complete = isQuestComplete(quest);
  const inactive = isQuestInactive(quest);

  return (
    <div className="quest-directory-quest-card quest-directory-branch-node quest-directory-quest-branch-node">
      <button
        type="button"
        onClick={() => selectQuest(quest)}
        onMouseMove={(event) => updateDropIndicator?.(event, quest.id)}
        data-directory-row-id={quest.id}
        data-directory-row-kind="quest"
        data-directory-can-contain="false"
        className={`quest-directory-item quest-directory-quest-item ${questTypeClass(quest)} ${complete || inactive ? "quest-directory-quest-muted" : ""} ${quest.id === activeQuestId ? "quest-directory-quest-selected" : ""}`}
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


