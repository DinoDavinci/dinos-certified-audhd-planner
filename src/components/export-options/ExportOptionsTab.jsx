import React from "react";

export default function ExportOptionsTab({
  exportJson,
  importJsonFile,
  exportQuestFile,
  importQuestFile,
  hasActiveQuest,
  resetToDefaults,
  projectRootPath = "",
  projectLoadSummary = "",
  chooseQuestProjectFolder,
  refreshQuestProjectFolder,
}) {
  const isProjectMode = Boolean(projectRootPath);

  return (
    <div className="export-options-root">
      <div className="export-options-scroll">
        <div className="export-options-content space-y-3">
          {isProjectMode && (
            <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
              <div className="mb-2 text-sm font-semibold text-neutral-200">Project Folder</div>
              <div className="space-y-2">
                <button
                  type="button"
                  className="primary-button w-full justify-center"
                  onClick={chooseQuestProjectFolder}
                >
                  Choose Project
                </button>
                <button
                  type="button"
                  className="primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => refreshQuestProjectFolder?.()}
                  disabled={!projectRootPath}
                >
                  Refresh
                </button>
              </div>
              <div
                className="mt-3 rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400"
                title={projectRootPath || "No project folder selected"}
              >
                {projectRootPath ? projectRootPath : "No project folder selected"}
                {projectLoadSummary ? <span className="mt-1 block">{projectLoadSummary}</span> : null}
              </div>
            </div>
          )}

          <button type="button" onClick={exportJson} className="primary-button w-full justify-center">Export all data</button>

          {!isProjectMode && (
            <>
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

              <button type="button" onClick={resetToDefaults} className="danger-button w-full justify-center">Reset to defaults</button>
            </>
          )}

          <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
            {isProjectMode
              ? "Export all data creates a portable backup bundle that the web app can import. Quest files are managed directly through the selected project folder."
              : "Export all data creates a backup of quests. Quest files export/import one quest scene at a time. Load all data replaces the current app state with the selected JSON file."}
          </div>
        </div>
      </div>
    </div>
  );
}
