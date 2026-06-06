from pathlib import Path
import shutil

path = Path("src/App.jsx")
backup = path.with_suffix(path.suffix + ".quest-move-fresh-scan.bak")
if not backup.exists():
    shutil.copy2(path, backup)

text = path.read_text(encoding="utf-8")

old = '''  async function moveQuestToFolder(questId, folderId) {
    if (projectRootPath) {
      const quest = (data.quests || []).find((item) => item.id === questId);

      if (!quest?.projectRelativePath) {
        window.alert("Could not move quest file because its project path is missing.");
        return;
      }

      if ((quest.folderId || null) === (folderId || null)) {
        return;
      }

      try {
        let result = await moveQuestFileInProject(
          projectRootPath,
          quest.projectRelativePath,
          folderId || null,
          false
        );

        if (result?.collision) {
          const confirmed = window.confirm(
            `A quest file already exists at the destination:\\n\\n${result.destinationRelativePath}\\n\\nOverwrite it?`
          );

          if (!confirmed) return;

          result = await moveQuestFileInProject(
            projectRootPath,
            quest.projectRelativePath,
            folderId || null,
            true
          );
        }

        await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });

        if (folderId) {
          setExpandedFolders((old) => ({ ...old, [folderId]: true }));
        }

        return;
      } catch (error) {
        console.error("Could not move quest file.", error);
        window.alert("Could not move quest file.");
        return;
      }
    }

    setData((old) => ({
      ...old,
      quests: moveQuestToFolderInList(old.quests || [], questId, folderId),
    }));
  }'''

new = '''  async function moveQuestToFolder(questId, folderId) {
    if (projectRootPath) {
      try {
        const scanned = await scanQuestProjectDirectory(projectRootPath);
        const quest =
          scanned.quests.find((item) => item.id === questId) ||
          (data.quests || []).find((item) => item.id === questId);

        if (!quest?.projectRelativePath) {
          console.warn("Could not move quest file because its project path is missing.", {
            questId,
            folderId,
            quest,
          });
          window.alert("Could not move quest file because its project path is missing.");
          await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
          return;
        }

        if ((quest.folderId || null) === (folderId || null)) {
          return;
        }

        let result = await moveQuestFileInProject(
          projectRootPath,
          quest.projectRelativePath,
          folderId || null,
          false
        );

        if (result?.collision) {
          const confirmed = window.confirm(
            `A quest file already exists at the destination:\\n\\n${result.destinationRelativePath}\\n\\nOverwrite it?`
          );

          if (!confirmed) return;

          result = await moveQuestFileInProject(
            projectRootPath,
            quest.projectRelativePath,
            folderId || null,
            true
          );
        }

        await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });

        if (folderId) {
          setExpandedFolders((old) => ({ ...old, [folderId]: true }));
        }

        return;
      } catch (error) {
        console.error("Could not move quest file.", error);
        window.alert("Could not move quest file.");
        await loadQuestProjectFolder(projectRootPath, { activeQuestId: questId });
        return;
      }
    }

    setData((old) => ({
      ...old,
      quests: moveQuestToFolderInList(old.quests || [], questId, folderId),
    }));
  }'''

if old not in text:
    raise SystemExit("Could not find current moveQuestToFolder block.")

text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print(f"Patched {path}")
