import { newId, todayString, isRoutineActiveOnDate } from "../utils/dateUtils";

import {
  cloneTasks,
  isTaskComplete,
  getTaskCounts,
  countLeafProgress,
  findTaskPath,
  nextTasksInList,
  resetTasks,
} from "./taskModel";

// Quest model helpers.
// This file still uses the old quest/task shape so this refactor stays mechanical.

export function makeQuest(overrides = {}) {
  return {
    id: newId("quest"),
    title: "",
    description: "",
    tags: ["Game Dev"],
    difficulty: "Medium",
    deadline: "",
    mode: "all",
    status: "active",
    completedAt: "",
    cooldownEnabled: false,
    cooldownAmount: 6,
    cooldownUnit: "months",
    sourceType: "manual",
    routineId: null,
    locked: false,
    tasks: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createQuestFromRoutine(routine, dueDate) {
  return makeQuest({
    title: routine.title,
    description: routine.description,
    tags: routine.tags,
    difficulty: routine.difficulty,
    deadline: dueDate,
    mode: routine.mode,
    sourceType: "routine",
    routineId: routine.id,
    locked: true,
    tasks: cloneTasks(routine.taskTemplate || []),
  });
}

export function syncGeneratedQuestWithRoutine(quest, routine) {
  return {
    ...quest,
    title: routine.title,
    description: routine.description,
    tags: routine.tags,
    difficulty: routine.difficulty,
    mode: routine.mode,
    tasks: cloneTasks(routine.taskTemplate || []),
  };
}

export function reconcileTodayQuestForRoutine(quests, routine) {
  const today = todayString();
  const shouldExist = routine.active && isRoutineActiveOnDate(routine, today);

  const existing = (quests || []).find(
    (quest) => quest.sourceType === "routine" && quest.routineId === routine.id && quest.deadline === today
  );

  if (shouldExist) {
    if (existing) {
      return quests.map((quest) =>
        quest.id === existing.id && !isQuestComplete(quest)
          ? syncGeneratedQuestWithRoutine(quest, routine)
          : quest
      );
    }

    return [createQuestFromRoutine(routine, today), ...(quests || [])];
  }

  return (quests || []).filter((quest) => {
    const isTodaysInstance =
      quest.sourceType === "routine" &&
      quest.routineId === routine.id &&
      quest.deadline === today;

    // Keep completed generated quests as a record; remove only the live/incomplete instance.
    return !(isTodaysInstance && !isQuestComplete(quest));
  });
}

export function isQuestComplete(quest) {
  return quest?.status === "completed";
}

export function isQuestReadyToComplete(quest) {
  if (!quest || isQuestComplete(quest)) return false;
  const tasks = quest.tasks || [];
  if (tasks.length === 0) return true;
  return tasks.every(isTaskComplete);
}

export function getQuestProgress(quest) {
  let total = 0;
  let complete = 0;

  function walk(list) {
    for (const obj of list || []) {
      total += 1;
      if (isTaskComplete(obj)) complete += 1;
      walk(obj.children || []);
    }
  }

  walk(quest?.tasks || []);
  if (total === 0) return isQuestComplete(quest) ? 100 : 0;
  return Math.round((complete / total) * 100);
}

export function nextTasksForQuest(quest) {
  if (!quest) return [];
  return nextTasksInList(quest.tasks || [], quest.mode);
}

export function makeQuestCompletionCard(quest, complete = false) {
  return {
    kind: "questCompletion",
    id: `quest-completion-${quest.id}`,
    quest,
    task: {
      id: `quest-completion-${quest.id}`,
      title: "Complete quest",
      description: "Finalize and complete this quest.",
      completed: complete,
      children: [],
    },
    path: [{ id: quest.id, title: "Complete quest", type: "questCompletion" }],
    pathText: "Complete quest",
    hasChildren: false,
    complete,
    displayTitle: "Complete quest",
  };
}

export function addQuestCompletionCard(board, quest) {
  if (!quest || !board) return board;

  const next = {
    ...board,
    available: [...(board.available || [])],
    completed: [...(board.completed || [])],
  };

  if (isQuestComplete(quest)) {
    next.completed.push(makeQuestCompletionCard(quest, true));
    next.completedCount += 1;
    next.totalCount += 1;
    return next;
  }

  if (isQuestReadyToComplete(quest)) {
    next.available.push(makeQuestCompletionCard(quest, false));
    next.totalCount += 1;
  }

  return next;
}

export function getBranchFocusInfo(quest, branchTaskId) {
  if (!quest || !branchTaskId) return null;

  const path = findTaskPath(quest.tasks || [], branchTaskId) || [];
  const task = path[path.length - 1];

  if (!task || (task.children || []).length === 0) return null;

  return {
    task,
    path,
    pathText: [quest.title || "Untitled quest", ...path.map((item) => item.title || "Untitled")].join(" › "),
    root: {
      mode: task.mode,
      tasks: task.children || [],
    },
  };
}

export function getFocusPathInfo(quest, branchTaskId) {
  if (!quest) {
    return {
      quest: null,
      branchTask: null,
      path: [],
      root: null,
      parent: null,
      childBranches: [],
      progress: 0,
    };
  }

  const branchInfo = getBranchFocusInfo(quest, branchTaskId);
  const branchTask = branchInfo?.task || null;
  const path = branchInfo?.path || [];

  const root = branchTask
    ? {
        mode: branchTask.mode,
        tasks: branchTask.children || [],
        selfTask: branchTask,
        selfPath: path,
      }
    : { mode: quest.mode, tasks: quest.tasks || [] };

  const parent = path.length > 1 ? path[path.length - 2] : null;
  const childBranches = getChildBranches(root.tasks || []);

  const rawCounts = branchTask
    ? countLeafProgress(branchTask)
    : getTaskCounts(quest.tasks || []);

  const completedCount = Number(rawCounts.completed ?? rawCounts.complete ?? 0);
  const totalCount = Number(rawCounts.total ?? 0);
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : isQuestComplete(quest) ? 100 : 0;

  return {
    quest,
    branchTask,
    path,
    root,
    parent,
    childBranches,
    progress: Number.isFinite(progress) ? progress : 0,
    completedCount,
    totalCount,
    counts: {
      completed: completedCount,
      total: totalCount,
    },
  };
}

export function getChildBranches(rootTasks) {
  return (rootTasks || []).filter((task) => (task.children || []).length > 0);
}
