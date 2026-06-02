import React from "react";
import { Play, CheckCircle2, RotateCcw } from "lucide-react";

import {
  MODES,
  isTaskComplete,
  hasCountTarget,
  isCountReady,
  getCountProgress,
  getLeafProgressPercent,
  areTaskChildrenComplete,
  getTaskProgress,
} from "../../models/appModel";

import {
  AncestryPath,
  ChildrenSummary,
  ProgressActionButton,
  InspectorProgressBar,
  FormText,
  FormTextarea,
  SelectField,
  CounterField,
} from "./inspectorShared";

export default function TaskInspector({ task, parent, ownerTitle, ancestry, setSelection, locked = false, canFocusBranch = false, isBranchFocused = false, setBranchFocus, clearBranchFocus, updateTask, toggleComplete, template }) {
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

