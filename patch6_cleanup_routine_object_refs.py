#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path.cwd()

FILES = {
    "app": ROOT / "src/App.jsx",
    "model": ROOT / "src/models/appModel.js",
    "tree": ROOT / "src/components/tree-view/TreeViewTab.jsx",
    "inspector": ROOT / "src/components/inspector/InspectorTab.jsx",
    "questboard": ROOT / "src/components/quest-board/QuestBoardTab.jsx",
    "fileio": ROOT / "src/utils/fileIO.js",
    "inspector_shared": ROOT / "src/components/inspector/inspectorShared.jsx",
}

def read(path):
    if not path.exists():
        raise SystemExit(f"Missing expected file: {path}")
    return path.read_text()

def write_with_backup(path, text, suffix=".bak-routine-cleanup"):
    original = path.read_text()
    if original == text:
        return False
    backup = path.with_name(path.name + suffix)
    if not backup.exists():
        backup.write_text(original)
    path.write_text(text)
    return True

def remove_import_names(text, names):
    for name in names:
        text = re.sub(rf'\n\s*{re.escape(name)},', '', text)
        text = re.sub(rf'{re.escape(name)},\n', '', text)
    return text

def remove_named_function(text, name):
    # Handles both "function name(...)" and "async function name(...)" at line start.
    match = re.search(rf'\n[ \t]*(?:async\s+)?function {re.escape(name)}\s*\(', text)
    if not match:
        return text

    start = match.start()
    brace = text.find("{", match.end())
    if brace == -1:
        raise SystemExit(f"Could not find opening brace for function {name}")

    depth = 0
    i = brace
    in_string = None
    escaped = False
    while i < len(text):
        ch = text[i]

        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == in_string:
                in_string = None
        else:
            if ch in ("'", '"', "`"):
                in_string = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    while end < len(text) and text[end] in " \t\r\n":
                        end += 1
                    return text[:start] + "\n\n" + text[end:]
        i += 1

    raise SystemExit(f"Could not find end of function {name}")

def remove_block_regex(text, pattern, replacement="", flags=re.S, count=1, label="block"):
    next_text, n = re.subn(pattern, replacement, text, count=count, flags=flags)
    if n == 0:
        print(f"Warning: did not find {label}")
    return next_text

def patch_app(text):
    text = remove_import_names(text, [
        "makeRoutine",
        "reconcileTodayQuestForRoutine",
        "makeRoutineFileExport",
        "rawRoutineFromRoutinePayload",
    ])

    text = re.sub(r'\n\s*const routines = data\.routines \|\| \[\];', '', text)
    text = re.sub(
        r'\n\s*const selectedRoutineForExport = selection\.type === "routine"\n\s*\? routines\.find\(\(routine\) => routine\.id === selection\.id\) \|\| null\n\s*: null;',
        '',
        text,
    )

    text = text.replace('    routines.forEach((routine) => (routine.tags || []).forEach((tag) => set.add(tag)));\n', '')
    text = text.replace('  }, [quests, routines]);', '  }, [quests]);')

    text = re.sub(
        r'\n\s*const filteredRoutines = useMemo\(\(\) => \{\n.*?\n\s*\}, \[routines, search, tagFilter\]\);',
        '',
        text,
        flags=re.S,
    )

    for fn in [
        "createRoutine",
        "createRoutineTask",
        "deleteRoutine",
        "deleteRoutineTask",
        "moveRoutineTask",
        "moveRoutineTaskToLocation",
        "exportRoutineFile",
        "importRoutineFile",
    ]:
        text = remove_named_function(text, fn)

    text = text.replace('Reset all quests and routines to the default state?', 'Reset all quests to the default state?')

    for line in [
        '          routines={filteredRoutines}\n',
        '          createRoutine={createRoutine}\n',
        '          exportRoutineFile={exportRoutineFile}\n',
        '          importRoutineFile={importRoutineFile}\n',
        '          hasSelectedRoutine={Boolean(selectedRoutineForExport)}\n',
        '          selectRoutine={(routine) => setSelection({ type: "routine", id: routine.id })}\n',
        '          createRoutineTask={createRoutineTask}\n',
        '          deleteRoutine={deleteRoutine}\n',
        '          deleteRoutineTask={deleteRoutineTask}\n',
        '          moveRoutineTask={moveRoutineTask}\n',
        '          moveRoutineTaskToLocation={moveRoutineTaskToLocation}\n',
    ]:
        text = text.replace(line, '')

    for param in [
        '  routines,\n',
        '  createRoutine,\n',
        '  exportRoutineFile,\n',
        '  importRoutineFile,\n',
        '  hasSelectedRoutine,\n',
        '  selectRoutine,\n',
        '    createRoutineTask,\n',
        '    deleteRoutineTask,\n',
        '    moveRoutineTask,\n',
        '    moveRoutineTaskToLocation,\n',
        '          createRoutineTask,\n',
        '          deleteRoutineTask,\n',
        '          moveRoutineTask,\n',
        '          moveRoutineTaskToLocation,\n',
    ]:
        text = text.replace(param, '')

    # Remove harmless but dead routine-object CSS selectors. Keep quest-type-routine because it now means scheduleType === "routine".
    text = re.sub(r'\n\s*\.routine-management-root \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.routine-toolbar \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.routine-contents-panel \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.routine-contents-margin \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.routine-list \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.inspector-title-routine \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.inspector-title-routineTask \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.inspector-selection-badge\.inspector-title-routine,\n\s*\.inspector-selection-badge\.inspector-title-routineTask \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.routine-tree \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.tree-root-routine \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.tree-root-routine,\n\s*\.tree-root-quest-type-routine,\n\s*\.tree-root-root-quest-type-routine,\n\s*\.tree-root-root-quest-type-cooldown \{', '\n      .tree-root-quest-type-routine,\n      .tree-root-root-quest-type-routine,\n      .tree-root-root-quest-type-cooldown {', text)
    text = re.sub(r'\n\s*\.selection-routine \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.selection-routine \.selection-type-label \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.selection-routineTask \{.*?\n\s*\}', '', text, flags=re.S)
    text = re.sub(r'\n\s*\.selection-routineTask \.selection-type-label \{.*?\n\s*\}', '', text, flags=re.S)

    return text

def patch_tree(text):
    for param in [
        '  createRoutineTask,\n',
        '  deleteRoutineTask,\n',
        '  moveRoutineTask,\n',
        '  moveRoutineTaskToLocation,\n',
    ]:
        text = text.replace(param, '')

    text = remove_block_regex(
        text,
        r'\n\s*if \(treeContext\.type === "routine" && treeContext\.routine\) \{\n.*?\n\s*\}\n\n\s*if \(\(treeContext\.type === "quest"',
        '\n    if ((treeContext.type === "quest"',
        label="routine move context",
    )

    text = remove_block_regex(
        text,
        r'\n\s*if \(validation\.context === "routine"\) \{\n.*?\n\s*\}\n\n\s*if \(validation\.context === "quest"',
        '\n    if (validation.context === "quest"',
        label="routine validated move",
    )

    text = text.replace(
        '{treeContext.type === "focus" ? "Focus" : treeContext.type === "routine" ? "Routine" : treeContext.type === "quest" ? "Quest" : "Empty"}',
        '{treeContext.type === "focus" ? "Focus" : treeContext.type === "quest" ? "Quest" : "Empty"}',
    )

    text = remove_block_regex(
        text,
        r'\n\s*if \(treeContext\.type === "routine" && treeContext\.routine\) \{\n.*?\n\s*return;\n\s*\}\n\n\s*if \(',
        '\n                if (',
        label="routine add task branch",
    )

    text = remove_block_regex(
        text,
        r'\n\s*\{treeContext\.type === "routine" && \(\n\s*<TreeRootNode\n.*?\n\s*</TreeRootNode>\n\s*\)\}\n',
        '\n',
        label="routine tree root render",
    )

    text = remove_block_regex(
        text,
        r'\n\s*if \(treeContext\?\.type === "routine"\) \{\n\s*setTreeSelection\(\{ type: "routineTask", routineId: treeContext\.routine\?\.id, id: task\.id \}\);\n\s*return;\n\s*\}\n',
        '\n',
        label="routine tree select branch",
    )

    text = text.replace("No quest or routine selected.", "No quest selected.")
    return text

def patch_inspector(text):
    text = remove_import_names(text, ["reconcileTodayQuestForRoutine"])
    text = re.sub(r'\nimport RoutineInspector from "\./RoutineInspector";', '', text)

    for line in [
        '  if (type === "routine") return "Routine";\n',
        '  if (type === "routineTask") return "Template Task";\n',
        '  if (type === "routine") return "inspector-title-routine";\n',
        '  if (type === "routineTask") return "inspector-title-routineTask";\n',
        '          routines={data.routines || []}\n',
        '  createRoutineTask,\n',
        '  deleteRoutine,\n',
        '  deleteRoutineTask,\n',
        '  runMaintenanceNow,\n',
    ]:
        text = text.replace(line, '')

    text = remove_block_regex(
        text,
        r'\n\s*if \(selection\.type === "routineTask" && selected\?\.task\) \{\n.*?\n\s*\}\n\n\s*return null;',
        '\n\n  return null;',
        label="routineTask relations",
    )

    text = remove_block_regex(
        text,
        r'\n\s*\{selection\.type === "routine" && selected\?\.routine && \(\n.*?\n\s*\)\}\n\n\s*\{selection\.type === "task"',
        '\n\n      {selection.type === "task"',
        label="routine inspector render",
    )

    text = remove_block_regex(
        text,
        r'\n\s*\{selection\.type === "routineTask" && selected\?\.routine && selected\?\.task && \(\n.*?\n\s*\)\}\n\n\s*\{\(!selected',
        '\n\n      {(!selected',
        label="routineTask inspector render",
    )

    text = remove_block_regex(
        text,
        r'\n\s*if \(selection\.type === "routine"\) \{\n.*?\n\s*\}\n\n\s*if \(selection\.type === "task"\)',
        '\n\n  if (selection.type === "task")',
        label="routine resolve selection",
    )

    text = remove_block_regex(
        text,
        r'\n\s*if \(selection\.type === "routineTask"\) \{\n.*?\n\s*\}\n\n\s*return null;',
        '\n\n  return null;',
        label="routineTask resolve selection",
    )

    text = re.sub(r'\n\s*if \(selection\.type === "routine".*?\n', '\n', text)
    text = re.sub(r'\n\s*if \(selection\.type === "routineTask".*?\n', '\n', text)
    return text

def patch_questboard(text):
    return text.replace('                  {quest.sourceType === "routine" && <span className="pill-blue">Routine</span>}\n', '')

def patch_fileio(text):
    text = re.sub(r'\nexport function makeRoutineFileExport\(routine\) \{\n.*?\n\}\n', '\n', text, flags=re.S)
    text = re.sub(r'\nexport function rawRoutineFromRoutinePayload\(payload\) \{\n.*?\n\}\n', '\n', text, flags=re.S)
    return text

def patch_model(text):
    text = remove_import_names(text, ["isRoutineActiveOnDate"])
    text = remove_import_names(text, ["makeRoutine", "makeRoutineQuestTemplate", "getRoutineTemplateTasks"])
    text = remove_import_names(text, ["createQuestFromRoutine", "syncGeneratedQuestWithRoutine", "reconcileTodayQuestForRoutine"])

    text = re.sub(r',\n\s*routines: \[\n\s*makeRoutine\(\{.*?\n\s*\}\),\n\s*\]', '', text, flags=re.S)

    text = re.sub(
        r'\n\s*const routines = Array\.isArray\(parsed\.routines\)\n.*?\n\s*: \[\];\n',
        '\n',
        text,
        flags=re.S,
    )

    text = text.replace('          locked: quest.locked ?? quest.sourceType === "routine",\n', '')
    text = text.replace('    quests,\n    routines,\n', '    quests,\n')
    text = text.replace('  const routines = data.routines || [];\n\n  return { ...data, quests, routines };', '  return { ...data, quests };')

    text = text.replace('  if (selection.type === "routine") return `routine:${selection.id}`;\n', '')
    text = text.replace('  if (selection.type === "routineTask") return `routineTask:${selection.routineId}:${selection.id}`;\n', '')

    text = re.sub(
        r'\n\s*if \(treeContext\.type === "routine" && selection\.type === "routineTask"\) \{\n.*?\n\s*\}\n',
        '\n',
        text,
        flags=re.S,
    )

    text = re.sub(
        r'\n\s*if \(selection\?\.type === "routine"\) \{\n.*?\n\s*\}\n\n\s*if \(selection\?\.type === "routineTask"\) \{\n.*?\n\s*\}\n\n\s*if \(selection\?\.type === "quest"\)',
        '\n  if (selection?.type === "quest")',
        text,
        flags=re.S,
    )

    text = text.replace('  if (treeContext.type === "routine") return "tree-panel routine-tree";\n', '')
    text = text.replace('  if (treeContext.type === "routine") return "Routine template";\n', '')
    text = text.replace('  if (quest.sourceType === "routine") return "quest-type-routine";', '  if (quest.scheduleType === "routine") return "quest-type-routine";')
    text = text.replace('  if (quest.sourceType === "routine") return "Routine";', '  if (quest.scheduleType === "routine") return "Routine";')

    return text

def patch_inspector_shared(text):
    # This file may still contain old routineTask breadcrumbs. Remove only the routine-specific branches.
    text = re.sub(
        r'\n\s*if \(owner\?\.type === "routine" && setSelection\) \{\n\s*setSelection\(\{ type: "routineTask", routineId: owner\.id, id: child\.id \}\);\n\s*\}\n',
        '\n',
        text,
        flags=re.S,
    )
    text = re.sub(r'\n\s*if \(item\.type === "routine"\) setSelection\(\{ type: "routine", id: item\.id \}\);', '', text)
    text = re.sub(r'\n\s*if \(item\.type === "routineTask"\) setSelection\(\{ type: "routineTask", routineId: item\.routineId, id: item\.id \}\);', '', text)
    return text

def assert_no_old_routine_object_refs():
    # We allow scheduleType "routine", quest-type-routine styling, and isQuestRoutineScheduledToday.
    checks = {
        FILES["app"]: [
            "makeRoutine",
            "reconcileTodayQuestForRoutine",
            "makeRoutineFileExport",
            "rawRoutineFromRoutinePayload",
            "data.routines",
            "selectedRoutineForExport",
            "filteredRoutines",
            "createRoutine",
            "createRoutineTask",
            "deleteRoutine",
            "deleteRoutineTask",
            "moveRoutineTask",
            "moveRoutineTaskToLocation",
            "importRoutineFile",
            "exportRoutineFile",
            'type: "routine"',
            'type: "routineTask"',
        ],
        FILES["tree"]: [
            'treeContext.type === "routine"',
            '"routineTask"',
            "createRoutineTask",
            "deleteRoutineTask",
            "moveRoutineTask",
            "moveRoutineTaskToLocation",
        ],
        FILES["inspector"]: [
            "RoutineInspector",
            "reconcileTodayQuestForRoutine",
            'selection.type === "routine"',
            'selection.type === "routineTask"',
            "data.routines",
            "createRoutineTask",
            "deleteRoutine",
            "deleteRoutineTask",
        ],
        FILES["questboard"]: [
            'sourceType === "routine"',
        ],
        FILES["fileio"]: [
            "makeRoutineFileExport",
            "rawRoutineFromRoutinePayload",
            "routine-template",
        ],
        FILES["model"]: [
            "makeRoutine",
            "makeRoutineQuestTemplate",
            "getRoutineTemplateTasks",
            "createQuestFromRoutine",
            "syncGeneratedQuestWithRoutine",
            "reconcileTodayQuestForRoutine",
            "data.routines",
            'selection.type === "routine"',
            'selection.type === "routineTask"',
            'treeContext.type === "routine"',
            'sourceType === "routine"',
        ],
    }

    failures = []
    for path, needles in checks.items():
        if not path.exists():
            continue
        text = path.read_text()
        for needle in needles:
            if needle in text:
                failures.append(f"{path}: still contains {needle!r}")

    if failures:
        print("\nPotential old routine-object references remain:")
        for item in failures:
            print(" -", item)
        raise SystemExit(1)

def main():
    changed = []

    transformations = [
        (FILES["app"], patch_app),
        (FILES["model"], patch_model),
        (FILES["tree"], patch_tree),
        (FILES["inspector"], patch_inspector),
        (FILES["questboard"], patch_questboard),
        (FILES["fileio"], patch_fileio),
    ]

    for path, transform in transformations:
        text = read(path)
        next_text = transform(text)
        if write_with_backup(path, next_text):
            changed.append(str(path))

    if FILES["inspector_shared"].exists():
        text = FILES["inspector_shared"].read_text()
        next_text = patch_inspector_shared(text)
        if write_with_backup(FILES["inspector_shared"], next_text):
            changed.append(str(FILES["inspector_shared"]))

    # Delete dead routine-object UI files if they still exist.
    for dead_path in [
        ROOT / "src/components/routine-management/RoutineManagementTab.jsx",
        ROOT / "src/components/inspector/RoutineInspector.jsx",
    ]:
        if dead_path.exists():
            backup = dead_path.with_name(dead_path.name + ".bak-routine-cleanup")
            if not backup.exists():
                backup.write_text(dead_path.read_text())
            dead_path.unlink()
            changed.append(str(dead_path) + " (deleted)")

    assert_no_old_routine_object_refs()

    print("Routine-object cleanup complete.")
    if changed:
        print("Changed files:")
        for item in changed:
            print(" -", item)
    else:
        print("No changes were needed.")

if __name__ == "__main__":
    main()
