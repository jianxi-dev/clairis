use std::fs;

use serde::{Deserialize, Serialize};

use crate::errors::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InboxEntry {
    pub id: String,
    pub content: String,
    pub prefix: String,
    pub captured_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxEntryInput {
    pub id: String,
    pub content: String,
    pub prefix: String,
    pub captured_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxEntryEdit {
    pub date: String,
    pub entry_id: String,
    pub new_content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxEntryDelete {
    pub date: String,
    pub entry_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxEntryArchive {
    pub date: String,
    pub entry_id: String,
}

fn inbox_base_dir() -> Result<std::path::PathBuf, AppError> {
    let home = dirs::home_dir().ok_or(AppError::Io {
        context: "Cannot determine home dir".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, "no home"),
    })?;
    let base = home.join("documents").join("inbox");
    fs::create_dir_all(&base).map_err(|e| AppError::Io {
        context: "create inbox dir".into(),
        source: e,
    })?;
    Ok(base)
}

fn day_file_path(date: &str, active: bool) -> Result<std::path::PathBuf, AppError> {
    let base = inbox_base_dir()?;
    let filename = format!("inbox-{}.md", date);
    if active {
        Ok(base.join(&filename))
    } else {
        fs::create_dir_all(base.join("archive")).map_err(|e| AppError::Io {
            context: "create archive dir".into(),
            source: e,
        })?;
        Ok(base.join("archive").join(&filename))
    }
}

fn format_entry(entry: &InboxEntryInput) -> String {
    let prefix_char = entry.prefix.clone();
    format!(
        "---\ntime: {}\nprefix: {}\n---\n\n{}\n",
        entry.captured_at, prefix_char, entry.content
    )
}

#[tauri::command]
pub fn append_inbox(entry: InboxEntryInput) -> Result<(), AppError> {
    let date = entry.captured_at.split('T').next().unwrap_or("unknown");
    let path = day_file_path(date, true)?;
    let new_content = format_entry(&entry);

    let mut existing = if path.exists() {
        fs::read_to_string(&path).unwrap_or_default()
    } else {
        String::new()
    };
    existing.push_str(&new_content);

    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp file".into(),
        source: e,
    })?;
    fs::write(&tmp, &existing).map_err(|e| AppError::Io {
        context: "write temp".into(),
        source: e,
    })?;
    tmp.persist(&path).map_err(|e| AppError::Io {
        context: "persist".into(),
        source: e.error,
    })?;

    Ok(())
}

#[tauri::command]
pub fn append_inbox_batch(entries: Vec<InboxEntryInput>) -> Result<(), AppError> {
    if entries.is_empty() {
        return Ok(());
    }

    // 按 captured_at 日期分组，保持组内顺序与首次出现顺序
    let mut groups: Vec<(String, Vec<InboxEntryInput>)> = Vec::new();
    for entry in entries {
        let date = entry
            .captured_at
            .split('T')
            .next()
            .unwrap_or("unknown")
            .to_string();
        match groups.iter_mut().find(|(d, _)| *d == date) {
            Some((_, list)) => list.push(entry),
            None => groups.push((date, vec![entry])),
        }
    }

    // 每个 date 一次原子写：读现有 → 追加该 date 全部块 → 临时文件 → persist 替换
    for (date, list) in groups {
        let path = day_file_path(&date, true)?;
        let mut existing = if path.exists() {
            fs::read_to_string(&path).unwrap_or_default()
        } else {
            String::new()
        };
        for entry in &list {
            existing.push_str(&format_entry(entry));
        }

        let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
        let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
            context: "create temp file".into(),
            source: e,
        })?;
        fs::write(&tmp, &existing).map_err(|e| AppError::Io {
            context: "write temp".into(),
            source: e,
        })?;
        tmp.persist(&path).map_err(|e| AppError::Io {
            context: "persist".into(),
            source: e.error,
        })?;
    }

    Ok(())
}

#[tauri::command]
pub fn load_today_inbox() -> Result<Vec<InboxEntry>, AppError> {
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    load_inbox_by_date(date)
}

#[tauri::command]
pub fn load_inbox_by_date(date: String) -> Result<Vec<InboxEntry>, AppError> {
    let path = day_file_path(&date, true)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path)?;

    let mut entries = Vec::new();
    let blocks: Vec<&str> = content.split("\n---\n").collect();
    for block in &blocks {
        let block = block.trim_start_matches('\n').trim_end();
        if block.is_empty() {
            continue;
        }
        if let Some(end) = block.find("\n\n") {
            let frontmatter = &block[..end];
            let body = &block[end + 2..];
            let mut time = String::new();
            let mut prefix = String::new();
            for line in frontmatter.lines() {
                if let Some(t) = line.strip_prefix("time: ") {
                    time = t.to_string();
                } else if let Some(p) = line.strip_prefix("prefix: ") {
                    prefix = p.to_string();
                }
            }
            entries.push(InboxEntry {
                id: format!(
                    "cap-{}-{}",
                    time.replace(':', "_").replace('.', "_"),
                    body.len()
                ),
                prefix,
                content: body.trim().to_string(),
                captured_at: time,
            });
        }
    }
    Ok(entries.into_iter().rev().collect())
}

#[tauri::command]
pub fn edit_inbox_entry(req: InboxEntryEdit) -> Result<(), AppError> {
    let path = day_file_path(&req.date, true)?;
    if !path.exists() {
        return Err(AppError::Io {
            context: "inbox file not found for edit".into(),
            source: std::io::Error::new(std::io::ErrorKind::NotFound, "file not found"),
        });
    }

    let content = fs::read_to_string(&path)?;
    let time_hint = req
        .entry_id
        .rsplit_once('-')
        .map(|(before, _)| {
            before
                .strip_prefix("cap-")
                .unwrap_or(before)
                .replace('_', "-")
        })
        .unwrap_or_else(|| req.entry_id.clone());

    let blocks: Vec<&str> = content.split("\n---\n").collect();
    let mut new_content = String::new();
    let mut found = false;

    for (i, block) in blocks.iter().enumerate() {
        let block = block.trim_start_matches('\n').trim_end();
        if block.is_empty() {
            continue;
        }
        if block.contains(&time_hint) && !found {
            // Preserve original prefix
            let mut orig_prefix = String::new();
            if let Some(end) = block.find("\n\n") {
                for line in block[..end].lines() {
                    if let Some(p) = line.strip_prefix("prefix: ") {
                        orig_prefix = p.to_string();
                    }
                }
            }
            if i > 0 && !new_content.is_empty() {
                new_content.push_str("\n---\n");
            }
            new_content.push_str(&format!(
                "---\ntime: {}\nprefix: {}\n---\n\n{}",
                time_hint, orig_prefix, req.new_content
            ));
            found = true;
            continue;
        }
        if i > 0 && !new_content.is_empty() {
            new_content.push_str("\n---\n");
        }
        new_content.push_str(block);
    }

    if !found {
        if !new_content.is_empty() {
            new_content.push_str("\n---\n");
        }
        new_content.push_str(&format!(
            "---\ntime: edit-{}\nprefix: \n---\n\n{}",
            chrono::Local::now().to_rfc3339(),
            req.new_content
        ));
    }

    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp file for edit".into(),
        source: e,
    })?;
    fs::write(&tmp, &new_content).map_err(|e| AppError::Io {
        context: "write edited content".into(),
        source: e,
    })?;
    tmp.persist(&path).map_err(|e| AppError::Io {
        context: "persist edited file".into(),
        source: e.error,
    })?;

    Ok(())
}

#[tauri::command]
pub fn delete_inbox_entry(req: InboxEntryDelete) -> Result<(), AppError> {
    let path = day_file_path(&req.date, true)?;
    if !path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&path)?;
    let time_hint = req
        .entry_id
        .rsplit_once('-')
        .map(|(before, _)| {
            before
                .strip_prefix("cap-")
                .unwrap_or(before)
                .replace('_', "-")
        })
        .unwrap_or_else(|| req.entry_id.clone());

    let blocks: Vec<&str> = content.split("\n---\n").collect();
    let mut new_content = String::new();
    let mut found = false;

    for (i, block) in blocks.iter().enumerate() {
        let block = block.trim_start_matches('\n').trim_end();
        if block.is_empty() {
            continue;
        }
        if block.contains(&time_hint) && !found {
            found = true;
            continue;
        }
        if i > 0 && !new_content.is_empty() {
            new_content.push_str("\n---\n");
        }
        new_content.push_str(block);
    }

    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp file for delete".into(),
        source: e,
    })?;
    fs::write(&tmp, &new_content).map_err(|e| AppError::Io {
        context: "write after delete".into(),
        source: e,
    })?;
    tmp.persist(&path).map_err(|e| AppError::Io {
        context: "persist deleted file".into(),
        source: e.error,
    })?;

    Ok(())
}

#[tauri::command]
pub fn archive_entry(req: InboxEntryArchive) -> Result<(), AppError> {
    let active_path = day_file_path(&req.date, true)?;
    let archive_path = day_file_path(&req.date, false)?;
    if !active_path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&active_path)?;
    let time_hint = req
        .entry_id
        .rsplit_once('-')
        .map(|(before, _)| {
            before
                .strip_prefix("cap-")
                .unwrap_or(before)
                .replace('_', "-")
        })
        .unwrap_or_else(|| req.entry_id.clone());

    let blocks: Vec<&str> = content.split("\n---\n").collect();
    let mut new_active = String::new();
    let mut archived_text: Option<String> = None;

    for (i, block) in blocks.iter().enumerate() {
        let block = block.trim_start_matches('\n').trim_end();
        if block.is_empty() {
            continue;
        }
        if block.contains(&time_hint) && archived_text.is_none() {
            archived_text = Some(block.to_string());
            continue;
        }
        if i > 0 && !new_active.is_empty() {
            new_active.push_str("\n---\n");
        }
        new_active.push_str(block);
    }

    let dir = active_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp file".into(),
        source: e,
    })?;
    fs::write(&tmp, &new_active).map_err(|e| AppError::Io {
        context: "write active after archive".into(),
        source: e,
    })?;
    tmp.persist(&active_path).map_err(|e| AppError::Io {
        context: "persist active".into(),
        source: e.error,
    })?;

    if let Some(entry_text) = archived_text {
        let mut archive_content = if archive_path.exists() {
            fs::read_to_string(&archive_path).unwrap_or_default()
        } else {
            String::new()
        };
        if !archive_content.is_empty() {
            archive_content.push_str("\n---\n");
        }
        archive_content.push_str(&entry_text);

        let archive_dir = archive_path
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."));
        let tmp_a = tempfile::NamedTempFile::new_in(archive_dir).map_err(|e| AppError::Io {
            context: "create archive temp file".into(),
            source: e,
        })?;
        fs::write(&tmp_a, &archive_content).map_err(|e| AppError::Io {
            context: "write archive".into(),
            source: e,
        })?;
        tmp_a.persist(&archive_path).map_err(|e| AppError::Io {
            context: "persist archive".into(),
            source: e.error,
        })?;
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureConfig {
    pub font_size: Option<u32>,
    pub position_x: Option<i32>,
    pub position_y: Option<i32>,
    pub capsule_x: Option<f64>,
    pub capsule_y: Option<f64>,
    pub pinned: Option<bool>,
    pub overlay_width: Option<i32>,
    pub overlay_height: Option<i32>,
    pub panel_ratio: Option<f64>,
}

fn config_path() -> Result<std::path::PathBuf, AppError> {
    let home = dirs::home_dir().ok_or(AppError::Io {
        context: "Cannot determine home dir".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, "no home"),
    })?;
    let dir = home.join(".clairis");
    fs::create_dir_all(&dir).map_err(|e| AppError::Io {
        context: "create .clairis dir".into(),
        source: e,
    })?;
    Ok(dir.join("config.toml"))
}

#[tauri::command]
pub fn save_config_capture(capture_config: CaptureConfig) -> Result<(), AppError> {
    let path = config_path()?;
    let mut doc: toml::Value = if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        content
            .parse::<toml::Value>()
            .unwrap_or(toml::Value::Table(Default::default()))
    } else {
        toml::Value::Table(Default::default())
    };

    let table = doc.as_table_mut().ok_or_else(|| AppError::Io {
        context: "config is not a table".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, "not a table"),
    })?;

    let capture = table
        .entry("capture".to_string())
        .or_insert_with(|| toml::Value::Table(Default::default()))
        .as_table_mut()
        .ok_or_else(|| AppError::Io {
            context: "capture section is not a table".into(),
            source: std::io::Error::new(std::io::ErrorKind::Other, "not a table"),
        })?;

    if let Some(fs) = capture_config.font_size {
        capture.insert("font_size".to_string(), toml::Value::Integer(fs as i64));
    }
    if let Some(px) = capture_config.position_x {
        capture.insert("position_x".to_string(), toml::Value::Integer(px as i64));
    }
    if let Some(py) = capture_config.position_y {
        capture.insert("position_y".to_string(), toml::Value::Integer(py as i64));
    }
    if let Some(cx) = capture_config.capsule_x {
        capture.insert("capsule_x".to_string(), toml::Value::Float(cx));
    }
    if let Some(cy) = capture_config.capsule_y {
        capture.insert("capsule_y".to_string(), toml::Value::Float(cy));
    }
    if let Some(p) = capture_config.pinned {
        capture.insert("pinned".to_string(), toml::Value::Boolean(p));
    }
    if let Some(w) = capture_config.overlay_width {
        capture.insert("overlay_width".to_string(), toml::Value::Integer(w as i64));
    }
    if let Some(h) = capture_config.overlay_height {
        capture.insert("overlay_height".to_string(), toml::Value::Integer(h as i64));
    }
    if let Some(r) = capture_config.panel_ratio {
        capture.insert("panel_ratio".to_string(), toml::Value::Float(r));
    }

    let toml_str = toml::to_string_pretty(&doc).map_err(|e| AppError::Io {
        context: "serialize config".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
    })?;

    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp config".into(),
        source: e,
    })?;
    fs::write(&tmp, &toml_str).map_err(|e| AppError::Io {
        context: "write config".into(),
        source: e,
    })?;
    tmp.persist(&path).map_err(|e| AppError::Io {
        context: "persist config".into(),
        source: e.error,
    })?;

    Ok(())
}

#[tauri::command]
pub fn set_overlay_pinned(app: tauri::AppHandle, pinned: bool) -> Result<(), AppError> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("overlay") {
        window.set_always_on_top(pinned).map_err(|e| AppError::Io {
            context: "set always on top".into(),
            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
        })?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_overlay_window(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("overlay") {
        window.show().map_err(|e| AppError::Io {
            context: "show overlay".into(),
            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
        })?;
        window.set_focus().map_err(|e| AppError::Io {
            context: "focus overlay".into(),
            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
        })?;
    }
    Ok(())
}

#[tauri::command]
pub fn hide_overlay_window(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("overlay") {
        window.hide().map_err(|e| AppError::Io {
            context: "hide overlay".into(),
            source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
        })?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_config_capture() -> Result<CaptureConfig, AppError> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(CaptureConfig {
            font_size: Some(15),
            position_x: None,
            position_y: None,
            capsule_x: None,
            capsule_y: None,
            pinned: None,
            overlay_width: None,
            overlay_height: None,
            panel_ratio: None,
        });
    }
    let content = fs::read_to_string(&path)?;
    let doc: toml::Value = content.parse::<toml::Value>().map_err(|e| AppError::Io {
        context: "parse config.toml".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
    })?;

    let font_size = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("font_size"))
        .and_then(|v: &toml::Value| v.as_integer())
        .map(|v| v as u32);
    let position_x = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("position_x"))
        .and_then(|v: &toml::Value| v.as_integer())
        .map(|v| v as i32);
    let position_y = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("position_y"))
        .and_then(|v: &toml::Value| v.as_integer())
        .map(|v| v as i32);
    let capsule_x = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("capsule_x"))
        .and_then(|v: &toml::Value| v.as_float());
    let capsule_y = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("capsule_y"))
        .and_then(|v: &toml::Value| v.as_float());
    let pinned = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("pinned"))
        .and_then(|v: &toml::Value| v.as_bool());
    let overlay_width = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("overlay_width"))
        .and_then(|v: &toml::Value| v.as_integer())
        .map(|v| v as i32);
    let overlay_height = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("overlay_height"))
        .and_then(|v: &toml::Value| v.as_integer())
        .map(|v| v as i32);
    let panel_ratio = doc
        .get("capture")
        .and_then(|c: &toml::Value| c.get("panel_ratio"))
        .and_then(|v: &toml::Value| v.as_float());

    Ok(CaptureConfig {
        font_size,
        position_x,
        position_y,
        capsule_x,
        capsule_y,
        pinned,
        overlay_width,
        overlay_height,
        panel_ratio,
    })
}
