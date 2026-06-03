import React from "react";
import { Trash2 } from "lucide-react";

import {
  DIFFICULTIES,
  MODES,
  COOLDOWN_UNITS,
  isQuestComplete,
  isQuestReadyToComplete,
  getQuestProgress,
} from "../../models/appModel";

import {
  QuestChildrenSummary,
  ProgressActionButton,
  InspectorProgressBar,
  FormText,
  FormTextarea,
  TagEditor,
  SelectField,
  FormDate,
  FormNumber,
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

