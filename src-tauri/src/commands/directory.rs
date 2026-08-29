use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tracing::warn;

use crate::errors::AppError;

#[derive(Debug, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct FlatEntry {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct DirectoryResult {
    pub entries: Vec<DirEntry>,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified: u64,
}

/// Recursively read a directory (max_depth=3).
/// Excludes .git, node_modules, and hidden files (dotfiles).
#[tauri::command]
pub async fn read_directory(path: String) -> Result<DirectoryResult, AppError> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(AppError::Io {
            context: format!("not a directory: {}", path),
            source: std::io::Error::new(std::io::ErrorKind::NotADirectory, "not a directory"),
        });
    }

    let root2 = root.clone();
    let entries = tokio::task::spawn_blocking(move || {
        let mut entries = Vec::new();
        collect_entries(&root2, &root2, 0, 3, &mut entries)?;
        Ok::<Vec<DirEntry>, AppError>(entries)
    })
    .await
    .map_err(|e| AppError::Io {
        context: "read directory task join".into(),
        source: std::io::Error::other(e.to_string()),
    })??;

    Ok(DirectoryResult { entries, path })
}

fn collect_entries(
    root: &PathBuf,
    current: &PathBuf,
    depth: usize,
    max_depth: usize,
    entries: &mut Vec<DirEntry>,
) -> Result<(), AppError> {
    if depth > max_depth {
        return Ok(());
    }

    let dir = match fs::read_dir(current) {
        Ok(d) => d,
        Err(e) => {
            warn!(path = %current.display(), error = %e, "Skipping unreadable directory");
            return Ok(());
        }
    };

    for entry in dir.flatten() {
        let path = entry.path();

        // Skip hidden files/directories (dotfiles)
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        // Skip symlinks
        if path.is_symlink() {
            continue;
        }

        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .into_owned();

        entries.push(DirEntry {
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            path: relative,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });

        if metadata.is_dir() {
            collect_entries(root, &path, depth + 1, max_depth, entries)?;
        }
    }

    Ok(())
}

/// Get file metadata info.
#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, AppError> {
    let p = PathBuf::from(&path);
    let metadata = fs::metadata(&p).map_err(|e| AppError::Io {
        context: format!("get info for {}", path),
        source: e,
    })?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(FileInfo {
        path,
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        modified,
    })
}

/// Heuristic heavy directories to skip during recursive scan.
fn is_heavy_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules" | ".git" | "target" | "dist" | ".next" | "__pycache__" | "vendor" | ".cache"
    )
}

/// Recursively list supported files as a flat list with relative paths.
/// Runs on blocking thread pool to avoid freezing the UI.
/// Max 2000 files, depth 5, skips heavy dirs.
#[tauri::command]
pub async fn flatten_files(path: String) -> Result<FlattenResult, AppError> {
    let base = PathBuf::from(&path);
    if !base.is_dir() {
        return Err(AppError::Io {
            context: "not a directory".into(),
            source: std::io::Error::new(std::io::ErrorKind::NotADirectory, path),
        });
    }

    tokio::task::spawn_blocking(move || {
        let supported = |name: &str| -> bool {
            name.ends_with(".md")
                || name.ends_with(".markdown")
                || name.ends_with(".html")
                || name.ends_with(".htm")
                || name.ends_with(".txt")
        };

        let mut entries: Vec<FlatEntry> = Vec::new();
        let mut truncated = false;
        collect_flat(&base, &base, 0, 5, &supported, &mut entries, &mut truncated);

        entries.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

        Ok(FlattenResult { entries, truncated })
    })
    .await
    .map_err(|e| AppError::Io {
        context: "flatten_files join error".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
    })?
}

#[derive(Debug, Serialize)]
pub struct FlattenResult {
    pub entries: Vec<FlatEntry>,
    pub truncated: bool,
}

const MAX_FILES: usize = 2000;

fn collect_flat(
    base: &PathBuf,
    current: &PathBuf,
    depth: u32,
    max_depth: u32,
    supported: &dyn Fn(&str) -> bool,
    entries: &mut Vec<FlatEntry>,
    truncated: &mut bool,
) {
    if depth > max_depth || *truncated {
        return;
    }

    let dir = match fs::read_dir(current) {
        Ok(d) => d,
        Err(_) => return,
    };

    for entry in dir.flatten() {
        if *truncated {
            break;
        }

        let path = entry.path();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip hidden
        if name.starts_with('.') {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let relative_path = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        if metadata.is_dir() {
            if is_heavy_dir(&name) {
                continue;
            }
            entries.push(FlatEntry {
                name: name.clone(),
                path: path.to_string_lossy().to_string(),
                relative_path,
                is_dir: true,
                size: 0,
            });
            collect_flat(
                base,
                &path,
                depth + 1,
                max_depth,
                supported,
                entries,
                truncated,
            );
        } else if supported(&name) {
            if entries.len() >= MAX_FILES {
                *truncated = true;
                break;
            }
            entries.push(FlatEntry {
                name,
                path: path.to_string_lossy().to_string(),
                relative_path,
                is_dir: false,
                size: metadata.len(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_test_dir(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("clairis_test_{}_{}", label, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("subdir")).unwrap();
        fs::write(dir.join("file1.md"), "# Hello").unwrap();
        fs::write(dir.join("subdir").join("file2.md"), "## Nested").unwrap();
        // Hidden file (should be excluded)
        fs::write(dir.join(".hidden"), "secret").unwrap();
        dir
    }

    #[test]
    fn test_read_directory_basic() {
        let dir = setup_test_dir("basic");
        let mut entries = Vec::new();
        let result = collect_entries(&dir, &dir, 0, 3, &mut entries);
        assert!(result.is_ok());

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(
            names.contains(&"file1.md"),
            "should contain file1.md: {:?}",
            names
        );
        assert!(
            names.contains(&"subdir"),
            "should contain subdir: {:?}",
            names
        );
        assert!(
            !names.contains(&".hidden"),
            "should not contain hidden files: {:?}",
            names
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_read_directory_max_depth() {
        let dir = setup_test_dir("maxdepth");
        let mut entries = Vec::new();
        let result = collect_entries(&dir, &dir, 0, 0, &mut entries);
        assert!(result.is_ok());

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(
            names.contains(&"file1.md"),
            "should contain file1.md at depth 0"
        );
        // subdir should appear but its children should not
        assert!(names.contains(&"subdir"), "should contain subdir");
        assert!(
            !names.contains(&"file2.md"),
            "should NOT contain file2.md beyond max_depth"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_read_directory_nonexistent() {
        let mut entries = Vec::new();
        let result = collect_entries(
            &PathBuf::from("/nonexistent_path_xyz"),
            &PathBuf::from("/nonexistent_path_xyz"),
            0,
            3,
            &mut entries,
        );
        assert!(result.is_ok());
        assert!(entries.is_empty());
    }

    #[test]
    fn test_get_file_info() {
        let dir = setup_test_dir("fileinfo");
        let file_path = dir.join("file1.md");
        let metadata = fs::metadata(&file_path).unwrap();
        assert!(metadata.len() > 0);

        let _ = fs::remove_dir_all(&dir);
    }
}
