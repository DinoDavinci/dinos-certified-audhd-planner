import { newId, todayString, isRoutineActiveOnDate } from "../utils/dateUtils";

import {
  cloneObjectives,
  isObjectiveComplete,
  getObjectiveCounts,
  countLeafProgress,
  findObjectivePath,
  nextObjectivesInList,
  resetObjectives,
} from "./taskModel";

// Quest model helpers.
// This file still uses the old quest/objective shape so this refactor stays mechanical.

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
    objectives: [],
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
    objectives: cloneObjectives(routine.objectiveTemplate || []),
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
    objectives: cloneObjectives(routine.objectiveTemplate || []),
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
  const objectives = quest.objectives || [];
  if (objectives.length === 0) return true;
  return objectives.every(isObjectiveComplete);
}

export function getQuestProgress(quest) {
  let total = 0;
  let complete = 0;

  function walk(list) {
    for (const obj of list || []) {
      total += 1;
      if (isObjectiveComplete(obj)) complete += 1;
      walk(obj.children || []);
    }
  }

  walk(quest?.objectives || []);
  if (total === 0) return isQuestComplete(quest) ? 100 : 0;
  return Math.round((complete / total) * 100);
}

export function nextObjectivesForQuest(quest) {
  if (!quest) return [];
  return nextObjectivesInList(quest.objectives || [], quest.mode);
}

export function makeQuestCompletionCard(quest, complete = false) {
  return {
    kind: "questCompletion",
    id: `quest-completion-${quest.id}`,
    quest,
    objective: {
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

export function getBranchFocusInfo(quest, branchObjectiveId) {
  if (!quest || !branchObjectiveId) return null;

  const path = findObjectivePath(quest.objectives || [], branchObjectiveId) || [];
  const objective = path[path.length - 1];

  if (!objective || (objective.children || []).length === 0) return null;

  return {
    objective,
    path,
    pathText: [quest.title || "Untitled quest", ...path.map((item) => item.title || "Untitled")].join(" › "),
    root: {
      mode: objective.mode,
      objectives: objective.children || [],
    },
  };
}

export function getFocusPathInfo(quest, branchObjectiveId) {
  if (!quest) {
    return {
      quest: null,
      branchObjective: null,
      path: [],
      root: null,
      parent: null,
      childBranches: [],
      progress: 0,
    };
  }

  const branchInfo = getBranchFocusInfo(quest, branchObjectiveId);
  const branchObjective = branchInfo?.objective || null;
  const path = branchInfo?.path || [];

  const root = branchObjective
    ? {
        mode: branchObjective.mode,
        objectives: branchObjective.children || [],
        selfObjective: branchObjective,
        selfPath: path,
      }
    : { mode: quest.mode, objectives: quest.objectives || [] };

  const parent = path.length > 1 ? path[path.length - 2] : null;
  const childBranches = getChildBranches(root.objectives || []);

  const rawCounts = branchObjective
    ? countLeafProgress(branchObjective)
    : getObjectiveCounts(quest.objectives || []);

  const completedCount = Number(rawCounts.completed ?? rawCounts.complete ?? 0);
  const totalCount = Number(rawCounts.total ?? 0);
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : isQuestComplete(quest) ? 100 : 0;

  return {
    quest,
    branchObjective,
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

export function getChildBranches(rootObjectives) {
  return (rootObjectives || []).filter((objective) => (objective.children || []).length > 0);
}
