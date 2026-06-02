import React from "react";
import { Plus, Search } from "lucide-react";

import {
  getQuestProgress,
  isQuestComplete,
  questTypeClass,
} from "../models/appModel";

export default function QuestBoardPanel({
  search,
  setSearch,
  tagFilter,
  setTagFilter,
  allTags,
  hideCompleted,
  setHideCompleted,
  quests,
  activeQuestId,
  dueBadge,
  createQuest,
  selectQuest,
}) {
  return (
    <>
      <div className="mt-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
          <input className="field py-2 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="" />
        </div>

        <select className="field py-2" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option>All</option>
          {allTags.map((tag) => <option key={tag}>{tag}</option>)}
        </select>

        <label className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
          Hide complete
        </label>
      </div>

      <div className="mt-4">
        <button onClick={createQuest} className="primary-button w-full"><Plus size={18} /> New quest</button>
      </div>

      <div className="mt-4 space-y-3">
        {quests.map((quest) => (
          <button
            key={quest.id}
            onClick={() => selectQuest(quest)}
            className={`library-card text-left ${questTypeClass(quest)} ${isQuestComplete(quest) ? "library-card-complete" : ""} ${quest.id === activeQuestId ? "border-neutral-300 bg-neutral-800" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold">{quest.title}</div>
              {dueBadge(quest)}
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full bg-slate-200" style={{ width: `${getQuestProgress(quest)}%` }} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {isQuestComplete(quest) && <span className="pill-complete">Completed</span>}
              {(quest.tags || []).map((tag) => <span key={tag} className="pill">{tag}</span>)}
              {quest.sourceType === "routine" && <span className="pill-blue">Routine</span>}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
