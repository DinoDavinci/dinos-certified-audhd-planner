import { newId, EVERY_DAY_MASK, todayString, isRoutineActiveOnDate } from "../utils/dateUtils";

// Task/quest tree model helpers.
//
// This file still uses the old "Task" names so this refactor stays mechanical.
// A later pass can rename Task -> Task once the module split is stable.

export function resetTasks(tasks) {
  return (tasks || []).map((task) => ({
    ...task,
    completed: false,
    countProgress: 0,
    children: resetTasks(task.children || []),
  }));
}

export function completeTasks(tasks) {
  return (tasks || []).map((task) => ({
    ...task,
    completed: true,
    children: completeTasks(task.children || []),
  }));
}

export function resetTaskSubtree(task) {
  return {
    ...task,
    completed: false,
    countProgress: 0,
    children: resetTasks(task.children || []),
  };
}

export function makeTask(overrides = {}) {
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
    taskTemplate: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function cloneTasks(tasks) {
  return (tasks || []).map((task) => ({
    ...task,
    id: newId("obj"),
    completed: false,
    countProgress: 0,
    children: cloneTasks(task.children || []),
  }));
}

export function isTaskComplete(task) {
  return !!task?.completed;
}

export function hasCountTarget(task) {
  return (Number(task?.countTarget || 0) || 0) > 0 && (task?.children || []).length === 0;
}

export function getCountTarget(task) {
  return Math.max(0, Number(task?.countTarget || 0));
}

export function isCountReady(task) {
  if (!hasCountTarget(task)) return true;
  const { target, progress } = getCountProgress(task);
  return target > 0 && progress >= target;
}

export function getCountProgress(task) {
  const target = getCountTarget(task);
  const progress = Math.max(0, Number(task?.countProgress || 0));
  return {
    target,
    progress: target > 0 ? Math.min(progress, target) : 0,
  };
}

export function getLeafProgressPercent(task) {
  if (!hasCountTarget(task)) return isTaskComplete(task) ? 100 : 0;
  const { target, progress } = getCountProgress(task);
  if (target <= 0) return 0;
  return Math.round((progress / target) * 100);
}

export function getKanbanTaskTitle(task, fallbackTitle = "Untitled") {
  const title = fallbackTitle || task?.title || "Untitled";

  if (hasCountTarget(task) && !isTaskComplete(task)) {
    const { progress, target } = getCountProgress(task);
    if (progress < target) return `${title} (${progress}/${target})`;
  }

  return title;
}

export function getKanbanActionState(task) {
  if (hasCountTarget(task) && !isTaskComplete(task)) {
    return isCountReady(task) ? "complete" : "progress";
  }

  return "complete";
}

export function getKanbanActionTitle(task) {
  return getKanbanActionState(task) === "progress" ? "Progress task" : "Complete task";
}

export function areTaskChildrenComplete(task) {
  const children = task?.children || [];
  if (children.length === 0) return true;
  return children.every(isTaskComplete);
}

export function isTaskReadyToComplete(task) {
  const children = task?.children || [];
  return children.length > 0 && !isTaskComplete(task) && children.every(isTaskComplete);
}

export function clearAncestorCompletionById(tasks, taskId) {
  let changed = false;

  const next = (tasks || []).map((task) => {
    const children = task.children || [];
    const hasDirectChild = children.some((child) => child.id === taskId);
    const updatedChildren = clearAncestorCompletionById(children, taskId);
    const childChanged = updatedChildren !== children;

    if (hasDirectChild || childChanged) {
      changed = true;
      return {
        ...task,
        completed: false,
        children: updatedChildren,
      };
    }

    return task;
  });

  return changed ? next : tasks;
}

export function getTaskCounts(tasks) {
  let total = 0;
  let completed = 0;

  function walk(list) {
    for (const obj of list || []) {
      total += 1;
      if (isTaskComplete(obj)) completed += 1;
      walk(obj.children || []);
    }
  }

  walk(tasks || []);
  return { total, completed };
}

export function getTaskProgress(task) {
  const counts = countLeafProgress(task);
  if (counts.total === 0) return isTaskComplete(task) ? 100 : 0;
  return Math.round((counts.complete / counts.total) * 100);
}

export function nextTasksInList(tasks, mode) {
  const open = (tasks || []).filter((obj) => !isTaskComplete(obj));
  if (mode === "sequence") {
    return open[0] ? nextTasksFromTask(open[0]) : [];
  }
  return open.flatMap(nextTasksFromTask);
}

export function nextTasksFromTask(task) {
  if (!task || isTaskComplete(task)) return [];
  const children = task.children || [];
  if (children.length === 0) return [task];
  return nextTasksInList(children, task.mode);
}

export function flattenQuestTree(tasks, path = []) {
  const rows = [];

  for (const task of tasks || []) {
    const nextPath = [...path, task];
    const children = task.children || [];

    rows.push({
      task,
      path: nextPath,
      pathText: nextPath.map((item) => item.title || "Untitled").join(" › "),
      hasChildren: children.length > 0,
      complete: isTaskComplete(task),
    });

    rows.push(...flattenQuestTree(children, nextPath));
  }

  return rows;
}

export function readyBranchRows(rows) {
  return (rows || [])
    .filter((row) => row.hasChildren && isTaskReadyToComplete(row.task))
    .map((row) => ({
      ...row,
      displayTitle: row.task.title || "Untitled",
      isConfirmation: true,
    }));
}

export function countLeafProgress(task) {
  let total = 0;
  let complete = 0;

  function walk(item) {
    const children = item.children || [];

    if (children.length === 0) {
      total += 1;
      if (isTaskComplete(item)) complete += 1;
      return;
    }

    children.forEach(walk);
  }

  walk(task);
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

  const rows = flattenQuestTree(root.tasks || []);
  const availableIds = new Set(nextTasksInList(root.tasks || [], root.mode || "all").map((task) => task.id));

  const available = rows
    .filter((row) => availableIds.has(row.task.id))
    .map((row) => ({
      ...row,
      displayTitle: getKanbanTaskTitle(row.task, row.task.title || "Untitled"),
      isConfirmation: row.hasChildren,
    }));

  const completed = rows.filter((row) => row.complete);

  if (root.selfTask) {
    const selfRow = {
      kind: root.selfTask.isRootTask ? "rootTask" : "taskConfirmation",
      task: root.selfTask,
      path: root.selfPath || [root.selfTask],
      pathText: (root.selfPath || [root.selfTask]).map((item) => item.title || "Untitled").join(" › "),
      hasChildren: true,
      complete: isTaskComplete(root.selfTask),
      displayTitle: root.selfTask.title || "Untitled",
      isConfirmation: true,
    };

    if (isTaskComplete(root.selfTask)) {
      completed.unshift(selfRow);
    } else if (isTaskReadyToComplete(root.selfTask)) {
      available.unshift(selfRow);
    }
  }

  const existingAvailableIds = new Set(available.map((row) => row.task.id));
  for (const readyRow of readyBranchRows(rows)) {
    if (!existingAvailableIds.has(readyRow.task.id)) {
      available.push(readyRow);
      existingAvailableIds.add(readyRow.task.id);
    }
  }

  const inProgress = rows
    .filter((row) => {
      if (!row.hasChildren || row.complete || isTaskReadyToComplete(row.task)) return false;
      const progress = countLeafProgress(row.task);
      return progress.complete > 0 && progress.complete < progress.total;
    })
    .map((row) => ({ ...row, progress: countLeafProgress(row.task) }));

  return {
    recommended: available[0] || null,
    available,
    inProgress,
    completed,
    totalCount: rows.length + (root.selfTask ? 1 : 0),
    completedCount: completed.length,
  };
}


export function buildFocusBoard(quest) {
  if (!quest) return buildFocusBoardFromRoot(null);
  return buildFocusBoardFromRoot({
    mode: quest.rootTask?.mode || "all",
    tasks: quest.rootTask?.children || [],
    selfTask: quest.rootTask,
    selfPath: quest.rootTask ? [quest.rootTask] : [],
  });
}

export const SAMPLE_TASK_DESCRIPTIONS = {
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

export function normalizeTasks(tasks) {
  return (tasks || []).map((task) => {
    const countTarget = Math.max(0, Number(task.countTarget || 0));
    const countProgress = Math.min(countTarget, Math.max(0, Number(task.countProgress || 0)));

    return makeTask({
      ...task,
      description: task.description || SAMPLE_TASK_DESCRIPTIONS[task.title] || "",
      countTarget,
      countProgress,
      completed: !!task.completed,
      children: normalizeTasks(task.children || []),
    });
  });
}

export function findTask(tasks, id, parent = null) {
  for (const task of tasks || []) {
    if (task.id === id) return { task, parent };
    const found = findTask(task.children || [], id, task);
    if (found) return found;
  }
  return null;
}

export function findTaskPath(tasks, id, path = []) {
  for (const task of tasks || []) {
    const nextPath = [...path, task];

    if (task.id === id) return nextPath;

    const found = findTaskPath(task.children || [], id, nextPath);
    if (found) return found;
  }

  return null;
}


export function getTaskAncestry(selection, data) {
  if (!selection || !data) return [];

  if (selection.type === "task") {
    const quest = (data.quests || []).find((item) => item.id === selection.questId);
    if (!quest) return [];

    const path = findTaskPath(quest.rootTask ? [quest.rootTask] : [], selection.id) || [];

    return [
      { type: "quest", id: quest.id, title: quest.title },
      ...path.map((task) => ({
        type: "task",
        questId: quest.id,
        id: task.id,
        title: task.title,
      })),
    ];
  }

  if (selection.type === "routineTask") {
    const routine = (data.routines || []).find((item) => item.id === selection.routineId);
    if (!routine) return [];

    const path = findTaskPath(routine.taskTemplate || [], selection.id) || [];

    return [
      { type: "routine", id: routine.id, title: routine.title },
      ...path.map((task) => ({
        type: "routineTask",
        routineId: routine.id,
        id: task.id,
        title: task.title,
      })),
    ];
  }

  return [];
}

export function updateQuestTree(tasks, id, updater) {
  return (tasks || []).map((task) => {
    if (task.id === id) return updater(task);
    return { ...task, children: updateQuestTree(task.children || [], id, updater) };
  });
}

export function addTaskToTree(tasks, parentId, child) {
  if (!parentId) return [...(tasks || []), child];
  return updateQuestTree(tasks, parentId, (task) => ({
    ...task,
    children: [...(task.children || []), child],
  }));
}

export function deleteTaskFromTree(tasks, id) {
  return (tasks || [])
    .filter((task) => task.id !== id)
    .map((task) => ({ ...task, children: deleteTaskFromTree(task.children || [], id) }));
}

export function moveTaskInTree(tasks, id, direction) {
  const list = [...(tasks || [])];
  const index = list.findIndex((task) => task.id === id);

  if (index !== -1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return list;

    const copy = [...list];
    const [item] = copy.splice(index, 1);
    copy.splice(newIndex, 0, item);
    return copy;
  }

  return list.map((task) => ({
    ...task,
    children: moveTaskInTree(task.children || [], id, direction),
  }));
}
