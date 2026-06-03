import React from "react";
import {
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";

import {
  hasCountTarget,
  getCountProgress,
  isCountReady,
  isTaskComplete,
  isTaskReadyToComplete,
  isTreeTaskSelected,
  questTypeClass,
  treeModeClass,
} from "../../models/appModel";

function PanelTitleBar({ title, children, className = "" }) {
  return (
    <div className={`panel-title-bar ${className}`}>
      <div className="panel-title">{title}</div>
      {children && <div className="panel-title-actions">{children}</div>}
    </div>
  );
}

export default function TreeViewTab({
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
  embedded = false,
}) {
  const shellClassName = embedded
    ? `tree-view-root ${treeModeClass(treeContext)}`
    : `panel panel-scroll ${treeModeClass(treeContext)}`;
  const shellStyle = embedded ? undefined : { flexBasis: `${100 - rightSplit}%` };

  return (
    <section
      className={shellClassName}
      style={shellStyle}
    >
      <div className="tree-scene-header">
        <div className="tree-toolbar">
          <div className="tree-toolbar-context">
            <span className="tree-mode-pill">{treeContext.type === "focus" ? "Focus" : treeContext.type === "routine" ? "Routine" : treeContext.type === "quest" ? "Quest" : "Empty"}</span>
            {effectiveTreeEditMode && <span className="tree-edit-pill">Editing</span>}
          </div>

          <div className="tree-toolbar-actions">
            {effectiveTreeEditMode && treeContext.type === "routine" && (
              <button onClick={() => createRoutineTask(treeContext.routine.id, null)} className="title-secondary-button">+ Task</button>
            )}
            {effectiveTreeEditMode && (treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && !treeContext.quest.locked && (
              <button onClick={() => createQuestTask(treeContext.quest.id, null)} className="title-secondary-button">+ Task</button>
            )}
            <button
              onClick={() => !treeContext.quest?.locked && setTreeEditMode(!treeEditMode)}
              disabled={Boolean(treeContext.quest?.locked)}
              className={treeContext.quest?.locked ? "title-secondary-button title-button-disabled" : effectiveTreeEditMode ? "title-primary-button" : "title-secondary-button"}
              title={treeContext.quest?.locked ? "Routine-generated quests are read-only. Edit the source routine instead." : "Edit tree"}
            >
              {effectiveTreeEditMode ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        {treeContext.type === "routine" && (
          <TreeRootRow
            title={treeContext.routine.title}
            kind="routine"
            selected={selection.type === "routine" && selection.id === treeContext.routine.id}
            onSelect={() => !treeEditMode && setSelection({ type: "routine", id: treeContext.routine.id })}
          />
        )}

        {(treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && (
          <TreeRootRow
            title={treeContext.quest.title}
            kind={`root-${treeContext.type === "focus" ? questTypeClass(treeContext.quest) : questTypeClass(treeContext.quest)}`}
            selected={selection.type === "quest" && selection.id === treeContext.quest.id}
            onSelect={() => !treeEditMode && setSelection({ type: "quest", id: treeContext.quest.id })}
          />
        )}
      </div>

      <div className="scene-contents-panel tree-contents-panel">
        <div className="scene-contents-margin tree-contents-margin">
          <div className="tree-scene-content">
            {treeContext.type === "routine" && (
              <QuestTree
                tasks={treeContext.routine.questTemplate?.rootTask?.children || []}
                expanded={expanded}
                setExpanded={setExpanded}
                onSelect={(task) => setSelection({ type: "routineTask", routineId: treeContext.routine.id, id: task.id })}
                onAddChild={(task) => createRoutineTask(treeContext.routine.id, task.id)}
                onDelete={(task) => deleteRoutineTask(treeContext.routine.id, task.id)}
                onMoveUp={(task) => moveRoutineTask(treeContext.routine.id, task.id, -1)}
                onMoveDown={(task) => moveRoutineTask(treeContext.routine.id, task.id, 1)}
                onToggleComplete={() => {}}
                treeEditMode={effectiveTreeEditMode}
                selection={selection}
                treeContext={treeContext}
                template
              />
            )}

            {(treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && (
              <QuestTree
                tasks={treeContext.quest.rootTask?.children || []}
                expanded={expanded}
                setExpanded={setExpanded}
                onSelect={(task) => setSelection({ type: "task", questId: treeContext.quest.id, id: task.id })}
                onAddChild={(task) => createQuestTask(treeContext.quest.id, task.id)}
                onDelete={(task) => deleteQuestTask(treeContext.quest.id, task.id)}
                onMoveUp={(task) => moveQuestTask(treeContext.quest.id, task.id, -1)}
                onMoveDown={(task) => moveQuestTask(treeContext.quest.id, task.id, 1)}
                onToggleComplete={(task) => toggleTask(treeContext.quest.id, task.id)}
                treeEditMode={effectiveTreeEditMode}
                selection={selection}
                treeContext={treeContext}
              />
            )}

            {treeContext.type === "empty" && (
              <div className="text-sm text-neutral-500">No quest or routine selected.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TreeRootRow({ title, kind, selected, onSelect }) {
  const className = ["tree-row", "tree-root-row", selected ? "tree-row-selected" : "", `tree-root-${kind}`].join(" ");

  return (
    <div className={className} onClick={onSelect}>
      <div className="tree-root-content">
        <div className="tree-root-icon">◆</div>
        <div className="tree-root-title">{title || "Untitled"}</div>
        <div className="tree-root-icon">◆</div>
      </div>
    </div>
  );
}

function getTreeStatusClass(task) {
  if (isTaskComplete(task)) return "tree-status-complete";

  if (hasCountTarget(task) && getCountProgress(task).progress > 0) {
    return "tree-status-in-progress";
  }

  const children = task.children || [];
  if (children.some((child) => getTreeStatusClass(child) !== "tree-status-empty")) {
    return "tree-status-in-progress";
  }

  return "tree-status-empty";
}

function QuestTree({ tasks, expanded, setExpanded, onSelect, onAddChild, onDelete, onMoveUp, onMoveDown, onToggleComplete, depth = 0, template = false, treeEditMode = false, selection = null, treeContext = null }) {
  if (!tasks || tasks.length === 0) return <div className="text-sm text-neutral-500">No tasks yet.</div>;

  return (
    <div className="tree-node-list">
      {tasks.map((task) => {
        const children = task.children || [];
        const hasChildren = children.length > 0;
        const open = expanded[task.id] ?? true;
        const complete = isTaskComplete(task);
        const statusClass = getTreeStatusClass(task);

        const selected = isTreeTaskSelected(selection, treeContext, task);
        const rowClass = [
          "tree-row",
          statusClass,
          complete ? "tree-row-complete" : "",
          selected ? "tree-row-selected" : "",
          treeEditMode ? "tree-row-edit" : "",
        ].join(" ");

        return (
          <div key={task.id} className="tree-node-wrap">
            <div className={[depth > 0 ? "tree-row-wrap tree-node-child" : "tree-row-wrap tree-node-root", hasChildren ? "tree-row-branch" : "tree-row-leaf"].join(" ")}>
              <div className="tree-disclosure-gutter">
                {hasChildren ? (
                  <button
                    className="tree-disclosure"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpanded({ ...expanded, [task.id]: !open });
                    }}
                  >
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <div className="tree-disclosure-spacer" />
                )}
              </div>

              <div
                className={rowClass}
                onClick={() => !treeEditMode && onSelect(task)}
              >
                <div className="tree-row-main">
                  <div className="tree-row-title">
                    {task.title || "Untitled task"}
                    {hasCountTarget(task) && (
                      <span className="tree-count-suffix"> ({getCountProgress(task).progress}/{getCountProgress(task).target})</span>
                    )}
                  </div>
                  {hasChildren && <div className="tree-row-mode">{task.mode === "sequence" ? "seq" : "all"}</div>}
                </div>

                <div className="tree-row-buttons" onClick={(event) => event.stopPropagation()}>
                  {treeEditMode ? (
                    <>
                      <button onClick={() => onMoveUp?.(task)} className="tree-icon-button" title="Move up"><ArrowUp size={14} /></button>
                      <button onClick={() => onMoveDown?.(task)} className="tree-icon-button" title="Move down"><ArrowDown size={14} /></button>
                      <button onClick={() => onAddChild(task)} className="tree-icon-button" title="Add child"><Plus size={14} /></button>
                      <button onClick={() => onDelete?.(task)} className="tree-icon-button danger-tree-button" title="Delete"><Trash2 size={14} /></button>
                    </>
                  ) : (
                    !template && (!hasChildren || complete || isTaskReadyToComplete(task)) && (
                      <button
                        onClick={() => onToggleComplete(task)}
                        className="tree-icon-button"
                        title={complete ? "Mark incomplete" : hasChildren ? "Confirm complete" : "Complete"}
                      >
                        {complete ? <X size={14} /> : hasCountTarget(task) && !isCountReady(task) ? <Play size={14} /> : <CheckCircle2 size={14} />}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {hasChildren && open && (
              <div className="tree-children-group">
                <QuestTree
                  tasks={children}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  onSelect={onSelect}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onToggleComplete={onToggleComplete}
                  depth={depth + 1}
                  template={template}
                  treeEditMode={treeEditMode}
                  selection={selection}
                  treeContext={treeContext}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
