import React from "react";

export default function ExportPanel({
  exportJson,
  importJsonFile,
  exportQuestFile,
  importQuestFile,
  hasActiveQuest,
  exportRoutineFile,
  importRoutineFile,
  hasSelectedRoutine,
  resetToDefaults,
}) {
  return (
    <div className="tab-scene-margin library-scene space-y-3">
      <button type="button" onClick={exportJson} className="primary-button w-full justify-center">Export all data</button>
      <label className="primary-button w-full cursor-pointer justify-center">
        Load all data
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            importJsonFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
        <div className="mb-2 text-sm font-semibold text-neutral-200">Quest files</div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => exportQuestFile()}
            disabled={!hasActiveQuest}
            className="primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export active quest
          </button>
          <label className="primary-button w-full cursor-pointer justify-center">
            Load quest file
            <input
              type="file"
              accept="application/json,.json,.quest.json"
              className="hidden"
              onChange={(event) => {
                importQuestFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
        <div className="mb-2 text-sm font-semibold text-neutral-200">Routine files</div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => exportRoutineFile()}
            disabled={!hasSelectedRoutine}
            className="primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
            title={hasSelectedRoutine ? "Export the selected routine" : "Select a routine first"}
          >
            Export selected routine
          </button>
          <label className="primary-button w-full cursor-pointer justify-center">
            Load routine file
            <input
              type="file"
              accept="application/json,.json,.routine.json"
              className="hidden"
              onChange={(event) => {
                importRoutineFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <button type="button" onClick={resetToDefaults} className="danger-button w-full justify-center">Reset to defaults</button>
      <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
        Export all data creates a backup of quests and routines. Quest files export/import one quest scene at a time. Routine files export/import one routine template at a time. Load all data replaces the current app state with the selected JSON file.
      </div>
    </div>
  );
}
