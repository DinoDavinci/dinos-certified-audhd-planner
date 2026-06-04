import React, { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";

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
  return (
    <div>
      <InputLabel text={label} />
      <input className="field mt-1" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

export function FormTextarea({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <textarea className="field mt-1 min-h-24" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
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
