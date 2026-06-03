import React from "react";
import {
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import {
  reconcileTodayQuestForRoutine,
  findTask,
  findTaskPath,
  getTaskAncestry,
  updateQuestTree,
} from "../../models/appModel";

import QuestInspector from "./QuestInspector";
import RoutineInspector from "./RoutineInspector";
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
          <InspectorToolbar {...props} />
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
  if (type === "routine") return "Routine";
  if (type === "task") return "Task";
  if (type === "routineTask") return "Template Task";
  return "Nothing";
}

function getInspectorAccentClass(selection) {
  const type = selection?.type || "none";
  if (type === "quest") return "inspector-title-quest";
  if (type === "routine") return "inspector-title-routine";
  if (type === "task") return "inspector-title-task";
  if (type === "routineTask") return "inspector-title-routineTask";
  return "";
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
}) {
  const goto = getInspectorGoto(selection, data, activeQuestId, activeBranchTaskId);

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

  return (
    <div className="inspector-toolbar">
      <div className="inspector-toolbar-section">
        <span className={`inspector-selection-badge ${getInspectorAccentClass(selection)}`}>{getSelectionType(selection)}</span>
      </div>

      <div className="inspector-toolbar-actions">
        {goto && (
          <button
            onClick={runGoto}
            disabled={goto.disabled}
            className="title-secondary-button"
            title={goto.title}
          >
            Focus
          </button>
        )}
        <button onClick={goBack} disabled={!canGoBack} className="title-icon-button disabled:opacity-30"><ArrowLeft size={16} /></button>
        <button onClick={goForward} disabled={!canGoForward} className="title-icon-button disabled:opacity-30"><ArrowRight size={16} /></button>
      </div>
    </div>
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

  if (selection.type === "routineTask" && selected?.task) {
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
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  makeFocus,
  activeBranchTaskId,
  setBranchFocus,
  clearBranchFocus,
  completeQuest,
  restoreQuest,
  createQuestTask,
  createRoutineTask,
  deleteQuest,
  deleteRoutine,
  deleteQuestTask,
  deleteRoutineTask,
  toggleTask,
  runMaintenanceNow,
}) {
  const selected = resolveSelection(selection, data);
  return (
    <div className="inspector-mode-content">
      {selection.type === "quest" && selected?.quest && (
        <QuestInspector
          quest={selected.quest}
          allTags={allTags}
          isFocus={selected.quest.id === activeQuestId && !activeBranchTaskId}
          isQuestRoot={selected.quest.id === activeQuestId}
          activeBranchTaskId={activeBranchTaskId}
          setData={setData}
          routines={data.routines || []}
          setSelection={setSelection}
          makeFocus={() => makeFocus(selected.quest.id)}
          completeQuest={() => completeQuest(selected.quest.id)}
          restoreQuest={() => restoreQuest(selected.quest.id)}
          deleteQuest={() => deleteQuest(selected.quest.id)}
        />
      )}

      {selection.type === "routine" && selected?.routine && (
        <RoutineInspector
          routine={selected.routine}
          allTags={allTags}
          setData={setData}
          deleteRoutine={() => deleteRoutine(selected.routine.id)}
          runMaintenanceNow={runMaintenanceNow}
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

      {selection.type === "routineTask" && selected?.routine && selected?.task && (
        <TaskInspector
          task={selected.task}
          parent={selected.parent}
          ownerTitle={selected.routine.title}
          ancestry={getTaskAncestry(selection, data)}
          setSelection={setSelection}
          locked={false}
          updateTask={(updater) => {
            setData((old) => {
              let updatedRoutine = null;
              const routines = old.routines.map((routine) => {
                if (routine.id !== selected.routine.id) return routine;
                const questTemplate = routine.questTemplate || {};
                const rootTask = questTemplate.rootTask || {};
                updatedRoutine = {
                  ...routine,
                  questTemplate: {
                    ...questTemplate,
                    rootTask: {
                      ...rootTask,
                      completed: false,
                      children: updateQuestTree(rootTask.children || [], selection.id, updater),
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
          }}
          deleteTask={() => deleteRoutineTask(selected.routine.id, selected.task.id)}
          template
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

  if (selection.type === "routine") {
    return { routine: data.routines.find((routine) => routine.id === selection.id) };
  }

  if (selection.type === "task") {
    const quest = data.quests.find((item) => item.id === selection.questId);
    const found = quest ? findTask(quest.rootTask ? [quest.rootTask] : [], selection.id) : null;
    return { quest, task: found?.task, parent: found?.parent };
  }

  if (selection.type === "routineTask") {
    const routine = data.routines.find((item) => item.id === selection.routineId);
    const found = routine ? findTask(routine.questTemplate?.rootTask?.children || [], selection.id) : null;
    return { routine, task: found?.task, parent: found?.parent };
  }

  return null;
}

function inspectorTitle(selection, selected) {
  if (selection.type === "quest" && selected?.quest) return `Quest: ${selected.quest.title || "Untitled"}`;
  if (selection.type === "routine" && selected?.routine) return `Routine: ${selected.routine.title || "Untitled"}`;
  if (selection.type === "task" && selected?.task) return `Task: ${selected.task.title || "Untitled"}`;
  if (selection.type === "routineTask" && selected?.task) return `Template Task: ${selected.task.title || "Untitled"}`;
  return "Nothing selected";
}

