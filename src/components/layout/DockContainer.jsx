import React from "react";

import TabContainer from "./TabContainer";

export default function DockContainer({
  dockId,
  tabs = [],
  activePanelId,
  onActivePanelChange,
  className = "",
  panelClassName = "panel panel-scroll",
  style = undefined,
  contentClassName = "tab-scene-root",
  empty = null,
}) {
  const visibleTabs = tabs.filter(Boolean);

  if (visibleTabs.length === 0) return empty;

  return (
    <section
      className={[panelClassName, className].filter(Boolean).join(" ")}
      data-dock-id={dockId}
      style={style}
    >
      <TabContainer
        tabs={visibleTabs}
        activeTabId={activePanelId}
        onActiveTabChange={onActivePanelChange}
        contentClassName={contentClassName}
      />
    </section>
  );
}
