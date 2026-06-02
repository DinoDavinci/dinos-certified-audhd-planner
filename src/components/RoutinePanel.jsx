import React from "react";
import { Plus, Search } from "lucide-react";

import { formatDayMask } from "../models/appModel";

export default function RoutinePanel({
  search,
  setSearch,
  tagFilter,
  setTagFilter,
  allTags,
  routines,
  createRoutine,
  selectRoutine,
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
      </div>

      <div className="mt-4">
        <button onClick={createRoutine} className="primary-button w-full"><Plus size={18} /> New routine</button>
      </div>

      <div className="mt-4 space-y-3">
        {routines.map((routine) => (
          <button key={routine.id} onClick={() => selectRoutine(routine)} className="library-card text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold">{routine.title}</div>
              <span className={routine.active ? "pill-green" : "pill-red"}>{routine.active ? "Active" : "Paused"}</span>
            </div>

            <div className="mt-1 text-sm text-neutral-400">{formatDayMask(routine.dayMask)}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(routine.tags || []).map((tag) => <span key={tag} className="pill">{tag}</span>)}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
