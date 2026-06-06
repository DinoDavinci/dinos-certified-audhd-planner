import React from "react";

export default function DebugTab({
  debugDateOverrideEnabled,
  setDebugDateOverrideEnabled,
  debugDateOverrideDate,
  setDebugDateOverrideDate,
  currentAppDate,
  runMaintenanceNow,
  showQuestBoardDebug = false,
  setShowQuestBoardDebug,
}) {
  return (
    <div className="export-options-root">
      <div className="export-options-scroll">
        <div className="export-options-content space-y-3">
          <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
            <div className="mb-2 text-sm font-semibold text-neutral-200">Date override</div>

            <label className="mb-3 flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={debugDateOverrideEnabled}
                onChange={(event) => setDebugDateOverrideEnabled(event.target.checked)}
              />
              Use debug date
            </label>

            <input
              className="field"
              type="date"
              value={debugDateOverrideDate || ""}
              onChange={(event) => setDebugDateOverrideDate(event.target.value)}
            />

            <div className="mt-2 text-xs text-neutral-400">
              Current app date: {currentAppDate || "real date"}
            </div>
          </div>



          <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
            <div className="mb-2 text-sm font-semibold text-neutral-200">Quest Board debug</div>

            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={Boolean(showQuestBoardDebug)}
                onChange={(event) => setShowQuestBoardDebug?.(event.target.checked)}
              />
              Show drag and hover path badges
            </label>
          </div>

          <button
            type="button"
            onClick={runMaintenanceNow}
            className="primary-button w-full justify-center"
          >
            Force maintenance
          </button>

          <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
            Changing the date override or its enabled state runs maintenance automatically. Use this tab to test routine rollover, event activation, cooldown expiration, and overdue badges.
          </div>
        </div>
      </div>
    </div>
  );
}
