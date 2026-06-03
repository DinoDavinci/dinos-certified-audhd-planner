import React from "react";

export default function TabContainer({
  tabs = [],
  activeTabId,
  onActiveTabChange,
  className = "",
  contentClassName = "tab-scene-root",
  empty = null,
}) {
  const visibleTabs = tabs.filter(Boolean);

  if (visibleTabs.length === 0) return empty;

  const activeTab = visibleTabs.find((tab) => tab.id === activeTabId) || visibleTabs[0];

  return (
    <div className={["tab-container", className].filter(Boolean).join(" ")}>
      <div className="tab-container-bar">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onActiveTabChange?.(tab.id)}
            className={tab.id === activeTab.id ? "tab-container-tab tab-container-tab-active" : "tab-container-tab"}
            title={tab.title}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className={["tab-container-content", contentClassName].filter(Boolean).join(" ")}>
        {activeTab.content}
      </div>
    </div>
  );
}
