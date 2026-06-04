import { newId, todayString, isRoutineActiveOnDate } from "../utils/dateUtils";

import {
  cloneTasks,
  makeTask,
  isTaskComplete,
  areTaskChildrenComplete,
  isTaskReadyToComplete,
  getTaskCounts,
  countLeafProgress,
  findTaskPath,
  nextTasksInList,
  resetTasks,
  resetTaskSubtree,
} from "./taskModel";

// Quest model helpers.
// Quest now owns a locked rootTask whose children contain the visible task tree.

export const SCHEDULE_TYPES = ["none", "cooldown", "routine", "event"];

export const SCHEDULE_LABELS = {
  none: "None",
  cooldown: "Cooldown",
  routine: "Routine",
  event: "Event",
};

export function makeQuestSchedule(overrides = {}) {
  return {
    dayMask: overrides.dayMask ?? 0,
    eventDate: overrides.eventDate || "",
    cooldownAmount: Math.max(1, Number(overrides.cooldownAmount || 6)),
    cooldownUnit: overrides.cooldownUnit || "months",
    ...overrides,
  };
}

export function normalizeScheduleType(value, fallback = "none") {
  return SCHEDULE_TYPES.includes(value) ? value : fallback;
}

export function normalizeQuestSchedule(quest = {}) {
  const rawSchedule = quest.schedule && typeof quest.schedule === "object"
    ? quest.schedule
    : {};

  const legacyCooldownEnabled = Boolean(quest.cooldownEnabled);
  const fallbackType = legacyCooldownEnabled ? "cooldown" : "none";
  const scheduleType = normalizeScheduleType(quest.scheduleType, fallbackType);

  return {
    scheduleType,
    schedule: makeQuestSchedule({
      cooldownAmount: quest.cooldownAmount ?? rawSchedule.cooldownAmount ?? 6,
      cooldownUnit: quest.cooldownUnit || rawSchedule.cooldownUnit || "months",
      dayMask: rawSchedule.dayMask ?? quest.dayMask ?? 0,
      eventDate: rawSchedule.eventDate || quest.eventDate || "",
      ...rawSchedule,
    }),
  };
}

export function getQuestScheduleLabel(quest) {
  const scheduleType = normalizeScheduleType(quest?.scheduleType, quest?.cooldownEnabled ? "cooldown" : "none");
  return SCHEDULE_LABELS[scheduleType] || "None";
}

export function getQuestScheduleSummary(quest) {
  const scheduleType = normalizeScheduleType(quest?.scheduleType, quest?.cooldownEnabled ? "cooldown" : "none");
  const schedule = makeQuestSchedule(quest?.schedule || {});

  if (scheduleType === "cooldown") {
    return `Cooldown · ${schedule.cooldownAmount} ${schedule.cooldownUnit}`;
  }

  if (scheduleType === "routine") {
    return "Routine";
  }

  if (scheduleType === "event") {
    return schedule.eventDate ? `Event · ${schedule.eventDate}` : "Event · No date";
  }

  return quest?.deadline ? `No schedule · Due ${quest.deadline}` : "No schedule";
}


export function makeQuestRootTask(overrides = {}) {
  return makeTask({
    id: overrides.id || newId("root_task"),
    title: "Complete Quest",
    description: "Finalize and complete this quest.",
    mode: overrides.mode || "all",
    completed: !!overrides.completed,
    countTarget: 0,
    countProgress: 0,
    locked: true,
    isRootTask: true,
    children: overrides.children || [],
    ...overrides,
    title: "Complete Quest",
    description: "Finalize and complete this quest.",
    locked: true,
    isRootTask: true,
  });
}

export function makeQuest(overrides = {}) {
  const legacyTasks = Array.isArray(overrides.tasks) ? overrides.tasks : [];
  const incomingRootTask = overrides.rootTask || null;
  const rootTask = makeQuestRootTask({
    ...(incomingRootTask || {}),
    mode: incomingRootTask?.mode || overrides.mode || "all",
    completed: incomingRootTask?.completed || overrides.status === "completed",
    children: incomingRootTask?.children || legacyTasks,
  });

  const normalizedSchedule = normalizeQuestSchedule(overrides);
  const { tasks, rootTask: _ignoredRootTask, mode, schedule, scheduleType, ...rest } = overrides;
  const cooldownEnabled = normalizedSchedule.scheduleType === "cooldown";

  return {
    id: newId("quest"),
    title: "",
    description: "",
    tags: ["Game Dev"],
    difficulty: "Medium",
    deadline: "",
    status: "active",
    completedAt: "",
    openedAt: todayString(),
    scheduleType: normalizedSchedule.scheduleType,
    schedule: normalizedSchedule.schedule,
    // Legacy mirrors kept during the scheduling refactor so existing UI and maintenance stay stable.
    cooldownEnabled,
    cooldownAmount: normalizedSchedule.schedule.cooldownAmount,
    cooldownUnit: normalizedSchedule.schedule.cooldownUnit,
    sourceType: "manual",
    routineId: null,
    locked: false,
    rootTask,
    createdAt: new Date().toISOString(),
    ...rest,
    scheduleType: normalizedSchedule.scheduleType,
    schedule: normalizedSchedule.schedule,
    cooldownEnabled,
    cooldownAmount: normalizedSchedule.schedule.cooldownAmount,
    cooldownUnit: normalizedSchedule.schedule.cooldownUnit,
  };
}


export function openQuestAttempt(quest, date = todayString(), patch = {}) {
  const rootTask = getQuestRootTask(quest);

  return {
    ...quest,
    status: "active",
    completedAt: "",
    openedAt: date,
    rootTask: resetTaskSubtree(rootTask),
    ...patch,
  };
}


export function getRoutineQuestTemplate(routine) {
  const template = routine?.questTemplate || {};
  const root = template.rootTask || {};

  return {
    title: template.title ?? routine?.title ?? "",
    description: template.description ?? routine?.description ?? "",
    tags: template.tags ?? routine?.tags ?? [],
    difficulty: template.difficulty ?? routine?.difficulty ?? "Tiny",
    rootTask: makeQuestRootTask({
      ...root,
      mode: root.mode || routine?.mode || "sequence",
      children: root.children || routine?.taskTemplate || [],
    }),
  };
}

export function createQuestFromRoutine(routine, dueDate) {
  const template = getRoutineQuestTemplate(routine);

  return makeQuest({
    title: template.title,
    description: template.description,
    tags: template.tags,
    difficulty: template.difficulty,
    deadline: dueDate,
    sourceType: "routine",
    routineId: routine.id,
    locked: true,
    rootTask: makeQuestRootTask({
      ...template.rootTask,
      id: newId("root"),
      completed: false,
      countProgress: 0,
      children: cloneTasks(template.rootTask.children || []),
    }),
  });
}


export function syncGeneratedQuestWithRoutine(quest, routine) {
  const template = getRoutineQuestTemplate(routine);
  const existingRoot = getQuestRootTask(quest);
  const existingChildren = existingRoot.children || [];
  const templateChildren = template.rootTask.children || [];

  return makeQuest({
    ...quest,
    title: template.title,
    description: template.description,
    tags: template.tags,
    difficulty: template.difficulty,
    locked: true,
    rootTask: makeQuestRootTask({
      ...existingRoot,
      mode: template.rootTask.mode || existingRoot.mode || "sequence",
      children: existingChildren.length > 0 ? existingChildren : cloneTasks(templateChildren),
    }),
  });
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


export function getQuestRootTask(quest) {
  return quest?.rootTask || makeQuestRootTask({
    mode: quest?.mode || "all",
    completed: quest?.status === "completed",
    children: quest?.tasks || [],
  });
}

export function getQuestChildTasks(quest) {
  return getQuestRootTask(quest).children || [];
}


export function isQuestComplete(quest) {
  return quest?.status === "completed" || isTaskComplete(quest?.rootTask);
}


export function isQuestReadyToComplete(quest) {
  if (!quest || isQuestComplete(quest)) return false;
  const rootTask = getQuestRootTask(quest);
  const tasks = rootTask.children || [];
  if (tasks.length === 0) return true;
  return areTaskChildrenComplete(rootTask);
}


export function getQuestProgress(quest) {
  const rootTask = getQuestRootTask(quest);
  const counts = getTaskCounts([rootTask]);
  if (counts.total === 0) return isQuestComplete(quest) ? 100 : 0;
  return Math.round((counts.completed / counts.total) * 100);
}


export function nextTasksForQuest(quest) {
  if (!quest) return [];
  const rootTask = getQuestRootTask(quest);
  if (isTaskReadyToComplete(rootTask)) return [rootTask];
  return nextTasksInList(rootTask.children || [], rootTask.mode || "all");
}


export function makeQuestCompletionCard(quest, complete = false) {
  const rootTask = getQuestRootTask(quest);
  return {
    kind: "rootTask",
    id: rootTask.id,
    quest,
    task: { ...rootTask, completed: complete || rootTask.completed },
    path: [rootTask],
    pathText: rootTask.title || "Complete Quest",
    hasChildren: true,
    complete: complete || rootTask.completed,
    displayTitle: rootTask.title || "Complete Quest",
    isConfirmation: true,
  };
}


export function addQuestCompletionCard(board, quest) {
  // Deprecated: the quest's real rootTask now appears in the focus board.
  return board;
}


export function getBranchFocusInfo(quest, branchTaskId) {
  if (!quest || !branchTaskId) return null;

  const path = findTaskPath(getQuestChildTasks(quest), branchTaskId) || [];
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

  const rootTask = getQuestRootTask(quest);
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
    : {
        mode: rootTask.mode,
        tasks: rootTask.children || [],
        selfTask: rootTask,
        selfPath: [rootTask],
      };

  const parent = path.length > 1 ? path[path.length - 2] : null;
  const childBranches = getChildBranches(root.tasks || []);

  const rawCounts = branchTask
    ? countLeafProgress(branchTask)
    : getTaskCounts([rootTask]);

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
