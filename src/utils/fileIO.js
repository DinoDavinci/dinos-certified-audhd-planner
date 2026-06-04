export function slugifyFilename(value, fallback = "quest") {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export async function downloadJsonFile(payload, filename) {
  const text = JSON.stringify(payload, null, 2);

  if (isLikelyTauriRuntime()) {
    const saved = await trySaveWithTauriDialog(text, filename);
    if (saved) return;
  }

  downloadJsonFileInBrowser(text, filename);
}

function isLikelyTauriRuntime() {
  return Boolean(
    window.__TAURI__ ||
    window.__TAURI_INTERNALS__ ||
    navigator.userAgent.includes("Tauri")
  );
}

async function trySaveWithTauriDialog(text, filename) {
  try {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const fs = await import("@tauri-apps/plugin-fs");

    const filePath = await dialog.save({
      defaultPath: filename,
      filters: [
        {
          name: "JSON",
          extensions: ["json"],
        },
      ],
    });

    if (!filePath) return true;

    await fs.writeTextFile(filePath, text);
    return true;
  } catch (error) {
    console.warn("Tauri save dialog unavailable; falling back to browser download.", error);
    return false;
  }
}

function downloadJsonFileInBrowser(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

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


export function rawDataFromPlannerPayload(payload) {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

export function rawQuestFromQuestPayload(payload) {
  return payload?.quest && typeof payload.quest === "object" ? payload.quest : payload;
}

