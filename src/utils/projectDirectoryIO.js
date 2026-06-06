import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { normalizeData } from "../models/appModel";
import { makeQuestFileExport, rawQuestFromQuestPayload, slugifyFilename } from "./fileIO";

export const PROJECT_ROOT_KEY = "quest-planner.projectRootPath";

export function getSavedProjectRootPath() {
  return localStorage.getItem(PROJECT_ROOT_KEY) || "";
}

export function saveProjectRootPath(path) {
  if (!path) {
    localStorage.removeItem(PROJECT_ROOT_KEY);
    return;
  }

  localStorage.setItem(PROJECT_ROOT_KEY, path);
}

export async function chooseProjectRootDirectory() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose Quest Project Folder",
  });

  if (!selected || Array.isArray(selected)) return "";

  saveProjectRootPath(selected);
  return selected;
}


export async function createFolderInProject(projectRootPath, parentFolderId, folderName) {
  return await invoke("create_quest_project_folder", {
    projectRootPath,
    parentRelativePath: parentFolderId || null,
    folderName,
  });
}

export async function createQuestFileInProject(projectRootPath, folderId, quest) {
  if (!projectRootPath) {
    throw new Error("Project root path is required.");
  }

  if (!quest) {
    throw new Error("Quest is required.");
  }

  const baseName = slugifyFilename(quest.title || "New Quest") || "new-quest";
  const fileName = `${baseName}.quest.json`;
  const contents = JSON.stringify(makeQuestFileExport(quest), null, 2);

  return invoke("create_quest_project_file", {
    projectRootPath,
    folderRelativePath: folderId || null,
    fileName,
    contents,
  });
}


export async function moveQuestFileInProject(projectRootPath, sourceRelativePath, targetFolderId, overwrite = false) {
  return await invoke("move_quest_project_file", {
    projectRootPath,
    sourceRelativePath,
    targetFolderRelativePath: targetFolderId || null,
    overwrite,
  });
}

export async function checkQuestMoveDestinationInProject(projectRootPath, sourceRelativePath, targetFolderId) {
  return await invoke("check_quest_project_move_destination", {
    projectRootPath,
    sourceRelativePath,
    targetFolderRelativePath: targetFolderId || null,
  });
}

export async function updateQuestFileInProject(projectRootPath, questRelativePath, quest) {
  if (!projectRootPath) {
    throw new Error("Project root path is required.");
  }

  if (!questRelativePath) {
    throw new Error("Quest relative path is required.");
  }

  if (!quest) {
    throw new Error("Quest is required.");
  }

  const {
    projectFilePath,
    projectRelativePath,
    sourceQuestId,
    ...questForExport
  } = quest;

  const contents = JSON.stringify(
    makeQuestFileExport({
      ...questForExport,
      id: sourceQuestId || quest.id,
    }),
    null,
    2
  );

  return await invoke("write_quest_project_file", {
    projectRootPath,
    questRelativePath,
    contents,
  });
}

export async function scanQuestProjectDirectory(projectRootPath) {
  if (!projectRootPath) {
    return {
      projectRootPath: "",
      folders: [],
      quests: [],
      errors: [],
    };
  }

  const scanned = await invoke("scan_quest_project_files", {
    projectRootPath,
  });

  const folders = (scanned.folders || []).map((folder) => ({
    id: folder.relativePath,
    title: baseName(folder.relativePath),
    parentId: parentPath(folder.relativePath),
    createdAt: "",
    updatedAt: "",
  }));

  const quests = [];
  const errors = [...(scanned.errors || [])];

  for (const file of scanned.questFiles || []) {
    try {
      const parsed = JSON.parse(file.contents);
      const rawQuest = rawQuestFromQuestPayload(parsed);
      const normalized = normalizeData({ quests: [rawQuest] });
      const quest = normalized.quests?.[0];

      if (!quest) throw new Error("No quest found in file.");

      quests.push({
        ...quest,
        id: file.relativePath,
        sourceQuestId: quest.id || "",
        folderId: parentPath(file.relativePath),
        projectFilePath: file.absolutePath,
        projectRelativePath: file.relativePath,
      });
    } catch (error) {
      errors.push({
        kind: "parse-quest-failed",
        path: file.relativePath,
        message: String(error),
      });
    }
  }

  return {
    projectRootPath,
    folders: folders.sort((a, b) => a.id.localeCompare(b.id)),
    quests: quests.sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    errors,
  };
}

function parentPath(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

function baseName(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
