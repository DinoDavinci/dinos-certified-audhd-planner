export const DOCK_IDS = Object.freeze({
  TOP_LEFT: "topLeft",
  BOTTOM_LEFT: "bottomLeft",
  CENTER: "center",
  TOP_RIGHT: "topRight",
  BOTTOM_RIGHT: "bottomRight",
});

export const PANEL_IDS = Object.freeze({
  QUEST_BOARD: "questBoard",
  ROUTINE_PANEL: "routinePanel",
  EXPORT_PANEL: "exportPanel",
  FOCUS_PANEL: "focusPanel",
  INSPECTOR_PANEL: "inspectorPanel",
  TREE_VIEW_PANEL: "treeViewPanel",
});

export const PANEL_DEFINITIONS = Object.freeze({
  [PANEL_IDS.QUEST_BOARD]: Object.freeze({
    id: PANEL_IDS.QUEST_BOARD,
    title: "Quest Board",
    defaultDock: DOCK_IDS.TOP_LEFT,
  }),
  [PANEL_IDS.ROUTINE_PANEL]: Object.freeze({
    id: PANEL_IDS.ROUTINE_PANEL,
    title: "Routines",
    defaultDock: DOCK_IDS.TOP_LEFT,
  }),
  [PANEL_IDS.EXPORT_PANEL]: Object.freeze({
    id: PANEL_IDS.EXPORT_PANEL,
    title: "Export",
    defaultDock: DOCK_IDS.TOP_LEFT,
  }),
  [PANEL_IDS.FOCUS_PANEL]: Object.freeze({
    id: PANEL_IDS.FOCUS_PANEL,
    title: "Focus",
    defaultDock: DOCK_IDS.CENTER,
  }),
  [PANEL_IDS.INSPECTOR_PANEL]: Object.freeze({
    id: PANEL_IDS.INSPECTOR_PANEL,
    title: "Inspector",
    defaultDock: DOCK_IDS.TOP_RIGHT,
  }),
  [PANEL_IDS.TREE_VIEW_PANEL]: Object.freeze({
    id: PANEL_IDS.TREE_VIEW_PANEL,
    title: "Tree View",
    defaultDock: DOCK_IDS.BOTTOM_RIGHT,
  }),
});

export const DEFAULT_DOCK_LAYOUT = Object.freeze({
  [DOCK_IDS.TOP_LEFT]: Object.freeze([
    PANEL_IDS.QUEST_BOARD,
    PANEL_IDS.ROUTINE_PANEL,
    PANEL_IDS.EXPORT_PANEL,
  ]),
  [DOCK_IDS.BOTTOM_LEFT]: Object.freeze([]),
  [DOCK_IDS.CENTER]: Object.freeze([PANEL_IDS.FOCUS_PANEL]),
  [DOCK_IDS.TOP_RIGHT]: Object.freeze([PANEL_IDS.INSPECTOR_PANEL]),
  [DOCK_IDS.BOTTOM_RIGHT]: Object.freeze([PANEL_IDS.TREE_VIEW_PANEL]),
});

export function getPanelsForDock(layout, dockId) {
  return Array.isArray(layout?.[dockId]) ? layout[dockId] : [];
}

export function isDockVisible(layout, dockId) {
  return getPanelsForDock(layout, dockId).length > 0;
}

export function getPanelDefinition(panelId) {
  return PANEL_DEFINITIONS[panelId] || null;
}
