export const STORAGE_KEY = "quest_planner_v1";
export const LAST_TICK_KEY = "quest_planner_last_tick_v1";

export const DEFAULT_TAGS = ["Life", "Game Dev", "Art", "Health", "Chores", "Animal Care", "Other"];
export const DIFFICULTIES = ["Tiny", "Easy", "Medium", "Hard", "Deep Work"];
export const WEEKDAYS = [
  { key: "sun", label: "Sun", bit: 1 << 0 },
  { key: "mon", label: "Mon", bit: 1 << 1 },
  { key: "tue", label: "Tue", bit: 1 << 2 },
  { key: "wed", label: "Wed", bit: 1 << 3 },
  { key: "thu", label: "Thu", bit: 1 << 4 },
  { key: "fri", label: "Fri", bit: 1 << 5 },
  { key: "sat", label: "Sat", bit: 1 << 6 },
];
export const EVERY_DAY_MASK = WEEKDAYS.reduce((mask, day) => mask | day.bit, 0);
export const MODES = ["all", "sequence"];
export const COOLDOWN_UNITS = ["days", "weeks", "months", "years"];

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function weekdayBit(dateString = todayString()) {
  const date = new Date(dateString + "T00:00:00");
  return 1 << date.getDay();
}

export function isRoutineActiveOnDate(routine, dateString = todayString()) {
  const mask = routine.dayMask ?? EVERY_DAY_MASK;
  return (mask & weekdayBit(dateString)) !== 0;
}

export function formatDayMask(mask = EVERY_DAY_MASK) {
  const active = WEEKDAYS.filter((day) => (mask & day.bit) !== 0).map((day) => day.label);
  if (active.length === 7) return "Every day";
  if (active.length === 0) return "No days";
  return active.join(", ");
}

export function addDays(dateString, days) {
  const date = new Date((dateString || todayString()) + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(dateString, months) {
  const date = new Date((dateString || todayString()) + "T00:00:00");
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function addCooldown(dateString, amount, unit) {
  const cleanAmount = Math.max(1, Number(amount) || 1);

  if (unit === "days") return addDays(dateString, cleanAmount);
  if (unit === "weeks") return addDays(dateString, cleanAmount * 7);
  if (unit === "months") return addMonths(dateString, cleanAmount);
  if (unit === "years") return addMonths(dateString, cleanAmount * 12);

  return addDays(dateString, cleanAmount);
}

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

export function isQuestComplete(quest) {
  return quest?.status === "completed";
}

export function isQuestReadyToComplete(quest) {
  if (!quest || isQuestComplete(quest)) return false;
  const objectives = quest.objectives || [];
  if (objectives.length === 0) return true;
  return objectives.every(isObjectiveComplete);
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

export function nextObjectivesForQuest(quest) {
  if (!quest) return [];
  return nextObjectivesInList(quest.objectives || [], quest.mode);
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

  const progressRoot = branchObjective || quest;
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

export const seedData = {
  activeQuestId: "quest_programming_sample",
  activeBranchObjectiveId: null,
  quests: [
    makeQuest({
      id: "quest_programming_sample",
      title: "Small Programming Task",
      description: "Use this as a template for one small programming task, feature, bug fix, or refactor.\n\nGoal:\nBreak the work into clear steps so the task does not become one vague blob.",
      tags: ["Programming"],
      difficulty: "Medium",
      mode: "sequence",
      objectives: [
        makeObjective({ id: "obj_programming_plan", title: "Plan", description: "Figure out what you are trying to do before opening too many files.\n\nOutput:\nA short written goal and a small step list.", mode: "sequence", children: [
            makeObjective({ id: "obj_programming_define", title: "Define the goal", description: "Write one or two sentences describing the intended outcome.\n\nUseful questions:\n- What should change?\n- What should stay the same?\n- How will I know it worked?" }),
            makeObjective({ id: "obj_programming_breakdown", title: "Break into steps", description: "Split the work into small steps.\n\nAim for steps that can be tested independently.\n\nAvoid:\nA giant all-in-one refactor unless the task truly requires it." })
          ] }),
        makeObjective({ id: "obj_programming_build", title: "Build and verify", description: "Make the planned change, then verify it.\n\nKeep the first pass simple. Polish after the behavior works.", mode: "sequence", children: [
            makeObjective({ id: "obj_programming_implement", title: "Implement first pass", description: "Build the simplest version that proves the idea works.\n\nDo not polish too early.\n\nGood first-pass goal:\nWorking, understandable, and easy to revise." }),
            makeObjective({ id: "obj_programming_test", title: "Test behavior", description: "Check that the task actually works.\n\nTest:\n- The normal expected case\n- At least one edge case\n- Anything that previously broke" }),
            makeObjective({ id: "obj_programming_cleanup", title: "Clean up notes", description: "Clean up after the task.\n\nChecklist:\n- Remove temporary logs or scratch code\n- Rename unclear variables if needed\n- Write down any follow-up task\n- Commit if the change is good" })
          ] }),
      ],
    }),
    makeQuest({
      id: "quest_oil_change",
      title: "Change Car Oil",
      description: "Recurring maintenance task for changing car oil.\n\nComplete this quest after the oil change is done.\n\nThe cooldown can reset it later.",
      tags: ["Maintenance", "Car"],
      difficulty: "Medium",
      mode: "sequence",
      cooldownEnabled: true,
      cooldownAmount: 6,
      cooldownUnit: "months",
      objectives: [
        makeObjective({ id: "obj_oil_supplies", title: "Gather supplies", description: "Gather everything before starting.\n\nChecklist:\n- Oil\n- Oil filter\n- Drain pan\n- Funnel\n- Gloves\n- Rags\n- Correct tools" }),
        makeObjective({ id: "obj_oil_drain", title: "Drain old oil", description: "Drain the old oil safely.\n\nRemember:\n- Let the oil drain fully\n- Keep track of the drain plug\n- Avoid spills where possible" }),
        makeObjective({ id: "obj_oil_filter", title: "Replace filter", description: "Replace the oil filter.\n\nBasic reminder:\n- Remove old filter\n- Check that the old gasket came off\n- Install the new filter correctly" }),
        makeObjective({ id: "obj_oil_refill", title: "Refill oil", description: "Refill with the correct oil.\n\nCheck:\n- Correct oil type\n- Correct amount\n- Oil cap replaced afterward" }),
        makeObjective({ id: "obj_oil_check", title: "Check level and leaks", description: "Verify the oil change.\n\nChecklist:\n- Run briefly\n- Check for leaks\n- Turn off and wait briefly\n- Check dipstick level\n- Top off if needed" }),
      ],
    }),
    makeQuest({
      id: "quest_laundry",
      title: "Laundry",
      description: "Recurring household task for laundry.\n\nGoal:\nMove clothes all the way from dirty to put away, not just washed.",
      tags: ["Home"],
      difficulty: "Tiny",
      mode: "sequence",
      cooldownEnabled: true,
      cooldownAmount: 1,
      cooldownUnit: "weeks",
      objectives: [
        makeObjective({ id: "obj_laundry_sort", title: "Gather laundry", description: "Collect laundry from the usual places.\n\nInclude:\n- Clothes\n- Towels\n- Washable cloth items\n- Anything that needs special handling" }),
        makeObjective({ id: "obj_laundry_wash", title: "Wash", description: "Start the wash.\n\nCheck:\n- Load size\n- Detergent\n- Water temperature\n- Any special settings" }),
        makeObjective({ id: "obj_laundry_dry", title: "Dry", description: "Move laundry out of the washer.\n\nUse dryer or hang dry as needed.\n\nDo not leave wet laundry sitting too long." }),
        makeObjective({ id: "obj_laundry_put_away", title: "Put away", description: "Finish the laundry loop.\n\nChecklist:\n- Fold or hang\n- Pair socks if needed\n- Put everything away" }),
      ],
    }),
    makeQuest({
      id: "quest_update_website",
      title: "Update Website",
      description: "Reference quest for publishing changes to the GitHub Pages web version.\n\nUse this when updating the public website.",
      tags: ["Release", "Website"],
      difficulty: "Tiny",
      mode: "sequence",
      objectives: [
        makeObjective({ id: "obj_web_test_dev", title: "Test locally", description: "Verify the browser dev version.\n\nCommand:\nnpm run dev\n\nCheck:\n- App loads\n- Main workflow still works\n- No obvious console errors" }),
        makeObjective({ id: "obj_web_test_tauri", title: "Test desktop dev", description: "Verify the desktop dev version if the change affects Tauri, localStorage, layout, or file behavior.\n\nCommand:\nnpm run tauri dev" }),
        makeObjective({ id: "obj_web_commit", title: "Commit changes", description: "Commit and push the source update.\n\nCommands:\ngit add .\ngit commit -m \"Describe update\"\ngit push origin main" }),
        makeObjective({ id: "obj_web_build", title: "Build website", description: "Create the production website build.\n\nCommand:\nnpm run build\n\nIf this fails, fix the error before deploying." }),
        makeObjective({ id: "obj_web_deploy", title: "Deploy GitHub Pages", description: "Publish the built website to GitHub Pages.\n\nCommand:\nnpm run deploy\n\nThis updates the gh-pages branch." }),
        makeObjective({ id: "obj_web_verify", title: "Verify live page", description: "Verify the live website.\n\nCheck:\n- Page loads\n- App is not a white screen\n- Refresh keeps data\n- JSON export/import still works\n\nIf needed, hard refresh:\nCtrl + Shift + R" }),
      ],
    }),
    makeQuest({
      id: "quest_update_appimage",
      title: "Update AppImage",
      description: "Reference quest for rebuilding the Linux desktop AppImage after changing the app.\n\nUse this when you want a new desktop build.",
      tags: ["Release", "Desktop"],
      difficulty: "Tiny",
      mode: "sequence",
      objectives: [
        makeObjective({ id: "obj_appimage_export_save", title: "Export save backup", description: "Back up your current planner data before a risky update.\n\nUse:\nSave/Load → Export JSON" }),
        makeObjective({ id: "obj_appimage_test_dev", title: "Test Tauri dev", description: "Verify the desktop development version.\n\nCommand:\nnpm run tauri dev\n\nCheck that the native window opens and the app behaves normally." }),
        makeObjective({ id: "obj_appimage_build", title: "Build AppImage", description: "Build the Linux desktop release.\n\nCommand:\nnpm run tauri build\n\nThis may take a while, especially while bundling." }),
        makeObjective({ id: "obj_appimage_find", title: "Find output", description: "Find the AppImage output.\n\nLocation:\nsrc-tauri/target/release/bundle/appimage/\n\nThe file should end with:\n.AppImage" }),
        makeObjective({ id: "obj_appimage_smoke_test", title: "Smoke test AppImage", description: "Smoke test the new AppImage.\n\nCheck:\n- App launches\n- Existing data loads\n- Create/edit works\n- Save/Load works\n- No white screen" }),
      ],
    }),
  ],
  routines: [
    makeRoutine({
      id: "routine_simple_workout",
      title: "Simple Workout",
      description: "A simple starter workout routine.\n\nUse Count Target for sets or rounds.\n\nGeneral rules:\n- Warm up first\n- Move smoothly\n- Stop before sharp pain\n- Rest as needed\n- Leave a few reps in reserve",
      tags: ["Health", "Routine"],
      difficulty: "Medium",
      dayMask: EVERY_DAY_MASK,
      mode: "sequence",
      active: true,
      objectiveTemplate: [
        makeObjective({ id: "routine_workout_warmup", title: "Warmup", description: "Do a few easy movements to feel warm.\n\nExamples:\n- Arm circles\n- Hip circles\n- Bodyweight squats\n- Easy marching in place" }),
        makeObjective({ id: "routine_workout_pushups", title: "Pushups", description: "Do controlled pushups or incline pushups.\n\nForm notes:\n- Keep the body straight\n- Lower under control\n- Stop before grinding reps", countTarget: 3 }),
        makeObjective({ id: "routine_workout_squats", title: "Squats", description: "Use bodyweight, a dumbbell, or a bag.\n\nForm notes:\n- Sit the hips down and back\n- Keep knees controlled\n- Stand smoothly", countTarget: 3 }),
        makeObjective({ id: "routine_workout_rows", title: "Rows", description: "Use a dumbbell, band, or bag.\n\nForm notes:\n- Pull toward the ribs or hip\n- Do not yank with momentum\n- Lower under control", countTarget: 3 }),
        makeObjective({ id: "routine_workout_carry", title: "Carry", description: "Carry a bag or weight for a short walk.\n\nForm notes:\n- Stand tall\n- Keep breathing steady\n- Do not rush", countTarget: 2 }),
      ],
    }),
  ],
};
export function normalizeData(parsed) {
  if (!parsed || typeof parsed !== "object") return seedData;

  const quests = Array.isArray(parsed.quests)
    ? parsed.quests.map((quest) =>
        makeQuest({
          ...quest,
          mode: quest.mode || "all",
          locked: quest.locked ?? quest.sourceType === "routine",
          completedAt: quest.completedAt || "",
          cooldownEnabled: quest.cooldownEnabled || false,
          cooldownAmount: quest.cooldownAmount || 6,
          cooldownUnit: quest.cooldownUnit || "months",
          objectives: normalizeObjectives(quest.objectives || []),
        })
      )
    : [];

  const routines = Array.isArray(parsed.routines)
    ? parsed.routines.map((routine) =>
        makeRoutine({
          ...routine,
          mode: routine.mode || "sequence",
          dayMask: routine.dayMask ?? EVERY_DAY_MASK,
          objectiveTemplate: normalizeObjectives(routine.objectiveTemplate || []),
        })
      )
    : [];

  return {
    activeQuestId: parsed.activeQuestId || quests[0]?.id || null,
    activeBranchObjectiveId: parsed.activeBranchObjectiveId || null,
    quests,
    routines,
  };
}

export function runDailyMaintenance(data) {
  const today = todayString();

  let quests = (data.quests || []).map((quest) => {
    if (
      quest.sourceType !== "routine" &&
      quest.cooldownEnabled &&
      isQuestComplete(quest) &&
      quest.completedAt
    ) {
      const resetDate = addCooldown(quest.completedAt, quest.cooldownAmount, quest.cooldownUnit);
      if (resetDate <= today) {
        return {
          ...quest,
          status: "active",
          completedAt: "",
          objectives: resetObjectives(quest.objectives || []),
        };
      }
    }

    return quest;
  }).filter((quest) => {
    const missedGeneratedQuest = quest.sourceType === "routine" && !isQuestComplete(quest) && quest.deadline && quest.deadline < today;
    return !missedGeneratedQuest;
  });

  const routines = data.routines || [];
  const generated = [];

  for (const routine of routines) {
    quests = reconcileTodayQuestForRoutine(quests, routine);
  }

  return { ...data, quests, routines };
}


export function selectionKey(selection) {
  if (!selection) return "none";
  if (selection.type === "quest") return `quest:${selection.id}`;
  if (selection.type === "routine") return `routine:${selection.id}`;
  if (selection.type === "objective") return `objective:${selection.questId}:${selection.id}`;
  if (selection.type === "routineObjective") return `routineObjective:${selection.routineId}:${selection.id}`;
  return "none";
}

export function isTreeObjectiveSelected(selection, treeContext, objective) {
  if (!selection || !objective || !treeContext) return false;

  if ((treeContext.type === "quest" || treeContext.type === "focus") && selection.type === "objective") {
    return selection.questId === treeContext.quest?.id && selection.id === objective.id;
  }

  if (treeContext.type === "routine" && selection.type === "routineObjective") {
    return selection.routineId === treeContext.routine?.id && selection.id === objective.id;
  }

  return false;
}

export function getTreeContext(selection, data, activeQuest) {
  if (selection?.type === "routine") {
    const routine = data.routines.find((item) => item.id === selection.id);
    if (routine) {
      return { type: "routine", routine, title: `Routine Template: ${routine.title}` };
    }
  }

  if (selection?.type === "routineObjective") {
    const routine = data.routines.find((item) => item.id === selection.routineId);
    if (routine) {
      return { type: "routine", routine, title: `Routine Template: ${routine.title}` };
    }
  }

  if (selection?.type === "quest") {
    const quest = data.quests.find((item) => item.id === selection.id);
    if (quest) {
      return { type: "quest", quest, title: `Quest Tree: ${quest.title}` };
    }
  }

  if (selection?.type === "objective") {
    const quest = data.quests.find((item) => item.id === selection.questId);
    if (quest) {
      return { type: "quest", quest, title: `Quest Tree: ${quest.title}` };
    }
  }

  if (activeQuest) {
    return { type: "focus", quest: activeQuest, title: `Focus Tree: ${activeQuest.title}` };
  }

  return { type: "empty", title: "Tree" };
}

export function treeModeClass(treeContext) {
  if (treeContext.type === "routine") return "tree-panel routine-tree";
  if (treeContext.type === "quest" || treeContext.type === "focus") return "tree-panel quest-type-regular-tree";
  return "tree-panel";
}

export function treeModeLabel(treeContext) {
  if (treeContext.type === "routine") return "Routine template";
  if (treeContext.type === "quest") return "Selected quest";
  if (treeContext.type === "focus") return "Current focus";
  return "No tree";
}

export function questTypeClass(quest) {
  if (!quest) return "";
  if (quest.sourceType === "routine") return "quest-type-routine";
  if (quest.cooldownEnabled) return "quest-type-cooldown";
  return "quest-type-regular";
}

export function questTypeLabel(quest) {
  if (!quest) return "Quest";
  if (quest.sourceType === "routine") return "Routine";
  if (quest.cooldownEnabled) return "Cooldown";
  return "Quest";
}
