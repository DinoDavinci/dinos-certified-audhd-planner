#!/usr/bin/env python3
from pathlib import Path
import re
import shutil

ROOT = Path.cwd()


def read(path):
    full = ROOT / path
    if not full.exists():
        raise SystemExit(f"Missing expected file: {path}")
    return full.read_text()


def write(path, text, backup_suffix=".bak-remove-routines"):
    full = ROOT / path
    if not full.exists():
        raise SystemExit(f"Missing expected file: {path}")
    backup = full.with_name(full.name + backup_suffix)
    if not backup.exists():
        shutil.copy2(full, backup)
    full.write_text(text)


def delete_with_backup(path, backup_suffix=".bak-remove-routines"):
    full = ROOT / path
    if not full.exists():
        return
    backup = full.with_name(full.name + backup_suffix)
    if not backup.exists():
        shutil.copy2(full, backup)
    full.unlink()


def require_contains(text, needle, label):
    if needle not in text:
        raise SystemExit(f"Could not find expected text in {label}: {needle[:120]!r}")


def require_not_contains(text, needle, label):
    if needle in text:
        raise SystemExit(f"Unexpected remaining text in {label}: {needle!r}")


def patch_app():
    path = "src/App.jsx"
    text = read(path)

    for needle in [
        "makeRoutine,",
        "reconcileTodayQuestForRoutine,",
        'import RoutineManagementTab from "./components/routine-management/RoutineManagementTab";',
        "function createRoutine()",
        "function createRoutineTask(",
        "function deleteRoutine(",
        "function moveRoutineTask(",
        "PANEL_IDS.ROUTINE_PANEL",
    ]:
        require_contains(text, needle, path)

    text = text.replace("  makeRoutine,\n  reconcileTodayQuestForRoutine,\n", "")
    text = text.replace("  makeRoutineFileExport,\n", "")
    text = text.replace("  rawRoutineFromRoutinePayload,\n", "")
    text = text.replace('import RoutineManagementTab from "./components/routine-management/RoutineManagementTab";\n', "")

    text = text.replace("  const routines = data.routines || [];\n", "")
    text = text.replace('''  const selectedRoutineForExport = selection.type === "routine"
    ? routines.find((routine) => routine.id === selection.id) || null
    : null;
''', "")
    text = text.replace('''  const allTags = useMemo(() => {
    const set = new Set(DEFAULT_TAGS);
    quests.forEach((quest) => (quest.tags || []).forEach((tag) => set.add(tag)));
    routines.forEach((routine) => (routine.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [quests, routines]);
''', '''  const allTags = useMemo(() => {
    const set = new Set(DEFAULT_TAGS);
    quests.forEach((quest) => (quest.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [quests]);
''')

    text = re.sub(r"\n  const filteredRoutines = useMemo\(\(\) => \{\n    return routines\n      \.filter[\s\S]*?\n  }, \[routines, search, tagFilter\]\);\n", "\n", text)

    text = re.sub(r"\n  function createRoutine\(\) \{\n    const routine[\s\S]*?\n  }\n\n  \nfunction createQuestTask", "\n  \nfunction createQuestTask", text)
    text = re.sub(r"\n  function createRoutineTask\(routineId, parentId = null\) \{[\s\S]*?\n  }\n\n  function deleteQuest", "\n  function deleteQuest", text)
    text = re.sub(r"\n  function deleteRoutine\(routineId\) \{[\s\S]*?\n  }\n\n  \nfunction deleteQuestTask", "\n  \nfunction deleteQuestTask", text)
    text = re.sub(r"\n  function deleteRoutineTask\(routineId, taskId\) \{[\s\S]*?\n  }\n\n  \nfunction moveQuestTask", "\n  \nfunction moveQuestTask", text)
    text = re.sub(r"\n  function moveRoutineTask\(routineId, taskId, direction\) \{[\s\S]*?\n  }\n\n  function moveQuestTaskToLocation", "\n  function moveQuestTaskToLocation", text)
    text = re.sub(r"\n  function moveRoutineTaskToLocation\(routineId, sourceTaskId, targetTaskId, placement\) \{[\s\S]*?\n  }\n\n\n  \nfunction toggleTask", "\n\n  \nfunction toggleTask", text)

    text = re.sub(r"\n  function exportRoutineFile\(routine = selectedRoutineForExport\) \{[\s\S]*?\n  }\n\n  async function importRoutineFile", "\n  async function importRoutineFile", text)
    text = re.sub(r"\n  async function importRoutineFile\(file\) \{[\s\S]*?\n  }\n\n  async function importJsonFile", "\n  async function importJsonFile", text)

    for snippet in [
        "          routines={filteredRoutines}\n",
        "          createRoutine={createRoutine}\n",
        "          exportRoutineFile={exportRoutineFile}\n",
        "          importRoutineFile={importRoutineFile}\n",
        "          hasSelectedRoutine={Boolean(selectedRoutineForExport)}\n",
        "          selectRoutine={(routine) => setSelection({ type: \"routine\", id: routine.id })}\n",
        "          createRoutineTask={createRoutineTask}\n",
        "          deleteRoutine={deleteRoutine}\n",
        "          deleteRoutineTask={deleteRoutineTask}\n",
        "          moveRoutineTask={moveRoutineTask}\n",
        "          moveRoutineTaskToLocation={moveRoutineTaskToLocation}\n",
    ]:
        text = text.replace(snippet, "")

    for snippet in [
        "  routines,\n",
        "  createRoutine,\n",
        "  exportRoutineFile,\n",
        "  importRoutineFile,\n",
        "  hasSelectedRoutine,\n",
        "  selectRoutine,\n",
    ]:
        text = text.replace(snippet, "")

    text = re.sub(r'''\n    \{\n      id: PANEL_IDS\.ROUTINE_PANEL,[\s\S]*?      \),\n    \},''', "", text)

    for snippet in [
        "          exportRoutineFile={exportRoutineFile}\n",
        "          importRoutineFile={importRoutineFile}\n",
        "          hasSelectedRoutine={hasSelectedRoutine}\n",
    ]:
        text = text.replace(snippet, "")

    for snippet in [
        "    createRoutineTask,\n",
        "    deleteRoutineTask,\n",
        "    moveRoutineTask,\n",
        "    moveRoutineTaskToLocation,\n",
        "          createRoutineTask,\n",
        "          deleteRoutineTask,\n",
        "          moveRoutineTask,\n",
        "          moveRoutineTaskToLocation,\n",
    ]:
        text = text.replace(snippet, "")

    text = text.replace("normalizeData({ quests: [rawQuest], routines: [] })", "normalizeData({ quests: [rawQuest] })")
    text = text.replace('Reset all quests and routines to the default state? This clears the saved app data in this browser.', 'Reset all quests to the default state? This clears the saved app data in this browser.')

    for forbidden in [
        "makeRoutine",
        "reconcileTodayQuestForRoutine",
        "RoutineManagementTab",
        "filteredRoutines",
        "createRoutine",
        "deleteRoutine",
        "routineTask",
        "PANEL_IDS.ROUTINE_PANEL",
    ]:
        require_not_contains(text, forbidden, path)

    write(path, text)


def patch_app_model():
    path = "src/models/appModel.js"
    text = read(path)

    for needle in [
        "makeRoutine",
        "reconcileTodayQuestForRoutine",
        "export function normalizeData(parsed)",
        "export function getTreeContext(selection, data, activeQuest)",
        "quest.sourceType === \"routine\"",
    ]:
        require_contains(text, needle, path)

    for snippet in [
        "  makeRoutine,\n",
        "  makeRoutineQuestTemplate,\n",
        "  getRoutineTemplateTasks,\n",
    ]:
        text = text.replace(snippet, "")

    for snippet in [
        "  createQuestFromRoutine,\n",
        "  syncGeneratedQuestWithRoutine,\n",
        "  reconcileTodayQuestForRoutine,\n",
    ]:
        text = text.replace(snippet, "")

    text = re.sub(r",\n  routines: \[\n    makeRoutine\(\{[\s\S]*?\n    \}\),\n  \]", "", text)

    norm_start = text.find("export function normalizeData(parsed)")
    schedule_start = text.find("\nfunction getScheduleTypeForMaintenance")
    if norm_start < 0 or schedule_start < 0 or schedule_start <= norm_start:
        raise SystemExit("Could not locate normalizeData block in src/models/appModel.js")

    new_normalize = r'''export function normalizeData(parsed) {
  if (!parsed || typeof parsed !== "object") return seedData;

  const routineIds = new Set(
    Array.isArray(parsed.routines)
      ? parsed.routines.map((routine) => routine?.id).filter(Boolean)
      : []
  );

  const quests = Array.isArray(parsed.quests)
    ? parsed.quests
        .filter((quest) => !(quest?.sourceType === "routine" && quest?.routineId && routineIds.has(quest.routineId)))
        .map((quest) => {
          const normalizedChildren = normalizeTasks(quest.rootTask?.children || quest.tasks || []);
          return makeQuest({
            ...quest,
            locked: false,
            sourceType: "manual",
            routineId: null,
            completedAt: quest.completedAt || "",
            openedAt: quest.openedAt || "",
            cooldownEnabled: quest.cooldownEnabled || false,
            cooldownAmount: quest.cooldownAmount || 6,
            cooldownUnit: quest.cooldownUnit || "months",
            rootTask: {
              ...(quest.rootTask || {}),
              mode: quest.rootTask?.mode || quest.mode || "all",
              completed: !!(quest.rootTask?.completed || quest.status === "completed"),
              children: normalizedChildren,
            },
          });
        })
    : [];

  const migratedRoutineQuests = Array.isArray(parsed.routines)
    ? parsed.routines.map((routine) => {
        const template = routine.questTemplate || {};
        const templateRoot = template.rootTask || {};
        const templateChildren = normalizeTasks(templateRoot.children || routine.taskTemplate || []);
        const id = `quest_from_${routine.id || newId("routine")}`;

        return makeQuest({
          id,
          title: template.title ?? routine.title ?? "Untitled Routine",
          description: template.description ?? routine.description ?? "",
          tags: template.tags ?? routine.tags ?? ["Life"],
          difficulty: template.difficulty ?? routine.difficulty ?? "Tiny",
          deadline: "",
          status: routine.active === false ? "inactive" : "active",
          completedAt: "",
          openedAt: "",
          scheduleType: "routine",
          schedule: {
            dayMask: routine.dayMask ?? EVERY_DAY_MASK,
            eventDate: "",
            cooldownAmount: 6,
            cooldownUnit: "months",
          },
          cooldownEnabled: false,
          sourceType: "manual",
          routineId: null,
          locked: false,
          rootTask: {
            ...templateRoot,
            id: templateRoot.id || newId("root_task"),
            mode: templateRoot.mode || routine.mode || "sequence",
            completed: false,
            children: templateChildren,
          },
        });
      })
    : [];

  const existingIds = new Set(quests.map((quest) => quest.id));
  const allQuests = [
    ...quests,
    ...migratedRoutineQuests.filter((quest) => !existingIds.has(quest.id)),
  ];

  return {
    activeQuestId: parsed.activeQuestId || allQuests[0]?.id || null,
    activeBranchTaskId: parsed.activeBranchTaskId || null,
    quests: allQuests,
  };
}


'''
    text = text[:norm_start] + new_normalize + text[schedule_start:]

    text = text.replace('''export function runDailyMaintenance(data, dateOverride = "") {
  const today = dateOverride || todayString();

  const quests = (data.quests || []).map((quest) => applyQuestSchedule(quest, today));
  const routines = data.routines || [];

  return { ...data, quests, routines };
}
''', '''export function runDailyMaintenance(data, dateOverride = "") {
  const today = dateOverride || todayString();

  const quests = (data.quests || []).map((quest) => applyQuestSchedule(quest, today));

  return { ...data, quests };
}
''')

    text = text.replace('''export function selectionKey(selection) {
  if (!selection) return "none";
  if (selection.type === "quest") return `quest:${selection.id}`;
  if (selection.type === "routine") return `routine:${selection.id}`;
  if (selection.type === "task") return `task:${selection.questId}:${selection.id}`;
  if (selection.type === "routineTask") return `routineTask:${selection.routineId}:${selection.id}`;
  return "none";
}
''', '''export function selectionKey(selection) {
  if (!selection) return "none";
  if (selection.type === "quest") return `quest:${selection.id}`;
  if (selection.type === "task") return `task:${selection.questId}:${selection.id}`;
  return "none";
}
''')

    text = text.replace('''export function isTreeTaskSelected(selection, treeContext, task) {
  if (!selection || !task || !treeContext) return false;

  if ((treeContext.type === "quest" || treeContext.type === "focus") && selection.type === "task") {
    return selection.questId === treeContext.quest?.id && selection.id === task.id;
  }

  if (treeContext.type === "routine" && selection.type === "routineTask") {
    return selection.routineId === treeContext.routine?.id && selection.id === task.id;
  }

  return false;
}
''', '''export function isTreeTaskSelected(selection, treeContext, task) {
  if (!selection || !task || !treeContext) return false;

  if ((treeContext.type === "quest" || treeContext.type === "focus") && selection.type === "task") {
    return selection.questId === treeContext.quest?.id && selection.id === task.id;
  }

  return false;
}
''')

    text = re.sub(r'''export function getTreeContext\(selection, data, activeQuest\) \{
  if \(selection\?\.type === "routine"\) \{[\s\S]*?  \}

  if \(selection\?\.type === "quest"\) \{''', '''export function getTreeContext(selection, data, activeQuest) {
  if (selection?.type === "quest") {''', text)

    text = text.replace('''export function treeModeClass(treeContext) {
  if (treeContext.type === "routine") return "tree-panel routine-tree";
  if (treeContext.type === "quest" || treeContext.type === "focus") return "tree-panel quest-type-regular-tree";
  return "tree-panel";
}
''', '''export function treeModeClass(treeContext) {
  if (treeContext.type === "quest" || treeContext.type === "focus") return "tree-panel quest-type-regular-tree";
  return "tree-panel";
}
''')

    text = text.replace('''export function treeModeLabel(treeContext) {
  if (treeContext.type === "routine") return "Routine template";
  if (treeContext.type === "quest") return "Selected quest";
  if (treeContext.type === "focus") return "Current focus";
  return "No tree";
}
''', '''export function treeModeLabel(treeContext) {
  if (treeContext.type === "quest") return "Selected quest";
  if (treeContext.type === "focus") return "Current focus";
  return "No tree";
}
''')

    text = text.replace('''export function questTypeClass(quest) {
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
''', '''export function questTypeClass(quest) {
  if (!quest) return "";
  if (quest.scheduleType === "routine") return "quest-type-routine";
  if (quest.scheduleType === "cooldown" || quest.cooldownEnabled) return "quest-type-cooldown";
  return "quest-type-regular";
}

export function questTypeLabel(quest) {
  if (!quest) return "Quest";
  if (quest.scheduleType === "routine") return "Routine";
  if (quest.scheduleType === "cooldown" || quest.cooldownEnabled) return "Cooldown";
  return "Quest";
}
''')

    for forbidden in [
        "makeRoutine",
        "reconcileTodayQuestForRoutine",
        'treeContext.type === "routine"',
        "routineTask",
        "data.routines",
    ]:
        require_not_contains(text, forbidden, path)

    write(path, text)


def patch_panel_layout():
    path = "src/layout/panelLayout.js"
    text = read(path)
    require_contains(text, "ROUTINE_PANEL", path)
    text = text.replace('  ROUTINE_PANEL: "routinePanel",\n', "")
    text = re.sub(r'''  \[PANEL_IDS\.ROUTINE_PANEL\]: Object\.freeze\(\{\n    id: PANEL_IDS\.ROUTINE_PANEL,\n    title: "Routines",\n    defaultDock: DOCK_IDS\.TOP_LEFT,\n  \}\),\n''', "", text)
    text = text.replace("    PANEL_IDS.ROUTINE_PANEL,\n", "")
    require_not_contains(text, "ROUTINE_PANEL", path)
    write(path, text)


INSPECTOR_TAB = r'''import React from "react";
import {
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import {
  findTask,
  findTaskPath,
  getTaskAncestry,
  updateQuestTree,
} from "../../models/appModel";

import QuestInspector from "./QuestInspector";
import TaskInspector from "./TaskInspector";
import {
  QuestChildrenSummary,
  AncestryPath,
  ChildrenSummary,
} from "./inspectorShared";

export default function InspectorTab(props) {
  const { rightSplit, embedded = false } = props;
  const rootClassName = embedded
    ? "inspector-root inspector-root-embedded"
    : "inspector-root";
  const rootStyle = embedded ? undefined : { flexBasis: `${rightSplit}%` };

  return (
    <div
      className={rootClassName}
      style={rootStyle}
    >
      <div className="inspector-main-margin">
        <div className="inspector-main-vbox">
          <InspectorToolbar {...props} />
          <InspectorRelations {...props} />
          <div className="scene-contents-panel inspector-contents-panel">
            <div className="scene-contents-margin inspector-contents-margin">
              <div className="inspector-scene-content">
                <Inspector {...props} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSelectionType(selection) {
  const type = selection?.type || "none";
  if (type === "quest") return "Quest";
  if (type === "task") return "Task";
  return "Nothing";
}

function getInspectorAccentClass(selection) {
  const type = selection?.type || "none";
  if (type === "quest") return "inspector-title-quest";
  if (type === "task") return "inspector-title-task";
  return "";
}

function getInspectorGoto(selection, data, activeQuestId, activeBranchTaskId) {
  if (!selection || !data) return null;

  if (selection.type === "quest") {
    const quest = data.quests.find((item) => item.id === selection.id);
    if (!quest) return null;

    const alreadyAtQuestRoot = activeQuestId === quest.id && !activeBranchTaskId;
    return {
      label: "Focus",
      disabled: alreadyAtQuestRoot,
      title: alreadyAtQuestRoot ? "Already focused here" : "Focus this quest",
      actionType: "quest",
      questId: quest.id,
    };
  }

  if (selection.type === "task") {
    const quest = data.quests.find((item) => item.id === selection.questId);
    if (!quest) return null;

    const path = findTaskPath(quest.rootTask?.children || [], selection.id) || [];
    const selectedTask = path[path.length - 1] || null;
    if (!selectedTask) return null;

    const branchTarget = [...path]
      .reverse()
      .find((task) => (task.children || []).length > 0);

    if (branchTarget) {
      const alreadyAtBranch = activeQuestId === quest.id && activeBranchTaskId === branchTarget.id;
      return {
        label: "Focus",
        disabled: alreadyAtBranch,
        title: alreadyAtBranch ? "Already focused here" : "Focus nearest branch",
        actionType: "task",
        questId: quest.id,
        taskId: branchTarget.id,
      };
    }

    const alreadyAtQuestRoot = activeQuestId === quest.id && !activeBranchTaskId;
    return {
      label: "Focus",
      disabled: alreadyAtQuestRoot,
      title: alreadyAtQuestRoot ? "Already focused here" : "Focus owner quest",
      actionType: "quest",
      questId: quest.id,
    };
  }

  return null;
}

function InspectorToolbar({
  selection,
  data,
  activeQuestId,
  activeBranchTaskId,
  makeFocus,
  setBranchFocus,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
}) {
  const goto = getInspectorGoto(selection, data, activeQuestId, activeBranchTaskId);

  function runGoto() {
    if (!goto || goto.disabled) return;

    if (goto.actionType === "quest") {
      makeFocus(goto.questId);
    }

    if (goto.actionType === "task") {
      makeFocus(goto.questId);
      setBranchFocus(goto.taskId);
    }
  }

  return (
    <div className="inspector-toolbar">
      <div className="inspector-toolbar-section">
        <span className={`inspector-selection-badge ${getInspectorAccentClass(selection)}`}>{getSelectionType(selection)}</span>
      </div>

      <div className="inspector-toolbar-actions">
        {goto && (
          <button
            onClick={runGoto}
            disabled={goto.disabled}
            className="title-secondary-button"
            title={goto.title}
          >
            Focus
          </button>
        )}
        <button onClick={goBack} disabled={!canGoBack} className="title-icon-button disabled:opacity-30"><ArrowLeft size={16} /></button>
        <button onClick={goForward} disabled={!canGoForward} className="title-icon-button disabled:opacity-30"><ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function InspectorRelations({ selection, data, setSelection }) {
  const selected = resolveSelection(selection, data);
  if (!selected || !selection || selection.type === "none") return null;

  if (selection.type === "quest" && selected?.quest) {
    return (
      <div className="inspector-relations-strip">
        <div className="wiki-meta-block">
          <QuestChildrenSummary quest={selected.quest} setSelection={setSelection} />
        </div>
      </div>
    );
  }

  if (selection.type === "task" && selected?.task) {
    const ancestry = getTaskAncestry(selection, data) || [];
    return (
      <div className="inspector-relations-strip">
        <div className="wiki-meta-block">
          <AncestryPath ancestry={ancestry} setSelection={setSelection} />
          <ChildrenSummary task={selected.task} ancestry={ancestry} setSelection={setSelection} />
        </div>
      </div>
    );
  }

  return null;
}

function Inspector({
  selection,
  data,
  setData,
  setSelection,
  allTags,
  activeQuestId,
  makeFocus,
  activeBranchTaskId,
  setBranchFocus,
  clearBranchFocus,
  completeQuest,
  restoreQuest,
  deleteQuest,
  deleteQuestTask,
  toggleTask,
}) {
  const selected = resolveSelection(selection, data);
  return (
    <div className="inspector-mode-content">
      {selection.type === "quest" && selected?.quest && (
        <QuestInspector
          quest={selected.quest}
          allTags={allTags}
          isFocus={selected.quest.id === activeQuestId && !activeBranchTaskId}
          isQuestRoot={selected.quest.id === activeQuestId}
          activeBranchTaskId={activeBranchTaskId}
          setData={setData}
          routines={[]}
          setSelection={setSelection}
          makeFocus={() => makeFocus(selected.quest.id)}
          completeQuest={() => completeQuest(selected.quest.id)}
          restoreQuest={() => restoreQuest(selected.quest.id)}
          deleteQuest={() => deleteQuest(selected.quest.id)}
        />
      )}

      {selection.type === "task" && selected?.quest && selected?.task && (
        <TaskInspector
          task={selected.task}
          parent={selected.parent}
          ownerTitle={selected.quest.title}
          ancestry={getTaskAncestry(selection, data)}
          setSelection={setSelection}
          locked={selected.quest.locked || selected.task.locked}
          canFocusBranch={selected.quest.id === activeQuestId && (selected.task.children || []).length > 0}
          isBranchFocused={activeBranchTaskId === selected.task.id}
          setBranchFocus={() => setBranchFocus(selected.task.id)}
          clearBranchFocus={clearBranchFocus}
          updateTask={(updater) => {
            setData((old) => ({
              ...old,
              quests: old.quests.map((quest) =>
                quest.id === selected.quest.id
                  ? { ...quest, rootTask: { ...quest.rootTask, children: updateQuestTree(quest.rootTask?.children || [], selection.id, updater) } }
                  : quest
              ),
            }));
          }}
          toggleComplete={() => toggleTask(selected.quest.id, selected.task.id)}
          deleteTask={() => deleteQuestTask(selected.quest.id, selected.task.id)}
          template={false}
        />
      )}

      {(!selected || selection.type === "none") && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-neutral-400">
          Select an item from the library or focus tree.
        </div>
      )}
    </div>
  );
}

function resolveSelection(selection, data) {
  if (!selection || selection.type === "none") return null;

  if (selection.type === "quest") {
    return { quest: data.quests.find((quest) => quest.id === selection.id) };
  }

  if (selection.type === "task") {
    const quest = data.quests.find((item) => item.id === selection.questId);
    const found = quest ? findTask(quest.rootTask ? [quest.rootTask] : [], selection.id) : null;
    return { quest, task: found?.task, parent: found?.parent };
  }

  return null;
}
'''


def patch_inspector_tab():
    path = "src/components/inspector/InspectorTab.jsx"
    text = read(path)
    require_contains(text, "RoutineInspector", path)
    write(path, INSPECTOR_TAB)


def patch_tree_view():
    path = "src/components/tree-view/TreeViewTab.jsx"
    text = read(path)

    for needle in [
        "createRoutineTask",
        'treeContext.type === "routine"',
        "routineTask",
        "moveRoutineTaskToLocation",
    ]:
        require_contains(text, needle, path)

    for snippet in [
        "  createRoutineTask,\n",
        "  deleteRoutineTask,\n",
        "  moveRoutineTask,\n",
        "  moveRoutineTaskToLocation,\n",
    ]:
        text = text.replace(snippet, "")

    text = re.sub(r'''  function getTreeMoveContext\(\) \{
    if \(treeContext\.type === "routine" && treeContext\.routine\) \{[\s\S]*?    \}

    if \(\(treeContext\.type === "quest" \|\| treeContext\.type === "focus"\) && treeContext\.quest\) \{''',
'''  function getTreeMoveContext() {
    if ((treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest) {''', text)

    text = re.sub(r'''\n    if \(validation\.context === "routine"\) \{[\s\S]*?      return;\n    \}\n''', "\n", text)

    text = text.replace('{treeContext.type === "focus" ? "Focus" : treeContext.type === "routine" ? "Routine" : treeContext.type === "quest" ? "Quest" : "Empty"}',
                        '{treeContext.type === "focus" ? "Focus" : treeContext.type === "quest" ? "Quest" : "Empty"}')

    text = re.sub(r'''                if \(treeContext\.type === "routine" && treeContext\.routine\) \{[\s\S]*?                  return;\n                \}\n\n''', "", text)

    text = re.sub(r'''            \{treeContext\.type === "routine" && \([\s\S]*?            \}\)

            \{\(treeContext\.type === "quest" \|\| treeContext\.type === "focus"\) && treeContext\.quest && \(''',
'''            {(treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && (''', text)

    text = re.sub(r'''                    if \(treeContext\?\.type === "routine"\) \{
                      setTreeSelection\(\{ type: "routineTask", routineId: treeContext\.routine\?\.id, id: task\.id \}\);
                      return;
                    \}

''', "", text)

    text = text.replace("No quest or routine selected.", "No quest selected.")

    for forbidden in [
        "createRoutineTask",
        "deleteRoutineTask",
        "moveRoutineTask",
        "moveRoutineTaskToLocation",
        'treeContext.type === "routine"',
        "routineTask",
    ]:
        require_not_contains(text, forbidden, path)

    write(path, text)


def patch_export_options():
    path = "src/components/export-options/ExportOptionsTab.jsx"
    text = read(path)

    require_contains(text, "Routine files", path)

    text = re.sub(r'''export default function ExportOptionsTab\(\{
  exportJson,
  importJsonFile,
  exportQuestFile,
  importQuestFile,
  hasActiveQuest,
  exportRoutineFile,
  importRoutineFile,
  hasSelectedRoutine,
  resetToDefaults,
\}\)''', '''export default function ExportOptionsTab({
  exportJson,
  importJsonFile,
  exportQuestFile,
  importQuestFile,
  hasActiveQuest,
  resetToDefaults,
})''', text)

    text = re.sub(r'''\n      <div className="rounded border border-neutral-800 bg-neutral-950 p-3">\n        <div className="mb-2 text-sm font-semibold text-neutral-200">Routine files</div>[\s\S]*?      </div>\n\n      <button type="button" onClick=\{resetToDefaults\}''',
"\n      <button type=\"button\" onClick={resetToDefaults}", text)

    text = text.replace(
        "Export all data creates a backup of quests and routines. Quest files export/import one quest scene at a time. Routine files export/import one routine template at a time. Load all data replaces the current app state with the selected JSON file.",
        "Export all data creates a backup of quests. Quest files export/import one quest scene at a time. Load all data replaces the current app state with the selected JSON file."
    )

    for forbidden in ["Routine files", "exportRoutineFile", "importRoutineFile", "hasSelectedRoutine"]:
        require_not_contains(text, forbidden, path)

    write(path, text)


def main():
    patch_app()
    patch_app_model()
    patch_panel_layout()
    patch_inspector_tab()
    patch_tree_view()
    patch_export_options()
    delete_with_backup("src/components/routine-management/RoutineManagementTab.jsx")
    delete_with_backup("src/components/inspector/RoutineInspector.jsx")

    print("Patch applied: routine objects/UI removed; quest scheduleType='routine' remains.")
    print("Backups use suffix .bak-remove-routines")


if __name__ == "__main__":
    main()
