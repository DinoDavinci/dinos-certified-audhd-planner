from pathlib import Path


def find_file(root: Path, name: str) -> Path:
    matches = [p for p in root.rglob(name) if p.is_file()]
    if not matches:
        raise FileNotFoundError(f"Could not find {name} under {root}")
    # Prefer src/ paths if more than one match exists.
    matches.sort(key=lambda p: ("/src/" not in str(p), len(str(p))))
    return matches[0]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Could not find unique patch target for {label}; found {count}")
    return text.replace(old, new, 1)


def patch_inspector(path: Path) -> None:
    text = path.read_text()

    old = """  const goto = getInspectorGoto(selection, data, activeQuestId, activeBranchTaskId);
  const ownerQuest = getOwnerQuestForSelection(selection, data);
  const canSaveQuestFile = Boolean(ownerQuest?.projectRelativePath && ownerQuest?.projectDirty && saveQuestFile);"""
    new = """  const goto = getInspectorGoto(selection, data, activeQuestId, activeBranchTaskId);
  const ownerQuest = getOwnerQuestForSelection(selection, data);
  const isProjectQuestFile = Boolean(ownerQuest?.projectRelativePath);
  const canSaveQuestFile = Boolean(isProjectQuestFile && ownerQuest?.projectDirty && saveQuestFile);"""
    if old in text:
        text = replace_once(text, old, new, "InspectorToolbar project mode flag")
    elif "const isProjectQuestFile = Boolean(ownerQuest?.projectRelativePath);" not in text:
        raise RuntimeError("InspectorToolbar already changed, but project mode flag was not found.")

    old = """      <div className=\"inspector-toolbar-actions inspector-toolbar-actions-left\">
        <button
          type=\"button\"
          onClick={runSave}
          disabled={!canSaveQuestFile}
          className={`title-icon-button inspector-save-button ${canSaveQuestFile ? \"inspector-save-button-dirty\" : \"inspector-save-button-clean\"}`}
          title={saveTitle}
        >
          <Save size={16} />
        </button>
      </div>"""
    new = """      <div className=\"inspector-toolbar-actions inspector-toolbar-actions-left\">
        {isProjectQuestFile ? (
          <button
            type=\"button\"
            onClick={runSave}
            disabled={!canSaveQuestFile}
            className={`title-icon-button inspector-save-button ${canSaveQuestFile ? \"inspector-save-button-dirty\" : \"inspector-save-button-clean\"}`}
            title={saveTitle}
          >
            <Save size={16} />
          </button>
        ) : (
          <span className={`inspector-selection-badge inspector-toolbar-web-badge ${getInspectorAccentClass(selection)}`}>
            {getSelectionType(selection)}
          </span>
        )}
      </div>"""
    if old in text:
        text = replace_once(text, old, new, "InspectorToolbar web identity badge / project save button")
    elif "inspector-toolbar-web-badge" not in text:
        raise RuntimeError("Could not patch InspectorToolbar left section.")

    old = """  if (!selection || selection.type === \"none\") return null;

  return ("""
    new = """  if (!selection || selection.type === \"none\") return null;
  if (!ownerQuest?.projectRelativePath) return null;

  return ("""
    if old in text and "if (!ownerQuest?.projectRelativePath) return null;" not in text:
        text = replace_once(text, old, new, "Hide standalone identity panel outside project mode")

    css_anchor = """      .inspector-toolbar-actions-left,
      .inspector-toolbar-actions-right {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }"""
    css_insert = """      .inspector-toolbar-actions-left,
      .inspector-toolbar-actions-right {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
      .inspector-toolbar-web-badge {
        flex: 0 0 4.35rem;
        min-width: 4.35rem;
        justify-content: center;
        text-align: center;
      }"""
    if css_anchor in text and "inspector-toolbar-web-badge" in text and ".inspector-toolbar-web-badge {" not in text:
        text = replace_once(text, css_anchor, css_insert, "web identity badge CSS")

    path.write_text(text)


def patch_focus(path: Path) -> None:
    text = path.read_text()

    old = """  return (
    <div className=\"focus-toolbar\">
      <div className=\"focus-toolbar-section\">
        <span className=\"inspector-selection-badge\">Focus</span>
      </div>

      <div className=\"focus-toolbar-actions\">"""
    new = """  return (
    <div className=\"focus-toolbar\" style={{ justifyContent: \"flex-end\" }}>
      <div className=\"focus-toolbar-actions\">"""
    if old in text:
        text = replace_once(text, old, new, "Remove redundant Focus toolbar badge")
    elif "<span className=\"inspector-selection-badge\">Focus</span>" in text:
        raise RuntimeError("Found Focus badge, but surrounding toolbar shape did not match expected patch target.")

    path.write_text(text)


def main() -> None:
    root = Path.cwd()
    inspector = find_file(root, "InspectorTab.jsx")
    focus = find_file(root, "FocusTab.jsx")

    patch_inspector(inspector)
    patch_focus(focus)

    print(f"Patched {inspector}")
    print(f"Patched {focus}")
    print("Done. Web inspector header now uses only the toolbar type badge, project mode keeps save + identity panel, and the Focus toolbar badge is removed.")


if __name__ == "__main__":
    main()
