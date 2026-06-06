import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";

import { normalizeData } from "../models/appModel";
import { rawQuestFromQuestPayload } from "./fileIO";

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

export async function scanQuestProjectDirectory(projectRootPath) {
  if (!projectRootPath) {
    return {
      projectRootPath: "",
      folders: [],
      quests: [],
      errors: [],
    };
  }

  const context = {
    projectRootPath,
    foldersById: new Map(),
    quests: [],
    errors: [],
  };

  await scanDirectoryIntoProject(context, projectRootPath, "");

  return {
    projectRootPath,
    folders: Array.from(context.foldersById.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    quests: context.quests.sort((a, b) =>
      (a.title || "").localeCompare(b.title || "")
    ),
    errors: context.errors,
  };
}

async function scanDirectoryIntoProject(context, absolutePath, relativePath) {
  let entries = [];

  try {
    entries = await readDir(absolutePath);
  } catch (error) {
    context.errors.push({
      kind: "read-directory-failed",
      path: relativePath || ".",
      message: String(error),
    });
    return;
  }

  for (const entry of entries) {
    const name = entry.name || "";
    if (!name) continue;
    if (name.startsWith(".")) continue;

    const childRelativePath = joinRelativePath(relativePath, name);
    const childAbsolutePath = joinAbsolutePath(absolutePath, name);

    if (entry.isDirectory) {
      addFolder(context, childRelativePath);
      await scanDirectoryIntoProject(context, childAbsolutePath, childRelativePath);
      continue;
    }

    if (!entry.isFile) continue;
    if (!isQuestFileName(name)) continue;

    await addQuestFile(context, childAbsolutePath, childRelativePath);
  }
}

function addFolder(context, folderId) {
  if (!folderId || context.foldersById.has(folderId)) return;

  context.foldersById.set(folderId, {
    id: folderId,
    title: baseName(folderId),
    parentId: parentPath(folderId),
    createdAt: "",
    updatedAt: "",
  });
}

async function addQuestFile(context, absolutePath, relativePath) {
  try {
    const text = await readTextFile(absolutePath);
    const parsed = JSON.parse(text);
    const rawQuest = rawQuestFromQuestPayload(parsed);
    const normalized = normalizeData({ quests: [rawQuest] });
    const quest = normalized.quests?.[0];

    if (!quest) {
      throw new Error("No quest found in file.");
    }

    context.quests.push({
      ...quest,
      folderId: parentPath(relativePath),
      projectFilePath: absolutePath,
      projectRelativePath: relativePath,
    });
  } catch (error) {
    context.errors.push({
      kind: "read-quest-failed",
      path: relativePath,
      message: String(error),
    });
  }
}

function isQuestFileName(name) {
  const lower = name.toLowerCase();
  return lower.endsWith(".quest.json") || lower.endsWith(".quest");
}

function joinRelativePath(parent, child) {
  return parent ? `${parent}/${child}` : child;
}

function joinAbsolutePath(parent, child) {
  return `${parent.replace(/[\\/]+$/, "")}/${child}`;
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
