import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Search,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Target,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";

import {
  STORAGE_KEY,
  LAST_TICK_KEY,
  DEFAULT_TAGS,
  DIFFICULTIES,
  WEEKDAYS,
  EVERY_DAY_MASK,
  MODES,
  COOLDOWN_UNITS,
  newId,
  todayString,
  weekdayBit,
  isRoutineActiveOnDate,
  formatDayMask,
  addDays,
  addMonths,
  addCooldown,
  resetTasks,
  completeTasks,
  resetTaskSubtree,
  makeTask,
  makeQuest,
  makeRoutine,
  cloneTasks,
  createQuestFromRoutine,
  syncGeneratedQuestWithRoutine,
  reconcileTodayQuestForRoutine,
  isTaskComplete,
  hasCountTarget,
  getCountTarget,
  isCountReady,
  getCountProgress,
  getLeafProgressPercent,
  getKanbanTaskTitle,
  getKanbanActionState,
  getKanbanActionTitle,
  areTaskChildrenComplete,
  isTaskReadyToComplete,
  clearAncestorCompletionById,
  isQuestComplete,
  isQuestReadyToComplete,
  getTaskCounts,
  getTaskProgress,
  getQuestProgress,
  nextTasksInList,
  nextTasksFromTask,
  nextTasksForQuest,
  flattenQuestTree,
  readyBranchRows,
  countLeafProgress,
  buildFocusBoardFromRoot,
  buildFocusBoard,
  makeQuestCompletionCard,
  addQuestCompletionCard,
  getBranchFocusInfo,
  getFocusPathInfo,
  getChildBranches,
  SAMPLE_TASK_DESCRIPTIONS,
  normalizeTasks,
  findTask,
  findTaskPath,
  getTaskAncestry,
  updateQuestTree,
  addTaskToTree,
  deleteTaskFromTree,
  moveTaskInTree,
  seedData,
  normalizeData,
  runDailyMaintenance,
  selectionKey,
  isTreeTaskSelected,
  getTreeContext,
  treeModeClass,
  treeModeLabel,
  questTypeClass,
  questTypeLabel,
} from "./models/appModel";

export default function App() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let loaded = seedData;

    if (saved) {
      try {
        loaded = normalizeData(JSON.parse(saved));
      } catch {
        loaded = seedData;
      }
    }

    const maintained = runDailyMaintenance(loaded);
    localStorage.setItem(LAST_TICK_KEY, todayString());
    return maintained;
  });

  const [libraryTab, setLibraryTab] = useState("quests");
  const [selection, setSelectionRaw] = useState({ type: "quest", id: data.activeQuestId || data.quests[0]?.id || null });
  const [history, setHistory] = useState([{ type: "quest", id: data.activeQuestId || data.quests[0]?.id || null }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("All");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [treeEditMode, setTreeEditMode] = useState(false);
  const [rightSplit, setRightSplit] = useState(62);
  const [leftPanelWidth, setLeftPanelWidth] = useState(360);
  const [rightPanelWidth, setRightPanelWidth] = useState(430);
  const [expandedKanbanCards, setExpandedKanbanCards] = useState({});

  const quests = data.quests || [];
  const routines = data.routines || [];
  const activeQuest = quests.find((quest) => quest.id === data.activeQuestId) || quests[0] || null;
  const focusPathInfo = getFocusPathInfo(activeQuest, data.activeBranchTaskId);
  const actionable = nextTasksInList(focusPathInfo.root?.tasks || [], focusPathInfo.root?.mode || "all");
  const focusBoard = addQuestCompletionCard(
    buildFocusBoardFromRoot(focusPathInfo.root),
    activeQuest
  );

  function setSelection(next) {
    setSelectionRaw(next);

    setHistory((old) => {
      const trimmed = old.slice(0, historyIndex + 1);
      const last = trimmed[trimmed.length - 1];

      if (selectionKey(last) === selectionKey(next)) return old;

      const nextHistory = [...trimmed, next];
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }

  function goBack() {
    if (historyIndex <= 0) return;
    const i = historyIndex - 1;
    setHistoryIndex(i);
    setSelectionRaw(history[i]);
  }

  function goForward() {
    if (historyIndex >= history.length - 1) return;
    const i = historyIndex + 1;
    setHistoryIndex(i);
    setSelectionRaw(history[i]);
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayString();
      const lastTick = localStorage.getItem(LAST_TICK_KEY);

      if (lastTick !== today) {
        setData((old) => runDailyMaintenance(old));
        localStorage.setItem(LAST_TICK_KEY, today);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set(DEFAULT_TAGS);
    quests.forEach((quest) => (quest.tags || []).forEach((tag) => set.add(tag)));
    routines.forEach((routine) => (routine.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [quests, routines]);

  const filteredQuests = useMemo(() => {
    return quests
      .filter((quest) => {
        const text = `${quest.title} ${quest.description} ${(quest.tags || []).join(" ")}`.toLowerCase();
        return (
          text.includes(search.toLowerCase()) &&
          (tagFilter === "All" || (quest.tags || []).includes(tagFilter)) &&
          (!hideCompleted || !isQuestComplete(quest))
        );
      })
      .sort((a, b) => {
        const completeCompare = Number(isQuestComplete(a)) - Number(isQuestComplete(b));
        if (completeCompare !== 0) return completeCompare;
        return (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99") || a.title.localeCompare(b.title);
      });
  }, [quests, search, tagFilter, hideCompleted]);

  const filteredRoutines = useMemo(() => {
    return routines
      .filter((routine) => {
        const text = `${routine.title} ${routine.description} ${(routine.tags || []).join(" ")}`.toLowerCase();
        return text.includes(search.toLowerCase()) && (tagFilter === "All" || (routine.tags || []).includes(tagFilter));
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [routines, search, tagFilter]);

  function createQuest() {
    const quest = makeQuest({ title: "New Quest" });
    setData((old) => ({ ...old, quests: [quest, ...old.quests] }));
    setSelection({ type: "quest", id: quest.id });
  }

  function createRoutine() {
    const routine = makeRoutine({ title: "New Routine" });
    setData((old) => ({ ...old, routines: [routine, ...old.routines] }));
    setSelection({ type: "routine", id: routine.id });
  }

  
function createQuestTask(questId, parentId = null) {
    const task = makeTask({ title: "New Task" });

    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              status: "active",
              completedAt: "",
              rootTask: {
                ...quest.rootTask,
                completed: false,
                children: addTaskToTree(quest.rootTask?.children || [], parentId, task),
              },
            }
          : quest
      ),
    }));

    if (parentId) setExpanded((old) => ({ ...old, [parentId]: true }));
    setSelection({ type: "task", questId, id: task.id });
  }

  function createRoutineTask(routineId, parentId = null) {
    const task = makeTask({ title: "New Task" });

    setData((old) => {
      let updatedRoutine = null;
      const routines = old.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        updatedRoutine = { ...routine, taskTemplate: addTaskToTree(routine.taskTemplate, parentId, task) };
        return updatedRoutine;
      });

      return {
        ...old,
        routines,
        quests: updatedRoutine
          ? reconcileTodayQuestForRoutine(old.quests, updatedRoutine)
          : old.quests,
      };
    });

    if (parentId) setExpanded((old) => ({ ...old, [parentId]: true }));
    setSelection({ type: "routineTask", routineId, id: task.id });
  }

  function deleteQuest(questId) {
    setData((old) => {
      const quests = old.quests.filter((quest) => quest.id !== questId);
      return {
        ...old,
        quests,
        activeQuestId: old.activeQuestId === questId ? quests[0]?.id || null : old.activeQuestId,
        activeBranchTaskId: old.activeQuestId === questId ? null : old.activeBranchTaskId,
      };
    });

    setSelection({ type: "none" });
  }

  function deleteRoutine(routineId) {
    setData((old) => ({
      ...old,
      quests: old.quests.filter((quest) => quest.routineId !== routineId),
      routines: old.routines.filter((routine) => routine.id !== routineId),
    }));

    setSelection({ type: "none" });
  }

  
function deleteQuestTask(questId, taskId) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              status: "active",
              completedAt: "",
              rootTask: {
                ...quest.rootTask,
                completed: false,
                children: deleteTaskFromTree(quest.rootTask?.children || [], taskId),
              },
            }
          : quest
      ),
    }));

    setSelection({ type: "quest", id: questId });
  }

  function deleteRoutineTask(routineId, taskId) {
    setData((old) => {
      let updatedRoutine = null;
      const routines = old.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        updatedRoutine = { ...routine, taskTemplate: deleteTaskFromTree(routine.taskTemplate, taskId) };
        return updatedRoutine;
      });

      return {
        ...old,
        routines,
        quests: updatedRoutine
          ? reconcileTodayQuestForRoutine(old.quests, updatedRoutine)
          : old.quests,
      };
    });

    setSelection({ type: "routine", id: routineId });
  }

  
function moveQuestTask(questId, taskId, direction) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              rootTask: {
                ...quest.rootTask,
                children: moveTaskInTree(quest.rootTask?.children || [], taskId, direction),
              },
            }
          : quest
      ),
    }));
  }

  function moveRoutineTask(routineId, taskId, direction) {
    setData((old) => {
      let updatedRoutine = null;
      const routines = old.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        updatedRoutine = { ...routine, taskTemplate: moveTaskInTree(routine.taskTemplate, taskId, direction) };
        return updatedRoutine;
      });

      return {
        ...old,
        routines,
        quests: updatedRoutine
          ? reconcileTodayQuestForRoutine(old.quests, updatedRoutine)
          : old.quests,
      };
    });
  }

  
function toggleTask(questId, taskId) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;

        const rootTask = quest.rootTask;
        if (!rootTask) return quest;

        if (rootTask.id === taskId) {
          if (!isTaskComplete(rootTask) && !isTaskReadyToComplete(rootTask)) return quest;

          const completed = !isTaskComplete(rootTask);
          return {
            ...quest,
            status: completed ? "completed" : "active",
            completedAt: completed ? todayString() : "",
            rootTask: {
              ...rootTask,
              completed,
              countProgress: 0,
            },
          };
        }

        let nextCompleted = null;
        let children = updateQuestTree(rootTask.children || [], taskId, (task) => {
          const taskChildren = task.children || [];
          if (taskChildren.length > 0 && !areTaskChildrenComplete(task)) return task;

          if (hasCountTarget(task) && !task.completed) {
            const { target, progress } = getCountProgress(task);

            if (progress < target) {
              nextCompleted = null;
              return {
                ...task,
                countProgress: Math.min(target, progress + 1),
                completed: false,
              };
            }

            nextCompleted = true;
            return {
              ...task,
              completed: true,
              countProgress: target,
            };
          }

          nextCompleted = !task.completed;
          return {
            ...task,
            completed: nextCompleted,
            countProgress: nextCompleted ? getCountProgress(task).progress : 0,
          };
        });

        if (nextCompleted === false) {
          children = clearAncestorCompletionById(children, taskId);
        }

        return {
          ...quest,
          status: "active",
          completedAt: "",
          rootTask: {
            ...rootTask,
            completed: false,
            children,
          },
        };
      }),
    }));
  }

  
function uncompleteTask(questId, taskId) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;

        const rootTask = quest.rootTask;
        if (!rootTask) return quest;

        if (rootTask.id === taskId) {
          return {
            ...quest,
            status: "active",
            completedAt: "",
            rootTask: resetTaskSubtree(rootTask),
          };
        }

        const resetTasksForTarget = updateQuestTree(rootTask.children || [], taskId, (task) => resetTaskSubtree(task));
        const children = clearAncestorCompletionById(resetTasksForTarget, taskId);

        return {
          ...quest,
          status: "active",
          completedAt: "",
          rootTask: {
            ...rootTask,
            completed: false,
            children,
          },
        };
      }),
    }));
  }

  function makeFocus(questId) {
    setData((old) => ({ ...old, activeQuestId: questId, activeBranchTaskId: null }));
  }

  function setBranchFocus(taskId) {
    setData((old) => ({ ...old, activeBranchTaskId: taskId }));
  }

  function clearBranchFocus() {
    setData((old) => ({ ...old, activeBranchTaskId: null }));
  }

  
function completeQuest(questId) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) => {
        if (quest.id !== questId) return quest;
        if (!isQuestReadyToComplete(quest)) return quest;

        return {
          ...quest,
          status: "completed",
          completedAt: todayString(),
          rootTask: {
            ...quest.rootTask,
            completed: true,
          },
        };
      }),
    }));
  }

  
function restoreQuest(questId) {
    setData((old) => ({
      ...old,
      quests: old.quests.map((quest) =>
        quest.id === questId
          ? {
              ...quest,
              status: "active",
              completedAt: "",
              rootTask: resetTaskSubtree(quest.rootTask),
            }
          : quest
      ),
    }));
  }

  function exportJson() {
    const payload = {
      app: "quest-planner",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = todayString();
    anchor.href = url;
    anchor.download = `quest-planner-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function importJsonFile(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const rawData = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
        const imported = runDailyMaintenance(normalizeData(rawData));

        setData(imported);
        setSelection({ type: "quest", id: imported.activeQuestId || imported.quests[0]?.id || null });
        setHistory([{ type: "quest", id: imported.activeQuestId || imported.quests[0]?.id || null }]);
        setHistoryIndex(0);
        setExpanded({});
        setTreeEditMode(false);
        setExpandedKanbanCards({});
        localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
        localStorage.setItem(LAST_TICK_KEY, todayString());
      } catch (error) {
        window.alert("Could not load that JSON file. It may not be a valid quest planner export.");
      }
    };

    reader.readAsText(file);
  }

  function resetToDefaults() {
    const confirmed = window.confirm("Reset all quests and routines to the default state? This clears the saved app data in this browser.");
    if (!confirmed) return;

    const resetData = runDailyMaintenance(normalizeData(seedData));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_TICK_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetData));
    localStorage.setItem(LAST_TICK_KEY, todayString());

    setData(resetData);
    setSelection({ type: "quest", id: resetData.activeQuestId || resetData.quests[0]?.id || null });
    setHistory([{ type: "quest", id: resetData.activeQuestId || resetData.quests[0]?.id || null }]);
    setHistoryIndex(0);
    setExpanded({});
    setTreeEditMode(false);
    setExpandedKanbanCards({});
  }

  function runMaintenanceNow() {
    setData((old) => runDailyMaintenance(old));
    localStorage.setItem(LAST_TICK_KEY, todayString());
  }

  function dueBadge(item) {
    const today = todayString();
    if (!item?.deadline) return null;
    if (item.deadline < today) return <span className="badge bg-red-950 text-red-200">Overdue</span>;
    if (item.deadline === today) return <span className="badge bg-amber-950 text-amber-200">Today</span>;
    return <span className="badge bg-neutral-800 text-neutral-300">Due {item.deadline}</span>;
  }

  function beginLeftPanelDrag(event) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = leftPanelWidth;

    function onMove(moveEvent) {
      const delta = moveEvent.clientX - startX;
      const next = Math.min(520, Math.max(240, startWidth + delta));
      setLeftPanelWidth(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function beginRightPanelDrag(event) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = rightPanelWidth;

    function onMove(moveEvent) {
      const delta = startX - moveEvent.clientX;
      const next = Math.min(620, Math.max(320, startWidth + delta));
      setRightPanelWidth(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="h-screen overflow-hidden bg-neutral-950 p-4 text-neutral-100">
      <div className="app-root">
        <LibraryPanel
          panelWidth={leftPanelWidth}
          tab={libraryTab}
          setTab={setLibraryTab}
          search={search}
          setSearch={setSearch}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          allTags={allTags}
          hideCompleted={hideCompleted}
          setHideCompleted={setHideCompleted}
          quests={filteredQuests}
          routines={filteredRoutines}
          activeQuestId={data.activeQuestId}
          dueBadge={dueBadge}
          createQuest={createQuest}
          createRoutine={createRoutine}
          exportJson={exportJson}
          importJsonFile={importJsonFile}
          resetToDefaults={resetToDefaults}
          selectQuest={(quest) => setSelection({ type: "quest", id: quest.id })}
          selectRoutine={(routine) => setSelection({ type: "routine", id: routine.id })}
        />

        <div
          className="column-splitter"
          onPointerDown={beginLeftPanelDrag}
          title="Drag to resize Library"
        />

        <FocusPanel
          quest={activeQuest}
          actionable={actionable}
          focusBoard={focusBoard}
          focusPathInfo={focusPathInfo}
          branchFocusId={data.activeBranchTaskId}
          setBranchFocus={setBranchFocus}
          clearBranchFocus={clearBranchFocus}
          dueBadge={dueBadge}
          selectQuest={(quest) => setSelection({ type: "quest", id: quest.id })}
          selectTask={(task) => setSelection({ type: "task", questId: activeQuest.id, id: task.id })}
          toggleTask={(rowOrTask) => {
            const task = rowOrTask.task || rowOrTask;
            return ((rowOrTask.kind === "questCompletion" || rowOrTask.kind === "rootTask") || rowOrTask.kind === "rootTask")
              ? completeQuest(activeQuest.id)
              : toggleTask(activeQuest.id, task.id);
          }}
          uncompleteTask={(rowOrTask) => {
            const task = rowOrTask.task || rowOrTask;
            return ((rowOrTask.kind === "questCompletion" || rowOrTask.kind === "rootTask") || rowOrTask.kind === "rootTask")
              ? restoreQuest(activeQuest.id)
              : uncompleteTask(activeQuest.id, task.id);
          }}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
        />


        <div
          className="column-splitter"
          onPointerDown={beginRightPanelDrag}
          title="Drag to resize Inspector / Tree column"
        />
        <RightPanel
          panelWidth={rightPanelWidth}
          selection={selection}
          data={data}
          setData={setData}
          setSelection={setSelection}
          allTags={allTags}
          activeQuest={activeQuest}
          activeQuestId={data.activeQuestId}
          expanded={expanded}
          setExpanded={setExpanded}
          treeEditMode={treeEditMode}
          setTreeEditMode={setTreeEditMode}
          rightSplit={rightSplit}
          setRightSplit={setRightSplit}
          goBack={goBack}
          goForward={goForward}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < history.length - 1}
          makeFocus={makeFocus}
          activeQuestId={data.activeQuestId}
          activeBranchTaskId={data.activeBranchTaskId}
          setBranchFocus={setBranchFocus}
          clearBranchFocus={clearBranchFocus}
          completeQuest={completeQuest}
          restoreQuest={restoreQuest}
          createQuestTask={createQuestTask}
          createRoutineTask={createRoutineTask}
          deleteQuest={deleteQuest}
          deleteRoutine={deleteRoutine}
          deleteQuestTask={deleteQuestTask}
          deleteRoutineTask={deleteRoutineTask}
          moveQuestTask={moveQuestTask}
          moveRoutineTask={moveRoutineTask}
          toggleTask={toggleTask}
          runMaintenanceNow={runMaintenanceNow}
        />
      </div>

      <DarkStyles />
    </div>
  );
}

function LibraryPanel({
  panelWidth,
  tab,
  setTab,
  search,
  setSearch,
  tagFilter,
  setTagFilter,
  allTags,
  hideCompleted,
  setHideCompleted,
  quests,
  routines,
  activeQuestId,
  dueBadge,
  createQuest,
  createRoutine,
  exportJson,
  importJsonFile,
  resetToDefaults,
  selectQuest,
  selectRoutine,
}) {
  return (
    <section className="panel panel-scroll library-col" style={{ flexBasis: `${panelWidth}px` }}>
      <LibraryTabBar tab={tab} setTab={setTab} />
      <div className="panel-content">
        {tab !== "save" && (
          <>
            <div className="mt-4 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
                <input className="field py-2 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="" />
              </div>

              <select className="field py-2" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option>All</option>
                {allTags.map((tag) => <option key={tag}>{tag}</option>)}
              </select>

              {tab === "quests" && (
                <label className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
                  <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
                  Hide complete
                </label>
              )}
            </div>

            <div className="mt-4">
              {tab === "quests" ? (
                <button onClick={createQuest} className="primary-button w-full"><Plus size={18} /> New quest</button>
              ) : (
                <button onClick={createRoutine} className="primary-button w-full"><Plus size={18} /> New routine</button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {tab === "quests" && quests.map((quest) => (
                <button
                  key={quest.id}
                  onClick={() => selectQuest(quest)}
                  className={`library-card text-left ${questTypeClass(quest)} ${isQuestComplete(quest) ? "library-card-complete" : ""} ${quest.id === activeQuestId ? "border-neutral-300 bg-neutral-800" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold">{quest.title}</div>
                    {dueBadge(quest)}
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full bg-slate-200" style={{ width: `${getQuestProgress(quest)}%` }} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {isQuestComplete(quest) && <span className="pill-complete">Completed</span>}
                    {(quest.tags || []).map((tag) => <span key={tag} className="pill">{tag}</span>)}
                    {quest.sourceType === "routine" && <span className="pill-blue">Routine</span>}
                  </div>
                </button>
              ))}

              {tab === "routines" && routines.map((routine) => (
                <button key={routine.id} onClick={() => selectRoutine(routine)} className="library-card text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold">{routine.title}</div>
                    <span className={routine.active ? "pill-green" : "pill-red"}>{routine.active ? "Active" : "Paused"}</span>
                  </div>

                  <div className="mt-1 text-sm text-neutral-400">{formatDayMask(routine.dayMask)}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(routine.tags || []).map((tag) => <span key={tag} className="pill">{tag}</span>)}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "save" && (
          <div className="mt-4 space-y-3">
            <button type="button" onClick={exportJson} className="primary-button w-full justify-center">Export JSON</button>
            <label className="primary-button w-full cursor-pointer justify-center">
              Load JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  importJsonFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <button type="button" onClick={resetToDefaults} className="danger-button w-full justify-center">Reset to defaults</button>
            <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
              Export creates a backup file of your quests and routines. Load replaces the current app state with the selected JSON file. Reset clears saved data and restores the default quests/routines.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FocusPanel({ quest, actionable, focusBoard, focusPathInfo, branchFocusId, setBranchFocus, clearBranchFocus, dueBadge, selectQuest, selectTask, toggleTask, uncompleteTask, expandedKanbanCards, setExpandedKanbanCards }) {
  if (!quest) {
    return (
      <main className="panel panel-scroll focus-col">
        <PanelTitleBar title="Current Focus" />
        <div className="panel-content text-neutral-400">Create or select a quest, then make it the current focus.</div>
      </main>
    );
  }

  return (
    <main className="panel panel-scroll focus-col">
      <PanelTitleBar title="Current Focus" />
      <div className="panel-content focus-panel-content">
      <FocusDocumentHeader
        quest={quest}
        focusPathInfo={focusPathInfo}
        selectQuest={selectQuest}
        selectTask={selectTask}
        setBranchFocus={setBranchFocus}
        clearBranchFocus={clearBranchFocus}
      />

      {focusBoard.available.some((row) => (row.kind === "questCompletion" || row.kind === "rootTask") || row.kind === "rootTask") || isQuestComplete(quest) ? (
        <div className="complete-quest-celebration">
          <button
            onClick={() => {
              const completionRow = focusBoard.available.find((row) => (row.kind === "questCompletion" || row.kind === "rootTask") || row.kind === "rootTask");
              if (completionRow) toggleTask(completionRow);
            }}
            className={isQuestComplete(quest) ? "recommended-complete-quest-button recommended-complete-quest-button-done" : "recommended-complete-quest-button"}
            disabled={isQuestComplete(quest)}
          >
            <span className="complete-quest-icon">◆</span>
            <span className="complete-quest-label">{isQuestComplete(quest) ? "Quest completed" : "Complete quest"}</span>
            <span className="complete-quest-icon">◆</span>
          </button>
        </div>
      ) : (
        <section className="mt-5 focus-recommend-panel">
          <h3 className="text-lg font-bold">Recommended</h3>
          {focusBoard.recommended ? (
            <div className="recommended-task-row">
              <div className="recommended-task-text">
                <FocusPathLinks row={focusBoard.recommended} selectTask={selectTask} />
                {focusBoard.recommended.task.description && (
                  <div className="mt-1 text-sm text-neutral-400">{focusBoard.recommended.task.description}</div>
                )}
              </div>
              <button onClick={() => toggleTask(focusBoard.recommended)} className="primary-button recommended-action-button">
                {getKanbanActionState(focusBoard.recommended.task) === "progress" ? <Play size={16} /> : <CheckCircle2 size={16} />}
                {getKanbanActionState(focusBoard.recommended.task) === "progress" ? "Progress" : "Complete"}
              </button>
            </div>
          ) : (
            <div className="mt-2 text-sm text-neutral-500">No available task. This quest may be complete.</div>
          )}
        </section>
      )}

      <div className="branch-progress-line">
        <div className="branch-progress-label">
          <span>Progress</span>
          <span>{Number.isFinite(focusPathInfo.progress) ? focusPathInfo.progress : 0}%</span>
        </div>
        <div className="branch-progress-track">
          <div className="branch-progress-fill" style={{ width: `${Number.isFinite(focusPathInfo.progress) ? focusPathInfo.progress : 0}%` }} />
        </div>
      </div>

      <section className="mt-5 focus-board">
        <FocusColumn
          title="Available"
          rows={focusBoard.available}
          emptyText="No available tasks."
          selectTask={selectTask}
          toggleTask={toggleTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          showCompleteButton
        />
        <FocusColumn
          title="In Progress"
          rows={focusBoard.inProgress}
          emptyText="No parent tasks in progress."
          selectTask={selectTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          showProgress
        />
        <FocusColumn
          title="Completed"
          rows={focusBoard.completed}
          emptyText="Nothing completed yet."
          selectTask={selectTask}
          uncompleteTask={uncompleteTask}
          expandedKanbanCards={expandedKanbanCards}
          setExpandedKanbanCards={setExpandedKanbanCards}
          completed
          showUncompleteButton
          summary={`${focusBoard.completedCount} / ${focusBoard.totalCount}`}
        />
      </section>
      </div>
    </main>
  );
}

function getFocusDisplayNode(quest, focusPathInfo) {
  if (!quest) return null;
  return focusPathInfo?.branchTask || quest;
}

function getFocusDisplayPath(quest, focusPathInfo) {
  if (!quest) return [];

  return [
    { id: quest.id, title: quest.title || "Untitled quest", type: "quest" },
    ...(focusPathInfo?.path || []).map((task) => ({
      id: task.id,
      title: task.title || "Untitled",
      type: "task",
    })),
  ];
}

function FocusDirectoryPath({ quest, focusPathInfo, selectQuest, setBranchFocus, clearBranchFocus }) {
  const items = getFocusDisplayPath(quest, focusPathInfo);

  return (
    <div className="focus-directory-path">
      <span className="focus-relation-label">Path:</span>
      {items.map((item, index) => (
        <React.Fragment key={`${item.type}-${item.id}`}>
          {index > 0 && <span className="focus-directory-separator">›</span>}
          <button
            className="focus-directory-link"
            onClick={() => {
              if (item.type === "quest") {
                clearBranchFocus();
              } else {
                setBranchFocus(item.id);
              }
            }}
          >
            {item.title}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function FocusRelations({ quest, focusPathInfo, setBranchFocus, clearBranchFocus, selectQuest }) {
  const childBranches = focusPathInfo?.childBranches || [];
  return (
    <div className="focus-relations">

      <div className="focus-relation-line">
        <span className="focus-relation-label">Subquests:</span>
        {childBranches.length === 0 && <span className="focus-relation-muted">No subquests</span>}
        {childBranches.map((task) => (
          <button type="button" key={task.id} className="focus-relation-chip" onClick={() => setBranchFocus(task.id)}>
            {task.title || "Untitled"}
          </button>
        ))}
      </div>
    </div>
  );
}

function FocusDocumentHeader({ quest, focusPathInfo, selectQuest, selectTask, setBranchFocus, clearBranchFocus }) {
  const displayNode = getFocusDisplayNode(quest, focusPathInfo);
  const description = displayNode?.description || "";

  return (
    <div className="focus-document-header">
      <button
        className="focus-document-title focus-document-title-button"
        onClick={() => {
          if (focusPathInfo?.branchTask) {
            selectTask(focusPathInfo.branchTask);
          } else {
            selectQuest(quest);
          }
        }}
        title="Select in inspector"
      >
        {displayNode?.title || "Untitled"}
      </button>

      {(focusPathInfo?.path || []).length > 0 && (
        <FocusDirectoryPath
          quest={quest}
          focusPathInfo={focusPathInfo}
          selectQuest={selectQuest}
          setBranchFocus={setBranchFocus}
          clearBranchFocus={clearBranchFocus}
        />
      )}

      <FocusRelations
        quest={quest}
        focusPathInfo={focusPathInfo}
        setBranchFocus={setBranchFocus}
        clearBranchFocus={clearBranchFocus}
        selectQuest={selectQuest}
      />

      {description.trim() !== "" && (
        <div className="focus-description-section">
          <h3 className="focus-description-title">Description</h3>
          <p className="focus-description-text">{description}</p>
        </div>
      )}
    </div>
  );
}

function FocusPathTitle({ quest, focusPathInfo, selectQuest, setBranchFocus, clearBranchFocus }) {
  const pathItems = focusPathInfo?.path || [];

  return (
    <div className="focus-path-title">
      <button onClick={() => { clearBranchFocus(); selectQuest(quest); }} className="focus-path-title-link">
        {quest.title || "Untitled quest"}
      </button>
      {pathItems.map((task) => (
        <React.Fragment key={task.id}>
          <span className="focus-path-title-separator">›</span>
          <button onClick={() => setBranchFocus(task.id)} className="focus-path-title-link">
            {task.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function FocusBranchNav({ focusPathInfo, setBranchFocus }) {
  const childBranches = focusPathInfo?.childBranches || [];

  return (
    <div className="focus-branch-nav">
      <span className="focus-branch-label">Child branches:</span>
      {childBranches.length === 0 && <span className="focus-nav-muted">None</span>}
      {childBranches.map((task) => (
        <button key={task.id} className="focus-nav-chip" onClick={() => setBranchFocus(task.id)}>
          {task.title || "Untitled"}
        </button>
      ))}
    </div>
  );
}

function FocusNavigation({ quest, focusPathInfo, setBranchFocus, clearBranchFocus }) {
  if (!quest) return null;

  const childBranches = focusPathInfo?.childBranches || [];
  const pathItems = focusPathInfo?.path || [];

  return (
    <section className="focus-nav">
      <div className="focus-nav-line">
        <span className="focus-nav-label">Focus Root:</span>
        <button className="focus-nav-link" onClick={clearBranchFocus}>{quest.title || "Untitled quest"}</button>
        {pathItems.map((task) => (
          <React.Fragment key={task.id}>
            <span className="focus-nav-separator">›</span>
            <button className="focus-nav-link" onClick={() => setBranchFocus(task.id)}>
              {task.title || "Untitled"}
            </button>
          </React.Fragment>
        ))}
      </div>

      {focusPathInfo?.branchTask && (
        <div className="focus-nav-line">
          <span className="focus-nav-label">Up:</span>
          {focusPathInfo.parent ? (
            <button className="focus-nav-link" onClick={() => setBranchFocus(focusPathInfo.parent.id)}>
              {focusPathInfo.parent.title || "Untitled"}
            </button>
          ) : (
            <button className="focus-nav-link" onClick={clearBranchFocus}>{quest.title || "Untitled quest"}</button>
          )}
        </div>
      )}

      <div className="focus-nav-line">
        <span className="focus-nav-label">Child Branches:</span>
        {childBranches.length === 0 && <span className="focus-nav-muted">None</span>}
        {childBranches.map((task) => (
          <button key={task.id} className="focus-nav-chip" onClick={() => setBranchFocus(task.id)}>
            {task.title || "Untitled"}
          </button>
        ))}
      </div>
    </section>
  );
}

function FocusPathLinks({ row, selectTask }) {
  return (
    <div className="focus-path-links">
      {row.path.map((task, index) => (
        <React.Fragment key={task.id}>
          {index > 0 && <span className="focus-path-separator">›</span>}
          <button
            className="focus-path-link"
            onClick={(event) => {
              event.stopPropagation();
              if ((row.kind !== "questCompletion" && row.kind !== "rootTask")) selectTask(task);
            }}
            title="Select in inspector"
          >
            {index === row.path.length - 1 && row.displayTitle ? row.displayTitle : task.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function FocusColumn({
  title,
  rows,
  emptyText,
  selectTask,
  toggleTask,
  uncompleteTask,
  expandedKanbanCards = {},
  setExpandedKanbanCards,
  showCompleteButton = false,
  showUncompleteButton = false,
  showProgress = false,
  completed = false,
  summary = null,
}) {
  return (
    <div className="focus-column">
      <div className="focus-column-title">
        <span>{title}</span>
        <span className="focus-column-count">{summary || rows.length}</span>
      </div>

      <div className="focus-column-list">
        {rows.length === 0 && <div className="focus-empty">{emptyText}</div>}

        {rows.map((row) => {
          const hasDescription = Boolean((row.task.description || "").trim());
          const expanded = Boolean(expandedKanbanCards[row.task.id]);

          return (
            <div
              key={row.task.id}
              className={completed ? "focus-card focus-card-complete" : "focus-card"}
            >
              <div
                className="focus-card-bar"
                onClick={() => (row.kind !== "questCompletion" && row.kind !== "rootTask") && selectTask(row.task)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if ((row.kind !== "questCompletion" && row.kind !== "rootTask")) selectTask(row.task);
                  }
                }}
              >
                <div className="focus-card-main">
                  <div className="focus-card-title-line">
                    {hasDescription && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedKanbanCards?.((old) => ({ ...old, [row.task.id]: !old[row.task.id] }));
                        }}
                        className="focus-card-done focus-card-dropdown"
                        title={expanded ? "Hide description" : "Show description"}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                    <FocusPathLinks row={row} selectTask={selectTask} />
                  </div>
                  {showProgress && row.progress && (
                    <div className="focus-card-progress-bar" title={`${row.progress.complete} / ${row.progress.total}`}>
                      <div
                        className="focus-card-progress-fill"
                        style={{ width: `${row.progress.total > 0 ? Math.round((row.progress.complete / row.progress.total) * 100) : 0}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="focus-card-actions">
                  {showCompleteButton && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleTask(row);
                      }}
                      className={`focus-card-done ${getKanbanActionState(row.task) === "progress" ? "focus-card-action-progress" : "focus-card-action-complete"}`}
                      title={getKanbanActionTitle(row.task)}
                    >
                      {getKanbanActionState(row.task) === "progress" ? <Play size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  )}

                  {showUncompleteButton && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        uncompleteTask(row);
                      }}
                      className="focus-card-done focus-card-action-uncomplete"
                      title="Mark incomplete"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {hasCountTarget(row.task) && !row.task.completed && (
                <div className="focus-card-progress-bar focus-card-progress-full" title={`${getCountProgress(row.task).progress} / ${getCountProgress(row.task).target}`}>
                  <div
                    className="focus-card-progress-fill"
                    style={{ width: `${getLeafProgressPercent(row.task)}%` }}
                  />
                </div>
              )}

              {hasDescription && expanded && (
                <div className="focus-card-body">
                  {row.task.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RightPanel(props) {
  const {
    panelWidth,
    selection,
    data,
    activeQuest,
    expanded,
    setExpanded,
    treeEditMode,
    setTreeEditMode,
    rightSplit,
    setRightSplit,
    setSelection,
    createQuestTask,
    createRoutineTask,
    deleteQuestTask,
    deleteRoutineTask,
    moveQuestTask,
    moveRoutineTask,
    toggleTask,
  } = props;

  const treeContext = getTreeContext(selection, data, activeQuest);
  const effectiveTreeEditMode = treeContext.quest?.locked ? false : treeEditMode;
  const rightColumnRef = useRef(null);

  function beginRightSplitDrag(event) {
    event.preventDefault();

    const startY = event.clientY;
    const startSplit = rightSplit;
    const rect = rightColumnRef.current?.getBoundingClientRect();
    const totalHeight = rect?.height || 1;

    function onMove(moveEvent) {
      const delta = moveEvent.clientY - startY;
      const deltaPercent = (delta / totalHeight) * 100;
      const next = Math.min(82, Math.max(28, startSplit + deltaPercent));
      setRightSplit(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <aside className="right-column" ref={rightColumnRef} style={{ flexBasis: `${panelWidth}px` }}>
      <section
        className="panel panel-scroll inspector-panel"
        style={{ flexBasis: `${rightSplit}%` }}
      >
        <InspectorTitleBar {...props} />
        <div className="panel-content">
          <Inspector {...props} />
        </div>
      </section>

      <div
        className="right-splitter"
        onPointerDown={beginRightSplitDrag}
        title="Drag to resize Inspector / Tree View"
      />

      <section
        className={`panel panel-scroll ${treeModeClass(treeContext)}`}
        style={{ flexBasis: `${100 - rightSplit}%` }}
      >
        <PanelTitleBar title="Tree View">
          {effectiveTreeEditMode && treeContext.type === "routine" && (
            <button onClick={() => createRoutineTask(treeContext.routine.id, null)} className="title-secondary-button">+ Task</button>
          )}
          {effectiveTreeEditMode && (treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && !treeContext.quest.locked && (
            <button onClick={() => createQuestTask(treeContext.quest.id, null)} className="title-secondary-button">+ Task</button>
          )}
          <button
            onClick={() => !treeContext.quest?.locked && setTreeEditMode(!treeEditMode)}
            disabled={Boolean(treeContext.quest?.locked)}
            className={treeContext.quest?.locked ? "title-secondary-button title-button-disabled" : effectiveTreeEditMode ? "title-primary-button" : "title-secondary-button"}
            title={treeContext.quest?.locked ? "Routine-generated quests are read-only. Edit the source routine instead." : "Edit tree"}
          >
            {effectiveTreeEditMode ? "Done" : "Edit"}
          </button>
        </PanelTitleBar>
        <div className="panel-content">

        {treeContext.type === "routine" && (
          <TreeRootRow
            title={treeContext.routine.title}
            kind="routine"
            selected={selection.type === "routine" && selection.id === treeContext.routine.id}
            onSelect={() => !treeEditMode && setSelection({ type: "routine", id: treeContext.routine.id })}
          />
        )}

        {(treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && (
          <TreeRootRow
            title={treeContext.quest.title}
            kind={`root-${treeContext.type === "focus" ? questTypeClass(treeContext.quest) : questTypeClass(treeContext.quest)}`}
            selected={selection.type === "quest" && selection.id === treeContext.quest.id}
            onSelect={() => !treeEditMode && setSelection({ type: "quest", id: treeContext.quest.id })}
          />
        )}

        {treeContext.type === "routine" && (
          <QuestTree
            tasks={treeContext.routine.taskTemplate}
            expanded={expanded}
            setExpanded={setExpanded}
            onSelect={(task) => setSelection({ type: "routineTask", routineId: treeContext.routine.id, id: task.id })}
            onAddChild={(task) => createRoutineTask(treeContext.routine.id, task.id)}
            onDelete={(task) => deleteRoutineTask(treeContext.routine.id, task.id)}
            onMoveUp={(task) => moveRoutineTask(treeContext.routine.id, task.id, -1)}
            onMoveDown={(task) => moveRoutineTask(treeContext.routine.id, task.id, 1)}
            onToggleComplete={() => {}}
            treeEditMode={effectiveTreeEditMode}
            selection={selection}
            treeContext={treeContext}
            template
          />
        )}

        {(treeContext.type === "quest" || treeContext.type === "focus") && treeContext.quest && (
          <QuestTree
            tasks={treeContext.quest.rootTask?.children || []}
            expanded={expanded}
            setExpanded={setExpanded}
            onSelect={(task) => setSelection({ type: "task", questId: treeContext.quest.id, id: task.id })}
            onAddChild={(task) => createQuestTask(treeContext.quest.id, task.id)}
            onDelete={(task) => deleteQuestTask(treeContext.quest.id, task.id)}
            onMoveUp={(task) => moveQuestTask(treeContext.quest.id, task.id, -1)}
            onMoveDown={(task) => moveQuestTask(treeContext.quest.id, task.id, 1)}
            onToggleComplete={(task) => toggleTask(treeContext.quest.id, task.id)}
            treeEditMode={effectiveTreeEditMode}
            selection={selection}
            treeContext={treeContext}
          />
        )}

        {treeContext.type === "empty" && (
          <div className="text-sm text-neutral-500">No quest or routine selected.</div>
        )}
        </div>
      </section>
    </aside>
  );
}

function getSelectionType(selection) {
  const type = selection?.type || "none";
  if (type === "quest") return "Quest";
  if (type === "routine") return "Routine";
  if (type === "task") return "Task";
  if (type === "routineTask") return "Template Task";
  return "Nothing";
}

function getInspectorBarClass(selection) {
  const type = selection?.type || "none";
  if (type === "quest") return "inspector-title-quest";
  if (type === "routine") return "inspector-title-routine";
  if (type === "task") return "inspector-title-task";
  if (type === "routineTask") return "inspector-title-routineTask";
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

function InspectorTitleBar({
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
    <PanelTitleBar title={`Inspector - ${getSelectionType(selection)}`} className={getInspectorBarClass(selection)}>
      <button onClick={goBack} disabled={!canGoBack} className="title-icon-button disabled:opacity-30"><ArrowLeft size={16} /></button>
      <button onClick={goForward} disabled={!canGoForward} className="title-icon-button disabled:opacity-30"><ArrowRight size={16} /></button>
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
    </PanelTitleBar>
  );
}

function Inspector({
  selection,
  data,
  setData,
  setSelection,
  allTags,
  activeQuestId,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  makeFocus,
  activeBranchTaskId,
  setBranchFocus,
  clearBranchFocus,
  completeQuest,
  restoreQuest,
  createQuestTask,
  createRoutineTask,
  deleteQuest,
  deleteRoutine,
  deleteQuestTask,
  deleteRoutineTask,
  toggleTask,
  runMaintenanceNow,
}) {
  const selected = resolveSelection(selection, data);
  const title = inspectorTitle(selection, selected);

  return (
    <div>


      {selection.type === "quest" && selected?.quest && (
        <QuestInspector
          quest={selected.quest}
          allTags={allTags}
          isFocus={selected.quest.id === activeQuestId && !activeBranchTaskId}
          isQuestRoot={selected.quest.id === activeQuestId}
          activeBranchTaskId={activeBranchTaskId}
          setData={setData}
          routines={data.routines || []}
          setSelection={setSelection}
          makeFocus={() => makeFocus(selected.quest.id)}
          completeQuest={() => completeQuest(selected.quest.id)}
          restoreQuest={() => restoreQuest(selected.quest.id)}
          deleteQuest={() => deleteQuest(selected.quest.id)}
        />
      )}

      {selection.type === "routine" && selected?.routine && (
        <RoutineInspector
          routine={selected.routine}
          allTags={allTags}
          setData={setData}
          deleteRoutine={() => deleteRoutine(selected.routine.id)}
          runMaintenanceNow={runMaintenanceNow}
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
          template={false}
        />
      )}

      {selection.type === "routineTask" && selected?.routine && selected?.task && (
        <TaskInspector
          task={selected.task}
          parent={selected.parent}
          ownerTitle={selected.routine.title}
          ancestry={getTaskAncestry(selection, data)}
          setSelection={setSelection}
          locked={false}
          updateTask={(updater) => {
            setData((old) => {
              let updatedRoutine = null;
              const routines = old.routines.map((routine) => {
                if (routine.id !== selected.routine.id) return routine;
                updatedRoutine = { ...routine, taskTemplate: updateQuestTree(routine.taskTemplate, selection.id, updater) };
                return updatedRoutine;
              });

              return {
                ...old,
                routines,
                quests: updatedRoutine
                  ? reconcileTodayQuestForRoutine(old.quests, updatedRoutine)
                  : old.quests,
              };
            });
          }}
          template
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

  if (selection.type === "routine") {
    return { routine: data.routines.find((routine) => routine.id === selection.id) };
  }

  if (selection.type === "task") {
    const quest = data.quests.find((item) => item.id === selection.questId);
    const found = quest ? findTask(quest.rootTask ? [quest.rootTask] : [], selection.id) : null;
    return { quest, task: found?.task, parent: found?.parent };
  }

  if (selection.type === "routineTask") {
    const routine = data.routines.find((item) => item.id === selection.routineId);
    const found = routine ? findTask(routine.taskTemplate, selection.id) : null;
    return { routine, task: found?.task, parent: found?.parent };
  }

  return null;
}

function inspectorTitle(selection, selected) {
  if (selection.type === "quest" && selected?.quest) return `Quest: ${selected.quest.title || "Untitled"}`;
  if (selection.type === "routine" && selected?.routine) return `Routine: ${selected.routine.title || "Untitled"}`;
  if (selection.type === "task" && selected?.task) return `Task: ${selected.task.title || "Untitled"}`;
  if (selection.type === "routineTask" && selected?.task) return `Template Task: ${selected.task.title || "Untitled"}`;
  return "Nothing selected";
}

function QuestInspector({ quest, allTags, isFocus, isQuestRoot = false, activeBranchTaskId = null, setData, routines, setSelection, makeFocus, completeQuest, restoreQuest, deleteQuest }) {
  function updateQuest(patch) {
    if (quest.locked) return;

    setData((old) => ({
      ...old,
      quests: old.quests.map((item) => (item.id === quest.id ? { ...item, ...patch } : item)),
    }));
  }

  const complete = isQuestComplete(quest);
  const hasCompletionStamp = Boolean(quest.completedAt);
  const sourceRoutine = (routines || []).find((routine) => routine.id === quest.routineId);

  return (
    <div className="space-y-4">
      <div className="wiki-meta-block">
        <QuestChildrenSummary quest={quest} setSelection={setSelection} />
      </div>

      <div className="main-action-row">
        <ProgressActionButton
          progress={getQuestProgress(quest)}
          label="Complete quest"
          readyLabel="Complete quest"
          complete={complete && hasCompletionStamp}
          completeLabel="Reopen quest"
          onComplete={completeQuest}
          onReopen={restoreQuest}
          disabled={!isQuestReadyToComplete(quest)}
          disabledTitle="Complete all root tasks first."
        />
      </div>

      <InspectorProgressBar progress={getQuestProgress(quest)} label="Quest progress" />

      {quest.locked && (
        <div className="locked-notice">
          This is a read-only instance generated from a routine.
          {sourceRoutine && (
            <button className="wiki-link-button ml-1" onClick={() => setSelection({ type: "routine", id: sourceRoutine.id })}>
              Edit source routine
            </button>
          )}
        </div>
      )}

      <FormText label="Title" value={quest.title} onChange={(value) => updateQuest({ title: value })} disabled={quest.locked} />
      <FormTextarea label="Description" value={quest.description} onChange={(value) => updateQuest({ description: value })} disabled={quest.locked} />
      <TagEditor tags={quest.tags || []} allTags={allTags} onChange={(tags) => updateQuest({ tags })} disabled={quest.locked} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Difficulty" value={quest.difficulty} options={DIFFICULTIES} onChange={(value) => updateQuest({ difficulty: value })} disabled={quest.locked} />
        <SelectField label="Rule" value={quest.rootTask?.mode || "all"} options={MODES} onChange={(value) => updateQuest({ rootTask: { ...quest.rootTask, mode: value } })} disabled={quest.locked} />
      </div>

      <FormDate label="Deadline" value={quest.deadline} onChange={(value) => updateQuest({ deadline: value })} disabled={quest.locked} />

      {!quest.locked && (
        <div className="cooldown-box">
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={quest.cooldownEnabled}
              onChange={(event) => updateQuest({ cooldownEnabled: event.target.checked })}
            />
            Reset after cooldown
          </label>

          {quest.cooldownEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FormNumber
                label="Cooldown amount"
                value={quest.cooldownAmount}
                onChange={(value) => updateQuest({ cooldownAmount: value })}
              />
              <SelectField
                label="Cooldown unit"
                value={quest.cooldownUnit}
                options={COOLDOWN_UNITS}
                onChange={(value) => updateQuest({ cooldownUnit: value })}
              />
            </div>
          )}

          {quest.cooldownEnabled && quest.completedAt && (
            <div className="mt-2 text-xs text-neutral-400">
              Completed {quest.completedAt}. Resets after {quest.cooldownAmount} {quest.cooldownUnit}.
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-neutral-400">Progress</span>
          <span>{getQuestProgress(quest)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full rounded-full bg-slate-200" style={{ width: `${getQuestProgress(quest)}%` }} />
        </div>
      </div>

      <div className="danger-zone">
        <button
          onClick={deleteQuest}
          disabled={quest.locked}
          className="danger-button w-full disabled:opacity-40 disabled:cursor-not-allowed"
          title={quest.locked ? "Routine-generated quests cannot be deleted from the quest inspector." : "Delete quest"}
        >
          <Trash2 size={16} /> Delete quest
        </button>
      </div>


    </div>
  );
}

function RoutineInspector({ routine, allTags, setData, deleteRoutine, runMaintenanceNow }) {
  function updateRoutine(patch) {
    setData((old) => {
      const updatedRoutine = { ...routine, ...patch };
      return {
        ...old,
        routines: old.routines.map((item) => (item.id === routine.id ? updatedRoutine : item)),
        quests: reconcileTodayQuestForRoutine(old.quests, updatedRoutine),
      };
    });
  }

  return (
    <div className="space-y-4">
      <div className="main-action-row">
      </div>

      <FormText label="Title" value={routine.title} onChange={(value) => updateRoutine({ title: value })} />
      <FormTextarea label="Description" value={routine.description} onChange={(value) => updateRoutine({ description: value })} />
      <TagEditor tags={routine.tags || []} allTags={allTags} onChange={(tags) => updateRoutine({ tags })} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Difficulty" value={routine.difficulty} options={DIFFICULTIES} onChange={(value) => updateRoutine({ difficulty: value })} />
        <SelectField label="Quest rule" value={routine.mode} options={MODES} onChange={(value) => updateRoutine({ mode: value })} />
      </div>

      <DayMaskEditor
        label="Active days"
        value={routine.dayMask ?? EVERY_DAY_MASK}
        onChange={(value) => updateRoutine({ dayMask: value })}
      />

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={routine.active} onChange={(e) => updateRoutine({ active: e.target.checked })} />
        Active
      </label>

      <div className="danger-zone">
        <button onClick={deleteRoutine} className="danger-button w-full"><Trash2 size={16} /> Delete routine</button>
      </div>


    </div>
  );
}

function InspectorProgressBar({ progress, label = "Progress", detail = "" }) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  return (
    <div className="inspector-progress-block">
      <div className="inspector-progress-header">
        <span>{label}</span>
        <span>{detail || `${safeProgress}%`}</span>
      </div>
      <div className="inspector-progress-bar">
        <div className="inspector-progress-fill" style={{ width: `${safeProgress}%` }} />
      </div>
    </div>
  );
}

function ProgressActionButton({
  progress,
  label,
  readyLabel,
  complete,
  completeLabel = "Reopen",
  onComplete,
  onReopen,
  disabled = false,
  disabledTitle = "",
}) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  if (complete) {
    return (
      <button onClick={onReopen} className="main-action-button progress-action-button">
        <RotateCcw size={18} /> {completeLabel}
      </button>
    );
  }

  if (safeProgress >= 100 && !disabled) {
    return (
      <button onClick={onComplete} className="main-action-button progress-action-button">
        <CheckCircle2 size={18} /> {readyLabel}
      </button>
    );
  }

  return (
    <button className="main-action-button progress-action-button" disabled title={disabledTitle}>
      <CheckCircle2 size={18} /> {label}
    </button>
  );
}

function TaskProgressBar({ task }) {
  const progress = getTaskProgress(task);
  const counts = countLeafProgress(task);

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-neutral-400">Progress</span>
        <span>{counts.complete} / {counts.total} · {progress}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-neutral-800">
        <div className="h-full rounded bg-neutral-200" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function CounterField({ label, value, onChange, disabled = false, min = 0 }) {
  const safeValue = Math.max(min, Number(value || min));

  return (
    <div>
      <InputLabel text={label} />
      <div className="counter-field mt-1">
        <input
          className="field counter-input"
          type="number"
          min={min}
          value={safeValue}
          onChange={(event) => onChange(Math.max(min, Number(event.target.value || min)))}
          disabled={disabled}
        />
        <div className="counter-stepper">
          <button type="button" onClick={() => onChange(safeValue + 1)} disabled={disabled}>+</button>
          <button type="button" onClick={() => onChange(Math.max(min, safeValue - 1))} disabled={disabled}>−</button>
        </div>
      </div>
    </div>
  );
}

function TaskInspector({ task, parent, ownerTitle, ancestry, setSelection, locked = false, canFocusBranch = false, isBranchFocused = false, setBranchFocus, clearBranchFocus, updateTask, toggleComplete, template }) {
  const hasChildren = (task.children || []).length > 0;
  const complete = isTaskComplete(task);

  return (
    <div className="space-y-4">
      <div className="wiki-meta-block">
        <AncestryPath ancestry={ancestry || []} setSelection={setSelection} />
        <ChildrenSummary task={task} ancestry={ancestry || []} setSelection={setSelection} />
      </div>

      {!template && (
        <div className="main-action-row">
          {hasChildren ? (
            <ProgressActionButton
              progress={getTaskProgress(task)}
              label="Complete task"
              readyLabel="Complete task"
              complete={complete}
              completeLabel="Mark incomplete"
              onComplete={toggleComplete}
              onReopen={toggleComplete}
              disabled={!areTaskChildrenComplete(task)}
              disabledTitle="Complete all child tasks first."
            />
          ) : (
            <button onClick={toggleComplete} className="main-action-button">
              {complete ? <RotateCcw size={18} /> : hasCountTarget(task) && !isCountReady(task) ? <Play size={18} /> : <CheckCircle2 size={18} />}
              {complete ? "Mark incomplete" : hasCountTarget(task) && !isCountReady(task) ? "Progress task" : "Complete task"}
            </button>
          )}
        </div>
      )}

      {hasChildren && (
        <InspectorProgressBar progress={getTaskProgress(task)} label="Task progress" />
      )}

      {!hasChildren && hasCountTarget(task) && (
        <InspectorProgressBar
          progress={getLeafProgressPercent(task)}
          label="Count progress"
          detail={`${getCountProgress(task).progress} / ${getCountProgress(task).target}`}
        />
      )}

      <FormText label="Title" value={task.title} onChange={(value) => updateTask((old) => ({ ...old, title: value }))} disabled={locked} />
      <FormTextarea label="Description" value={task.description} onChange={(value) => updateTask((old) => ({ ...old, description: value }))} disabled={locked} />
      <SelectField label="Child rule" value={task.mode} options={MODES} onChange={(value) => updateTask((old) => ({ ...old, mode: value }))} disabled={locked} />

      <div className="grid grid-cols-2 gap-3">
        <CounterField
          label="Count target"
          value={task.countTarget || 0}
          min={0}
          disabled={locked || hasChildren}
          onChange={(value) => updateTask((old) => {
            const nextTarget = Math.max(0, Number(value || 0));
            const nextProgress = Math.min(nextTarget, Math.max(0, Number(old.countProgress || 0)));
            return {
              ...old,
              countTarget: nextTarget,
              countProgress: nextProgress,
              completed: false,
            };
          })}
        />
        <CounterField
          label="Count progress"
          value={task.countProgress || 0}
          disabled={hasChildren || !(task.countTarget > 0)}
          onChange={(value) => updateTask((old) => {
            const target = Math.max(0, Number(old.countTarget || 0));
            const progress = Math.min(target, Math.max(0, Number(value || 0)));
            return {
              ...old,
              countProgress: progress,
              completed: false,
            };
          }, { allowLockedProgress: true })}
        />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
        {hasChildren
          ? "Parent task: can be completed after its children are complete."
          : task.countTarget > 0
            ? "Counted leaf task: progress clicks advance the counter until complete."
            : template
              ? "Template leaf: generated copies can be completed later."
              : "Leaf task: can be completed directly."}
      </div>

    </div>
  );
}

function QuestChildrenSummary({ quest, setSelection }) {
  const children = quest?.rootTask?.children || [];
  if (children.length === 0) {
    return (
      <div className="wiki-meta-line">
        <span className="wiki-meta-label">Children:</span>{" "}
        <span className="text-neutral-500">None</span>
      </div>
    );
  }

  return (
    <div className="wiki-meta-line">
      <span className="wiki-meta-label">Children:</span>{" "}
      {children.map((child, index) => (
        <React.Fragment key={child.id}>
          {index > 0 && <span>, </span>}
          <button
            className="wiki-link-button"
            onClick={() => setSelection({ type: "task", questId: quest.id, id: child.id })}
          >
            {child.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function ChildrenSummary({ task, ancestry, setSelection }) {
  const children = task?.children || [];
  if (children.length === 0) return null;

  const owner = ancestry?.[0];

  return (
    <div className="wiki-meta-line">
      <span className="wiki-meta-label">Children:</span>{" "}
      {children.map((child, index) => (
        <React.Fragment key={child.id}>
          {index > 0 && <span>, </span>}
          <button
            className="wiki-link-button"
            onClick={() => {
              if (owner?.type === "quest" && setSelection) {
                setSelection({ type: "task", questId: owner.id, id: child.id });
              }
              if (owner?.type === "routine" && setSelection) {
                setSelection({ type: "routineTask", routineId: owner.id, id: child.id });
              }
            }}
          >
            {child.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function AncestryPath({ ancestry, setSelection }) {
  if (!ancestry || ancestry.length === 0) return null;

  return (
    <div className="ancestry-path">
      {ancestry.map((item, index) => (
        <React.Fragment key={`${item.type}-${item.id}-${index}`}>
          {index > 0 && <span className="ancestry-separator">›</span>}
          <button
            className="ancestry-button"
            onClick={() => {
              if (item.type === "quest") setSelection({ type: "quest", id: item.id });
              if (item.type === "routine") setSelection({ type: "routine", id: item.id });
              if (item.type === "task") setSelection({ type: "task", questId: item.questId, id: item.id });
              if (item.type === "routineTask") setSelection({ type: "routineTask", routineId: item.routineId, id: item.id });
            }}
          >
            {item.title || "Untitled"}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function TreeRootRow({ title, kind, selected, onSelect }) {
  const className = ["tree-row", "tree-root-row", selected ? "tree-row-selected" : "", `tree-root-${kind}`].join(" ");

  return (
    <div className={className} onClick={onSelect}>
      <div className="tree-root-content">
        <div className="tree-root-icon">◆</div>
        <div className="tree-root-title">{title || "Untitled"}</div>
        <div className="tree-root-icon">◆</div>
      </div>
    </div>
  );
}

function QuestTree({ tasks, expanded, setExpanded, onSelect, onAddChild, onDelete, onMoveUp, onMoveDown, onToggleComplete, depth = 0, template = false, treeEditMode = false, selection = null, treeContext = null }) {
  if (!tasks || tasks.length === 0) return <div className="text-sm text-neutral-500">No tasks yet.</div>;

  return (
    <div className="tree-node-list">
      {tasks.map((task) => {
        const children = task.children || [];
        const hasChildren = children.length > 0;
        const open = expanded[task.id] ?? true;
        const complete = isTaskComplete(task);

        const selected = isTreeTaskSelected(selection, treeContext, task);
        const rowClass = [
          "tree-row",
          complete ? "tree-row-complete" : "",
          selected ? "tree-row-selected" : "",
          treeEditMode ? "tree-row-edit" : "",
        ].join(" ");

        return (
          <div key={task.id} className="tree-node-wrap">
            <div className={[depth > 0 ? "tree-row-wrap tree-node-child" : "tree-row-wrap tree-node-root", hasChildren ? "tree-row-branch" : "tree-row-leaf"].join(" ")}>
              <div className="tree-disclosure-gutter">
                {hasChildren ? (
                  <button
                    className="tree-disclosure"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpanded({ ...expanded, [task.id]: !open });
                    }}
                  >
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <div className="tree-disclosure-spacer" />
                )}
              </div>

              <div
                className={rowClass}
                onClick={() => !treeEditMode && onSelect(task)}
              >
                <div className="tree-row-main">
                  <div className="tree-row-title">
                    {task.title || "Untitled task"}
                    {hasCountTarget(task) && (
                      <span className="tree-count-suffix"> ({getCountProgress(task).progress}/{getCountProgress(task).target})</span>
                    )}
                  </div>
                  {hasChildren && <div className="tree-row-mode">{task.mode === "sequence" ? "seq" : "all"}</div>}
                </div>

                <div className="tree-row-buttons" onClick={(event) => event.stopPropagation()}>
                  {treeEditMode ? (
                    <>
                      <button onClick={() => onMoveUp?.(task)} className="tree-icon-button" title="Move up"><ArrowUp size={14} /></button>
                      <button onClick={() => onMoveDown?.(task)} className="tree-icon-button" title="Move down"><ArrowDown size={14} /></button>
                      <button onClick={() => onAddChild(task)} className="tree-icon-button" title="Add child"><Plus size={14} /></button>
                      <button onClick={() => onDelete?.(task)} className="tree-icon-button danger-tree-button" title="Delete"><Trash2 size={14} /></button>
                    </>
                  ) : (
                    !template && (!hasChildren || complete || isTaskReadyToComplete(task)) && (
                      <button
                        onClick={() => onToggleComplete(task)}
                        className="tree-icon-button"
                        title={complete ? "Mark incomplete" : hasChildren ? "Confirm complete" : "Complete"}
                      >
                        {complete ? <X size={14} /> : hasCountTarget(task) && !isCountReady(task) ? <Play size={14} /> : <CheckCircle2 size={14} />}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {hasChildren && open && (
              <div className="tree-children-group">
                <QuestTree
                  tasks={children}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  onSelect={onSelect}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onToggleComplete={onToggleComplete}
                  depth={depth + 1}
                  template={template}
                  treeEditMode={treeEditMode}
                  selection={selection}
                  treeContext={treeContext}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayMaskEditor({ label, value, onChange, disabled = false }) {
  function toggleDay(bit) {
    if (disabled) return;
    onChange(value ^ bit);
  }

  return (
    <div>
      <InputLabel text={label} />
      <div className="day-mask-row">
        {WEEKDAYS.map((day) => {
          const active = (value & day.bit) !== 0;
          return (
            <button
              key={day.key}
              type="button"
              className={active ? "day-button day-button-active" : "day-button"}
              onClick={() => toggleDay(day.bit)}
              disabled={disabled}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagEditor({ tags, allTags, onChange, disabled = false }) {
  const [custom, setCustom] = useState("");

  function toggle(tag) {
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  }

  function addCustom() {
    const clean = custom.trim();
    if (!clean) return;
    if (!tags.includes(clean)) onChange([...tags, clean]);
    setCustom("");
  }

  return (
    <div>
      <InputLabel text="Tags" />

      <div className="mt-2 flex flex-wrap gap-2">
        {allTags.map((tag) => (
          <button key={tag} onClick={() => !disabled && toggle(tag)} disabled={disabled} className={tags.includes(tag) ? "pill-green" : "pill"}>{tag}</button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input className="field" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom tag" disabled={disabled} />
        <button className="secondary-button" onClick={addCustom} disabled={disabled}>Add</button>
      </div>
    </div>
  );
}

function LibraryTabBar({ tab, setTab }) {
  return (
    <div className="panel-title-bar library-tab-bar">
      <button
        onClick={() => setTab("quests")}
        className={tab === "quests" ? "library-title-tab library-title-tab-active" : "library-title-tab"}
      >
        Quests
      </button>
      <button
        onClick={() => setTab("routines")}
        className={tab === "routines" ? "library-title-tab library-title-tab-active" : "library-title-tab"}
      >
        Routines
      </button>
      <button
        onClick={() => setTab("save")}
        className={tab === "save" ? "library-title-tab library-title-tab-active" : "library-title-tab"}
      >
        Save/Load
      </button>
    </div>
  );
}

function PanelTitleBar({ title, children, className = "" }) {
  return (
    <div className={`panel-title-bar ${className}`}>
      <div className="panel-title-text">{title}</div>
      {children && <div className="panel-title-actions">{children}</div>}
    </div>
  );
}

function InputLabel({ text }) {
  return <label className="block text-sm font-medium text-neutral-300">{text}</label>;
}

function FormText({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <input className="field mt-1" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function FormTextarea({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <textarea className="field mt-1 min-h-24" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function FormNumber({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <input
        className="field mt-1"
        type="number"
        min="1"
        value={value || 1}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}

function FormDate({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <input className="field mt-1" type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function SelectField({ label, value, options, onChange, disabled = false }) {
  return (
    <div>
      <InputLabel text={label} />
      <select className="field mt-1" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}

function DarkStyles() {
  return (
    <style>{`
      html, body, #root {
        height: 100%;
        margin: 0;
        overflow: hidden;
      }
      * {
        box-sizing: border-box;
      }
      .app-root {
        height: 100%;
        display: flex;
        gap: 0.35rem;
        overflow: hidden;
      }
      .column-splitter {
        flex: 0 0 0.45rem;
        cursor: col-resize;
        border: 1px solid transparent;
        background: rgb(23 23 23);
      }
      .column-splitter:hover {
        border-color: rgb(82 82 82);
        background: rgb(38 38 38);
      }
      .column-splitter::before {
        content: "";
        display: block;
        width: 1px;
        height: 3rem;
        margin: 2rem auto 0;
        background: rgb(82 82 82);
      }
      .panel {
        border-radius: 0.25rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(23 23 23);
        padding: 0;
        box-shadow: 0 20px 40px rgb(0 0 0 / 0.18);
        min-height: 0;
      }
      .panel-title-bar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        min-height: 1.55rem;
        border-bottom: 1px solid rgb(38 38 38);
        border-radius: 0.35rem 0.35rem 0 0;
        background: rgb(38 38 38);
        padding: 0.25rem 0.75rem;
      }
      .panel-title-text {
        font-size: 0.9rem;
        font-weight: 800;
        color: rgb(229 229 229);
      }
      .library-tab-bar {
        justify-content: flex-start;
        gap: 0.25rem;
        padding: 0.25rem 0.35rem 0;
        min-height: 2.15rem;
      }
      .library-title-tab {
        align-self: stretch;
        display: inline-flex;
        align-items: center;
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 0.28rem 0.28rem 0 0;
        padding: 0.25rem 0.8rem;
        font-size: 0.85rem;
        font-weight: 800;
        color: rgb(163 163 163);
      }
      .library-title-tab:hover {
        background: rgb(64 64 64);
        color: rgb(229 229 229);
      }
      .library-title-tab-active {
        border-color: rgb(64 64 64);
        background: rgb(23 23 23);
        color: rgb(245 245 245);
      }
      .panel-title-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .title-icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 0.35rem;
        color: rgb(229 229 229);
      }
      .title-icon-button:hover {
        background: rgb(64 64 64);
      }
      .title-secondary-button,
      .title-primary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.35rem;
        padding: 0.18rem 0.45rem;
        font-size: 0.75rem;
        font-weight: 800;
      }
      .title-secondary-button {
        background: rgb(23 23 23);
        color: rgb(229 229 229);
      }
      .title-secondary-button:hover {
        background: rgb(64 64 64);
      }
      .title-secondary-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .title-secondary-button:disabled:hover {
        background: rgb(23 23 23);
      }
      .title-primary-button {
        background: rgb(229 229 229);
        color: rgb(23 23 23);
      }
      .title-button-disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .main-action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .main-action-button {
        display: inline-flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border-radius: 0.32rem;
        background: rgb(229 229 229);
        padding: 0.75rem 1rem;
        font-size: 1rem;
        font-weight: 800;
        color: rgb(23 23 23);
      }
            .progress-action-button {
        min-height: 2.75rem;
      }


      .main-action-button:disabled {
        background: rgb(38 38 38);
        border-color: rgb(64 64 64);
        color: rgb(120 120 120);
        cursor: default;
        opacity: 0.75;
      }

      .main-action-button:disabled:hover {
        background: rgb(38 38 38);
        border-color: rgb(64 64 64);
        color: rgb(120 120 120);
      }

.main-action-button:hover {
        background: white;
      }
      .main-action-complete {
        display: inline-flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        border-radius: 0.32rem;
        border: 1px solid rgb(21 128 61);
        background: rgb(20 83 45);
        padding: 0.75rem 1rem;
        font-weight: 800;
        color: rgb(187 247 208);
      }
      .main-action-placeholder {
        flex: 1 1 auto;
        border-radius: 0.32rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.75rem 1rem;
        text-align: center;
        font-size: 0.9rem;
        font-weight: 700;
        color: rgb(163 163 163);
      }
      .danger-zone {
        margin-top: 1rem;
        border-top: 1px solid rgb(38 38 38);
        padding-top: 1rem;
      }
      .wiki-meta-block {
        display: grid;
        gap: 0.25rem;
        font-size: 0.78rem;
        line-height: 1.35;
        color: rgb(163 163 163);
      }
      .wiki-meta-line {
        color: rgb(163 163 163);
      }
      .wiki-meta-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .ancestry-path {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.2rem;
      }
      .ancestry-path::before {
        content: "Path:";
        margin-right: 0.25rem;
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .ancestry-button {
        border-radius: 0.3rem;
        padding: 0 0.15rem;
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: rgb(82 82 82);
        text-underline-offset: 2px;
      }
      .ancestry-button:hover {
        color: white;
        text-decoration-color: white;
      }
      .wiki-link-button {
        border-radius: 0.3rem;
        padding: 0 0.15rem;
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: rgb(82 82 82);
        text-underline-offset: 2px;
      }
      .wiki-link-button:hover {
        color: white;
        text-decoration-color: white;
      }
      .ancestry-separator {
        color: rgb(115 115 115);
      }
      .inspector-title-quest {
        background: rgb(20 83 45);
        border-bottom-color: rgb(21 128 61);
      }
      .inspector-title-task {
        background: rgb(30 58 138);
        border-bottom-color: rgb(30 64 175);
      }
      .inspector-title-routine {
        background: rgb(120 53 15);
        border-bottom-color: rgb(217 119 6);
      }
      .inspector-title-routineTask {
        background: rgb(120 53 15);
        border-bottom-color: rgb(217 119 6);
      }
      .inspector-action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        border-radius: 0.32rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 0.65rem;
      }
      .focus-status-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 0.28rem;
        border: 1px solid rgb(21 128 61);
        background: rgb(20 83 45);
        padding: 0.5rem 0.75rem;
        font-weight: 700;
        color: rgb(187 247 208);
      }
      .panel-content {
        padding: 1rem;
      }
      .panel-scroll {
        overflow-y: auto;
        overflow-x: hidden;
      }
      .library-col {
        flex: 0 0 auto;
      }
      .focus-col {
        flex: 1 1 auto;
        min-width: 420px;
      }
      .right-column {
        flex: 0 0 auto;
        min-width: 360px;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        overflow: hidden;
      }
      .right-splitter {
        flex: 0 0 0.45rem;
        cursor: row-resize;
        border: 1px solid transparent;
        background: rgb(23 23 23);
      }
      .right-splitter:hover {
        border-color: rgb(82 82 82);
        background: rgb(38 38 38);
      }
      .right-splitter::before {
        content: "";
        display: block;
        height: 1px;
        margin: 0.2rem auto 0;
        width: 3rem;
        background: rgb(82 82 82);
      }
      .inspector-panel {
        flex: 0 0 auto;
      }
      .tree-panel {
        flex: 0 0 auto;
        transition: border-color 0.15s ease, background 0.15s ease;
      
      }
      .focus-tree {
        border-color: rgb(30 64 175);
      }
      .quest-tree {
        border-color: rgb(21 128 61);
              }
      .routine-tree {
        border-color: rgb(217 119 6);
      }
      .quest-type-regular-tree {
        border-color: rgb(21 128 61);
      }
      .quest-type-routine-tree {
        border-color: rgb(217 119 6);
      }
      .quest-type-cooldown-tree {
        border-color: rgb(126 34 206);
      }
      .tree-mode-pill {
        display: inline-flex;
        border-radius: 0.35rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgb(64 64 64);
        color: rgb(229 229 229);
      }
      .tree-edit-pill {
        display: inline-flex;
        border-radius: 0.35rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 800;
        background: rgb(234 179 8);
        color: rgb(23 23 23);
      }
      .tree-node-list {
        display: grid;
        gap: 0.15rem;
      }
      .tree-node-wrap {
        position: relative;
        display: grid;
        gap: 0.15rem;
      }
      .tree-row-wrap {
        position: relative;
        display: flex;
        align-items: stretch;
        gap: 0.25rem;
      }
      .tree-children-group {
        position: relative;
        margin-left: 1.35rem;
        padding-left: 0.55rem;
        display: grid;
        gap: 0.15rem;
      }
      .tree-row-wrap.tree-node-child::after {
        content: "";
        position: absolute;
        left: calc(-0.55rem - 12px);
        top: -0.15rem;
        bottom: calc(50% - 1px);
        width: 2px;
        background: rgb(82 82 82);
        opacity: 0.9;
      }
      .tree-node-wrap:not(:last-child) > .tree-row-wrap.tree-node-child::after {
        bottom: -0.15rem;
      }
      .tree-row-wrap.tree-node-child::before {
        content: "";
        position: absolute;
        left: calc(-0.55rem - 12px);
        top: 0.78rem;
        width: calc(0.55rem + 12px);
        height: 2px;
        background: rgb(82 82 82);
        opacity: 0.9;
      }
      .tree-row-wrap.tree-node-child.tree-row-leaf::before {
        width: calc(1.9rem + 12px);
      }
      .tree-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-height: 1.55rem;
        border-radius: 0.25rem;
        border: 1px solid transparent;
        background: rgb(23 23 23);
        padding: 0.12rem 0.3rem;
        cursor: pointer;
      
        flex: 1 1 auto;}
      .tree-row:hover {
        border-color: rgba(255, 255, 255, 0.22);
        background: rgba(255, 255, 255, 0.08);
      }
      .tree-row-selected {
        border-color: rgb(229 229 229);
        background: rgb(38 38 38);
      }
      .tree-root-row {
        margin-bottom: 0.5rem;
        font-weight: 800;
        justify-content: center;
      }
      .tree-root-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.85rem;
        width: 100%;
        min-width: 0;
        text-align: center;
      }
      .tree-root-icon {
        flex: 0 0 auto;
        width: 1.35rem;
        text-align: center;
        color: rgb(229 229 229);
      }
      .tree-root-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: center;
      }
      .tree-root-quest {
        border-color: rgb(21 128 61);
      }
      .tree-root-routine {
        border-color: rgb(217 119 6);
      }
      .tree-root-focus {
        border-color: rgb(30 64 175);
      }
      .tree-root-quest-type-regular {
        border-color: rgb(21 128 61);
      }
      .tree-root-quest-type-routine {
        border-color: rgb(217 119 6);
      }
      .tree-root-quest-type-cooldown {
        border-color: rgb(126 34 206);
      }
      .tree-root-root-quest-type-regular {
        border-width: 2px;
      }
      .tree-root-root-quest-type-routine {
        border-width: 2px;
      }
      .tree-root-root-quest-type-cooldown {
        border-width: 2px;
      }
      .tree-row-complete {
        background: rgb(52 68 58);
      }
      .tree-row-complete:hover {
        background: linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08)), rgb(52 68 58);
      }
      .tree-row-edit {
        cursor: default;
      }
      .tree-row-main {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 0.35rem;
      }
      .tree-row-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.9rem;
        font-weight: 650;
      }
      .tree-count-suffix {
        color: rgb(163 163 163);
        font-weight: 650;
      }
      .tree-row-mode {
        flex: 0 0 auto;
        border-radius: 0.35rem;
        background: rgb(64 64 64);
        padding: 0.1rem 0.35rem;
        font-size: 0.65rem;
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .tree-row-buttons {
        display: flex;
        flex: 0 0 auto;
        gap: 0.25rem;
      }
            .tree-disclosure-gutter {
        display: inline-flex;
        flex: 0 0 1.35rem;
        align-items: center;
        justify-content: center;
      }
.tree-disclosure,
      .tree-icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 0.25rem;
        color: rgb(229 229 229);
      }
      .tree-disclosure-spacer {
        display: inline-flex;
        width: 1.35rem;
        height: 1.35rem;
        flex: 0 0 1.35rem;
      }

      .tree-disclosure:hover,
      .tree-icon-button:hover {
        background: rgb(64 64 64);
      }
      .danger-tree-button:hover {
        background: rgb(127 29 29);
      }
      .selection-type-card {
        margin-bottom: 1rem;
        border-radius: 0.25rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.75rem;
      }
      .selection-type-label {
        display: inline-flex;
        border-radius: 0.35rem;
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .selection-type-title {
        margin-top: 0.5rem;
        font-size: 1rem;
        font-weight: 700;
        color: rgb(245 245 245);
      }
      .selection-quest {
        border-color: rgb(21 128 61);
      }
      .selection-quest .selection-type-label {
        background: rgb(20 83 45);
        color: rgb(187 247 208);
      }
      .selection-task {
        border-color: rgb(30 64 175);
      }
      .selection-task .selection-type-label {
        background: rgb(30 58 138);
        color: rgb(191 219 254);
      }
      .selection-routine {
        border-color: rgb(126 34 206);
      }
      .selection-routine .selection-type-label {
        background: rgb(88 28 135);
        color: rgb(233 213 255);
      }
      .selection-routineTask {
        border-color: rgb(147 51 234);
      }
      .selection-routineTask .selection-type-label {
        background: rgb(107 33 168);
        color: rgb(243 232 255);
      }
      .focus-panel-content {
        min-height: calc(100% - 2rem);
        display: flex;
        flex-direction: column;
      }
      .focus-document-header {
        padding: 0.25rem 0 0;
      }
      .focus-document-title {
        display: block;
        font-size: 2rem;
        line-height: 1.1;
        font-weight: 900;
        color: rgb(245 245 245);
        text-align: left;
      }
      .focus-document-title-button {
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 3px;
      }
      .focus-document-title-button:hover {
        text-decoration-color: currentColor;
      }
      .focus-directory-path {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem;
        margin-top: 0.45rem;
        font-size: 1rem;
        color: rgb(212 212 212);
      }
      .focus-directory-link {
        text-align: left;
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 2px;
      }
      .focus-directory-link:hover {
        color: white;
        text-decoration-color: currentColor;
      }
      .focus-directory-separator {
        color: rgb(115 115 115);
      }
      .focus-relations {
        display: grid;
        gap: 0.25rem;
        margin-top: 0.45rem;
        font-size: 1rem;
        color: rgb(212 212 212);
      }
      .focus-relation-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
      }
      .focus-relation-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .focus-relation-muted {
        color: rgb(115 115 115);
      }
      .focus-relation-chip {
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 2px;
      }
      .focus-relation-chip:hover {
        color: white;
        text-decoration-color: currentColor;
      }
      .focus-description-section {
        margin-top: 0.85rem;
      }
      .focus-description-title {
        font-size: 1.2rem;
        font-weight: 900;
        color: rgb(245 245 245);
      }
      .focus-description-text {
        margin-top: 0.25rem;
        white-space: pre-wrap;
        font-size: 1rem;
        line-height: 1.5;
        color: rgb(212 212 212);
      }
      .focus-path-header {
        padding: 0.25rem 0 0;
      }
      .focus-path-title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.25rem;
        font-size: 1.5rem;
        font-weight: 800;
      }
      .focus-path-title-link {
        color: rgb(245 245 245);
        text-align: left;
      }
      .focus-path-title-link:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .focus-path-title-separator {
        color: rgb(115 115 115);
      }
      .focus-branch-nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.45rem;
        font-size: 0.8rem;
      }
      .focus-branch-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .branch-progress-line {
        margin-top: 0.75rem;
      }
      .branch-progress-label {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.82rem;
        font-weight: 750;
        color: rgb(212 212 212);
      }
      .branch-progress-track {
        margin-top: 0.35rem;
        height: 0.45rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
      }
      .branch-progress-fill {
        height: 100%;
        background: rgb(212 212 212);
      }
      .focus-nav {
        display: grid;
        gap: 0.3rem;
        margin-top: 0.75rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.55rem;
        font-size: 0.8rem;
      }
      .focus-nav-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem;
      }
      .focus-nav-label {
        font-weight: 800;
        color: rgb(212 212 212);
      }
      .focus-nav-link {
        color: rgb(212 212 212);
        text-decoration: underline;
        text-decoration-color: rgb(82 82 82);
        text-underline-offset: 2px;
      }
      .focus-nav-link:hover {
        color: white;
        text-decoration-color: white;
      }
      .focus-nav-separator,
      .focus-nav-muted {
        color: rgb(115 115 115);
      }
      .focus-nav-chip {
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.1rem 0.35rem;
        color: rgb(212 212 212);
      }
      .focus-nav-chip:hover {
        background: rgb(38 38 38);
      }


      .complete-quest-celebration {
        display: flex;
        justify-content: center;
        margin: 1.5rem 1.5rem 1rem;
      }
      .recommended-complete-quest-button {
        width: min(38rem, 100%);
        border: 1px solid rgb(74 222 128);
        background: linear-gradient(135deg, rgb(22 101 52), rgb(34 140 84));
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 1.4rem rgba(34, 197, 94, 0.18);
        padding: 1.35rem 1.75rem;
        display: grid;
        grid-template-columns: 2rem minmax(0, 1fr) 2rem;
        align-items: center;
        justify-items: center;
        gap: 1rem;
        font-size: 1.2rem;
        font-weight: 950;
        letter-spacing: 0.02em;
      }
      .recommended-complete-quest-button:hover {
        background: linear-gradient(rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.14)), linear-gradient(135deg, rgb(22 101 52), rgb(34 140 84));
      }
      .recommended-complete-quest-button-done,
      .recommended-complete-quest-button-done:hover,
      .recommended-complete-quest-button-done:disabled {
        border-color: rgb(115 115 115);
        background: linear-gradient(135deg, rgb(64 64 64), rgb(82 82 82));
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
        color: rgb(229 229 229);
        cursor: default;
        opacity: 1;
      }
      .complete-quest-icon {
        color: rgb(220 252 231);
        font-size: 1rem;
        line-height: 1;
      }
      .recommended-complete-quest-button-done .complete-quest-icon {
        color: rgb(212 212 212);
      }
      .complete-quest-label {
        min-width: 0;
        text-align: center;
        white-space: nowrap;
      }
      .recommended-task-row {
        margin-top: 0.5rem;
        min-height: 3rem;
        padding-right: 8.5rem;
      }
      .recommended-task-text {
        min-width: 0;
        text-align: left;
      }
      .recommended-action-button {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        min-width: 7.5rem;
      }
      .focus-recommend-panel {
        position: relative;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.9rem;
      
      
        padding-right: 9.5rem;
      }
      .focus-board {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        height: 50vh;
        min-height: 50vh;
        max-height: 50vh;
        overflow: hidden;
      }
      .focus-column {
        display: flex;
        min-width: 0;
        min-height: 0;
        height: 100%;
        max-height: 100%;
        flex-direction: column;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        overflow: hidden;
      }
      .focus-column-title {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        border-bottom: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.45rem 0.55rem;
        font-size: 0.85rem;
        font-weight: 800;
      }
      .focus-column-count {
        color: rgb(163 163 163);
        font-size: 0.75rem;
      }
      .focus-column-list {
        display: flex;
        flex: 1 1 0;
        min-height: 0;
        max-height: 100%;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.45rem;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .focus-card {
        flex: 0 0 auto;
        border: 1px solid rgb(38 38 38);
        background: rgb(23 23 23);
        overflow: hidden;
      
      }
      .focus-card-bar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.35rem;
        background: rgb(38 38 38);
        padding: 0.3rem 0.35rem;
        cursor: pointer;
      
      }
      .focus-card-body {
        border-top: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 0.5rem;
        white-space: pre-wrap;
        font-size: 0.78rem;
        line-height: 1.45;
        color: rgb(212 212 212);
      }
      .focus-card-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        flex: 0 0 auto;
      }
      .focus-card:hover {
        border-color: rgb(82 82 82);
      }
      .focus-card-bar:focus-visible {
        outline: 2px solid rgb(163 163 163);
        outline-offset: -2px;
      }


      .focus-card-title-line {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.3rem;
      }
      .focus-card-dropdown {
        flex: 0 0 auto;
      }
      .focus-card-progress-full {
        width: 100%;
        border-left: 0;
        border-right: 0;
        border-top: 1px solid rgb(38 38 38);
        border-bottom: 0;
        height: 0.42rem;
      }
      .focus-card-main {
        min-width: 0;
        text-align: left;
      }
      .focus-card-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .focus-path-links {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.2rem;
        font-size: 0.82rem;
        font-weight: 650;
      }
      .focus-path-link {
        max-width: 100%;
        padding: 0 0.05rem;
        color: rgb(212 212 212);
        text-align: left;
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 2px;
      }
      .focus-path-link:hover {
        color: white;
        text-decoration-color: currentColor;
      }
      .focus-path-separator {
        color: rgb(115 115 115);
      }
      .focus-card-progress-bar {
        margin-top: 0.3rem;
        height: 0.35rem;
        overflow: hidden;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
      }
      .focus-card-progress-fill {
        height: 100%;
        background: rgb(163 163 163);
      }

      .focus-card-action-progress {
        border-color: rgb(245 158 11);
        background: rgb(180 95 18);
      }
      .focus-card-action-progress:hover {
        background: linear-gradient(rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.14)), rgb(180 95 18);
      }
      
      .focus-card-action-uncomplete:hover {
        border-color: rgb(248 113 113);
        background: rgb(185 45 45);
      }
.focus-card-action-complete {
        border-color: rgb(74 222 128);
        background: rgb(34 140 84);
      }
      .focus-card-action-complete:hover {
        background: linear-gradient(rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.14)), rgb(34 140 84);
      }
      .focus-card-done {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border: 1px solid rgb(64 64 64);
        color: rgb(212 212 212);
      }
      .focus-card-done:hover {
        color: inherit;
      }
      .focus-card-complete {
        color: rgb(163 163 163);
      }
      .focus-empty {
        font-size: 0.78rem;
        color: rgb(115 115 115);
        padding: 0.25rem;
      }

      .task-action-stack {
        display: grid;
        flex: 1 1 auto;
        gap: 0.45rem;
      }
      .counter-field {
        display: flex;
        align-items: stretch;
        gap: 0.35rem;
      }
      .counter-input {
        min-width: 0;
        text-align: center;
        appearance: textfield;
        -moz-appearance: textfield;
      }
      .counter-input::-webkit-outer-spin-button,
      .counter-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .counter-stepper {
        display: flex;
        flex: 0 0 1.7rem;
        flex-direction: column;
        gap: 0.2rem;
      }
      .counter-stepper button {
        flex: 1 1 0;
        border: 1px solid rgb(64 64 64);
        background: rgb(38 38 38);
        font-size: 0.75rem;
        font-weight: 900;
        line-height: 1;
      }
      .counter-stepper button:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .inspector-progress-block {
        display: grid;
        gap: 0.35rem;
        width: 100%;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.65rem;
      }
      .inspector-progress-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        color: rgb(212 212 212);
        font-size: 0.8rem;
        font-weight: 800;
      }
      .inspector-progress-line {
        display: grid;
        gap: 0.3rem;
        width: 100%;
        color: rgb(212 212 212);
        font-size: 0.8rem;
        font-weight: 800;
      }
      .inspector-progress-bar {
        height: 0.5rem;
        overflow: hidden;
        border: 1px solid rgb(82 82 82);
        background: rgb(38 38 38);
      }
      .inspector-progress-fill {
        height: 100%;
        background: rgb(229 229 229);
        opacity: 0.28;
      }


      select.field {
        appearance: none;
        -webkit-appearance: none;
        background-color: rgb(23 23 23);
        color: rgb(245 245 245);
        border-color: rgb(64 64 64);
      }
      select.field option {
        background-color: rgb(23 23 23);
        color: rgb(245 245 245);
      }

      .field {
        width: 100%;
        border-radius: 0.28rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.5rem 0.75rem;
        color: rgb(245 245 245);
        outline: none;
      }
      .field:focus { border-color: rgb(163 163 163); }
      .field:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .locked-notice {
        border-radius: 0.28rem;
        border: 1px solid rgb(30 64 175);
        background: rgb(23 23 23);
        padding: 0.65rem;
        font-size: 0.85rem;
        color: rgb(191 219 254);
      }
      .cooldown-box {
        border-radius: 0.32rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 0.75rem;
      }
      .day-mask-row {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.35rem;
        margin-top: 0.35rem;
      }
      .day-button {
        border-radius: 0.25rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(10 10 10);
        padding: 0.35rem 0.25rem;
        font-size: 0.75rem;
        font-weight: 800;
        color: rgb(163 163 163);
      }
      .day-button:hover {
        background: rgb(38 38 38);
      }
      .day-button-active {
        border-color: rgb(126 34 206);
        background: rgb(88 28 135);
        color: rgb(243 232 255);
      }
      .primary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border-radius: 0.28rem;
        background: rgb(229 229 229);
        padding: 0.5rem 1rem;
        font-weight: 700;
        color: rgb(23 23 23);
      }
      .primary-button:hover { background: white; }
      .secondary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border-radius: 0.28rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.5rem 1rem;
        font-weight: 600;
        color: rgb(229 229 229);
      }
      .secondary-button:hover { background: rgb(38 38 38); }
      .danger-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        border-radius: 0.28rem;
        border: 1px solid rgb(127 29 29);
        background: rgb(69 10 10);
        padding: 0.5rem 1rem;
        font-weight: 700;
        color: rgb(254 202 202);
      }
      .danger-button:hover { background: rgb(127 29 29); }
      .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.28rem;
        border: 1px solid rgb(64 64 64);
        background: rgb(23 23 23);
        padding: 0.5rem;
        color: rgb(229 229 229);
      }
      .icon-button:hover { background: rgb(38 38 38); }
      .library-card {
        width: 100%;
        border-radius: 0.25rem;
        border: 1px solid rgb(38 38 38);
        background: rgb(10 10 10);
        padding: 1rem;
      }
      .library-card:hover {
        background: rgb(38 38 38);
      }
      .quest-type-regular {
        border-color: rgb(21 128 61);
      }
      .quest-type-routine {
        border-color: rgb(217 119 6);
      }
      .quest-type-cooldown {
        border-color: rgb(126 34 206);
      }
      .library-card-complete {
        border-color: rgb(64 64 64);
        background: rgb(23 23 23);
        color: rgb(163 163 163);
      }
      .library-card-complete:hover {
        background: rgb(38 38 38);
      }
      .library-card-complete .font-semibold {
        color: rgb(163 163 163);
      }
      .library-card-complete .text-neutral-400 {
        color: rgb(115 115 115);
      }
      .pill-complete {
        border-radius: 0.35rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgb(20 83 45);
        color: rgb(187 247 208);
      }
      .tab {
        border-radius: 0.25rem;
        padding: 0.5rem;
        color: rgb(163 163 163);
        font-weight: 700;
      }
      .tab-active {
        border-radius: 0.25rem;
        background: rgb(64 64 64);
        padding: 0.5rem;
        color: rgb(245 245 245);
        font-weight: 700;
      }
      .badge, .pill, .pill-blue, .pill-green, .pill-red {
        border-radius: 0.35rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .pill { background: rgb(38 38 38); color: rgb(212 212 212); }
      .pill-blue { background: rgb(30 58 138); color: rgb(191 219 254); }
      .pill-green { background: rgb(20 83 45); color: rgb(187 247 208); }
      .pill-red { background: rgb(127 29 29); color: rgb(254 202 202); }
    `}</style>
  );
}
