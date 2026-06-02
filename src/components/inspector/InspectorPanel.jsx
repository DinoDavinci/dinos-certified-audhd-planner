import React, { useState } from "react";
import {
  Play,
  Trash2,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import {
  DIFFICULTIES,
  WEEKDAYS,
  EVERY_DAY_MASK,
  MODES,
  COOLDOWN_UNITS,
  reconcileTodayQuestForRoutine,
  isTaskComplete,
  hasCountTarget,
  isCountReady,
  getCountProgress,
  getLeafProgressPercent,
  areTaskChildrenComplete,
  isQuestComplete,
  isQuestReadyToComplete,
  getTaskProgress,
  getQuestProgress,
  countLeafProgress,
  findTask,
  findTaskPath,
  getTaskAncestry,
  updateQuestTree,
} from "../../models/appModel";

function PanelTitleBar({ title, children, className = "" }) {
  return (
    <div className={`panel-title-bar ${className}`}>
      <div className="panel-title">{title}</div>
      {children && <div className="panel-title-actions">{children}</div>}
    </div>
  );
}

export default function InspectorPanel(props) {
  const { rightSplit } = props;

  return (
    <section
      className="panel panel-scroll inspector-panel"
      style={{ flexBasis: `${rightSplit}%` }}
    >
      <InspectorTitleBar {...props} />
      <div className="panel-content">
        <Inspector {...props} />
      </div>
    </section>
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

function getInspectorBarClass(selection) {
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

function InspectorTitleBar({
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
    <PanelTitleBar title={`Inspector - ${getSelectionType(selection)}`} className={getInspectorBarClass(selection)}>
      <button onClick={goBack} disabled={!canGoBack} className="title-icon-button disabled:opacity-30"><ArrowLeft size={16} /></button>
      <button onClick={goForward} disabled={!canGoForward} className="title-icon-button disabled:opacity-30"><ArrowRight size={16} /></button>
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
    </PanelTitleBar>
  );
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
  const title = inspectorTitle(selection, selected);

  return (
    <div>


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

function QuestInspector({ quest, allTags, isFocus, isQuestRoot = false, activeBranchTaskId = null, setData, routines, setSelection, makeFocus, completeQuest, restoreQuest, deleteQuest }) {
  function updateQuest(patch) {
    if (quest.locked) return;

    setData((old) => ({
      ...old,
      quests: old.quests.map((item) => (item.id === quest.id ? { ...item, ...patch } : item)),
    }));
  }

  const complete = isQuestComplete(quest);
  const hasCompletionStamp = Boolean(quest.completedAt);
  const sourceRoutine = (routines || []).find((routine) => routine.id === quest.routineId);

  return (
    <div className="space-y-4">
      <div className="wiki-meta-block">
        <QuestChildrenSummary quest={quest} setSelection={setSelection} />
      </div>

      <div className="main-action-row">
        <ProgressActionButton
          progress={getQuestProgress(quest)}
          label="Complete quest"
          readyLabel="Complete quest"
          complete={complete && hasCompletionStamp}
          completeLabel="Reopen quest"
          onComplete={completeQuest}
          onReopen={restoreQuest}
          disabled={!isQuestReadyToComplete(quest)}
          disabledTitle="Complete all root tasks first."
        />
      </div>

      <InspectorProgressBar progress={getQuestProgress(quest)} label="Quest progress" />

      {quest.locked && (
        <div className="locked-notice">
          This is a read-only instance generated from a routine.
          {sourceRoutine && (
            <button className="wiki-link-button ml-1" onClick={() => setSelection({ type: "routine", id: sourceRoutine.id })}>
              Edit source routine
            </button>
          )}
        </div>
      )}

      <FormText label="Title" value={quest.title} onChange={(value) => updateQuest({ title: value })} disabled={quest.locked} />
      <FormTextarea label="Description" value={quest.description} onChange={(value) => updateQuest({ description: value })} disabled={quest.locked} />
      <TagEditor tags={quest.tags || []} allTags={allTags} onChange={(tags) => updateQuest({ tags })} disabled={quest.locked} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Difficulty" value={quest.difficulty} options={DIFFICULTIES} onChange={(value) => updateQuest({ difficulty: value })} disabled={quest.locked} />
        <SelectField label="Rule" value={quest.rootTask?.mode || "all"} options={MODES} onChange={(value) => updateQuest({ rootTask: { ...quest.rootTask, mode: value } })} disabled={quest.locked} />
      </div>

      <FormDate label="Deadline" value={quest.deadline} onChange={(value) => updateQuest({ deadline: value })} disabled={quest.locked} />

      {!quest.locked && (
        <div className="cooldown-box">
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={quest.cooldownEnabled}
              onChange={(event) => updateQuest({ cooldownEnabled: event.target.checked })}
            />
            Reset after cooldown
          </label>

          {quest.cooldownEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FormNumber
                label="Cooldown amount"
                value={quest.cooldownAmount}
                onChange={(value) => updateQuest({ cooldownAmount: value })}
              />
              <SelectField
                label="Cooldown unit"
                value={quest.cooldownUnit}
                options={COOLDOWN_UNITS}
                onChange={(value) => updateQuest({ cooldownUnit: value })}
              />
            </div>
          )}

          {quest.cooldownEnabled && quest.completedAt && (
            <div className="mt-2 text-xs text-neutral-400">
              Completed {quest.completedAt}. Resets after {quest.cooldownAmount} {quest.cooldownUnit}.
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-neutral-400">Progress</span>
          <span>{getQuestProgress(quest)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full rounded-full bg-slate-200" style={{ width: `${getQuestProgress(quest)}%` }} />
        </div>
      </div>

      <div className="danger-zone">
        <button
          onClick={deleteQuest}
          disabled={quest.locked}
          className="danger-button w-full disabled:opacity-40 disabled:cursor-not-allowed"
          title={quest.locked ? "Routine-generated quests cannot be deleted from the quest inspector." : "Delete quest"}
        >
          <Trash2 size={16} /> Delete quest
        </button>
      </div>


    </div>
  );
}

function RoutineInspector({ routine, allTags, setData, deleteRoutine, runMaintenanceNow }) {
  function applyRoutinePatch(currentRoutine, patch) {
    const nextRoutine = { ...currentRoutine, ...patch };
    const questTemplate = nextRoutine.questTemplate || {};
    const rootTask = questTemplate.rootTask || {};

    const nextQuestTemplate = {
      ...questTemplate,
      title: "title" in patch ? patch.title : questTemplate.title ?? nextRoutine.title,
      description: "description" in patch ? patch.description : questTemplate.description ?? nextRoutine.description,
      tags: "tags" in patch ? patch.tags : questTemplate.tags ?? nextRoutine.tags,
      difficulty: "difficulty" in patch ? patch.difficulty : questTemplate.difficulty ?? nextRoutine.difficulty,
      rootTask: {
        ...rootTask,
        mode: "mode" in patch ? patch.mode : rootTask.mode || nextRoutine.mode || "sequence",
        title: "Complete Quest",
        description: "Finalize and complete this quest.",
        locked: true,
        completed: false,
      },
    };

    return {
      ...nextRoutine,
      title: nextQuestTemplate.title,
      description: nextQuestTemplate.description,
      tags: nextQuestTemplate.tags,
      difficulty: nextQuestTemplate.difficulty,
      mode: nextQuestTemplate.rootTask.mode,
      questTemplate: nextQuestTemplate,
    };
  }

  function updateRoutine(patch) {
    setData((old) => {
      const updatedRoutine = applyRoutinePatch(routine, patch);
      return {
        ...old,
        routines: old.routines.map((item) => (item.id === routine.id ? updatedRoutine : item)),
        quests: reconcileTodayQuestForRoutine(old.quests, updatedRoutine),
      };
    });
  }

  return (
    <div className="space-y-4">
      <div className="main-action-row">
      </div>

      <FormText label="Title" value={routine.title} onChange={(value) => updateRoutine({ title: value })} />
      <FormTextarea label="Description" value={routine.description} onChange={(value) => updateRoutine({ description: value })} />
      <TagEditor tags={routine.tags || []} allTags={allTags} onChange={(tags) => updateRoutine({ tags })} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Difficulty" value={routine.difficulty} options={DIFFICULTIES} onChange={(value) => updateRoutine({ difficulty: value })} />
        <SelectField label="Quest rule" value={routine.mode} options={MODES} onChange={(value) => updateRoutine({ mode: value })} />
      </div>

      <DayMaskEditor
        label="Active days"
        value={routine.dayMask ?? EVERY_DAY_MASK}
        onChange={(value) => updateRoutine({ dayMask: value })}
      />

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={routine.active} onChange={(e) => updateRoutine({ active: e.target.checked })} />
        Active
      </label>

      <div className="danger-zone">
        <button onClick={deleteRoutine} className="danger-button w-full"><Trash2 size={16} /> Delete routine</button>
      </div>


    </div>
  );
}

function InspectorProgressBar({ progress, label = "Progress", detail = "" }) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  return (
    <div className="inspector-progress-block">
      <div className="inspector-progress-header">
        <span>{label}</span>
        <span>{detail || `${safeProgress}%`}</span>
      </div>
      <div className="inspector-progress-bar">
        <div className="inspector-progress-fill" style={{ width: `${safeProgress}%` }} />
      </div>
    </div>
  );
}

function ProgressActionButton({
  progress,
  label,
  readyLabel,
  complete,
  completeLabel = "Reopen",
  onComplete,
  onReopen,
  disabled = false,
  disabledTitle = "",
}) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  if (complete) {
    return (
      <button onClick={onReopen} className="main-action-button progress-action-button">
        <RotateCcw size={18} /> {completeLabel}
      </button>
    );
  }

  if (safeProgress >= 100 && !disabled) {
    return (
      <button onClick={onComplete} className="main-action-button progress-action-button">
        <CheckCircle2 size={18} /> {readyLabel}
      </button>
    );
  }

  return (
    <button className="main-action-button progress-action-button" disabled title={disabledTitle}>
      <CheckCircle2 size={18} /> {label}
    </button>
  );
}

function TaskProgressBar({ task }) {
  const progress = getTaskProgress(task);
  const counts = countLeafProgress(task);

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-neutral-400">Progress</span>
        <span>{counts.complete} / {counts.total} · {progress}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-neutral-800">
        <div className="h-full rounded bg-neutral-200" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function CounterField({ label, value, onChange, disabled = false, min = 0 }) {
  const safeValue = Math.max(min, Number(value || min));

  return (
    <div>
      <InputLabel text={label} />
      <div className="counter-field mt-1">
        <input
          className="field counter-input"
          type="number"
          min={min}
          value={safeValue}
          onChange={(event) => onChange(Math.max(min, Number(event.target.value || min)))}
          disabled={disabled}
        />
        <div className="counter-stepper">
          <button type="button" onClick={() => onChange(safeValue + 1)} disabled={disabled}>+</button>
          <button type="button" onClick={() => onChange(Math.max(min, safeValue - 1))} disabled={disabled}>−</button>
        </div>
      </div>
    </div>
  );
}

function TaskInspector({ task, parent, ownerTitle, ancestry, setSelection, locked = false, canFocusBranch = false, isBranchFocused = false, setBranchFocus, clearBranchFocus, updateTask, toggleComplete, template }) {
  const hasChildren = (task.children || []).length > 0;
  const complete = isTaskComplete(task);

  return (
    <div className="space-y-4">
      <div className="wiki-meta-block">
        <AncestryPath ancestry={ancestry || []} setSelection={setSelection} />
        <ChildrenSummary task={task} ancestry={ancestry || []} setSelection={setSelection} />
      </div>

      {!template && (
        <div className="main-action-row">
          {hasChildren ? (
            <ProgressActionButton
              progress={getTaskProgress(task)}
              label="Complete task"
              readyLabel="Complete task"
              complete={complete}
              completeLabel="Mark incomplete"
              onComplete={toggleComplete}
              onReopen={toggleComplete}
              disabled={!areTaskChildrenComplete(task)}
              disabledTitle="Complete all child tasks first."
            />
          ) : (
            <button onClick={toggleComplete} className="main-action-button">
              {complete ? <RotateCcw size={18} /> : hasCountTarget(task) && !isCountReady(task) ? <Play size={18} /> : <CheckCircle2 size={18} />}
              {complete ? "Mark incomplete" : hasCountTarget(task) && !isCountReady(task) ? "Progress task" : "Complete task"}
            </button>
          )}
        </div>
      )}

      {hasChildren && (
        <InspectorProgressBar progress={getTaskProgress(task)} label="Task progress" />
      )}

      {!hasChildren && hasCountTarget(task) && (
        <InspectorProgressBar
          progress={getLeafProgressPercent(task)}
          label="Count progress"
          detail={`${getCountProgress(task).progress} / ${getCountProgress(task).target}`}
        />
      )}

      <FormText label="Title" value={task.title} onChange={(value) => updateTask((old) => ({ ...old, title: value }))} disabled={locked} />
      <FormTextarea label="Description" value={task.description} onChange={(value) => updateTask((old) => ({ ...old, description: value }))} disabled={locked} />
      <SelectField label="Child rule" value={task.mode} options={MODES} onChange={(value) => updateTask((old) => ({ ...old, mode: value }))} disabled={locked} />

      <div className="grid grid-cols-2 gap-3">
        <CounterField
          label="Count target"
          value={task.countTarget || 0}
          min={0}
          disabled={locked || hasChildren}
          onChange={(value) => updateTask((old) => {
            const nextTarget = Math.max(0, Number(value || 0));
            const nextProgress = Math.min(nextTarget, Math.max(0, Number(old.countProgress || 0)));
            return {
              ...old,
              countTarget: nextTarget,
              countProgress: nextProgress,
              completed: false,
            };
          })}
        />
        <CounterField
          label="Count progress"
          value={task.countProgress || 0}
          disabled={hasChildren || !(task.countTarget > 0)}
          onChange={(value) => updateTask((old) => {
            const target = Math.max(0, Number(old.countTarget || 0));
            const progress = Math.min(target, Math.max(0, Number(value || 0)));
            return {
              ...old,
              countProgress: progress,
              completed: false,
            };
          }, { allowLockedProgress: true })}
        />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
        {hasChildren
          ? "Parent task: can be completed after its children are complete."
          : task.countTarget > 0
            ? "Counted leaf task: progress clicks advance the counter until complete."
            : template
              ? "Template leaf: generated copies can be completed later."
              : "Leaf task: can be completed directly."}
      </div>

    </div>
  );
}

function QuestChildrenSummary({ quest, setSelection }) {
  const children = quest?.rootTask?.children || [];
  if (children.length === 0) {
    return (
      <div className="wiki-meta-line">
        <span className="wiki-meta-label">Children:</span>{" "}
        <span className="text-neutral-500">None</span>
      </div>
    );
  }

  return (
    <div className="wiki-meta-line">
      <span className="wiki-meta-label">Children:</span>{" "}
      {children.map((child, index) => (
        <React.Fragment key={child.id}>
          {index > 0 && <span>, </span>}
          <button
            className="wiki-link-button"
            onClick={() => setSelection({ type: "task", questId: quest.id, id: child.id })}
          >
            {child.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function ChildrenSummary({ task, ancestry, setSelection }) {
  const children = task?.children || [];
  if (children.length === 0) return null;

  const owner = ancestry?.[0];

  return (
    <div className="wiki-meta-line">
      <span className="wiki-meta-label">Children:</span>{" "}
      {children.map((child, index) => (
        <React.Fragment key={child.id}>
          {index > 0 && <span>, </span>}
          <button
            className="wiki-link-button"
            onClick={() => {
              if (owner?.type === "quest" && setSelection) {
                setSelection({ type: "task", questId: owner.id, id: child.id });
              }
              if (owner?.type === "routine" && setSelection) {
                setSelection({ type: "routineTask", routineId: owner.id, id: child.id });
              }
            }}
          >
            {child.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function AncestryPath({ ancestry, setSelection }) {
  if (!ancestry || ancestry.length === 0) return null;

  return (
    <div className="ancestry-path">
      {ancestry.map((item, index) => (
        <React.Fragment key={`${item.type}-${item.id}-${index}`}>
          {index > 0 && <span className="ancestry-separator">›</span>}
          <button
            className="ancestry-button"
            onClick={() => {
              if (item.type === "quest") setSelection({ type: "quest", id: item.id });
              if (item.type === "routine") setSelection({ type: "routine", id: item.id });
              if (item.type === "task") setSelection({ type: "task", questId: item.questId, id: item.id });
              if (item.type === "routineTask") setSelection({ type: "routineTask", routineId: item.routineId, id: item.id });
            }}
          >
            {item.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function DayMaskEditor({ label, value, onChange, disabled = false }) {
  function toggleDay(bit) {
    if (disabled) return;
    onChange(value ^ bit);
  }

  return (
    <div>
      <InputLabel text={label} />
      <div className="day-mask-row">
        {WEEKDAYS.map((day) => {
          const active = (value & day.bit) !== 0;
          return (
            <button
              key={day.key}
              type="button"
              className={active ? "day-button day-button-active" : "day-button"}
              onClick={() => toggleDay(day.bit)}
              disabled={disabled}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagEditor({ tags, allTags, onChange, disabled = false }) {
  const [custom, setCustom] = useState("");

  function toggle(tag) {
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  }

  function addCustom() {
    const clean = custom.trim();
    if (!clean) return;
    if (!tags.includes(clean)) onChange([...tags, clean]);
    setCustom("");
  }

  return (
    <div>
      <InputLabel text="Tags" />

      <div className="mt-2 flex flex-wrap gap-2">
        {allTags.map((tag) => (
          <button key={tag} onClick={() => !disabled && toggle(tag)} disabled={disabled} className={tags.includes(tag) ? "pill-green" : "pill"}>{tag}</button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input className="field" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom tag" disabled={disabled} />
        <button className="secondary-button" onClick={addCustom} disabled={disabled}>Add</button>
      </div>
    </div>
  );
}

function InputLabel({ text }) {
  return <label className="block text-sm font-medium text-neutral-300">{text}</label>;
}

function FormText({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <input className="field mt-1" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function FormTextarea({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <textarea className="field mt-1 min-h-24" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function FormNumber({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <input
        className="field mt-1"
        type="number"
        min="1"
        value={value || 1}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}

function FormDate({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <input className="field mt-1" type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function SelectField({ label, value, options, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <select className="field mt-1" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}
