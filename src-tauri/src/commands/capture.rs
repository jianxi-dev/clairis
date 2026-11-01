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

#[cfg(test)]
static TEST_INBOX_BASE: std::sync::Mutex<Option<std::path::PathBuf>> = std::sync::Mutex::new(None);

#[cfg(test)]
fn set_test_inbox_base(dir: std::path::PathBuf) {
    *TEST_INBOX_BASE.lock().unwrap() = Some(dir);
}

fn inbox_base_dir() -> Result<std::path::PathBuf, AppError> {
    #[cfg(test)]
    {
        if let Some(dir) = TEST_INBOX_BASE.lock().unwrap().clone() {
            fs::create_dir_all(&dir).map_err(|e| AppError::Io {
                context: "create test inbox dir".into(),
                source: e,
            })?;
            return Ok(dir);
        }
    }
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

/// time → id 嵌入编码（冒号/点 → 下划线），load 生成 id 与 CRUD 反解必须共用同一函数。
fn encode_time_key(time: &str) -> String {
    time.replace(':', "_").replace('.', "_")
}

/// 从 entry_id 提取 time_key（去掉 "cap-" 前缀与 "-{长度}" 后缀，保留编码）。
fn time_key_from_entry_id(entry_id: &str) -> String {
    entry_id
        .rsplit_once('-')
        .map(|(before, _)| before.strip_prefix("cap-").unwrap_or(before).to_string())
        .unwrap_or_else(|| entry_id.to_string())
}

/// 块是否属于给定 time_key 的条目：行级解析 frontmatter 的 time 行并编码比较。
fn block_matches_time_key(block: &str, time_key: &str) -> bool {
    block.lines().any(|line| {
        line.strip_prefix("time: ")
            .map(|t| encode_time_key(t) == time_key)
            .unwrap_or(false)
    })
}

/// 归一化切块：按 "\n---\ntime: " 切分后，块 0 保留 "---\n" 前缀、其余块以裸时间值开头。
/// 统一为 "time: {t}\nprefix: {p}\n---\n\n{content}" 的规范形态；空块返回 None。
fn normalize_block(raw: &str) -> Option<String> {
    let t = raw.trim_start_matches('\n').trim_end();
    if t.is_empty() {
        return None;
    }
    let bare = t.strip_prefix("---\n").unwrap_or(t);
    if bare.starts_with("time: ") {
        Some(bare.to_string())
    } else {
        Some(format!("time: {bare}"))
    }
}

/// 把裸块（time: ... 开头）重组成与 append 写入一致的条目文件格式。
fn join_blocks(blocks: &[String]) -> String {
    if blocks.is_empty() {
        return String::new();
    }
    let mut out = String::from("---\n");
    out.push_str(&blocks.join("\n---\n"));
    out
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
    // 不能按 "\n---\n" 切分：块内收尾的 "---\n\n" 也含该子串，会误切。
    for block in content.split("---\ntime: ").skip(1) {
        let block = block.trim_end();
        if block.is_empty() {
            continue;
        }
        let mut parts = block.splitn(2, "\n---\n\n");
        let frontmatter = parts.next().unwrap_or("");
        let body = parts.next().unwrap_or("").trim();
        // split("---\ntime: ") 已吞掉 "time: " 前缀：frontmatter 第一行即为 time 值；
        // 若未来格式改回带前缀，也兼容剥除。
        let mut lines = frontmatter.lines();
        let first = lines.next().unwrap_or("");
        let time = first.strip_prefix("time: ").unwrap_or(first).to_string();
        let mut prefix = String::new();
        for line in lines {
            if let Some(p) = line.strip_prefix("prefix: ") {
                prefix = p.to_string();
            }
        }
        entries.push(InboxEntry {
            id: format!("cap-{}-{}", encode_time_key(&time), body.len()),
            prefix,
            content: body.to_string(),
            captured_at: time,
        });
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
    let time_key = time_key_from_entry_id(&req.entry_id);

    let mut rebuilt: Vec<String> = Vec::new();
    let mut found = false;

    for raw_block in content.split("\n---\ntime: ") {
        let Some(bare) = normalize_block(raw_block) else {
            continue;
        };
        if !found && block_matches_time_key(&bare, &time_key) {
            let orig_time = bare
                .lines()
                .find_map(|l| l.strip_prefix("time: "))
                .unwrap_or(&time_key)
                .to_string();
            let mut orig_prefix = String::new();
            for line in bare.lines().take_while(|l| !l.starts_with("---")) {
                if let Some(p) = line.strip_prefix("prefix: ") {
                    orig_prefix = p.to_string();
                }
            }
            rebuilt.push(format!(
                "time: {}\nprefix: {}\n---\n\n{}",
                orig_time, orig_prefix, req.new_content
            ));
            found = true;
        } else {
            rebuilt.push(bare);
        }
    }

    if !found {
        rebuilt.push(format!(
            "time: edit-{}\nprefix: \n---\n\n{}",
            chrono::Local::now().to_rfc3339(),
            req.new_content
        ));
    }

    let new_content = join_blocks(&rebuilt);

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
    let time_key = time_key_from_entry_id(&req.entry_id);

    let mut rebuilt: Vec<String> = Vec::new();
    let mut found = false;
    for raw_block in content.split("\n---\ntime: ") {
        let Some(bare) = normalize_block(raw_block) else {
            continue;
        };
        if !found && block_matches_time_key(&bare, &time_key) {
            found = true;
        } else {
            rebuilt.push(bare);
        }
    }
    let new_content = join_blocks(&rebuilt);

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
    let time_key = time_key_from_entry_id(&req.entry_id);

    let mut rebuilt: Vec<String> = Vec::new();
    let mut archived: Option<String> = None;
    for raw_block in content.split("\n---\ntime: ") {
        let Some(bare) = normalize_block(raw_block) else {
            continue;
        };
        if archived.is_none() && block_matches_time_key(&bare, &time_key) {
            archived = Some(bare);
        } else {
            rebuilt.push(bare);
        }
    }

    let dir = active_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp file".into(),
        source: e,
    })?;
    fs::write(&tmp, join_blocks(&rebuilt)).map_err(|e| AppError::Io {
        context: "write active after archive".into(),
        source: e,
    })?;
    tmp.persist(&active_path).map_err(|e| AppError::Io {
        context: "persist active".into(),
        source: e.error,
    })?;

    if let Some(bare) = archived {
        let mut archive_content = if archive_path.exists() {
            fs::read_to_string(&archive_path).unwrap_or_default()
        } else {
            String::new()
        };
        if archive_content.trim_end().is_empty() {
            archive_content = format!("---\n{}", bare);
        } else {
            archive_content.push_str(&format!("\n---\n{}", bare));
        }

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
#[serde(rename_all = "camelCase")]
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

fn migrate_legacy_capture_config(legacy: &std::path::Path, target: &std::path::Path) {
    if target.exists() || legacy == target || !legacy.exists() {
        return;
    }
    let _ = fs::copy(legacy, target);
}

fn config_path() -> Result<std::path::PathBuf, AppError> {
    let home = dirs::home_dir().ok_or(AppError::Io {
        context: "Cannot determine home dir".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, "no home"),
    })?;
    let dir = home.join(".biaoyue");
    fs::create_dir_all(&dir).map_err(|e| AppError::Io {
        context: "create .biaoyue dir".into(),
        source: e,
    })?;
    let path = dir.join("config.toml");
    let legacy = home.join(".clairis").join("config.toml");
    migrate_legacy_capture_config(&legacy, &path);
    Ok(path)
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    // 测试共享 TEST_INBOX_BASE 静态，串行化避免并行测试互相覆盖
    static TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn setup_inbox_dir(label: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "biaoyue_test_inbox_{}_{}",
            label,
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        set_test_inbox_base(dir.clone());
        dir
    }

    fn entry(id: &str, date: &str, prefix: &str, content: &str) -> InboxEntryInput {
        InboxEntryInput {
            id: id.to_string(),
            content: content.to_string(),
            prefix: prefix.to_string(),
            captured_at: format!("{}T10:00:00.000Z", date),
        }
    }

    #[test]
    fn append_inbox_batch_same_date_writes_three_blocks() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("same_date");
        let entries = vec![
            entry("a", "2026-08-01", "-", "first"),
            entry("b", "2026-08-01", ">", "second"),
            entry("c", "2026-08-01", "*", "third"),
        ];
        let result = append_inbox_batch(entries);
        assert!(result.is_ok());

        let path = dir.join("inbox-2026-08-01.md");
        assert!(path.exists(), "file should exist");
        let content = fs::read_to_string(&path).unwrap();
        let block_count = content.matches("---\ntime: ").count();
        assert_eq!(block_count, 3, "expected 3 blocks: {:?}", content);

        // 块序与输入一致，content/prefix 正确
        assert!(content.contains("time: 2026-08-01T10:00:00.000Z\nprefix: -\n---\n\nfirst"));
        assert!(content.contains("time: 2026-08-01T10:00:00.000Z\nprefix: >\n---\n\nsecond"));
        assert!(content.contains("time: 2026-08-01T10:00:00.000Z\nprefix: *\n---\n\nthird"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn append_inbox_batch_different_dates_write_two_files() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("two_dates");
        let entries = vec![
            entry("a", "2026-08-01", "-", "first day"),
            entry("b", "2026-08-02", ">", "second day"),
        ];
        let result = append_inbox_batch(entries);
        assert!(result.is_ok());

        assert!(dir.join("inbox-2026-08-01.md").exists());
        assert!(dir.join("inbox-2026-08-02.md").exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn append_inbox_batch_read_back_via_load_inbox_by_date() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("read_back");
        let entries = vec![
            entry("a", "2026-08-01", "-", "first"),
            entry("b", "2026-08-01", ">", "second"),
            entry("c", "2026-08-01", "*", "third"),
        ];
        append_inbox_batch(entries).unwrap();

        let loaded = load_inbox_by_date("2026-08-01".to_string()).unwrap();
        // load_inbox_by_date 返回倒序（最新在前）
        assert_eq!(loaded.len(), 3);
        assert_eq!(loaded[0].content, "third");
        assert_eq!(loaded[0].prefix, "*");
        assert_eq!(loaded[1].content, "second");
        assert_eq!(loaded[1].prefix, ">");
        assert_eq!(loaded[2].content, "first");
        assert_eq!(loaded[2].prefix, "-");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn append_inbox_batch_empty_entries_writes_nothing() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("empty");
        let result = append_inbox_batch(vec![]);
        assert!(result.is_ok());

        let entries: Vec<_> = fs::read_dir(&dir).unwrap().collect();
        assert!(entries.is_empty(), "dir should be empty: {:?}", entries);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn edit_inbox_entry_replaces_matching_block() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("edit_found");
        append_inbox_batch(vec![
            InboxEntryInput {
                id: "a".into(),
                content: "original".into(),
                prefix: "-".into(),
                captured_at: "2026-08-02T10:00:00.000Z".into(),
            },
            InboxEntryInput {
                id: "b".into(),
                content: "keep-me".into(),
                prefix: ">".into(),
                captured_at: "2026-08-02T10:00:01.000Z".into(),
            },
        ])
        .unwrap();

        let loaded = load_inbox_by_date("2026-08-02".into()).unwrap();
        let target = loaded
            .iter()
            .find(|e| e.content == "original")
            .expect("original entry");
        let result = edit_inbox_entry(InboxEntryEdit {
            date: "2026-08-02".into(),
            entry_id: target.id.clone(),
            new_content: "edited".into(),
        });
        assert!(result.is_ok());

        let after = load_inbox_by_date("2026-08-02".into()).unwrap();
        let edited = after
            .iter()
            .find(|e| e.content == "edited")
            .expect("edited");
        assert_eq!(edited.prefix, "-", "prefix must be preserved");
        assert!(after.iter().all(|e| e.content != "original"));
        assert!(
            after.iter().any(|e| e.content == "keep-me"),
            "other blocks untouched"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn edit_inbox_entry_missing_entry_appends_edit_block() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("edit_miss");
        append_inbox_batch(vec![entry("a", "2026-08-02", "-", "original")]).unwrap();

        let result = edit_inbox_entry(InboxEntryEdit {
            date: "2026-08-02".into(),
            entry_id: "cap-1990_01_01T00_00_00_000Z-99".into(),
            new_content: "fallback".into(),
        });
        assert!(result.is_ok());

        let after = load_inbox_by_date("2026-08-02".into()).unwrap();
        assert_eq!(after.len(), 2, "fallback append adds a new block");
        assert!(after.iter().any(|e| e.content == "original"));
        assert!(after.iter().any(|e| e.content == "fallback"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn edit_inbox_entry_missing_file_errors() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("edit_absent_file");
        let result = edit_inbox_entry(InboxEntryEdit {
            date: "2026-08-02".into(),
            entry_id: "cap-x-1".into(),
            new_content: "nope".into(),
        });
        assert!(result.is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn delete_inbox_entry_removes_matching_block_only() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("delete_found");
        append_inbox_batch(vec![
            InboxEntryInput {
                id: "a".into(),
                content: "first".into(),
                prefix: "-".into(),
                captured_at: "2026-08-02T10:00:00.000Z".into(),
            },
            InboxEntryInput {
                id: "b".into(),
                content: "second".into(),
                prefix: ">".into(),
                captured_at: "2026-08-02T10:00:01.000Z".into(),
            },
            InboxEntryInput {
                id: "c".into(),
                content: "third".into(),
                prefix: "*".into(),
                captured_at: "2026-08-02T10:00:02.000Z".into(),
            },
        ])
        .unwrap();

        let loaded = load_inbox_by_date("2026-08-02".into()).unwrap();
        let target = loaded
            .iter()
            .find(|e| e.content == "second")
            .expect("second entry");
        let result = delete_inbox_entry(InboxEntryDelete {
            date: "2026-08-02".into(),
            entry_id: target.id.clone(),
        });
        assert!(result.is_ok());

        let after = load_inbox_by_date("2026-08-02".into()).unwrap();
        assert_eq!(after.len(), 2);
        assert!(after.iter().all(|e| e.content != "second"));
        assert!(after.iter().any(|e| e.content == "first"));
        assert!(after.iter().any(|e| e.content == "third"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn delete_inbox_entry_missing_file_is_noop() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("delete_absent_file");
        let result = delete_inbox_entry(InboxEntryDelete {
            date: "2026-08-02".into(),
            entry_id: "cap-x-1".into(),
        });
        assert!(
            result.is_ok(),
            "delete of absent file must be a silent no-op"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn archive_entry_moves_block_to_archive_file() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("archive_move");
        append_inbox_batch(vec![
            InboxEntryInput {
                id: "a".into(),
                content: "first".into(),
                prefix: "-".into(),
                captured_at: "2026-08-02T10:00:00.000Z".into(),
            },
            InboxEntryInput {
                id: "b".into(),
                content: "doomed".into(),
                prefix: ">".into(),
                captured_at: "2026-08-02T10:00:01.000Z".into(),
            },
        ])
        .unwrap();

        let loaded = load_inbox_by_date("2026-08-02".into()).unwrap();
        let doomed = loaded
            .iter()
            .find(|e| e.content == "doomed")
            .expect("doomed entry");
        let result = archive_entry(InboxEntryArchive {
            date: "2026-08-02".into(),
            entry_id: doomed.id.clone(),
        });
        assert!(result.is_ok());

        let active = load_inbox_by_date("2026-08-02".into()).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].content, "first");

        let archive_path = dir.join("archive").join("inbox-2026-08-02.md");
        assert!(archive_path.exists(), "archive file created");
        let archive_text = fs::read_to_string(&archive_path).unwrap();
        assert!(archive_text.contains("doomed"));
        assert!(!archive_text.contains("first"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn archive_entry_missing_active_file_is_noop() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("archive_absent");
        let result = archive_entry(InboxEntryArchive {
            date: "2026-08-02".into(),
            entry_id: "cap-x-1".into(),
        });
        assert!(
            result.is_ok(),
            "archive of absent file must be a silent no-op"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn append_inbox_single_roundtrips() {
        let _guard = TEST_LOCK.lock().unwrap();
        let dir = setup_inbox_dir("append_single");
        let result = append_inbox(entry("solo", "2026-08-02", "?", "solo-entry"));
        assert!(result.is_ok());

        let loaded = load_inbox_by_date("2026-08-02".into()).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].content, "solo-entry");
        assert_eq!(loaded[0].prefix, "?");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn migrate_legacy_capture_config_copies_once_without_overwrite() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "biaoyue_test_capture_migrate_{}_{}",
            std::process::id(),
            nanos
        ));
        let legacy = root.join(".clairis").join("config.toml");
        let target = root.join(".biaoyue").join("config.toml");
        fs::create_dir_all(legacy.parent().unwrap()).unwrap();
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(&legacy, "theme = \"dark\"\n").unwrap();

        migrate_legacy_capture_config(&legacy, &target);

        assert!(target.exists());
        assert!(fs::read_to_string(&target).unwrap().contains("dark"));
        assert!(legacy.exists());

        fs::write(&target, "theme = \"warm\"\n").unwrap();
        fs::write(&legacy, "theme = \"cold\"\n").unwrap();

        migrate_legacy_capture_config(&legacy, &target);

        let kept = fs::read_to_string(&target).unwrap();
        assert!(kept.contains("warm"));
        assert!(!kept.contains("cold"));

        let _ = fs::remove_dir_all(&root);
    }
}
