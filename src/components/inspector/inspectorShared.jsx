import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Maximize2, RotateCcw } from "lucide-react";

import {
  WEEKDAYS,
  getTaskProgress,
  countLeafProgress,
} from "../../models/appModel";

export function PanelTitleBar({ title, children, className = "" }) {
  return (
    <div className={`panel-title-bar ${className}`}>
      <div className="panel-title">{title}</div>
      {children && <div className="panel-title-actions">{children}</div>}
    </div>
  );
}

export function InspectorProgressBar({ progress, label = "Progress", detail = "" }) {
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

export function ProgressActionButton({
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

export function TaskProgressBar({ task }) {
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

export function CounterField({ label, value, onChange, disabled = false, min = 0 }) {
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

export function QuestChildrenSummary({ quest, setSelection }) {
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

export function ChildrenSummary({ task, ancestry, setSelection }) {
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
            }}
          >
            {child.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export function AncestryPath({ ancestry, setSelection }) {
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
              if (item.type === "task") setSelection({ type: "task", questId: item.questId, id: item.id });
            }}
          >
            {item.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export function DayMaskEditor({ label, value, onChange, disabled = false }) {
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

export function TagEditor({ tags, allTags, onChange, disabled = false }) {
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

export function InputLabel({ text }) {
  return <label className="block text-sm font-medium text-neutral-300">{text}</label>;
}

export function FormText({ label, value, onChange, disabled = false }) {
  const externalValue = value || "";
  const [draft, setDraft] = useState(externalValue);
  const [editing, setEditing] = useState(false);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(externalValue);
  }, [externalValue, editing]);

  function commitDraft() {
    const nextValue = String(draft || "");
    if (nextValue !== externalValue) onChange(nextValue);
  }

  function handleFocus() {
    skipCommitRef.current = false;
    setEditing(true);
    setDraft(externalValue);
  }

  function handleBlur() {
    setEditing(false);

    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setDraft(externalValue);
      return;
    }

    commitDraft();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      skipCommitRef.current = true;
      setDraft(externalValue);
      event.currentTarget.blur();
    }
  }

  return (
    <div>
      <InputLabel text={label} />
      <input
        className="field mt-1 inspector-line-edit"
        value={draft}
        onFocus={handleFocus}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        title="Enter or click away to apply. Escape cancels."
      />
    </div>
  );
}

export function FormTextarea({ label, value, onChange, disabled = false }) {
  const externalValue = value || "";
  const [draft, setDraft] = useState(externalValue);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState(externalValue);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!editing && !modalOpen) setDraft(externalValue);
    if (!modalOpen) setModalDraft(externalValue);
  }, [externalValue, editing, modalOpen]);

  function commitValue(nextValue = draft) {
    const cleanValue = String(nextValue || "");
    if (cleanValue !== externalValue) onChange(cleanValue);
  }

  function handleFocus() {
    skipCommitRef.current = false;
    setEditing(true);
    setDraft(externalValue);
  }

  function handleBlur() {
    if (modalOpen) return;

    setEditing(false);

    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setDraft(externalValue);
      return;
    }

    commitValue();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      skipCommitRef.current = true;
      setDraft(externalValue);
      event.currentTarget.blur();
    }
  }

  function openModal() {
    if (disabled) return;
    setModalDraft(draft);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalDraft(externalValue);
  }

  function acceptModal() {
    const nextValue = String(modalDraft || "");
    setDraft(nextValue);
    setEditing(false);
    skipCommitRef.current = false;
    setModalOpen(false);
    commitValue(nextValue);
  }

  function handleModalKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
  }

  return (
    <div>
      <MultilineEditStyles />
      <InputLabel text={label} />
      <div className="inspector-multiline-edit mt-1">
        <textarea
          className="field inspector-multiline-edit-input"
          value={draft}
          onFocus={handleFocus}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          title="Click away to apply. Enter inserts a newline. Escape cancels."
        />
        <button
          type="button"
          className="inspector-multiline-expand-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openModal}
          disabled={disabled}
          title="Expand text editor"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {modalOpen && (
        <div className="inspector-multiline-modal-backdrop">
          <div className="inspector-multiline-modal" role="dialog" aria-modal="true">
            <div className="inspector-multiline-modal-title">Edit {label}</div>
            <textarea
              className="field inspector-multiline-modal-input"
              value={modalDraft}
              onChange={(event) => setModalDraft(event.target.value)}
              onKeyDown={handleModalKeyDown}
              autoFocus
            />
            <div className="inspector-multiline-modal-actions">
              <button type="button" className="inspector-multiline-modal-cancel" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="inspector-multiline-modal-accept" onClick={acceptModal}>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MultilineEditStyles() {
  return (
    <style>{`
      .inspector-line-edit {
        min-height: 2.15rem;
      }
      .inspector-multiline-edit {
        display: flex;
        align-items: stretch;
        min-width: 0;
      }
      .inspector-multiline-edit-input {
        min-height: 6rem;
        min-width: 0;
        resize: vertical;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
      .inspector-multiline-expand-button {
        flex: 0 0 2.15rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgb(64 64 64);
        border-left: 0;
        border-radius: 0 0.35rem 0.35rem 0;
        background: rgb(38 38 38);
        color: rgb(212 212 212);
      }
      .inspector-multiline-expand-button:hover:not(:disabled) {
        background: rgb(64 64 64);
        color: rgb(245 245 245);
      }
      .inspector-multiline-expand-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .inspector-multiline-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.62);
      }
      .inspector-multiline-modal {
        width: min(56rem, calc(100vw - 2rem));
        height: min(44rem, calc(100vh - 2rem));
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 0.75rem;
        border-radius: 0.45rem;
        border: 1px solid rgb(82 82 82);
        background: rgb(23 23 23);
        padding: 1rem;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
      }
      .inspector-multiline-modal-title {
        font-size: 1rem;
        font-weight: 900;
        color: rgb(245 245 245);
      }
      .inspector-multiline-modal-input {
        min-height: 0;
        height: 100%;
        resize: none;
      }
      .inspector-multiline-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .inspector-multiline-modal-cancel,
      .inspector-multiline-modal-accept {
        border-radius: 0.35rem;
        border: 1px solid rgb(64 64 64);
        padding: 0.38rem 0.7rem;
        font-size: 0.78rem;
        font-weight: 850;
      }
      .inspector-multiline-modal-cancel {
        background: rgb(38 38 38);
        color: rgb(229 229 229);
      }
      .inspector-multiline-modal-accept {
        background: rgb(229 229 229);
        color: rgb(23 23 23);
      }
    `}</style>
  );
}

export function FormNumber({ label, value, onChange, disabled = false }) {
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

export function FormDate({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <input className="field mt-1" type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

export function SelectField({ label, value, options, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <select className="field mt-1" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}
