import React from "react";
import {
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

import {
  isQuestComplete,
  getKanbanActionState,
  getKanbanActionTitle,
  hasCountTarget,
  getCountProgress,
  getLeafProgressPercent,
} from "../../models/appModel";

function PanelTitleBar({ title, children, className = "" }) {
  return (
    <div className={`panel-title-bar ${className}`}>
      <div className="panel-title">{title}</div>
      {children && <div className="panel-title-actions">{children}</div>}
    </div>
  );
}

export default function FocusPanel({ quest, actionable, focusBoard, focusPathInfo, branchFocusId, setBranchFocus, clearBranchFocus, dueBadge, selectQuest, selectTask, toggleTask, uncompleteTask, expandedKanbanCards, setExpandedKanbanCards }) {
  if (!quest) {
    return (
      <main className="panel panel-scroll focus-col">
        <PanelTitleBar title="Current Focus" />
        <div className="panel-content text-neutral-400">Create or select a quest, then make it the current focus.</div>
      </main>
    );
  }

  return (
    <main className="panel panel-scroll focus-col">
      <PanelTitleBar title="Current Focus" />
      <div className="panel-content focus-panel-content">
      <FocusDocumentHeader
        quest={quest}
        focusPathInfo={focusPathInfo}
        selectQuest={selectQuest}
        selectTask={selectTask}
        setBranchFocus={setBranchFocus}
        clearBranchFocus={clearBranchFocus}
      />

      {focusBoard.available.some((row) => ((row.kind === "questCompletion" || row.kind === "rootTask") || row.kind === "rootTask") || row.kind === "rootTask") || isQuestComplete(quest) ? (
        <div className="complete-quest-celebration">
          <button
            onClick={() => {
              const completionRow = focusBoard.available.find((row) => ((row.kind === "questCompletion" || row.kind === "rootTask") || row.kind === "rootTask") || row.kind === "rootTask");
              if (completionRow) toggleTask(completionRow);
            }}
            className={isQuestComplete(quest) ? "recommended-complete-quest-button recommended-complete-quest-button-done" : "recommended-complete-quest-button"}
            disabled={isQuestComplete(quest)}
          >
            <span className="complete-quest-icon">◆</span>
            <span className="complete-quest-label">{isQuestComplete(quest) ? "Quest completed" : "Complete quest"}</span>
            <span className="complete-quest-icon">◆</span>
          </button>
        </div>
      ) : (
        <section className="mt-5 focus-recommend-panel">
          <h3 className="text-lg font-bold">Recommended</h3>
          {focusBoard.recommended ? (
            <div className="recommended-task-row">
              <div className="recommended-task-text">
                <FocusPathLinks row={focusBoard.recommended} selectTask={selectTask} />
                {focusBoard.recommended.task.description && (
                  <div className="mt-1 text-sm text-neutral-400">{focusBoard.recommended.task.description}</div>
                )}
              </div>
              <button onClick={() => toggleTask(focusBoard.recommended)} className="primary-button recommended-action-button">
                {getKanbanActionState(focusBoard.recommended.task) === "progress" ? <Play size={16} /> : <CheckCircle2 size={16} />}
                {getKanbanActionState(focusBoard.recommended.task) === "progress" ? "Progress" : "Complete"}
              </button>
            </div>
          ) : (
            <div className="mt-2 text-sm text-neutral-500">No available task. This quest may be complete.</div>
          )}
        </section>
      )}

      <div className="branch-progress-line">
        <div className="branch-progress-label">
          <span>Progress</span>
          <span>{Number.isFinite(focusPathInfo.progress) ? focusPathInfo.progress : 0}%</span>
        </div>
        <div className="branch-progress-track">
          <div className="branch-progress-fill" style={{ width: `${Number.isFinite(focusPathInfo.progress) ? focusPathInfo.progress : 0}%` }} />
        </div>
      </div>

      <section className="mt-5 focus-board">
        <FocusColumn
          title="Available"
          rows={focusBoard.available}
          emptyText="No available tasks."
          selectTask={selectTask}
          toggleTask={toggleTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          showCompleteButton
        />
        <FocusColumn
          title="In Progress"
          rows={focusBoard.inProgress}
          emptyText="No parent tasks in progress."
          selectTask={selectTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          showProgress
        />
        <FocusColumn
          title="Completed"
          rows={focusBoard.completed}
          emptyText="Nothing completed yet."
          selectTask={selectTask}
          uncompleteTask={uncompleteTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          completed
          showUncompleteButton
          summary={`${focusBoard.completedCount} / ${focusBoard.totalCount}`}
        />
      </section>
      </div>
    </main>
  );
}

function getFocusDisplayNode(quest, focusPathInfo) {
  if (!quest) return null;
  return focusPathInfo?.branchTask || quest;
}

function getFocusDisplayPath(quest, focusPathInfo) {
  if (!quest) return [];

  return [
    { id: quest.id, title: quest.title || "Untitled quest", type: "quest" },
    ...(focusPathInfo?.path || []).map((task) => ({
      id: task.id,
      title: task.title || "Untitled",
      type: "task",
    })),
  ];
}

function FocusDirectoryPath({ quest, focusPathInfo, selectQuest, setBranchFocus, clearBranchFocus }) {
  const items = getFocusDisplayPath(quest, focusPathInfo);

  return (
    <div className="focus-directory-path">
      <span className="focus-relation-label">Path:</span>
      {items.map((item, index) => (
        <React.Fragment key={`${item.type}-${item.id}`}>
          {index > 0 && <span className="focus-directory-separator">›</span>}
          <button
            className="focus-directory-link"
            onClick={() => {
              if (item.type === "quest") {
                clearBranchFocus();
              } else {
                setBranchFocus(item.id);
              }
            }}
          >
            {item.title}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function FocusRelations({ quest, focusPathInfo, setBranchFocus, clearBranchFocus, selectQuest }) {
  const childBranches = focusPathInfo?.childBranches || [];
  return (
    <div className="focus-relations">

      <div className="focus-relation-line">
        <span className="focus-relation-label">Subquests:</span>
        {childBranches.length === 0 && <span className="focus-relation-muted">No subquests</span>}
        {childBranches.map((task) => (
          <button type="button" key={task.id} className="focus-relation-chip" onClick={() => setBranchFocus(task.id)}>
            {task.title || "Untitled"}
          </button>
        ))}
      </div>
    </div>
  );
}

function FocusDocumentHeader({ quest, focusPathInfo, selectQuest, selectTask, setBranchFocus, clearBranchFocus }) {
  const displayNode = getFocusDisplayNode(quest, focusPathInfo);
  const description = displayNode?.description || "";

  return (
    <div className="focus-document-header">
      <button
        className="focus-document-title focus-document-title-button"
        onClick={() => {
          if (focusPathInfo?.branchTask) {
            selectTask(focusPathInfo.branchTask);
          } else {
            selectQuest(quest);
          }
        }}
        title="Select in inspector"
      >
        {displayNode?.title || "Untitled"}
      </button>

      {(focusPathInfo?.path || []).length > 0 && (
        <FocusDirectoryPath
          quest={quest}
          focusPathInfo={focusPathInfo}
          selectQuest={selectQuest}
          setBranchFocus={setBranchFocus}
          clearBranchFocus={clearBranchFocus}
        />
      )}

      <FocusRelations
        quest={quest}
        focusPathInfo={focusPathInfo}
        setBranchFocus={setBranchFocus}
        clearBranchFocus={clearBranchFocus}
        selectQuest={selectQuest}
      />

      {description.trim() !== "" && (
        <div className="focus-description-section">
          <h3 className="focus-description-title">Description</h3>
          <p className="focus-description-text">{description}</p>
        </div>
      )}
    </div>
  );
}

function FocusPathTitle({ quest, focusPathInfo, selectQuest, setBranchFocus, clearBranchFocus }) {
  const pathItems = focusPathInfo?.path || [];

  return (
    <div className="focus-path-title">
      <button onClick={() => { clearBranchFocus(); selectQuest(quest); }} className="focus-path-title-link">
        {quest.title || "Untitled quest"}
      </button>
      {pathItems.map((task) => (
        <React.Fragment key={task.id}>
          <span className="focus-path-title-separator">›</span>
          <button onClick={() => setBranchFocus(task.id)} className="focus-path-title-link">
            {task.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function FocusBranchNav({ focusPathInfo, setBranchFocus }) {
  const childBranches = focusPathInfo?.childBranches || [];

  return (
    <div className="focus-branch-nav">
      <span className="focus-branch-label">Child branches:</span>
      {childBranches.length === 0 && <span className="focus-nav-muted">None</span>}
      {childBranches.map((task) => (
        <button key={task.id} className="focus-nav-chip" onClick={() => setBranchFocus(task.id)}>
          {task.title || "Untitled"}
        </button>
      ))}
    </div>
  );
}

function FocusNavigation({ quest, focusPathInfo, setBranchFocus, clearBranchFocus }) {
  if (!quest) return null;

  const childBranches = focusPathInfo?.childBranches || [];
  const pathItems = focusPathInfo?.path || [];

  return (
    <section className="focus-nav">
      <div className="focus-nav-line">
        <span className="focus-nav-label">Focus Root:</span>
        <button className="focus-nav-link" onClick={clearBranchFocus}>{quest.title || "Untitled quest"}</button>
        {pathItems.map((task) => (
          <React.Fragment key={task.id}>
            <span className="focus-nav-separator">›</span>
            <button className="focus-nav-link" onClick={() => setBranchFocus(task.id)}>
              {task.title || "Untitled"}
            </button>
          </React.Fragment>
        ))}
      </div>

      {focusPathInfo?.branchTask && (
        <div className="focus-nav-line">
          <span className="focus-nav-label">Up:</span>
          {focusPathInfo.parent ? (
            <button className="focus-nav-link" onClick={() => setBranchFocus(focusPathInfo.parent.id)}>
              {focusPathInfo.parent.title || "Untitled"}
            </button>
          ) : (
            <button className="focus-nav-link" onClick={clearBranchFocus}>{quest.title || "Untitled quest"}</button>
          )}
        </div>
      )}

      <div className="focus-nav-line">
        <span className="focus-nav-label">Child Branches:</span>
        {childBranches.length === 0 && <span className="focus-nav-muted">None</span>}
        {childBranches.map((task) => (
          <button key={task.id} className="focus-nav-chip" onClick={() => setBranchFocus(task.id)}>
            {task.title || "Untitled"}
          </button>
        ))}
      </div>
    </section>
  );
}

function FocusPathLinks({ row, selectTask }) {
  return (
    <div className="focus-path-links">
      {row.path.map((task, index) => (
        <React.Fragment key={task.id}>
          {index > 0 && <span className="focus-path-separator">›</span>}
          <button
            className="focus-path-link"
            onClick={(event) => {
              event.stopPropagation();
              if ((row.kind !== "questCompletion" && row.kind !== "rootTask")) selectTask(task);
            }}
            title="Select in inspector"
          >
            {index === row.path.length - 1 && row.displayTitle ? row.displayTitle : task.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function FocusColumn({
  title,
  rows,
  emptyText,
  selectTask,
  toggleTask,
  uncompleteTask,
  expandedKanbanCards = {},
  setExpandedKanbanCards,
  showCompleteButton = false,
  showUncompleteButton = false,
  showProgress = false,
  completed = false,
  summary = null,
}) {
  return (
    <div className="focus-column">
      <div className="focus-column-title">
        <span>{title}</span>
        <span className="focus-column-count">{summary || rows.length}</span>
      </div>

      <div className="focus-column-list">
        {rows.length === 0 && <div className="focus-empty">{emptyText}</div>}

        {rows.map((row) => {
          const hasDescription = Boolean((row.task.description || "").trim());
          const expanded = Boolean(expandedKanbanCards[row.task.id]);

          return (
            <div
              key={row.task.id}
              className={completed ? "focus-card focus-card-complete" : "focus-card"}
            >
              <div
                className="focus-card-bar"
                onClick={() => (row.kind !== "questCompletion" && row.kind !== "rootTask") && selectTask(row.task)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if ((row.kind !== "questCompletion" && row.kind !== "rootTask")) selectTask(row.task);
                  }
                }}
              >
                <div className="focus-card-main">
                  <div className="focus-card-title-line">
                    {hasDescription && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedKanbanCards?.((old) => ({ ...old, [row.task.id]: !old[row.task.id] }));
                        }}
                        className="focus-card-done focus-card-dropdown"
                        title={expanded ? "Hide description" : "Show description"}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                    <FocusPathLinks row={row} selectTask={selectTask} />
                  </div>
                  {showProgress && row.progress && (
                    <div className="focus-card-progress-bar" title={`${row.progress.complete} / ${row.progress.total}`}>
                      <div
                        className="focus-card-progress-fill"
                        style={{ width: `${row.progress.total > 0 ? Math.round((row.progress.complete / row.progress.total) * 100) : 0}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="focus-card-actions">
                  {showCompleteButton && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleTask(row);
                      }}
                      className={`focus-card-done ${getKanbanActionState(row.task) === "progress" ? "focus-card-action-progress" : "focus-card-action-complete"}`}
                      title={getKanbanActionTitle(row.task)}
                    >
                      {getKanbanActionState(row.task) === "progress" ? <Play size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  )}

                  {showUncompleteButton && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        uncompleteTask(row);
                      }}
                      className="focus-card-done focus-card-action-uncomplete"
                      title="Mark incomplete"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {hasCountTarget(row.task) && !row.task.completed && (
                <div className="focus-card-progress-bar focus-card-progress-full" title={`${getCountProgress(row.task).progress} / ${getCountProgress(row.task).target}`}>
                  <div
                    className="focus-card-progress-fill"
                    style={{ width: `${getLeafProgressPercent(row.task)}%` }}
                  />
                </div>
              )}

              {hasDescription && expanded && (
                <div className="focus-card-body">
                  {row.task.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
