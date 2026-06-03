import React, { useEffect, useRef, useState } from "react";
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


const TREE_INTERACTION_MODE = "rearrange";

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
  const isRearrangeMode = TREE_INTERACTION_MODE === "rearrange";
  const [dropIndicator, setDropIndicator] = useState(null);
  const [dragState, setDragState] = useState(null);
  const treeContentRef = useRef(null);
  const dragStateRef = useRef(null);
  const dropIndicatorRef = useRef(null);
  const interactionClassName = isRearrangeMode ? "tree-view-rearrange" : "tree-view-normal";
  const shellClassName = embedded
    ? `tree-view-root ${treeModeClass(treeContext)} ${interactionClassName}`
    : `panel panel-scroll ${treeModeClass(treeContext)} ${interactionClassName}`;
  const shellStyle = embedded ? undefined : { flexBasis: `${100 - rightSplit}%` };

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

      const nextIndicator = getTreeDropIndicatorFromPoint(event, treeContentRef.current);
      dropIndicatorRef.current = nextIndicator;
      setDropIndicator(nextIndicator);
    }

    function handleWindowPointerUp(event) {
      const activeDrag = dragStateRef.current;
      if (!activeDrag) return;
      if (activeDrag.pointerId !== event.pointerId) return;
      finishTreeDrag(event);
    }

    function handleWindowPointerCancel(event) {
      const activeDrag = dragStateRef.current;
      if (!activeDrag) return;
      if (activeDrag.pointerId !== event.pointerId) return;
      cancelTreeDrag();
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

  function updateDropIndicator(event, id, forcedZone = null) {
    if (!isRearrangeMode || !id) return;
    if (!dragStateRef.current) return;

    const nextIndicator =
      getTreeDropIndicatorFromPoint(event, treeContentRef.current) ||
      getTreeDropIndicator(event, treeContentRef.current, id, forcedZone);

    if (!nextIndicator) return;

    dropIndicatorRef.current = nextIndicator;
    setDropIndicator(nextIndicator);
  }

  function clearDropIndicator() {
    if (dragStateRef.current) return;

    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }

  function beginTreeDrag(event, source) {
    if (!isRearrangeMode || !source?.taskId) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const nextDragState = {
      ...source,
      pointerId: event.pointerId,
      startedAtClientX: event.clientX,
      startedAtClientY: event.clientY,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
    console.log("[Tree rearrange] drag start", nextDragState);
  }

  function finishTreeDrag(event) {
    const activeDrag = dragStateRef.current;
    if (!activeDrag) return;

    event.preventDefault();
    event.stopPropagation();

    const releaseTarget =
      getTreeDropIndicatorFromPoint(event, treeContentRef.current) ||
      dropIndicatorRef.current;

    const result = {
      source: activeDrag,
      target: releaseTarget,
    };

    console.log("[Tree rearrange] drag release", result);
    dragStateRef.current = null;
    setDragState(null);
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }

  function cancelTreeDrag() {
    const activeDrag = dragStateRef.current;
    if (!activeDrag) return;
    console.log("[Tree rearrange] drag cancel", activeDrag);
    dragStateRef.current = null;
    setDragState(null);
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }

  return (
    <section
      className={`${shellClassName} ${dragState ? "tree-drag-active" : ""}`}
      style={shellStyle}
    >
      <div className="tree-scene-header">
        <div className="tree-toolbar">
          <div className="tree-toolbar-context">
            <span className="tree-mode-pill">{treeContext.type === "focus" ? "Focus" : treeContext.type === "routine" ? "Routine" : treeContext.type === "quest" ? "Quest" : "Empty"}</span>
            {effectiveTreeEditMode && <span className="tree-edit-pill">Editing</span>}
            {dragState && <span className="tree-drag-pill">Dragging: {dragState.title}</span>}
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
      </div>

      <div className="scene-contents-panel tree-contents-panel">
        <div className="scene-contents-margin tree-contents-margin">
          <div
            className="tree-scene-content"
            ref={treeContentRef}
            onMouseLeave={clearDropIndicator}
          >
            {dropIndicator && <TreeDropIndicator indicator={dropIndicator} />}
            {treeContext.type === "routine" && (
              <TreeRootNode
                id={treeContext.routine.questTemplate?.rootTask?.id || `routine-root-${treeContext.routine.id}`}
                title={treeContext.routine.title}
                kind="routine"
                selected={selection.type === "routine" && selection.id === treeContext.routine.id}
                expanded={expanded}
                setExpanded={setExpanded}
                onSelect={() => !treeEditMode && setSelection({ type: "routine", id: treeContext.routine.id })}
                dropIndicator={dropIndicator}
                updateDropIndicator={updateDropIndicator}
              >
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
                  depth={1}
                  treeEditMode={effectiveTreeEditMode}
                  selection={selection}
                  treeContext={treeContext}
                  dropIndicator={dropIndicator}
                  updateDropIndicator={updateDropIndicator}
                  beginTreeDrag={beginTreeDrag}
                  template
                />
              </TreeRootNode>
            )}

            {(treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && (
              <TreeRootNode
                id={treeContext.quest.rootTask?.id || `quest-root-${treeContext.quest.id}`}
                title={treeContext.quest.title}
                kind={`root-${treeContext.type === "focus" ? questTypeClass(treeContext.quest) : questTypeClass(treeContext.quest)}`}
                selected={selection.type === "quest" && selection.id === treeContext.quest.id}
                expanded={expanded}
                setExpanded={setExpanded}
                onSelect={() => !treeEditMode && setSelection({ type: "quest", id: treeContext.quest.id })}
                dropIndicator={dropIndicator}
                updateDropIndicator={updateDropIndicator}
              >
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
                  depth={1}
                  treeEditMode={effectiveTreeEditMode}
                  selection={selection}
                  treeContext={treeContext}
                  dropIndicator={dropIndicator}
                  updateDropIndicator={updateDropIndicator}
                  beginTreeDrag={beginTreeDrag}
                />
              </TreeRootNode>
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

function TreeRootNode({ id, title, kind, selected, expanded, setExpanded, onSelect, dropIndicator, updateDropIndicator, children }) {
  const open = expanded[id] ?? true;
  const className = ["tree-row", "tree-root-row", selected ? "tree-row-selected" : "", `tree-root-${kind}`].join(" ");

  return (
    <div className="tree-node-wrap tree-root-node-wrap">
      <div className="tree-row-wrap tree-node-root tree-row-branch">
        <div className="tree-disclosure-gutter">
          <button
            className="tree-disclosure"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded({ ...expanded, [id]: !open });
            }}
            title={open ? "Collapse root" : "Expand root"}
          >
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        <div
          className={className}
          data-tree-row-id={id}
          data-tree-has-children="true"
          data-tree-open={open ? "true" : "false"}
          onMouseMove={(event) => updateDropIndicator?.(event, id)}
          onClick={onSelect}
        >
          <div className="tree-root-content">
            <div className="tree-root-icon">◆</div>
            <div className="tree-root-title">{title || "Untitled"}</div>
            <div className="tree-root-icon">◆</div>
          </div>
        </div>
      </div>

      {open && (
        <div className="tree-children-group">
          {children}
        </div>
      )}
    </div>
  );
}


function getTreeDropZone(event) {
  return getTreeDropZoneFromElement(event, event.currentTarget);
}

function getTreeDropZoneFromElement(event, rowElement) {
  const rect = rowElement.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const ratio = rect.height > 0 ? y / rect.height : 0.5;

  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

function getTreeDropIndicator(event, treeContentElement, id, forcedZone = null) {
  const rowElement = event.currentTarget;
  return getTreeDropIndicatorForElement(event, treeContentElement, rowElement, id, forcedZone);
}

function getTreeDropIndicatorFromPoint(event, treeContentElement) {
  if (!treeContentElement) return null;

  const hitElement = document.elementFromPoint(event.clientX, event.clientY);
  if (!hitElement || !treeContentElement.contains(hitElement)) return null;

  const subtreeEndElement = hitElement.closest?.(".tree-subtree-end-drop-zone");
  if (subtreeEndElement && treeContentElement.contains(subtreeEndElement)) {
    const id = subtreeEndElement.dataset.treeSubtreeEndFor;
    return getTreeDropIndicatorForElement(event, treeContentElement, subtreeEndElement, id, "subtree-after");
  }

  const rowElement = hitElement.closest?.("[data-tree-row-id]");
  if (!rowElement || !treeContentElement.contains(rowElement)) return null;

  return getTreeDropIndicatorForElement(event, treeContentElement, rowElement, rowElement.dataset.treeRowId);
}

function getTreeDropIndicatorForElement(event, treeContentElement, rowElement, id, forcedZone = null) {
  if (!treeContentElement || !rowElement || !id) return null;

  const contentRect = treeContentElement.getBoundingClientRect();
  const rowElements = Array.from(treeContentElement.querySelectorAll("[data-tree-row-id]"));
  const sourceRow = findTreeRowById(rowElements, id);
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
    };
  }

  const zone = forcedZone || getTreeDropZoneFromElement(event, rowElement);

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
  const isExpandedComposite = targetRow.dataset.treeHasChildren === "true" && targetRow.dataset.treeOpen === "true";

  let boundaryY = zone === "before" ? rowRect.top : rowRect.bottom;
  let boundaryRow = targetRow;
  let placement = zone;

  if (zone === "before" && previousRow) {
    const previousRect = previousRow.getBoundingClientRect();
    boundaryY = (previousRect.bottom + rowRect.top) / 2;
  }

  if (zone === "after" && isExpandedComposite && nextRow) {
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
  };
}

function findTreeRowById(rowElements, id) {
  return rowElements.find((rowElement) => rowElement.dataset.treeRowId === id) || null;
}

function TreeDropIndicator({ indicator }) {
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
    ? "tree-drop-overlay tree-drop-overlay-inside"
    : "tree-drop-overlay tree-drop-overlay-boundary";

  return <div className={className} style={style} />;
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

function QuestTree({ tasks, expanded, setExpanded, onSelect, onAddChild, onDelete, onMoveUp, onMoveDown, onToggleComplete, depth = 0, parentId = null, template = false, treeEditMode = false, selection = null, treeContext = null, dropIndicator = null, updateDropIndicator = null, beginTreeDrag = null }) {
  if (!tasks || tasks.length === 0) return <div className="text-sm text-neutral-500">No tasks yet.</div>;

  return (
    <div className="tree-node-list">
      {tasks.map((task, index) => {
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
                data-tree-row-id={task.id}
                data-tree-has-children={hasChildren ? "true" : "false"}
                data-tree-open={open ? "true" : "false"}
                data-tree-parent-id={parentId || ""}
                data-tree-index={index}
                onPointerDown={(event) => beginTreeDrag?.(event, {
                  taskId: task.id,
                  parentId,
                  index,
                  title: task.title || "Untitled task",
                  contextType: treeContext?.type || "unknown",
                })}
                onMouseMove={(event) => updateDropIndicator?.(event, task.id)}
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

                <div
                  className="tree-row-buttons"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
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
              <>
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
                    parentId={task.id}
                    template={template}
                    treeEditMode={treeEditMode}
                    selection={selection}
                    treeContext={treeContext}
                    dropIndicator={dropIndicator}
                    updateDropIndicator={updateDropIndicator}
                    beginTreeDrag={beginTreeDrag}
                  />
                </div>
                <div
                  className="tree-subtree-end-drop-zone"
                  data-tree-subtree-end-for={task.id}
                  onMouseMove={(event) => updateDropIndicator?.(event, task.id, "subtree-after")}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
