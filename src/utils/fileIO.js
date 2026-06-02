export function slugifyFilename(value, fallback = "quest") {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function downloadJsonFile(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "{}")));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsText(file);
  });
}

export function makeAllDataExport(data) {
  return {
    app: "quest-planner",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function makeQuestFileExport(quest) {
  return {
    app: "quest-planner",
    type: "quest-scene",
    version: 1,
    exportedAt: new Date().toISOString(),
    quest,
  };
}

export function makeRoutineFileExport(routine) {
  return {
    app: "quest-planner",
    type: "routine-template",
    version: 1,
    exportedAt: new Date().toISOString(),
    routine,
  };
}

export function rawDataFromPlannerPayload(payload) {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

export function rawQuestFromQuestPayload(payload) {
  return payload?.quest && typeof payload.quest === "object" ? payload.quest : payload;
}

export function rawRoutineFromRoutinePayload(payload) {
  return payload?.routine && typeof payload.routine === "object" ? payload.routine : payload;
}
