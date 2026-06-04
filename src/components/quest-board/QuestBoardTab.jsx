import React from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
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
  return (
    <div className="tab-scene-margin library-scene quest-board-root">
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
      </div>

      <div className="scene-contents-panel quest-board-contents-panel">
        <div className="scene-contents-margin quest-board-contents-margin">
          <div className="quest-directory-tree">
            <InboxSection
              quests={quests}
              folders={folders}
              activeQuestId={activeQuestId}
              selectedFolderId={selectedFolderId}
              setSelectedFolderId={setSelectedFolderId}
              dueBadge={dueBadge}
              selectQuest={selectQuest}
              moveQuestToFolder={moveQuestToFolder}
            />

            {getDirectFolderChildren(folders, null).map((folder) => (
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
                depth={0}
              />
            ))}
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
  dueBadge,
  selectQuest,
  moveQuestToFolder,
}) {
  const inboxQuests = getDirectFolderQuests(quests, null);
  const count = inboxQuests.length;

  return (
    <div className="quest-directory-section">
      <div className={`quest-directory-inbox-row ${selectedFolderId == null ? "quest-directory-folder-selected" : ""}`}>
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
        {inboxQuests.length === 0 && (
          <div className="quest-directory-empty">No quests in Inbox.</div>
        )}

        {inboxQuests.map((quest) => (
          <QuestDirectoryCard
            key={quest.id}
            quest={quest}
            activeQuestId={activeQuestId}
            dueBadge={dueBadge}
            selectQuest={selectQuest}
            moveQuestToFolder={moveQuestToFolder}
            folders={folders}
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
  depth = 0,
}) {
  const open = expandedFolders[folder.id] ?? true;
  const childFolders = getDirectFolderChildren(folders, folder.id);
  const directQuests = getDirectFolderQuests(quests, folder.id);
  const count = countFolderContents(folders, quests, folder.id);

  return (
    <div className="quest-directory-folder">
      <div className={`quest-directory-folder-row ${selectedFolderId === folder.id ? "quest-directory-folder-selected" : ""}`}>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestDirectoryCard({ quest, activeQuestId, dueBadge, selectQuest, moveQuestToFolder, folders }) {
  return (
    <div className="quest-directory-quest-card">
      <button
        type="button"
        onClick={() => selectQuest(quest)}
        className={`library-card text-left ${questTypeClass(quest)} ${(isQuestComplete(quest) || isQuestInactive(quest)) ? "library-card-complete" : ""} ${quest.id === activeQuestId ? "border-neutral-300 bg-neutral-800" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="font-semibold">{quest.title}</div>
          {dueBadge(quest)}
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full bg-slate-200" style={{ width: `${getQuestProgress(quest)}%` }} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {isQuestComplete(quest) && <span className="pill-complete">Completed</span>}
          {isQuestInactive(quest) && <span className="pill">Disabled</span>}
          {(quest.tags || []).map((tag) => <span key={tag} className="pill">{tag}</span>)}
        </div>
      </button>

      <select
        className="field mt-1 py-1 text-xs"
        value={quest.folderId || ""}
        onChange={(event) => moveQuestToFolder(quest.id, event.target.value || null)}
        title="Move quest to folder"
      >
        <option value="">Inbox</option>
        {(folders || []).map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.title || "Untitled Folder"}
          </option>
        ))}
      </select>
    </div>
  );
}
