use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectScanFolder {
  relative_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectScanQuestFile {
  relative_path: String,
  absolute_path: String,
  contents: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectScanError {
  kind: String,
  path: String,
  message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectScanResult {
  folders: Vec<ProjectScanFolder>,
  quest_files: Vec<ProjectScanQuestFile>,
  errors: Vec<ProjectScanError>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMoveResult {
  moved: bool,
  collision: bool,
  source_relative_path: String,
  destination_relative_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMovePreflightResult {
  exists: bool,
  same_source: bool,
  source_relative_path: String,
  destination_relative_path: String,
}


#[tauri::command]
fn create_quest_project_folder(
  project_root_path: String,
  parent_relative_path: Option<String>,
  folder_name: String,
) -> Result<String, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let clean_folder_name = sanitize_file_name(&folder_name);

  if clean_folder_name.is_empty() {
    return Err("Folder name is empty.".to_string());
  }

  let canonical_root = root
    .canonicalize()
    .map_err(|error| format!("Could not resolve project root: {error}"))?;

  let mut parent_dir = root.clone();

  if let Some(parent) = parent_relative_path {
    let normalized_parent = normalize_relative_path(&parent);

    if normalized_parent.components().next().is_some() {
      parent_dir.push(normalized_parent);
    }
  }

  if parent_dir.exists() && !parent_dir.is_dir() {
    return Err("Parent path exists but is not a directory.".to_string());
  }

  fs::create_dir_all(&parent_dir)
    .map_err(|error| format!("Could not create parent folder: {error}"))?;

  let canonical_parent_dir = parent_dir
    .canonicalize()
    .map_err(|error| format!("Could not resolve parent folder: {error}"))?;

  if !canonical_parent_dir.starts_with(&canonical_root) {
    return Err("Parent folder must be inside the project root.".to_string());
  }

  let target_dir = next_available_folder_path(&parent_dir, &clean_folder_name);

  fs::create_dir(&target_dir)
    .map_err(|error| format!("Could not create quest folder: {error}"))?;

  let canonical_target_dir = target_dir
    .canonicalize()
    .map_err(|error| format!("Could not resolve created folder: {error}"))?;

  if !canonical_target_dir.starts_with(&canonical_root) {
    return Err("Created folder must be inside the project root.".to_string());
  }

  Ok(relative_path_string(&root, &target_dir))
}

#[tauri::command]
fn create_quest_project_file(
  project_root_path: String,
  folder_relative_path: Option<String>,
  file_name: String,
  contents: String,
) -> Result<String, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let clean_file_name = sanitize_file_name(&file_name);

  if clean_file_name.is_empty() {
    return Err("Quest file name is empty.".to_string());
  }

  if !is_quest_file_name(&clean_file_name) {
    return Err("Quest file must end with .quest.json or .quest.".to_string());
  }

  let mut target_dir = root.clone();

  if let Some(folder) = folder_relative_path {
    let normalized_folder = normalize_relative_path(&folder);
    
    if normalized_folder.components().next().is_some() {
      target_dir.push(normalized_folder);
    }
  }

  let canonical_root = root
    .canonicalize()
    .map_err(|error| format!("Could not resolve project root: {error}"))?;

  if target_dir.exists() && !target_dir.is_dir() {
    return Err("Target folder path exists but is not a directory.".to_string());
  }

  fs::create_dir_all(&target_dir)
    .map_err(|error| format!("Could not create target folder: {error}"))?;

  let canonical_target_dir = target_dir
    .canonicalize()
    .map_err(|error| format!("Could not resolve target folder: {error}"))?;

  if !canonical_target_dir.starts_with(&canonical_root) {
    return Err("Target folder must be inside the project root.".to_string());
  }

  let target_path = next_available_file_path(&target_dir, &clean_file_name);

  fs::write(&target_path, contents)
    .map_err(|error| format!("Could not write quest file: {error}"))?;

  Ok(target_path.to_string_lossy().to_string())
}



#[tauri::command]
fn check_quest_project_move_destination(
  project_root_path: String,
  source_relative_path: String,
  target_folder_relative_path: Option<String>,
) -> Result<ProjectMovePreflightResult, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  if source_relative_path.trim().is_empty() {
    return Err("Source quest path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let canonical_root = root
    .canonicalize()
    .map_err(|error| format!("Could not resolve project root: {error}"))?;

  let mut source_path = root.clone();
  let normalized_source = normalize_relative_path(&source_relative_path);

  if normalized_source.components().next().is_none() {
    return Err("Source quest path is invalid.".to_string());
  }

  source_path.push(normalized_source);

  if !source_path.is_file() {
    return Err("Source quest file does not exist.".to_string());
  }

  let source_name = source_path
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Source quest file has no valid file name.".to_string())?
    .to_string();

  if !is_quest_file_name(&source_name) {
    return Err("Source file is not a quest file.".to_string());
  }

  let canonical_source = source_path
    .canonicalize()
    .map_err(|error| format!("Could not resolve source quest file: {error}"))?;

  if !canonical_source.starts_with(&canonical_root) {
    return Err("Source quest file must be inside the project root.".to_string());
  }

  let mut target_dir = root.clone();

  if let Some(target_folder) = target_folder_relative_path {
    let normalized_target_folder = normalize_relative_path(&target_folder);

    if normalized_target_folder.components().next().is_some() {
      target_dir.push(normalized_target_folder);
    }
  }

  if target_dir.exists() && !target_dir.is_dir() {
    return Err("Target folder path exists but is not a directory.".to_string());
  }

  let canonical_target_dir = if target_dir.exists() {
    target_dir
      .canonicalize()
      .map_err(|error| format!("Could not resolve target folder: {error}"))?
  } else {
    target_dir
      .parent()
      .unwrap_or(&root)
      .canonicalize()
      .map_err(|error| format!("Could not resolve target folder parent: {error}"))?
  };

  if !canonical_target_dir.starts_with(&canonical_root) {
    return Err("Target folder must be inside the project root.".to_string());
  }

  let destination_path = target_dir.join(&source_name);
  let destination_relative_path = relative_path_string(&root, &destination_path);
  let source_relative_path = relative_path_string(&root, &source_path);

  match fs::metadata(&destination_path) {
    Ok(metadata) => {
      if !metadata.is_file() {
        return Err("Destination path exists but is not a file.".to_string());
      }

      let canonical_destination = destination_path
        .canonicalize()
        .map_err(|error| format!("Could not resolve destination quest file: {error}"))?;

      if !canonical_destination.starts_with(&canonical_root) {
        return Err("Destination quest file must be inside the project root.".to_string());
      }

      Ok(ProjectMovePreflightResult {
        exists: true,
        same_source: canonical_destination == canonical_source,
        source_relative_path,
        destination_relative_path,
      })
    }
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
      Ok(ProjectMovePreflightResult {
        exists: false,
        same_source: false,
        source_relative_path,
        destination_relative_path,
      })
    }
    Err(error) => Err(format!("Could not inspect destination quest file: {error}")),
  }
}



#[tauri::command]
fn rename_quest_project_folder(
  project_root_path: String,
  source_relative_path: String,
  new_folder_name: String,
) -> Result<String, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  if source_relative_path.trim().is_empty() {
    return Err("Source folder path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let clean_folder_name = sanitize_file_name(&new_folder_name);

  if clean_folder_name.is_empty() {
    return Err("Folder name is empty.".to_string());
  }

  let canonical_root = root
    .canonicalize()
    .map_err(|error| format!("Could not resolve project root: {error}"))?;

  let mut source_path = root.clone();
  let normalized_source = normalize_relative_path(&source_relative_path);

  if normalized_source.components().next().is_none() {
    return Err("Source folder path is invalid.".to_string());
  }

  source_path.push(normalized_source);

  if !source_path.is_dir() {
    return Err("Source folder does not exist.".to_string());
  }

  let canonical_source = source_path
    .canonicalize()
    .map_err(|error| format!("Could not resolve source folder: {error}"))?;

  if !canonical_source.starts_with(&canonical_root) {
    return Err("Source folder must be inside the project root.".to_string());
  }

  let parent_dir = source_path
    .parent()
    .ok_or_else(|| "Source folder has no parent folder.".to_string())?;

  let canonical_parent_dir = parent_dir
    .canonicalize()
    .map_err(|error| format!("Could not resolve source parent folder: {error}"))?;

  if !canonical_parent_dir.starts_with(&canonical_root) {
    return Err("Source parent folder must be inside the project root.".to_string());
  }

  let destination_path = parent_dir.join(&clean_folder_name);
  let destination_relative_path = relative_path_string(&root, &destination_path);

  if destination_path == source_path {
    return Ok(destination_relative_path);
  }

  if destination_path.exists() {
    return Err("A folder with that name already exists.".to_string());
  }

  fs::rename(&source_path, &destination_path)
    .map_err(|error| format!("Could not rename quest folder: {error}"))?;

  Ok(destination_relative_path)
}

#[tauri::command]
fn move_quest_project_folder(
  project_root_path: String,
  source_relative_path: String,
  target_parent_relative_path: Option<String>,
) -> Result<String, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  if source_relative_path.trim().is_empty() {
    return Err("Source folder path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let canonical_root = root
    .canonicalize()
    .map_err(|error| format!("Could not resolve project root: {error}"))?;

  let mut source_path = root.clone();
  let normalized_source = normalize_relative_path(&source_relative_path);

  if normalized_source.components().next().is_none() {
    return Err("Source folder path is invalid.".to_string());
  }

  source_path.push(normalized_source);

  if !source_path.is_dir() {
    return Err("Source folder does not exist.".to_string());
  }

  let canonical_source = source_path
    .canonicalize()
    .map_err(|error| format!("Could not resolve source folder: {error}"))?;

  if !canonical_source.starts_with(&canonical_root) {
    return Err("Source folder must be inside the project root.".to_string());
  }

  let folder_name = source_path
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Source folder has no valid folder name.".to_string())?
    .to_string();

  let mut target_parent = root.clone();

  if let Some(parent) = target_parent_relative_path {
    let normalized_parent = normalize_relative_path(&parent);

    if normalized_parent.components().next().is_some() {
      target_parent.push(normalized_parent);
    }
  }

  if !target_parent.is_dir() {
    return Err("Target parent folder does not exist.".to_string());
  }

  let canonical_target_parent = target_parent
    .canonicalize()
    .map_err(|error| format!("Could not resolve target parent folder: {error}"))?;

  if !canonical_target_parent.starts_with(&canonical_root) {
    return Err("Target parent folder must be inside the project root.".to_string());
  }

  if canonical_target_parent == canonical_source || canonical_target_parent.starts_with(&canonical_source) {
    return Err("A folder cannot be moved into itself or one of its child folders.".to_string());
  }

  let destination_path = target_parent.join(&folder_name);
  let destination_relative_path = relative_path_string(&root, &destination_path);

  if destination_path.exists() {
    return Err("Destination folder already exists. Folder merge is not supported.".to_string());
  }

  fs::rename(&source_path, &destination_path)
    .map_err(|error| format!("Could not move quest folder: {error}"))?;

  Ok(destination_relative_path)
}

#[tauri::command]
fn move_quest_project_file(
  project_root_path: String,
  source_relative_path: String,
  target_folder_relative_path: Option<String>,
  overwrite: bool,
) -> Result<ProjectMoveResult, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  if source_relative_path.trim().is_empty() {
    return Err("Source quest path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let canonical_root = root
    .canonicalize()
    .map_err(|error| format!("Could not resolve project root: {error}"))?;

  let mut source_path = root.clone();
  let normalized_source = normalize_relative_path(&source_relative_path);

  if normalized_source.components().next().is_none() {
    return Err("Source quest path is invalid.".to_string());
  }

  source_path.push(normalized_source);

  if !source_path.is_file() {
    return Err("Source quest file does not exist.".to_string());
  }

  let source_name = source_path
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Source quest file has no valid file name.".to_string())?
    .to_string();

  if !is_quest_file_name(&source_name) {
    return Err("Source file is not a quest file.".to_string());
  }

  let canonical_source = source_path
    .canonicalize()
    .map_err(|error| format!("Could not resolve source quest file: {error}"))?;

  if !canonical_source.starts_with(&canonical_root) {
    return Err("Source quest file must be inside the project root.".to_string());
  }

  let mut target_dir = root.clone();

  if let Some(target_folder) = target_folder_relative_path {
    let normalized_target_folder = normalize_relative_path(&target_folder);

    if normalized_target_folder.components().next().is_some() {
      target_dir.push(normalized_target_folder);
    }
  }

  if target_dir.exists() && !target_dir.is_dir() {
    return Err("Target folder path exists but is not a directory.".to_string());
  }

  fs::create_dir_all(&target_dir)
    .map_err(|error| format!("Could not create target folder: {error}"))?;

  let canonical_target_dir = target_dir
    .canonicalize()
    .map_err(|error| format!("Could not resolve target folder: {error}"))?;

  if !canonical_target_dir.starts_with(&canonical_root) {
    return Err("Target folder must be inside the project root.".to_string());
  }

  let destination_path = target_dir.join(&source_name);
  let destination_relative_path = relative_path_string(&root, &destination_path);

  let destination_metadata = match fs::metadata(&destination_path) {
    Ok(metadata) => Some(metadata),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
    Err(error) => {
      return Err(format!("Could not inspect destination quest file: {error}"));
    }
  };

  if let Some(metadata) = destination_metadata {
    let canonical_destination = destination_path
      .canonicalize()
      .map_err(|error| format!("Could not resolve destination quest file: {error}"))?;

    if canonical_destination == canonical_source {
      return Ok(ProjectMoveResult {
        moved: false,
        collision: false,
        source_relative_path: relative_path_string(&root, &source_path),
        destination_relative_path,
      });
    }

    if !canonical_destination.starts_with(&canonical_root) {
      return Err("Destination quest file must be inside the project root.".to_string());
    }

    if !metadata.is_file() {
      return Err("Destination path exists but is not a file.".to_string());
    }

    if !overwrite {
      return Ok(ProjectMoveResult {
        moved: false,
        collision: true,
        source_relative_path: relative_path_string(&root, &source_path),
        destination_relative_path,
      });
    }

    fs::remove_file(&destination_path)
      .map_err(|error| format!("Could not overwrite destination quest file: {error}"))?;
  }

  if overwrite {
    fs::rename(&source_path, &destination_path)
      .map_err(|error| format!("Could not move quest file: {error}"))?;
  } else {
    match move_file_without_overwrite(&source_path, &destination_path) {
      Ok(()) => {}
      Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
        return Ok(ProjectMoveResult {
          moved: false,
          collision: true,
          source_relative_path: relative_path_string(&root, &source_path),
          destination_relative_path,
        });
      }
      Err(error) => {
        return Err(format!("Could not move quest file without overwrite: {error}"));
      }
    }
  }

  Ok(ProjectMoveResult {
    moved: true,
    collision: false,
    source_relative_path: relative_path_string(&root, &source_path),
    destination_relative_path,
  })
}


#[tauri::command]
fn write_quest_project_file(
  project_root_path: String,
  quest_relative_path: String,
  contents: String,
) -> Result<String, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  if quest_relative_path.trim().is_empty() {
    return Err("Quest path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let canonical_root = root
    .canonicalize()
    .map_err(|error| format!("Could not resolve project root: {error}"))?;

  let mut target_path = root.clone();
  let normalized_quest_path = normalize_relative_path(&quest_relative_path);

  if normalized_quest_path.components().next().is_none() {
    return Err("Quest path is invalid.".to_string());
  }

  target_path.push(normalized_quest_path);

  let file_name = target_path
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Quest file has no valid file name.".to_string())?
    .to_string();

  if !is_quest_file_name(&file_name) {
    return Err("Target file is not a quest file.".to_string());
  }

  let parent_dir = target_path
    .parent()
    .ok_or_else(|| "Quest file has no parent folder.".to_string())?;

  if !parent_dir.exists() {
    return Err("Quest file parent folder does not exist.".to_string());
  }

  let canonical_parent_dir = parent_dir
    .canonicalize()
    .map_err(|error| format!("Could not resolve quest parent folder: {error}"))?;

  if !canonical_parent_dir.starts_with(&canonical_root) {
    return Err("Quest file must be inside the project root.".to_string());
  }

  if target_path.exists() && !target_path.is_file() {
    return Err("Quest path exists but is not a file.".to_string());
  }

  fs::write(&target_path, contents)
    .map_err(|error| format!("Could not write quest file: {error}"))?;

  Ok(relative_path_string(&root, &target_path))
}

#[tauri::command]
fn scan_quest_project_files(project_root_path: String) -> Result<ProjectScanResult, String> {
  if project_root_path.trim().is_empty() {
    return Err("Project root path is empty.".to_string());
  }

  let root = PathBuf::from(&project_root_path);

  if !root.is_dir() {
    return Err("Project root path is not a directory.".to_string());
  }

  let mut result = ProjectScanResult {
    folders: Vec::new(),
    quest_files: Vec::new(),
    errors: Vec::new(),
  };

  scan_project_directory(&root, &root, &mut result);

  result.folders.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
  result.quest_files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

  Ok(result)
}

fn scan_project_directory(root: &Path, current: &Path, result: &mut ProjectScanResult) {
  let entries = match fs::read_dir(current) {
    Ok(entries) => entries,
    Err(error) => {
      result.errors.push(ProjectScanError {
        kind: "read-directory-failed".to_string(),
        path: relative_path_string(root, current),
        message: error.to_string(),
      });
      return;
    }
  };

  for entry_result in entries {
    let entry = match entry_result {
      Ok(entry) => entry,
      Err(error) => {
        result.errors.push(ProjectScanError {
          kind: "read-entry-failed".to_string(),
          path: relative_path_string(root, current),
          message: error.to_string(),
        });
        continue;
      }
    };

    let path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();

    if name.is_empty() || name.starts_with('.') {
      continue;
    }

    if path.is_dir() {
      result.folders.push(ProjectScanFolder {
        relative_path: relative_path_string(root, &path),
      });
      scan_project_directory(root, &path, result);
      continue;
    }

    if !path.is_file() || !is_quest_file_name(&name) {
      continue;
    }

    match fs::read_to_string(&path) {
      Ok(contents) => result.quest_files.push(ProjectScanQuestFile {
        relative_path: relative_path_string(root, &path),
        absolute_path: path.to_string_lossy().to_string(),
        contents,
      }),
      Err(error) => result.errors.push(ProjectScanError {
        kind: "read-quest-failed".to_string(),
        path: relative_path_string(root, &path),
        message: error.to_string(),
      }),
    }
  }
}

fn is_quest_file_name(name: &str) -> bool {
  let lower = name.to_lowercase();
  lower.ends_with(".quest.json") || lower.ends_with(".quest")
}

fn move_file_without_overwrite(source_path: &Path, destination_path: &Path) -> std::io::Result<()> {
  let mut source_file = fs::File::open(source_path)?;
  let mut destination_file = fs::OpenOptions::new()
    .write(true)
    .create_new(true)
    .open(destination_path)?;

  let mut buffer = Vec::new();
  source_file.read_to_end(&mut buffer)?;
  destination_file.write_all(&buffer)?;
  destination_file.sync_all()?;

  fs::remove_file(source_path)?;

  Ok(())
}

fn sanitize_file_name(name: &str) -> String {
  name
    .chars()
    .map(|ch| match ch {
      '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
      _ => ch,
    })
    .collect::<String>()
    .trim()
    .trim_matches('.')
    .to_string()
}

fn normalize_relative_path(path: &str) -> PathBuf {
  let mut normalized = PathBuf::new();

  for part in path.replace('\\', "/").split('/') {
    let part = part.trim();
    if part.is_empty() || part == "." || part == ".." {
      continue;
    }

    normalized.push(part);
  }

  normalized
}


fn next_available_folder_path(parent_dir: &Path, preferred_folder_name: &str) -> PathBuf {
  let mut candidate = parent_dir.join(preferred_folder_name);

  if !candidate.exists() {
    return candidate;
  }

  for index in 2..10_000 {
    candidate = parent_dir.join(format!("{preferred_folder_name} {index}"));

    if !candidate.exists() {
      return candidate;
    }
  }

  parent_dir.join(format!("{preferred_folder_name}-copy"))
}

fn next_available_file_path(target_dir: &Path, preferred_file_name: &str) -> PathBuf {
  let (stem, extension) = split_quest_file_name(preferred_file_name);

  let mut candidate = target_dir.join(format!("{stem}{extension}"));

  if !candidate.exists() {
    return candidate;
  }

  for index in 2..10_000 {
    let file_name = format!("{stem}({index}){extension}");
    candidate = target_dir.join(file_name);

    if !candidate.exists() {
      return candidate;
    }
  }

  target_dir.join(format!("{stem}-copy{extension}"))
}

fn split_quest_file_name(file_name: &str) -> (String, String) {
  let lower = file_name.to_lowercase();

  if lower.ends_with(".quest.json") {
    let stem = &file_name[..file_name.len() - ".quest.json".len()];
    return (
      if stem.is_empty() { "new-quest" } else { stem }.to_string(),
      ".quest.json".to_string(),
    );
  }

  if lower.ends_with(".quest") {
    let stem = &file_name[..file_name.len() - ".quest".len()];
    return (
      if stem.is_empty() { "new-quest" } else { stem }.to_string(),
      ".quest".to_string(),
    );
  }

  let preferred = PathBuf::from(file_name);
  let stem = preferred
    .file_stem()
    .and_then(|value| value.to_str())
    .unwrap_or("new-quest")
    .to_string();
  let extension = preferred
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| format!(".{value}"))
    .unwrap_or_else(|| ".quest.json".to_string());

  (stem, extension)
}

fn relative_path_string(root: &Path, path: &Path) -> String {
  path.strip_prefix(root)
    .unwrap_or(path)
    .to_string_lossy()
    .replace('\\', "/")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      scan_quest_project_files,
      create_quest_project_file,
      create_quest_project_folder,
      check_quest_project_move_destination,
      move_quest_project_file,
      rename_quest_project_folder,
      move_quest_project_folder,
      write_quest_project_file,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
