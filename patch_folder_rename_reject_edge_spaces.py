from pathlib import Path
import shutil

path = Path("src/components/quest-board/QuestBoardTab.jsx")
backup = path.with_suffix(path.suffix + ".reject-rename-edge-spaces.bak")
if not backup.exists():
    shutil.copy2(path, backup)

text = path.read_text(encoding="utf-8")

old_validation = '''    const rawName = String(renameState.name || "");
    const name = rawName.trim();

    if (!name) {
      return { ok: false, message: "Name cannot be empty." };
    }

    if (name === "." || name === "..") {
      return { ok: false, message: "Name cannot be . or ..." };
    }

    if (/[\\\\/:*?"<>|]/.test(name)) {
      return { ok: false, message: "Name contains an invalid filename character." };
    }

    if (name.startsWith(".") || name.endsWith(".")) {
      return { ok: false, message: "Name cannot start or end with a period." };
    }'''

new_validation = '''    const rawName = String(renameState.name || "");
    const name = rawName;

    if (!name.trim()) {
      return { ok: false, message: "Name cannot be empty." };
    }

    if (name !== name.trim()) {
      return { ok: false, message: "Name cannot start or end with spaces." };
    }

    if (name === "." || name === "..") {
      return { ok: false, message: "Name cannot be . or ..." };
    }

    if (/[\\\\/:*?"<>|]/.test(name)) {
      return { ok: false, message: "Name contains an invalid filename character." };
    }

    if (name.startsWith(".") || name.endsWith(".")) {
      return { ok: false, message: "Name cannot start or end with a period." };
    }'''

if old_validation not in text:
    raise SystemExit("Could not find folder rename validation block.")

text = text.replace(old_validation, new_validation, 1)

old_confirm = '''    const cleanName = String(renameState.name || "").trim();

    setPendingFolderRename(null);
    latestDirectoryDataRef.current.renameQuestFolder?.(renameState.folderId, cleanName);'''

new_confirm = '''    const cleanName = String(renameState.name || "");

    setPendingFolderRename(null);
    latestDirectoryDataRef.current.renameQuestFolder?.(renameState.folderId, cleanName);'''

if old_confirm not in text:
    raise SystemExit("Could not find confirmFolderRename cleanName block.")

text = text.replace(old_confirm, new_confirm, 1)

path.write_text(text, encoding="utf-8")
print(f"Patched {path}")
