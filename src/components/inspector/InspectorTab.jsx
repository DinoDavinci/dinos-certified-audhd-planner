import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Target,
} from "lucide-react";

import {
  findTask,
  findTaskPath,
  getTaskAncestry,
  updateQuestTree,
} from "../../models/appModel";

import QuestInspector from "./QuestInspector";
import TaskInspector from "./TaskInspector";
import {
  QuestChildrenSummary,
  AncestryPath,
  ChildrenSummary,
} from "./inspectorShared";

export default function InspectorTab(props) {
  const { rightSplit, embedded = false } = props;
  const rootClassName = embedded
    ? "inspector-root inspector-root-embedded"
    : "inspector-root";
  const rootStyle = embedded ? undefined : { flexBasis: `${rightSplit}%` };

  return (
    <div
      className={rootClassName}
      style={rootStyle}
    >
      <div className="inspector-main-margin">
        <div className="inspector-main-vbox">
          <InspectorRenameModalStyles />
          <InspectorToolbar {...props} />
          <InspectorIdentityPanel {...props} />
          <InspectorRelations {...props} />
          <div className="scene-contents-panel inspector-contents-panel">
            <div className="scene-contents-margin inspector-contents-margin">
              <div className="inspector-scene-content">
                <Inspector {...props} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSelectionType(selection) {
  const type = selection?.type || "none";
  if (type === "quest") return "Quest";
  if (type === "task") return "Task";
  return "Nothing";
}

function getInspectorAccentClass(selection) {
  const type = selection?.type || "none";
  if (type === "quest") return "inspector-title-quest";
  if (type === "task") return "inspector-title-task";
  return "";
}

function getProjectPathBaseName(path) {
  const normalized = String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function stripQuestFileExtension(fileName) {
  return String(fileName || "")
    .replace(/\.quest\.json$/i, "")
    .replace(/\.quest$/i, "");
}

function getQuestForSelection(selection, data) {
  if (selection?.type !== "quest") return null;
  return (data?.quests || []).find((item) => item.id === selection.id) || null;
}

function getOwnerQuestForSelection(selection, data) {
  if (!selection || !data) return null;

  if (selection.type === "quest") {
    return (data.quests || []).find((item) => item.id === selection.id) || null;
  }

  if (selection.type === "task") {
    return (data.quests || []).find((item) => item.id === selection.questId) || null;
  }

  return null;
}

function getQuestFilenameForQuest(quest) {
  if (!quest) return "";

  const fileName = getProjectPathBaseName(
    quest.projectRelativePath ||
    quest.projectFilePath ||
    quest.id ||
    quest.title ||
    "untitled.quest.json"
  );

  if (!fileName) return "";
  if (/\.quest\.json$/i.test(fileName) || /\.quest$/i.test(fileName)) return fileName;

  return `${stripQuestFileExtension(fileName)}.quest.json`;
}

function getQuestFileBaseNameForQuest(quest) {
  return stripQuestFileExtension(getQuestFilenameForQuest(quest));
}

function getQuestFilenameForSelection(selection, data) {
  return getQuestFilenameForQuest(getQuestForSelection(selection, data));
}

function normalizeProjectRelativePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
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

function getQuestRenameValidation({ quest, data, name }) {
  if (!quest) {
    return { ok: false, message: "No quest selected." };
  }

  if (!quest.projectRelativePath) {
    return { ok: false, message: "File rename is only available in a project folder." };
  }

  const rawName = String(name || "");
  const trimmed = rawName.trim();
  const lowerName = trimmed.toLowerCase();

  if (!trimmed) {
    return { ok: false, message: "Name cannot be empty." };
  }

  if (rawName !== trimmed) {
    return { ok: false, message: "Name cannot start or end with spaces." };
  }

  if (trimmed === "." || trimmed === "..") {
    return { ok: false, message: "Name cannot be . or ..." };
  }

  if (/[\\/:*?"<>|]/.test(trimmed)) {
    return { ok: false, message: "Name contains an invalid filename character." };
  }

  if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
    return { ok: false, message: "Name cannot start or end with a period." };
  }

  if (lowerName.endsWith(".quest.json") || lowerName.endsWith(".quest")) {
    return { ok: false, message: "Enter the name without the .quest.json extension." };
  }

  const currentPath = normalizeProjectRelativePath(quest.projectRelativePath);
  const parentPath = getProjectPathParent(currentPath);
  const destinationPath = joinProjectRelativePath(parentPath || null, `${trimmed}.quest.json`);

  if (normalizeProjectRelativePath(destinationPath) === currentPath) {
    return {
      ok: true,
      message: "Name is unchanged.",
      destinationPath,
    };
  }

  const existingQuest = (data?.quests || []).find((item) => {
    if (item.id === quest.id) return false;
    return normalizeProjectRelativePath(item.projectRelativePath || "") === normalizeProjectRelativePath(destinationPath);
  });

  if (existingQuest) {
    return {
      ok: false,
      message: "A quest file with that name already exists.",
      destinationPath,
    };
  }

  return {
    ok: true,
    message: "Name is valid.",
    destinationPath,
  };
}


function getInspectorGoto(selection, data, activeQuestId, activeBranchTaskId) {
  if (!selection || !data) return null;

  if (selection.type === "quest") {
    const quest = data.quests.find((item) => item.id === selection.id);
    if (!quest) return null;

    const alreadyAtQuestRoot = activeQuestId === quest.id && !activeBranchTaskId;
    return {
      label: "Focus",
      disabled: alreadyAtQuestRoot,
      title: alreadyAtQuestRoot ? "Already focused here" : "Focus this quest",
      actionType: "quest",
      questId: quest.id,
    };
  }

  if (selection.type === "task") {
    const quest = data.quests.find((item) => item.id === selection.questId);
    if (!quest) return null;

    const path = findTaskPath(quest.rootTask?.children || [], selection.id) || [];
    const selectedTask = path[path.length - 1] || null;
    if (!selectedTask) return null;

    const branchTarget = [...path]
      .reverse()
      .find((task) => (task.children || []).length > 0);

    if (branchTarget) {
      const alreadyAtBranch = activeQuestId === quest.id && activeBranchTaskId === branchTarget.id;
      return {
        label: "Focus",
        disabled: alreadyAtBranch,
        title: alreadyAtBranch ? "Already focused here" : "Focus nearest branch",
        actionType: "task",
        questId: quest.id,
        taskId: branchTarget.id,
      };
    }

    const alreadyAtQuestRoot = activeQuestId === quest.id && !activeBranchTaskId;
    return {
      label: "Focus",
      disabled: alreadyAtQuestRoot,
      title: alreadyAtQuestRoot ? "Already focused here" : "Focus owner quest",
      actionType: "quest",
      questId: quest.id,
    };
  }

  return null;
}

function InspectorToolbar({
  selection,
  data,
  activeQuestId,
  activeBranchTaskId,
  makeFocus,
  setBranchFocus,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  saveQuestFile,
}) {
  const goto = getInspectorGoto(selection, data, activeQuestId, activeBranchTaskId);
  const ownerQuest = getOwnerQuestForSelection(selection, data);
  const isProjectQuestFile = Boolean(ownerQuest?.projectRelativePath);
  const canSaveQuestFile = Boolean(isProjectQuestFile && ownerQuest?.projectDirty && saveQuestFile);

  function runGoto() {
    if (!goto || goto.disabled) return;

    if (goto.actionType === "quest") {
      makeFocus(goto.questId);
    }

    if (goto.actionType === "task") {
      makeFocus(goto.questId);
      setBranchFocus(goto.taskId);
    }
  }

  function runSave() {
    if (!canSaveQuestFile || !ownerQuest?.id) return;
    saveQuestFile(ownerQuest.id);
  }

  const saveTitle = !ownerQuest?.projectRelativePath
    ? "No project quest file selected"
    : ownerQuest.projectDirty
      ? "Save quest file"
      : "Quest file is clean";

  return (
    <div className="inspector-toolbar inspector-icon-toolbar">
      <div className="inspector-toolbar-actions inspector-toolbar-actions-left">
        {isProjectQuestFile ? (
          <button
            type="button"
            onClick={runSave}
            disabled={!canSaveQuestFile}
            className={`title-icon-button inspector-save-button ${canSaveQuestFile ? "inspector-save-button-dirty" : "inspector-save-button-clean"}`}
            title={saveTitle}
          >
            <Save size={16} />
          </button>
        ) : (
          <span className={`inspector-selection-badge inspector-toolbar-web-badge ${getInspectorAccentClass(selection)}`}>
            {getSelectionType(selection)}
          </span>
        )}
      </div>

      <div className="inspector-toolbar-actions inspector-toolbar-actions-right">
        {goto && (
          <button
            type="button"
            onClick={runGoto}
            disabled={goto.disabled}
            className="title-icon-button disabled:opacity-30"
            title={goto.title || "Focus selected item"}
          >
            <Target size={16} />
          </button>
        )}
        <button onClick={goBack} disabled={!canGoBack} className="title-icon-button disabled:opacity-30" title="Back"><ArrowLeft size={16} /></button>
        <button onClick={goForward} disabled={!canGoForward} className="title-icon-button disabled:opacity-30" title="Forward"><ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function InspectorIdentityPanel({
  selection,
  data,
  renameQuestFile,
}) {
  const ownerQuest = getOwnerQuestForSelection(selection, data);
  const questFilename = getQuestFilenameForQuest(ownerQuest);
  const questFileBaseName = getQuestFileBaseNameForQuest(ownerQuest);
  const canRenameFile = Boolean(ownerQuest?.projectRelativePath && questFileBaseName && renameQuestFile);
  const [renameState, setRenameState] = useState(null);
  const renameValidation = renameState
    ? getQuestRenameValidation({
        quest: renameState.quest,
        data,
        name: renameState.name,
      })
    : null;

  function openRenameModal() {
    if (!canRenameFile) return;

    setRenameState({
      quest: ownerQuest,
      name: questFileBaseName,
    });
  }

  function closeRenameModal() {
    setRenameState(null);
  }

  async function confirmRenameModal() {
    if (!renameState || !renameValidation?.ok) return;

    await renameQuestFile?.(renameState.quest.id, String(renameState.name || "").trim());
    setRenameState(null);
  }

  if (!selection || selection.type === "none") return null;
  if (!ownerQuest?.projectRelativePath) return null;

  return (
    <div className="inspector-identity-panel-wrap">
      <button
        type="button"
        className={`inspector-identity-panel ${canRenameFile ? "inspector-identity-panel-clickable" : ""}`}
        onClick={openRenameModal}
        disabled={!canRenameFile}
        title={canRenameFile ? `Rename quest file: ${questFilename}` : undefined}
      >
        <span className={`inspector-selection-badge ${getInspectorAccentClass(selection)}`}>{getSelectionType(selection)}</span>
        {questFilename && ownerQuest?.projectRelativePath ? (
          <span className="inspector-identity-filename">{questFilename}</span>
        ) : null}
      </button>

      {renameState && (
        <div className="inspector-rename-modal-backdrop">
          <div className="inspector-rename-modal" role="dialog" aria-modal="true">
            <div className="inspector-rename-modal-title">Rename quest file</div>
            <div className="inspector-rename-modal-body">
              <label className="inspector-rename-field">
                <span>File name</span>
                <div className="inspector-rename-input-row">
                  <input
                    value={renameState.name}
                    onChange={(event) => setRenameState((old) => old ? { ...old, name: event.target.value } : old)}
                    autoFocus
                  />
                  <span className="inspector-rename-extension">.quest.json</span>
                </div>
              </label>
              <div className={`inspector-rename-validation ${renameValidation?.ok ? "inspector-rename-validation-ok" : "inspector-rename-validation-bad"}`}>
                {renameValidation?.message || "Enter a file name."}
              </div>
            </div>
            <div className="inspector-rename-modal-actions">
              <button type="button" className="inspector-rename-cancel" onClick={closeRenameModal}>
                Cancel
              </button>
              <button
                type="button"
                className="inspector-rename-confirm"
                onClick={confirmRenameModal}
                disabled={!renameValidation?.ok}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InspectorRenameModalStyles() {
  return (
    <style>{`
      .inspector-toolbar { min-width: 0; }
      .inspector-icon-toolbar {
        justify-content: space-between;
      }
      .inspector-toolbar-actions-left,
      .inspector-toolbar-actions-right {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
      .inspector-toolbar-web-badge {
        flex: 0 0 4.35rem;
        min-width: 4.35rem;
        justify-content: center;
        text-align: center;
      }
      .inspector-save-button-clean,
      .inspector-save-button-clean:disabled {
        cursor: not-allowed;
        color: rgb(82 82 82);
        opacity: 0.45;
      }
      .inspector-save-button-dirty {
        color: rgb(245 245 245);
        opacity: 1;
      }
      .inspector-identity-panel-wrap {
        min-width: 0;
      }
      .inspector-identity-panel {
        width: 100%;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        border-radius: 0.35rem;
        border: none;
        background: rgba(23, 23, 23, 0.78);
        padding: 0.35rem 0.45rem;
        text-align: left;
      }
      .inspector-identity-panel:disabled {
        opacity: 1;
      }
      .inspector-identity-panel-clickable {
        cursor: pointer;
      }
      .inspector-identity-panel-clickable:hover {
        border-color: rgb(115 115 115);
        background: rgb(38 38 38);
      }
      .inspector-identity-panel .inspector-selection-badge {
        flex: 0 0 4.35rem;
        min-width: 4.35rem;
        justify-content: center;
        text-align: center;
      }
      .inspector-identity-filename {
        min-width: 0;
        overflow: hidden;
        color: rgb(212 212 212);
        font-size: 0.78rem;
        font-weight: 850;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .inspector-toolbar-section { flex: 1 1 auto; min-width: 0; }
      .inspector-filename-button { cursor: pointer; text-align: left; }
      .inspector-filename-button:hover { border-color: rgb(115 115 115); background: rgb(64 64 64); color: rgb(245 245 245); }
      .inspector-rename-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.58); }
      .inspector-rename-modal { width: min(30rem, calc(100vw - 2rem)); display: grid; gap: 0.8rem; border-radius: 0.45rem; border: 1px solid rgb(82 82 82); background: rgb(23 23 23); padding: 1rem; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45); }
      .inspector-rename-modal-title { font-size: 1rem; font-weight: 900; color: rgb(245 245 245); }
      .inspector-rename-modal-body { display: grid; gap: 0.5rem; }
      .inspector-rename-field { display: grid; gap: 0.3rem; font-size: 0.74rem; font-weight: 850; color: rgb(212 212 212); }
      .inspector-rename-input-row { display: flex; align-items: stretch; min-width: 0; }
      .inspector-rename-input-row input { flex: 1 1 auto; min-width: 0; border-radius: 0.35rem 0 0 0.35rem; border: 1px solid rgb(64 64 64); border-right: none; background: rgb(10 10 10); padding: 0.45rem 0.55rem; font-size: 0.85rem; color: rgb(245 245 245); }
      .inspector-rename-extension { flex: 0 0 auto; display: inline-flex; align-items: center; border-radius: 0 0.35rem 0.35rem 0; border: 1px solid rgb(64 64 64); background: rgb(38 38 38); padding: 0.45rem 0.55rem; font-size: 0.85rem; font-weight: 850; color: rgb(163 163 163); }
      .inspector-rename-validation { font-size: 0.76rem; font-weight: 850; }
      .inspector-rename-validation-ok { color: rgb(134 239 172); }
      .inspector-rename-validation-bad { color: rgb(252 165 165); }
      .inspector-rename-modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
      .inspector-rename-cancel, .inspector-rename-confirm { border-radius: 0.35rem; border: 1px solid rgb(64 64 64); padding: 0.38rem 0.7rem; font-size: 0.78rem; font-weight: 850; }
      .inspector-rename-cancel { background: rgb(38 38 38); color: rgb(229 229 229); }
      .inspector-rename-confirm { background: rgb(229 229 229); color: rgb(23 23 23); }
      .inspector-rename-confirm:disabled { cursor: not-allowed; opacity: 0.45; }
    `}</style>
  );
}


function InspectorRelations({ selection, data, setSelection }) {
  const selected = resolveSelection(selection, data);
  if (!selected || !selection || selection.type === "none") return null;

  if (selection.type === "quest" && selected?.quest) {
    return (
      <div className="inspector-relations-strip">
        <div className="wiki-meta-block">
          <QuestChildrenSummary quest={selected.quest} setSelection={setSelection} />
        </div>
      </div>
    );
  }

  if (selection.type === "task" && selected?.task) {
    const ancestry = getTaskAncestry(selection, data) || [];
    return (
      <div className="inspector-relations-strip">
        <div className="wiki-meta-block">
          <AncestryPath ancestry={ancestry} setSelection={setSelection} />
          <ChildrenSummary task={selected.task} ancestry={ancestry} setSelection={setSelection} />
        </div>
      </div>
    );
  }

  return null;
}
function Inspector({
  selection,
  data,
  setData,
  setSelection,
  allTags,
  activeQuestId,
  makeFocus,
  activeBranchTaskId,
  setBranchFocus,
  clearBranchFocus,
  completeQuest,
  restoreQuest,
  deleteQuest,
  deleteQuestTask,
  toggleTask,
}) {
  const selected = resolveSelection(selection, data);
  return (
    <div className="inspector-mode-content">
      {selection.type === "quest" && selected?.quest && (
        <QuestInspector
          quest={selected.quest}
          allTags={allTags}
          setData={setData}
          setSelection={setSelection}
          completeQuest={() => completeQuest(selected.quest.id)}
          restoreQuest={() => restoreQuest(selected.quest.id)}
          deleteQuest={() => deleteQuest(selected.quest.id)}
        />
      )}

      {selection.type === "task" && selected?.quest && selected?.task && (
        <TaskInspector
          task={selected.task}
          parent={selected.parent}
          ownerTitle={selected.quest.title}
          ancestry={getTaskAncestry(selection, data)}
          setSelection={setSelection}
          locked={selected.quest.locked || selected.task.locked}
          canFocusBranch={selected.quest.id === activeQuestId && (selected.task.children || []).length > 0}
          isBranchFocused={activeBranchTaskId === selected.task.id}
          setBranchFocus={() => setBranchFocus(selected.task.id)}
          clearBranchFocus={clearBranchFocus}
          updateTask={(updater) => {
            setData((old) => ({
              ...old,
              quests: old.quests.map((quest) =>
                quest.id === selected.quest.id
                  ? { ...quest, rootTask: { ...quest.rootTask, children: updateQuestTree(quest.rootTask?.children || [], selection.id, updater) } }
                  : quest
              ),
            }));
          }}
          toggleComplete={() => toggleTask(selected.quest.id, selected.task.id)}
          deleteTask={() => deleteQuestTask(selected.quest.id, selected.task.id)}
          template={false}
        />
      )}

      {(!selected || selection.type === "none") && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-neutral-400">
          Select an item from the library or focus tree.
        </div>
      )}
    </div>
  );
}


function resolveSelection(selection, data) {
  if (!selection || selection.type === "none") return null;

  if (selection.type === "quest") {
    return { quest: data.quests.find((quest) => quest.id === selection.id) };
  }

  if (selection.type === "task") {
    const quest = data.quests.find((item) => item.id === selection.questId);
    const found = quest ? findTask(quest.rootTask ? [quest.rootTask] : [], selection.id) : null;
    return { quest, task: found?.task, parent: found?.parent };
  }

  return null;
}

