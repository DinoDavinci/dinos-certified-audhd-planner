import React, { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

import {
  DIFFICULTIES,
  MODES,
  COOLDOWN_UNITS,
  SCHEDULE_TYPES,
  SCHEDULE_LABELS,
  makeQuestSchedule,
  getQuestScheduleSummary,
  isQuestComplete,
  isQuestReadyToComplete,
  getQuestProgress,
} from "../../models/appModel";

import {
  ProgressActionButton,
  InspectorProgressBar,
  FormText,
  FormTextarea,
  TagEditor,
  SelectField,
  FormDate,
  FormNumber,
  DayMaskEditor,
} from "./inspectorShared";

export default function QuestInspector({ quest, allTags, isFocus, isQuestRoot = false, activeBranchTaskId = null, setData, makeFocus, completeQuest, restoreQuest, deleteQuest }) {
  function updateQuest(patch) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((item) => (item.id === quest.id ? { ...item, ...patch } : item)),
    }));
  }

  const complete = isQuestComplete(quest);
  const hasCompletionStamp = Boolean(quest.completedAt);
  const scheduleType = getQuestScheduleType(quest);
  const eventManaged = scheduleType === "event";
  const questEnabled = quest.status !== "inactive";

  return (
    <div className="space-y-4">
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

      <label className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={questEnabled}
          disabled={eventManaged}
          onChange={(event) => updateQuest({ status: event.target.checked ? "active" : "inactive" })}
        />
        Enabled
        {eventManaged && <span className="text-xs text-neutral-500">Event quests enable automatically on their event date.</span>}
      </label>

      <FormText label="Title" value={quest.title} onChange={(value) => updateQuest({ title: value })} />
      <FormTextarea label="Description" value={quest.description} onChange={(value) => updateQuest({ description: value })} />
      <TagEditor tags={quest.tags || []} allTags={allTags} onChange={(tags) => updateQuest({ tags })} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Difficulty" value={quest.difficulty} options={DIFFICULTIES} onChange={(value) => updateQuest({ difficulty: value })} />
        <SelectField label="Rule" value={quest.rootTask?.mode || "all"} options={MODES} onChange={(value) => updateQuest({ rootTask: { ...quest.rootTask, mode: value } })} />
      </div>

      <QuestScheduleGroup quest={quest} updateQuest={updateQuest} />

      <div className="danger-zone">
        <button
          onClick={deleteQuest}
          className="danger-button w-full"
          title="Delete quest"
        >
          <Trash2 size={16} /> Delete quest
        </button>
      </div>


    </div>
  );
}


function getQuestScheduleType(quest) {
  if (SCHEDULE_TYPES.includes(quest?.scheduleType)) return quest.scheduleType;
  return quest?.cooldownEnabled ? "cooldown" : "none";
}

function getQuestSchedule(quest) {
  return makeQuestSchedule({
    cooldownAmount: quest?.cooldownAmount ?? quest?.schedule?.cooldownAmount ?? 6,
    cooldownUnit: quest?.cooldownUnit || quest?.schedule?.cooldownUnit || "months",
    dayMask: quest?.schedule?.dayMask ?? quest?.dayMask ?? 0,
    eventDate: quest?.schedule?.eventDate || quest?.eventDate || "",
    ...(quest?.schedule || {}),
  });
}

function getSchedulePatch(quest, nextScheduleType, schedulePatch = {}) {
  const currentSchedule = getQuestSchedule(quest);
  const nextSchedule = makeQuestSchedule({
    ...currentSchedule,
    ...schedulePatch,
  });
  const cooldownEnabled = nextScheduleType === "cooldown";

  return {
    scheduleType: nextScheduleType,
    schedule: nextSchedule,
    // Legacy mirrors kept until the maintenance refactor no longer reads these fields.
    cooldownEnabled,
    cooldownAmount: nextSchedule.cooldownAmount,
    cooldownUnit: nextSchedule.cooldownUnit,
  };
}

function ScheduleTypeSelect({ value, onChange, disabled = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">Regime</label>
      <select className="field mt-1" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {SCHEDULE_TYPES.map((type) => (
          <option key={type} value={type}>{SCHEDULE_LABELS[type] || type}</option>
        ))}
      </select>
    </div>
  );
}

function QuestScheduleGroup({ quest, updateQuest }) {
  const [open, setOpen] = useState(false);
  const scheduleType = getQuestScheduleType(quest);
  const schedule = getQuestSchedule(quest);
  const disabled = false;

  function updateScheduleType(nextScheduleType) {
    updateQuest(getSchedulePatch(quest, nextScheduleType));
  }

  function updateSchedule(schedulePatch) {
    updateQuest(getSchedulePatch(quest, scheduleType, schedulePatch));
  }

  const summary = getQuestScheduleSummary({
    ...quest,
    scheduleType,
    schedule,
  });

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/70">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-2 font-semibold text-neutral-200">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Schedule
        </span>
        <span className="truncate text-xs text-neutral-400">{summary}</span>
      </button>

      {open && (
        <div className="grid gap-3 border-t border-neutral-800 p-3">
          <ScheduleTypeSelect value={scheduleType} onChange={updateScheduleType} disabled={disabled} />

          {scheduleType === "none" && (
            <FormDate
              label="Due date"
              value={quest.deadline}
              onChange={(value) => updateQuest({ deadline: value })}
              disabled={disabled}
            />
          )}

          {scheduleType === "cooldown" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormNumber
                  label="Cooldown amount"
                  value={schedule.cooldownAmount}
                  onChange={(value) => updateSchedule({ cooldownAmount: value })}
                  disabled={disabled}
                />
                <SelectField
                  label="Cooldown unit"
                  value={schedule.cooldownUnit}
                  options={COOLDOWN_UNITS}
                  onChange={(value) => updateSchedule({ cooldownUnit: value })}
                  disabled={disabled}
                />
              </div>

              {quest.completedAt && (
                <div className="text-xs text-neutral-400">
                  Completed {quest.completedAt}. It will reopen after {schedule.cooldownAmount} {schedule.cooldownUnit}.
                </div>
              )}
            </>
          )}

          {scheduleType === "routine" && (
            <DayMaskEditor
              label="Active days"
              value={schedule.dayMask}
              onChange={(value) => updateSchedule({ dayMask: value })}
              disabled={disabled}
            />
          )}

          {scheduleType === "event" && (
            <FormDate
              label="Event date"
              value={schedule.eventDate}
              onChange={(value) => updateSchedule({ eventDate: value })}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </section>
  );
}

