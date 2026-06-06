use serde::Serialize;
use std::fs;
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
  let preferred = PathBuf::from(preferred_file_name);
  let stem = preferred
    .file_stem()
    .and_then(|value| value.to_str())
    .unwrap_or("New Quest");
  let extension = preferred
    .extension()
    .and_then(|value| value.to_str())
    .unwrap_or("json");

  let mut candidate = target_dir.join(preferred_file_name);

  if !candidate.exists() {
    return candidate;
  }

  for index in 2..10_000 {
    let file_name = format!("{stem} {index}.{extension}");
    candidate = target_dir.join(file_name);

    if !candidate.exists() {
      return candidate;
    }
  }

  target_dir.join(format!("{stem}-copy.{extension}"))
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
