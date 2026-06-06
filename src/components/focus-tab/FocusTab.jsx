import React, { useState } from "react";
import {
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
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

function isQuestCompletionRow(row) {
  return row?.kind === "questCompletion" || row?.kind === "rootTask";
}

export default function FocusTab({ quest, focusBoard, focusPathInfo, goFocusBack, goFocusForward, canFocusGoBack = false, canFocusGoForward = false, setBranchFocus, clearBranchFocus, selectQuest, selectTask, toggleTask, uncompleteTask, expandedKanbanCards, setExpandedKanbanCards }) {
  const [showUpcomingStacks, setShowUpcomingStacks] = useState(true);
  if (!quest) {
    return (
      <main className="focus-tab-root">
        <div className="scene-contents-panel focus-contents-panel">
          <div className="scene-contents-margin focus-contents-margin">
            <div className="focus-scene-content focus-empty-message text-neutral-400">Create or select a quest, then make it the current focus.</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="focus-tab-root">
      <div className="focus-main-margin">
        <div className="focus-main-vbox">
          <FocusToolbar
            goFocusBack={goFocusBack}
            goFocusForward={goFocusForward}
            canFocusGoBack={canFocusGoBack}
            canFocusGoForward={canFocusGoForward}
          />

          <div className="scene-contents-panel focus-contents-panel">
            <div className="scene-contents-margin focus-contents-margin">
              <div className="focus-panel-content focus-scene-content">
      <FocusDocumentHeader
        quest={quest}
        focusPathInfo={focusPathInfo}
        selectQuest={selectQuest}
        selectTask={selectTask}
        setBranchFocus={setBranchFocus}
        clearBranchFocus={clearBranchFocus}
      />

      <div className="branch-progress-line">
        <div className="branch-progress-label">
          <span>Progress</span>
          <span>{Number.isFinite(focusPathInfo.progress) ? focusPathInfo.progress : 0}%</span>
        </div>
        <div className="branch-progress-track">
          <div className="branch-progress-fill" style={{ width: `${Number.isFinite(focusPathInfo.progress) ? focusPathInfo.progress : 0}%` }} />
        </div>
      </div>

      <div className="focus-board-toolbar">
        <label className="focus-board-toggle">
          <input
            type="checkbox"
            checked={showUpcomingStacks}
            onChange={(event) => setShowUpcomingStacks(event.target.checked)}
          />
          Show upcoming
        </label>
      </div>

      <section className="focus-board">
        <FocusColumn
          title="Available"
          rows={focusBoard.available}
          emptyText="No available tasks."
          selectTask={selectTask}
          setBranchFocus={setBranchFocus}
          toggleTask={toggleTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          showUpcoming={showUpcomingStacks}
        />
        <FocusColumn
          title="In Progress"
          rows={focusBoard.inProgress}
          emptyText="No tasks in progress."
          selectTask={selectTask}
          setBranchFocus={setBranchFocus}
          toggleTask={toggleTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
        />
        <FocusColumn
          title="Completed"
          rows={focusBoard.completed}
          emptyText="Nothing completed yet."
          selectTask={selectTask}
          setBranchFocus={setBranchFocus}
          uncompleteTask={uncompleteTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          completed
          showUncompleteButton
          summary={`${focusBoard.completedCount} / ${focusBoard.totalCount}`}
        />
      </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


function FocusToolbar({ goFocusBack, goFocusForward, canFocusGoBack = false, canFocusGoForward = false }) {
  return (
    <div className="focus-toolbar" style={{ justifyContent: "flex-end" }}>
      <div className="focus-toolbar-actions">
        <button
          type="button"
          onClick={goFocusBack}
          disabled={!canFocusGoBack}
          className="title-icon-button disabled:opacity-30"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          type="button"
          onClick={goFocusForward}
          disabled={!canFocusGoForward}
          className="title-icon-button disabled:opacity-30"
          title="Forward"
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
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


function parseDescriptionBlocks(text) {
  const blocks = [];
  const pattern = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    blocks.push({
      type: "code",
      language: (match[1] || "").trim(),
      text: match[2] || "",
    });

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    blocks.push({ type: "text", text: text.slice(lastIndex) });
  }

  return blocks.length > 0 ? blocks : [{ type: "text", text }];
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function DescriptionCodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyTextToClipboard(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.warn("Could not copy code block", error);
    }
  }

  return (
    <div className="description-code-panel">
      <div className="description-code-toolbar">
        <span className="description-code-language">{language || "Code"}</span>
        <button type="button" className="description-code-copy" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="description-code-pre"><code>{code}</code></pre>
    </div>
  );
}

function RichDescription({ text }) {
  const blocks = parseDescriptionBlocks(text);

  return (
    <div className="focus-description-rich">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <DescriptionCodeBlock
              key={`code-${index}`}
              code={block.text}
              language={block.language}
            />
          );
        }

        if (block.text.trim() === "") return null;

        return (
          <p key={`text-${index}`} className="focus-description-text">
            {block.text}
          </p>
        );
      })}
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
          <RichDescription text={description} />
        </div>
      )}
    </div>
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
              if (!isQuestCompletionRow(row)) selectTask(task);
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

function getLayerExpansionKey(stack, layer) {
  return `stack:${stack.stackId}:${layer.task.id}`;
}

function getLayerProgressLabel(layer) {
  if (layer.complete) return "Done";
  if (hasCountTarget(layer.task) && !layer.complete) {
    const { progress, target } = getCountProgress(layer.task);
    return `${progress}/${target}`;
  }
  if (layer.progress?.total > 0) {
    return `${layer.progress.complete}/${layer.progress.total}`;
  }
  return "";
}

function ExecutionStackLayer({ stack, layer, depth, selectTask, setBranchFocus, toggleTask, uncompleteTask, expandedKanbanCards = {}, setExpandedKanbanCards, showUncompleteButton = false }) {
  const task = layer.task;
  const displayTitle = layer.displayTitle || task.title || "Untitled";
  const displayDescription = layer.displayDescription ?? task.description ?? "";
  const hasDescription = Boolean(displayDescription.trim());
  const expansionKey = getLayerExpansionKey(stack, layer);
  const expanded = Boolean(expandedKanbanCards[expansionKey]);
  const isActionLayer = layer.isTerminal && stack.actionTask?.id === task.id && !stack.isBlocked && !stack.complete;
  const actionState = getKanbanActionState(task);
  const progressLabel = getLayerProgressLabel(layer);
  const isCompositeTask = (task.children || []).length > 0;

  return (
    <div className={`execution-stack-layer execution-stack-layer-depth-${Math.min(depth, 5)} ${layer.isTerminal ? "execution-stack-layer-terminal" : ""}`}>
      <div className="execution-stack-layer-bar">
        <div className="execution-stack-layer-main">
          {hasDescription && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpandedKanbanCards?.((old) => ({ ...old, [expansionKey]: !old[expansionKey] }));
              }}
              className="focus-card-done focus-card-dropdown"
              title={expanded ? "Hide description" : "Show description"}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          <button
            type="button"
            className="execution-stack-layer-title"
            onClick={() => {
              if (isQuestCompletionRow(stack)) return;
              if (isCompositeTask) {
                selectTask(task);
                setBranchFocus?.(task.id);
              } else {
                selectTask(task);
              }
            }}
            title={isCompositeTask ? "Focus this branch" : "Select in inspector"}
          >
            {displayTitle}
          </button>
        </div>

        <div className="execution-stack-layer-meta">
          {isActionLayer && hasCountTarget(task) && (
            <span className="execution-stack-count-badge" title="Count progress">
              {progressLabel}
            </span>
          )}

          {isActionLayer && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleTask(task);
              }}
              className={`focus-card-done ${actionState === "progress" ? "focus-card-action-progress" : "focus-card-action-complete"}`}
              title={getKanbanActionTitle(task)}
            >
              {actionState === "progress" ? <Play size={14} /> : <CheckCircle2 size={14} />}
            </button>
          )}

          {stack.complete && layer.isTerminal && showUncompleteButton && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                uncompleteTask(task);
              }}
              className="focus-card-done focus-card-action-uncomplete"
              title="Mark incomplete"
            >
              <X size={14} />
            </button>
          )}

          {!isActionLayer && !(stack.complete && layer.isTerminal && showUncompleteButton) && (
            <span className={layer.complete ? "execution-stack-done-pill" : stack.isUpcoming && layer.isTerminal ? "execution-stack-upcoming-pill" : "execution-stack-progress-pill"}>
              {stack.isUpcoming && layer.isTerminal ? "Upcoming" : progressLabel}
            </span>
          )}
        </div>
      </div>

      {hasDescription && expanded && (
        <div className="execution-stack-layer-body">
          <RichDescription text={displayDescription} />
        </div>
      )}
    </div>
  );
}

function ExecutionStackCard({ stack, selectTask, setBranchFocus, toggleTask, uncompleteTask, expandedKanbanCards = {}, setExpandedKanbanCards, showUncompleteButton = false }) {
  return (
    <div className={`execution-stack-card ${stack.isUpcoming ? "execution-stack-card-upcoming" : ""} ${stack.complete ? "focus-card-complete" : ""}`}>
      {(stack.layers || []).map((layer, index) => (
        <ExecutionStackLayer
          key={`${stack.stackId}:${layer.task.id}:${index}`}
          stack={stack}
          layer={layer}
          depth={index}
          selectTask={selectTask}
          setBranchFocus={setBranchFocus}
          toggleTask={toggleTask}
          uncompleteTask={uncompleteTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          showUncompleteButton={showUncompleteButton}
        />
      ))}
    </div>
  );
}

function FocusColumn({
  title,
  rows,
  emptyText,
  selectTask,
  setBranchFocus,
  toggleTask,
  uncompleteTask,
  expandedKanbanCards = {},
  setExpandedKanbanCards,
  completed = false,
  showUncompleteButton = false,
  showUpcoming = true,
  summary = null,
}) {
  const visibleRows = showUpcoming ? rows : rows.filter((row) => !row.isUpcoming);

  return (
    <div className="focus-column">
      <div className="focus-column-title">
        <span>{title}</span>
        <span className="focus-column-count">{summary || visibleRows.length}</span>
      </div>

      <div className="focus-column-list">
        {visibleRows.length === 0 && <div className="focus-empty">{emptyText}</div>}

        {visibleRows.map((row) => (
          <ExecutionStackCard
            key={row.stackId || row.task.id}
            stack={row}
            selectTask={selectTask}
            setBranchFocus={setBranchFocus}
            toggleTask={toggleTask}
            uncompleteTask={uncompleteTask}
            expandedKanbanCards={expandedKanbanCards}
            setExpandedKanbanCards={setExpandedKanbanCards}
            completed={completed}
            showUncompleteButton={showUncompleteButton}
          />
        ))}
      </div>
    </div>
  );
}
