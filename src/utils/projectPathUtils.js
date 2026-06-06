export function normalizeProjectRelativePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

export function getProjectPathBaseName(path) {
  const normalized = normalizeProjectRelativePath(path);
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function joinProjectRelativePath(folderId, fileName) {
  const cleanFolderId = normalizeProjectRelativePath(folderId);
  const cleanFileName = getProjectPathBaseName(fileName);
  return cleanFolderId ? `${cleanFolderId}/${cleanFileName}` : cleanFileName;
}

export function getProjectPathParent(path) {
  const normalized = normalizeProjectRelativePath(path);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return null;
  return normalized.slice(0, index);
}

export function makeVirtualFolderId(parentId, name) {
  const cleanName = String(name || "").trim();
  const cleanParentId = normalizeProjectRelativePath(parentId || null);

  return cleanParentId ? `${cleanParentId}/${cleanName}` : cleanName;
}

export function getVirtualFolderName(folderId) {
  return getProjectPathBaseName(folderId);
}

export function isValidVirtualFolderName(name) {
  const value = String(name || "");
  return Boolean(
    value.trim() &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !/[\\/:*?"<>|]/.test(value) &&
    !value.startsWith(".") &&
    !value.endsWith(".")
  );
}

export function getInvalidVirtualFolderNameMessage(name) {
  const value = String(name || "");

  if (!value.trim()) return "Folder name cannot be empty.";
  if (value !== value.trim()) return "Folder name cannot start or end with spaces.";
  if (value === "." || value === "..") return "Folder name cannot be . or ...";
  if (/[\\/:*?"<>|]/.test(value)) return "Folder name contains an invalid filename character.";
  if (value.startsWith(".") || value.endsWith(".")) return "Folder name cannot start or end with a period.";

  return "";
}

export function renameVirtualFolderPath(folders, quests, folderId, nextName) {
  const oldId = normalizeProjectRelativePath(folderId);
  const parentId = getProjectPathParent(oldId);
  const nextId = makeVirtualFolderId(parentId, nextName);

  if (!oldId || !nextId || oldId === nextId) {
    return { folders, quests, nextFolderId: oldId || nextId };
  }

  function remapFolderId(value) {
    const normalized = normalizeProjectRelativePath(value);

    if (normalized === oldId) return nextId;
    if (normalized.startsWith(`${oldId}/`)) return `${nextId}/${normalized.slice(oldId.length + 1)}`;

    return value || null;
  }

  return {
    folders: (folders || []).map((folder) => ({
      ...folder,
      id: remapFolderId(folder.id),
      parentId: folder.parentId ? remapFolderId(folder.parentId) : null,
      title: undefined,
      updatedAt: new Date().toISOString(),
    })),
    quests: (quests || []).map((quest) => ({
      ...quest,
      folderId: quest.folderId ? remapFolderId(quest.folderId) : null,
    })),
    nextFolderId: nextId,
  };
}

export function moveVirtualFolderPath(folders, quests, folderId, nextParentId) {
  const oldId = normalizeProjectRelativePath(folderId);
  const cleanNextParentId = normalizeProjectRelativePath(nextParentId || null);
  const folderName = getProjectPathBaseName(oldId);
  const nextId = makeVirtualFolderId(cleanNextParentId || null, folderName);

  if (!oldId || !nextId || oldId === nextId) {
    return { moved: false, reason: "same-parent/no-op", folders, quests, nextFolderId: oldId || nextId };
  }

  if (cleanNextParentId && (cleanNextParentId === oldId || cleanNextParentId.startsWith(`${oldId}/`))) {
    return { moved: false, reason: "folder-into-self-or-child", folders, quests, nextFolderId: oldId };
  }

  const collision = (folders || []).some((folder) =>
    normalizeProjectRelativePath(folder.id) !== oldId &&
    normalizeProjectRelativePath(folder.id) === nextId
  );

  if (collision) {
    return { moved: false, reason: "folder-merge-risk", folders, quests, nextFolderId: oldId };
  }

  function remapFolderId(value) {
    const normalized = normalizeProjectRelativePath(value);

    if (normalized === oldId) return nextId;
    if (normalized.startsWith(`${oldId}/`)) return `${nextId}/${normalized.slice(oldId.length + 1)}`;

    return value || null;
  }

  return {
    moved: true,
    reason: "moved",
    folders: (folders || []).map((folder) => {
      const normalizedId = normalizeProjectRelativePath(folder.id);
      const isMovedRoot = normalizedId === oldId;

      return {
        ...folder,
        id: remapFolderId(folder.id),
        parentId: isMovedRoot
          ? (cleanNextParentId || null)
          : (folder.parentId ? remapFolderId(folder.parentId) : null),
        title: undefined,
        updatedAt: new Date().toISOString(),
      };
    }),
    quests: (quests || []).map((quest) => ({
      ...quest,
      folderId: quest.folderId ? remapFolderId(quest.folderId) : null,
    })),
    nextFolderId: nextId,
  };
}
