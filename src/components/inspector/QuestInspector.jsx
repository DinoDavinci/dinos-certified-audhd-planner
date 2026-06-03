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

export default function QuestInspector({ quest, allTags, isFocus, isQuestRoot = false, activeBranchTaskId = null, setData, routines, setSelection, makeFocus, completeQuest, restoreQuest, deleteQuest }) {
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

      <QuestScheduleGroup quest={quest} updateQuest={updateQuest} />

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
  const disabled = Boolean(quest.locked);

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

