import { newId, EVERY_DAY_MASK, todayString, isRoutineActiveOnDate } from "../utils/dateUtils";

// Task/objective tree model helpers.
//
// This file still uses the old "Objective" names so this refactor stays mechanical.
// A later pass can rename Objective -> Task once the module split is stable.

export function resetObjectives(objectives) {
  return (objectives || []).map((objective) => ({
    ...objective,
    completed: false,
    countProgress: 0,
    children: resetObjectives(objective.children || []),
  }));
}

export function completeObjectives(objectives) {
  return (objectives || []).map((objective) => ({
    ...objective,
    completed: true,
    children: completeObjectives(objective.children || []),
  }));
}

export function resetObjectiveSubtree(objective) {
  return {
    ...objective,
    completed: false,
    countProgress: 0,
    children: resetObjectives(objective.children || []),
  };
}

export function makeObjective(overrides = {}) {
  return {
    id: newId("obj"),
    title: "",
    description: "",
    mode: "all",
    completed: false,
    countTarget: 0,
    countProgress: 0,
    children: [],
    ...overrides,
  };
}

export function makeRoutine(overrides = {}) {
  return {
    id: newId("routine"),
    title: "",
    description: "",
    tags: ["Life"],
    difficulty: "Tiny",
    dayMask: EVERY_DAY_MASK,
    mode: "sequence",
    active: true,
    objectiveTemplate: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function cloneObjectives(objectives) {
  return (objectives || []).map((objective) => ({
    ...objective,
    id: newId("obj"),
    completed: false,
    countProgress: 0,
    children: cloneObjectives(objective.children || []),
  }));
}

export function isObjectiveComplete(objective) {
  return !!objective?.completed;
}

export function hasCountTarget(objective) {
  return (Number(objective?.countTarget || 0) || 0) > 0 && (objective?.children || []).length === 0;
}

export function getCountTarget(objective) {
  return Math.max(0, Number(objective?.countTarget || 0));
}

export function isCountReady(objective) {
  if (!hasCountTarget(objective)) return true;
  const { target, progress } = getCountProgress(objective);
  return target > 0 && progress >= target;
}

export function getCountProgress(objective) {
  const target = getCountTarget(objective);
  const progress = Math.max(0, Number(objective?.countProgress || 0));
  return {
    target,
    progress: target > 0 ? Math.min(progress, target) : 0,
  };
}

export function getLeafProgressPercent(objective) {
  if (!hasCountTarget(objective)) return isObjectiveComplete(objective) ? 100 : 0;
  const { target, progress } = getCountProgress(objective);
  if (target <= 0) return 0;
  return Math.round((progress / target) * 100);
}

export function getKanbanObjectiveTitle(objective, fallbackTitle = "Untitled") {
  const title = fallbackTitle || objective?.title || "Untitled";

  if (hasCountTarget(objective) && !isObjectiveComplete(objective)) {
    const { progress, target } = getCountProgress(objective);
    if (progress < target) return `${title} (${progress}/${target})`;
  }

  return title;
}

export function getKanbanActionState(objective) {
  if (hasCountTarget(objective) && !isObjectiveComplete(objective)) {
    return isCountReady(objective) ? "complete" : "progress";
  }

  return "complete";
}

export function getKanbanActionTitle(objective) {
  return getKanbanActionState(objective) === "progress" ? "Progress objective" : "Complete objective";
}

export function areObjectiveChildrenComplete(objective) {
  const children = objective?.children || [];
  if (children.length === 0) return true;
  return children.every(isObjectiveComplete);
}

export function isObjectiveReadyToComplete(objective) {
  const children = objective?.children || [];
  return children.length > 0 && !isObjectiveComplete(objective) && children.every(isObjectiveComplete);
}

export function clearAncestorCompletionById(objectives, objectiveId) {
  let changed = false;

  const next = (objectives || []).map((objective) => {
    const children = objective.children || [];
    const hasDirectChild = children.some((child) => child.id === objectiveId);
    const updatedChildren = clearAncestorCompletionById(children, objectiveId);
    const childChanged = updatedChildren !== children;

    if (hasDirectChild || childChanged) {
      changed = true;
      return {
        ...objective,
        completed: false,
        children: updatedChildren,
      };
    }

    return objective;
  });

  return changed ? next : objectives;
}

export function getObjectiveCounts(objectives) {
  let total = 0;
  let completed = 0;

  function walk(list) {
    for (const obj of list || []) {
      total += 1;
      if (isObjectiveComplete(obj)) completed += 1;
      walk(obj.children || []);
    }
  }

  walk(objectives || []);
  return { total, completed };
}

export function getObjectiveProgress(objective) {
  const counts = countLeafProgress(objective);
  if (counts.total === 0) return isObjectiveComplete(objective) ? 100 : 0;
  return Math.round((counts.complete / counts.total) * 100);
}

export function nextObjectivesInList(objectives, mode) {
  const open = (objectives || []).filter((obj) => !isObjectiveComplete(obj));
  if (mode === "sequence") {
    return open[0] ? nextObjectivesFromObjective(open[0]) : [];
  }
  return open.flatMap(nextObjectivesFromObjective);
}

export function nextObjectivesFromObjective(objective) {
  if (!objective || isObjectiveComplete(objective)) return [];
  const children = objective.children || [];
  if (children.length === 0) return [objective];
  return nextObjectivesInList(children, objective.mode);
}

export function flattenObjectiveTree(objectives, path = []) {
  const rows = [];

  for (const objective of objectives || []) {
    const nextPath = [...path, objective];
    const children = objective.children || [];

    rows.push({
      objective,
      path: nextPath,
      pathText: nextPath.map((item) => item.title || "Untitled").join(" › "),
      hasChildren: children.length > 0,
      complete: isObjectiveComplete(objective),
    });

    rows.push(...flattenObjectiveTree(children, nextPath));
  }

  return rows;
}

export function readyBranchRows(rows) {
  return (rows || [])
    .filter((row) => row.hasChildren && isObjectiveReadyToComplete(row.objective))
    .map((row) => ({
      ...row,
      displayTitle: row.objective.title || "Untitled",
      isConfirmation: true,
    }));
}

export function countLeafProgress(objective) {
  let total = 0;
  let complete = 0;

  function walk(item) {
    const children = item.children || [];

    if (children.length === 0) {
      total += 1;
      if (isObjectiveComplete(item)) complete += 1;
      return;
    }

    children.forEach(walk);
  }

  walk(objective);
  return { total, complete };
}

export function buildFocusBoardFromRoot(root) {
  if (!root) {
    return {
      recommended: null,
      available: [],
      inProgress: [],
      completed: [],
      totalCount: 0,
      completedCount: 0,
    };
  }

  const rows = flattenObjectiveTree(root.objectives || []);
  const availableIds = new Set(nextObjectivesInList(root.objectives || [], root.mode || "all").map((objective) => objective.id));

  const available = rows
    .filter((row) => availableIds.has(row.objective.id))
    .map((row) => ({
      ...row,
      displayTitle: getKanbanObjectiveTitle(row.objective, row.objective.title || "Untitled"),
      isConfirmation: row.hasChildren,
    }));

  if (root.selfObjective && isObjectiveReadyToComplete(root.selfObjective)) {
    available.unshift({
      objective: root.selfObjective,
      path: root.selfPath || [root.selfObjective],
      pathText: (root.selfPath || [root.selfObjective]).map((item) => item.title || "Untitled").join(" › "),
      hasChildren: true,
      complete: false,
      displayTitle: root.selfObjective.title || "Untitled",
      isConfirmation: true,
    });
  }

  const existingAvailableIds = new Set(available.map((row) => row.objective.id));
  for (const readyRow of readyBranchRows(rows)) {
    if (!existingAvailableIds.has(readyRow.objective.id)) {
      available.push(readyRow);
      existingAvailableIds.add(readyRow.objective.id);
    }
  }
  const inProgress = rows
    .filter((row) => {
      if (!row.hasChildren || row.complete || isObjectiveReadyToComplete(row.objective)) return false;
      const progress = countLeafProgress(row.objective);
      return progress.complete > 0 && progress.complete < progress.total;
    })
    .map((row) => ({ ...row, progress: countLeafProgress(row.objective) }));

  const completed = rows.filter((row) => row.complete);

  return {
    recommended: available[0] || null,
    available,
    inProgress,
    completed,
    totalCount: rows.length,
    completedCount: completed.length,
  };
}

export function buildFocusBoard(quest) {
  if (!quest) return buildFocusBoardFromRoot(null);
  return buildFocusBoardFromRoot({ mode: quest.mode, objectives: quest.objectives || [] });
}

export const SAMPLE_OBJECTIVE_DESCRIPTIONS = {
  "Modeling": "Build and clean the main mesh before moving into UVs, textures, and rigging.",
  "Clean shoulder region": "Refine topology and silhouette around the scapula, chest, and front limb transition.",
  "Model foot": "Block out and refine the foot shape, including toe proportions and weight-bearing contact.",
  "Refine plates": "Adjust plate shape, spacing, thickness, and silhouette so they read well from gameplay distance.",
  "UV unwrap": "Prepare UVs for painting by cutting seams, unwrapping, and checking texel density.",
  "Mark seams": "Place seams in low-visibility regions and around natural anatomical breaks.",
  "Unwrap islands": "Generate UV islands and reduce stretching before packing.",
  "Pack UVs": "Pack UV islands cleanly with consistent padding and efficient texture usage.",
  "Texture Stegosaurus": "Paint the final color, roughness, and surface detail pass for the Stegosaurus.",
  "Push-ups": "Complete the planned push-up set with controlled form.",
  "Squats": "Complete the planned squat set, focusing on depth and stable knees.",
  "Walk": "Take a short walk to finish the routine and cool down.",
};

export function normalizeObjectives(objectives) {
  return (objectives || []).map((objective) => {
    const countTarget = Math.max(0, Number(objective.countTarget || 0));
    const countProgress = Math.min(countTarget, Math.max(0, Number(objective.countProgress || 0)));

    return makeObjective({
      ...objective,
      description: objective.description || SAMPLE_OBJECTIVE_DESCRIPTIONS[objective.title] || "",
      countTarget,
      countProgress,
      completed: !!objective.completed,
      children: normalizeObjectives(objective.children || []),
    });
  });
}

export function findObjective(objectives, id, parent = null) {
  for (const objective of objectives || []) {
    if (objective.id === id) return { objective, parent };
    const found = findObjective(objective.children || [], id, objective);
    if (found) return found;
  }
  return null;
}

export function findObjectivePath(objectives, id, path = []) {
  for (const objective of objectives || []) {
    const nextPath = [...path, objective];

    if (objective.id === id) return nextPath;

    const found = findObjectivePath(objective.children || [], id, nextPath);
    if (found) return found;
  }

  return null;
}

export function getObjectiveAncestry(selection, data) {
  if (!selection || !data) return [];

  if (selection.type === "objective") {
    const quest = (data.quests || []).find((item) => item.id === selection.questId);
    if (!quest) return [];

    const path = findObjectivePath(quest.objectives || [], selection.id) || [];

    return [
      { type: "quest", id: quest.id, title: quest.title },
      ...path.map((objective) => ({
        type: "objective",
        questId: quest.id,
        id: objective.id,
        title: objective.title,
      })),
    ];
  }

  if (selection.type === "routineObjective") {
    const routine = (data.routines || []).find((item) => item.id === selection.routineId);
    if (!routine) return [];

    const path = findObjectivePath(routine.objectiveTemplate || [], selection.id) || [];

    return [
      { type: "routine", id: routine.id, title: routine.title },
      ...path.map((objective) => ({
        type: "routineObjective",
        routineId: routine.id,
        id: objective.id,
        title: objective.title,
      })),
    ];
  }

  return [];
}

export function updateObjectiveTree(objectives, id, updater) {
  return (objectives || []).map((objective) => {
    if (objective.id === id) return updater(objective);
    return { ...objective, children: updateObjectiveTree(objective.children || [], id, updater) };
  });
}

export function addObjectiveToTree(objectives, parentId, child) {
  if (!parentId) return [...(objectives || []), child];
  return updateObjectiveTree(objectives, parentId, (objective) => ({
    ...objective,
    children: [...(objective.children || []), child],
  }));
}

export function deleteObjectiveFromTree(objectives, id) {
  return (objectives || [])
    .filter((objective) => objective.id !== id)
    .map((objective) => ({ ...objective, children: deleteObjectiveFromTree(objective.children || [], id) }));
}

export function moveObjectiveInTree(objectives, id, direction) {
  const list = [...(objectives || [])];
  const index = list.findIndex((objective) => objective.id === id);

  if (index !== -1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return list;

    const copy = [...list];
    const [item] = copy.splice(index, 1);
    copy.splice(newIndex, 0, item);
    return copy;
  }

  return list.map((objective) => ({
    ...objective,
    children: moveObjectiveInTree(objective.children || [], id, direction),
  }));
}
