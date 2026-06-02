import React from "react";
import { Trash2 } from "lucide-react";

import {
  DIFFICULTIES,
  EVERY_DAY_MASK,
  MODES,
  reconcileTodayQuestForRoutine,
} from "../../models/appModel";

import {
  FormText,
  FormTextarea,
  TagEditor,
  SelectField,
  DayMaskEditor,
} from "./inspectorShared";

export default function RoutineInspector({ routine, allTags, setData, deleteRoutine, runMaintenanceNow }) {
  function applyRoutinePatch(currentRoutine, patch) {
    const nextRoutine = { ...currentRoutine, ...patch };
    const questTemplate = nextRoutine.questTemplate || {};
    const rootTask = questTemplate.rootTask || {};

    const nextQuestTemplate = {
      ...questTemplate,
      title: "title" in patch ? patch.title : questTemplate.title ?? nextRoutine.title,
      description: "description" in patch ? patch.description : questTemplate.description ?? nextRoutine.description,
      tags: "tags" in patch ? patch.tags : questTemplate.tags ?? nextRoutine.tags,
      difficulty: "difficulty" in patch ? patch.difficulty : questTemplate.difficulty ?? nextRoutine.difficulty,
      rootTask: {
        ...rootTask,
        mode: "mode" in patch ? patch.mode : rootTask.mode || nextRoutine.mode || "sequence",
        title: "Complete Quest",
        description: "Finalize and complete this quest.",
        locked: true,
        completed: false,
      },
    };

    return {
      ...nextRoutine,
      title: nextQuestTemplate.title,
      description: nextQuestTemplate.description,
      tags: nextQuestTemplate.tags,
      difficulty: nextQuestTemplate.difficulty,
      mode: nextQuestTemplate.rootTask.mode,
      questTemplate: nextQuestTemplate,
    };
  }

  function updateRoutine(patch) {
    setData((old) => {
      const updatedRoutine = applyRoutinePatch(routine, patch);
      return {
        ...old,
        routines: old.routines.map((item) => (item.id === routine.id ? updatedRoutine : item)),
        quests: reconcileTodayQuestForRoutine(old.quests, updatedRoutine),
      };
    });
  }

  return (
    <div className="space-y-4">
      <div className="main-action-row">
      </div>

      <FormText label="Title" value={routine.title} onChange={(value) => updateRoutine({ title: value })} />
      <FormTextarea label="Description" value={routine.description} onChange={(value) => updateRoutine({ description: value })} />
      <TagEditor tags={routine.tags || []} allTags={allTags} onChange={(tags) => updateRoutine({ tags })} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Difficulty" value={routine.difficulty} options={DIFFICULTIES} onChange={(value) => updateRoutine({ difficulty: value })} />
        <SelectField label="Quest rule" value={routine.mode} options={MODES} onChange={(value) => updateRoutine({ mode: value })} />
      </div>

      <DayMaskEditor
        label="Active days"
        value={routine.dayMask ?? EVERY_DAY_MASK}
        onChange={(value) => updateRoutine({ dayMask: value })}
      />

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={routine.active} onChange={(e) => updateRoutine({ active: e.target.checked })} />
        Active
      </label>

      <div className="danger-zone">
        <button onClick={deleteRoutine} className="danger-button w-full"><Trash2 size={16} /> Delete routine</button>
      </div>


    </div>
  );
}

