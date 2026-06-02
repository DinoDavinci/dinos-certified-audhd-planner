import {
  WEEKDAYS,
  EVERY_DAY_MASK,
  newId,
  todayString,
  weekdayBit,
  isRoutineActiveOnDate,
  formatDayMask,
  addDays,
  addMonths,
  addCooldown,
} from "../utils/dateUtils";

import {
  resetObjectives,
  completeObjectives,
  resetObjectiveSubtree,
  makeObjective,
  makeQuest,
  makeRoutine,
  cloneObjectives,
  createQuestFromRoutine,
  syncGeneratedQuestWithRoutine,
  reconcileTodayQuestForRoutine,
  isObjectiveComplete,
  hasCountTarget,
  getCountTarget,
  isCountReady,
  getCountProgress,
  getLeafProgressPercent,
  getKanbanObjectiveTitle,
  getKanbanActionState,
  getKanbanActionTitle,
  areObjectiveChildrenComplete,
  isObjectiveReadyToComplete,
  clearAncestorCompletionById,
  isQuestComplete,
  isQuestReadyToComplete,
  getObjectiveCounts,
  getObjectiveProgress,
  getQuestProgress,
  nextObjectivesInList,
  nextObjectivesFromObjective,
  nextObjectivesForQuest,
  flattenObjectiveTree,
  readyBranchRows,
  countLeafProgress,
  buildFocusBoardFromRoot,
  buildFocusBoard,
  makeQuestCompletionCard,
  addQuestCompletionCard,
  getBranchFocusInfo,
  getFocusPathInfo,
  getChildBranches,
  normalizeObjectives,
  findObjective,
  findObjectivePath,
  getObjectiveAncestry,
  updateObjectiveTree,
  addObjectiveToTree,
  deleteObjectiveFromTree,
  moveObjectiveInTree,
  SAMPLE_OBJECTIVE_DESCRIPTIONS
} from "./taskModel";

export {
  WEEKDAYS,
  EVERY_DAY_MASK,
  newId,
  todayString,
  weekdayBit,
  isRoutineActiveOnDate,
  formatDayMask,
  addDays,
  addMonths,
  addCooldown,
};

export {
  resetObjectives,
  completeObjectives,
  resetObjectiveSubtree,
  makeObjective,
  makeQuest,
  makeRoutine,
  cloneObjectives,
  createQuestFromRoutine,
  syncGeneratedQuestWithRoutine,
  reconcileTodayQuestForRoutine,
  isObjectiveComplete,
  hasCountTarget,
  getCountTarget,
  isCountReady,
  getCountProgress,
  getLeafProgressPercent,
  getKanbanObjectiveTitle,
  getKanbanActionState,
  getKanbanActionTitle,
  areObjectiveChildrenComplete,
  isObjectiveReadyToComplete,
  clearAncestorCompletionById,
  isQuestComplete,
  isQuestReadyToComplete,
  getObjectiveCounts,
  getObjectiveProgress,
  getQuestProgress,
  nextObjectivesInList,
  nextObjectivesFromObjective,
  nextObjectivesForQuest,
  flattenObjectiveTree,
  readyBranchRows,
  countLeafProgress,
  buildFocusBoardFromRoot,
  buildFocusBoard,
  makeQuestCompletionCard,
  addQuestCompletionCard,
  getBranchFocusInfo,
  getFocusPathInfo,
  getChildBranches,
  normalizeObjectives,
  findObjective,
  findObjectivePath,
  getObjectiveAncestry,
  updateObjectiveTree,
  addObjectiveToTree,
  deleteObjectiveFromTree,
  moveObjectiveInTree,
  SAMPLE_OBJECTIVE_DESCRIPTIONS
} from "./taskModel";

export const STORAGE_KEY = "quest_planner_v1";
export const LAST_TICK_KEY = "quest_planner_last_tick_v1";

export const DEFAULT_TAGS = ["Life", "Game Dev", "Art", "Health", "Chores", "Animal Care", "Other"];
export const DIFFICULTIES = ["Tiny", "Easy", "Medium", "Hard", "Deep Work"];
export const MODES = ["all", "sequence"];
export const COOLDOWN_UNITS = ["days", "weeks", "months", "years"];

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
