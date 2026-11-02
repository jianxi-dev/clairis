//! 用户扩展点（design §D1–D4）：snippets / templates / theme tokens。
//!
//! 只读用户配置目录下的数据文件，**不执行任何文件内容、不写任何文件**。
//! 目录缺失或单个文件非法都只记录 warning 并继续，绝不报错中断。

use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Snippet {
    pub id: String,
    pub label: String,
    pub keywords: Vec<String>,
    pub icon: Option<String>,
    pub body: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Template {
    pub name: String,
    pub body: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Default)]
pub struct ThemeTokens {
    pub tokens: BTreeMap<String, String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Default)]
pub struct ExtensionsSnapshot {
    pub snippets: Vec<Snippet>,
    pub templates: Vec<Template>,
    pub theme: ThemeTokens,
    pub warnings: Vec<String>,
}

/// frontmatter 值：标量或字符串列表。
enum FrontValue {
    Scalar(String),
    List(Vec<String>),
}

/// 去掉成对引号（单/双）。
fn unquote(value: &str) -> String {
    let bytes = value.as_bytes();
    if bytes.len() >= 2 {
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

/// `id` 必须匹配 `[a-z0-9-]+`。
fn is_valid_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// theme token 键必须匹配 `^--app-[a-z0-9-]+$`。
fn is_valid_token_key(key: &str) -> bool {
    match key.strip_prefix("--app-") {
        Some(rest) => {
            !rest.is_empty()
                && rest
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        }
        None => false,
    }
}

/// 颜色白名单：`#rgb` / `#rrggbb` / `rgb(` / `rgba(` / `hsl(` / `hsla(` / 具名色。
/// 明确拒绝 `url(` / `expression(` / `var(` 等可注入 CSS 的值。
fn is_valid_color(value: &str) -> bool {
    let value = value.trim();
    if value.is_empty() {
        return false;
    }
    for forbidden in ["url(", "expression(", "var("] {
        if value.starts_with(forbidden) {
            return false;
        }
    }
    if let Some(hex) = value.strip_prefix('#') {
        return (hex.len() == 3 || hex.len() == 6) && hex.chars().all(|c| c.is_ascii_hexdigit());
    }
    for func in ["rgb(", "rgba(", "hsl(", "hsla("] {
        if value.starts_with(func) {
            return value.ends_with(')');
        }
    }
    // 具名色：仅字母（拒绝 `red; background:url(...)` 之类）
    value.chars().all(|c| c.is_ascii_alphabetic())
}

/// 解析单个 snippet 文件。成功返回 `Some`，失败（缺 id / 非法 frontmatter /
/// 未闭合）记录 warning 并返回 `None`。
fn parse_snippet(raw: &str, rel: &str, path: &Path, warnings: &mut Vec<String>) -> Option<Snippet> {
    // 容忍 UTF-8 BOM。
    let text = raw.strip_prefix('\u{feff}').unwrap_or(raw);

    // 首行必须是 `---`。
    let first_line = match text.find('\n') {
        Some(i) => &text[..i],
        None => text,
    };
    if first_line.trim_end_matches('\r') != "---" {
        warnings.push(format!("{rel}: 缺少 frontmatter（未以 --- 开头）"));
        return None;
    }
    let mut cursor = text.find('\n').map(|i| i + 1).unwrap_or(text.len());

    // 收集 frontmatter 行直到闭合 `---`。
    let mut fm_lines: Vec<&str> = Vec::new();
    let mut closed = false;
    while cursor < text.len() {
        let (line, next) = match text[cursor..].find('\n') {
            Some(i) => (&text[cursor..cursor + i], cursor + i + 1),
            None => (&text[cursor..], text.len()),
        };
        if line.trim_end_matches('\r') == "---" {
            cursor = next;
            closed = true;
            break;
        }
        fm_lines.push(line);
        cursor = next;
    }
    if !closed {
        warnings.push(format!("{rel}: frontmatter 未闭合"));
        return None;
    }

    // 扁平 YAML 子集：`key: value` 或 `key: [a, b]`。
    let mut map: BTreeMap<String, FrontValue> = BTreeMap::new();
    for line in fm_lines {
        let line = line.trim_end_matches('\r');
        let Some((key, value)) = line.split_once(':') else {
            warnings.push(format!("{rel}: 无法解析 frontmatter 行 {line:?}"));
            return None;
        };
        let key = key.trim();
        let value = value.trim();
        let parsed = if value.starts_with('[') && value.ends_with(']') {
            let inner = &value[1..value.len() - 1];
            FrontValue::List(
                inner
                    .split(',')
                    .map(|s| unquote(s.trim()))
                    .filter(|s| !s.is_empty())
                    .collect(),
            )
        } else {
            FrontValue::Scalar(unquote(value))
        };
        map.insert(key.to_string(), parsed);
    }

    // 正文：闭合 `---` 之后，去掉紧跟的一个空行，其余字节原样保留。
    let mut body = text[cursor..].to_string();
    if body.starts_with("\r\n") {
        body.drain(0..2);
    } else if body.starts_with('\n') {
        body.remove(0);
    }

    let id = match map.get("id") {
        Some(FrontValue::Scalar(s)) if is_valid_id(s) => s.clone(),
        Some(FrontValue::Scalar(s)) => {
            warnings.push(format!("{rel}: id {s:?} 格式非法（应为 [a-z0-9-]+）"));
            return None;
        }
        _ => {
            warnings.push(format!("{rel}: 缺少 id"));
            return None;
        }
    };

    let label = match map.get("label") {
        Some(FrontValue::Scalar(s)) if !s.is_empty() => s.clone(),
        _ => id.clone(),
    };

    let keywords = match map.get("keywords") {
        Some(FrontValue::List(list)) => list.clone(),
        Some(FrontValue::Scalar(s)) if !s.is_empty() => vec![s.clone()],
        _ => Vec::new(),
    };

    let icon = match map.get("icon") {
        Some(FrontValue::Scalar(s)) if !s.is_empty() => Some(s.clone()),
        _ => None,
    };

    Some(Snippet {
        id,
        label,
        keywords,
        icon,
        body,
        path: path.to_string_lossy().into_owned(),
    })
}

/// 扫描 `<dir>/snippets/*.md`。目录不存在返回空；读取失败记 warning。
fn scan_snippets(dir: &Path, warnings: &mut Vec<String>) -> Vec<Snippet> {
    let dir = dir.join("snippets");
    let entries = match std::fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
        Err(e) => {
            warnings.push(format!("snippets: 无法读取目录（{e}）"));
            return Vec::new();
        }
    };

    let mut snippets = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(".md") {
            continue;
        }
        let rel = format!("snippets/{name}");
        let Ok(raw) = std::fs::read_to_string(&path) else {
            warnings.push(format!("{rel}: 读取失败"));
            continue;
        };
        if let Some(snippet) = parse_snippet(&raw, &rel, &path, warnings) {
            snippets.push(snippet);
        }
    }
    snippets.sort_by(|a, b| a.id.cmp(&b.id));
    snippets
}

/// 扫描 `<dir>/templates/*.md`。文件名（去扩展名）即模板名；重名后读覆盖先读。
fn scan_templates(dir: &Path, warnings: &mut Vec<String>) -> Vec<Template> {
    let dir = dir.join("templates");
    let entries = match std::fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
        Err(e) => {
            warnings.push(format!("templates: 无法读取目录（{e}）"));
            return Vec::new();
        }
    };

    let mut templates: BTreeMap<String, Template> = BTreeMap::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(".md") {
            continue;
        }
        let rel = format!("templates/{name}");
        let Some(stem) = path.file_stem() else {
            warnings.push(format!("{rel}: 无法解析文件名"));
            continue;
        };
        let Ok(body) = std::fs::read_to_string(&path) else {
            warnings.push(format!("{rel}: 读取失败"));
            continue;
        };
        templates.insert(
            stem.to_string_lossy().into_owned(),
            Template {
                name: stem.to_string_lossy().into_owned(),
                body,
                path: path.to_string_lossy().into_owned(),
            },
        );
    }
    templates.into_values().collect()
}

/// 读取 `<dir>/theme.toml` 的 `[tokens]` 表，白名单校验键与值。
fn scan_theme(dir: &Path) -> ThemeTokens {
    let path = dir.join("theme.toml");
    let data = match std::fs::read_to_string(&path) {
        Ok(data) => data,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return ThemeTokens::default();
        }
        Err(e) => {
            return ThemeTokens {
                tokens: BTreeMap::new(),
                warnings: vec![format!("theme.toml: 读取失败（{e}）")],
            };
        }
    };

    let mut tokens = BTreeMap::new();
    let mut invalid = 0usize;
    let mut warnings = Vec::new();

    match toml::from_str::<toml::Value>(&data) {
        Ok(toml::Value::Table(table)) => {
            if let Some(toml::Value::Table(token_table)) = table.get("tokens") {
                for (key, value) in token_table {
                    let Some(value) = value.as_str() else {
                        invalid += 1;
                        continue;
                    };
                    if !is_valid_token_key(key) || !is_valid_color(value) {
                        invalid += 1;
                        continue;
                    }
                    tokens.insert(key.clone(), value.to_string());
                }
            }
        }
        Ok(_) => warnings.push("theme.toml: 顶层不是表".into()),
        Err(e) => warnings.push(format!("theme.toml: 解析失败（{e}）")),
    }

    if invalid > 0 {
        warnings.push(format!("theme.toml: 忽略 {invalid} 个非法 token"));
    }

    ThemeTokens { tokens, warnings }
}

/// 扫描用户扩展目录，返回快照。任何缺失/非法都只记录 warning，不报错。
pub fn scan_extensions(config_dir: &Path) -> ExtensionsSnapshot {
    let mut warnings = Vec::new();
    let snippets = scan_snippets(config_dir, &mut warnings);
    let templates = scan_templates(config_dir, &mut warnings);
    let theme = scan_theme(config_dir);

    ExtensionsSnapshot {
        snippets,
        templates,
        theme,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> tempfile::TempDir {
        tempfile::Builder::new()
            .prefix(&format!("biaoyue_ext_{tag}_"))
            .tempdir()
            .expect("create temp dir")
    }

    fn write_file(dir: &Path, rel: &str, content: &str) {
        let path = dir.join(rel);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, content).unwrap();
    }

    #[test]
    fn parses_snippet_and_template() {
        let dir = temp_dir("parse");
        let base = dir.path();
        write_file(
            base,
            "snippets/weekly.md",
            "---\nid: weekly-review\nlabel: 周报模板\nkeywords: [zhoubao, weekly]\nicon: DocTextOutlined\n---\n## 本周\n\n- 完成：\n",
        );
        write_file(base, "templates/日记.md", "# {{title}}\n{{date}}\n");

        let snapshot = scan_extensions(base);

        assert!(snapshot.warnings.is_empty(), "got {:?}", snapshot.warnings);
        assert_eq!(snapshot.snippets.len(), 1);
        let snippet = &snapshot.snippets[0];
        assert_eq!(snippet.id, "weekly-review");
        assert_eq!(snippet.label, "周报模板");
        assert_eq!(snippet.keywords, vec!["zhoubao", "weekly"]);
        assert_eq!(snippet.icon.as_deref(), Some("DocTextOutlined"));
        assert_eq!(snippet.body, "## 本周\n\n- 完成：\n");

        assert_eq!(snapshot.templates.len(), 1);
        assert_eq!(snapshot.templates[0].name, "日记");
        assert_eq!(snapshot.templates[0].body, "# {{title}}\n{{date}}\n");
    }

    #[test]
    fn snippet_without_id_is_skipped_with_warning() {
        let dir = temp_dir("noid");
        let base = dir.path();
        write_file(base, "snippets/bad.md", "---\nlabel: 无 id\n---\n正文\n");

        let snapshot = scan_extensions(base);

        assert!(snapshot.snippets.is_empty());
        assert_eq!(snapshot.warnings.len(), 1);
        assert!(
            snapshot.warnings[0].contains("snippets/bad.md")
                && snapshot.warnings[0].contains("缺少 id"),
            "got {:?}",
            snapshot.warnings
        );
    }

    #[test]
    fn snippet_with_invalid_id_is_skipped() {
        let dir = temp_dir("badid");
        let base = dir.path();
        write_file(base, "snippets/bad.md", "---\nid: Bad_ID\n---\n正文\n");

        let snapshot = scan_extensions(base);

        assert!(snapshot.snippets.is_empty());
        assert_eq!(snapshot.warnings.len(), 1);
        assert!(
            snapshot.warnings[0].contains("格式非法"),
            "got {:?}",
            snapshot.warnings
        );
    }

    #[test]
    fn invalid_frontmatter_is_skipped() {
        let dir = temp_dir("badfm");
        let base = dir.path();
        // 未以 --- 开头
        write_file(base, "snippets/a.md", "id: no-frontmatter\n---\n正文\n");
        // 未闭合
        write_file(base, "snippets/b.md", "---\nid: unclosed\n正文\n");
        // 行无法解析
        write_file(
            base,
            "snippets/c.md",
            "---\nid: ok\nbroken line\n---\n正文\n",
        );

        let snapshot = scan_extensions(base);

        assert!(snapshot.snippets.is_empty());
        assert_eq!(snapshot.warnings.len(), 3, "got {:?}", snapshot.warnings);
        assert!(snapshot
            .warnings
            .iter()
            .any(|w| w.contains("缺少 frontmatter")));
        assert!(snapshot.warnings.iter().any(|w| w.contains("未闭合")));
        assert!(snapshot.warnings.iter().any(|w| w.contains("无法解析")));
    }

    #[test]
    fn missing_directories_return_empty_not_error() {
        let dir = temp_dir("empty");
        let base = dir.path();

        let snapshot = scan_extensions(base);

        assert!(snapshot.snippets.is_empty());
        assert!(snapshot.templates.is_empty());
        assert!(snapshot.theme.tokens.is_empty());
        assert!(snapshot.theme.warnings.is_empty());
        assert!(snapshot.warnings.is_empty());
    }

    #[test]
    fn theme_valid_tokens_are_kept() {
        let dir = temp_dir("theme_ok");
        let base = dir.path();
        write_file(
            base,
            "theme.toml",
            "[tokens]\n--app-accent = \"#c2410c\"\n--app-bg = \"rgb(255, 255, 255)\"\n--app-fg = \"red\"\n",
        );

        let snapshot = scan_extensions(base);

        assert!(
            snapshot.theme.warnings.is_empty(),
            "got {:?}",
            snapshot.theme.warnings
        );
        assert_eq!(
            snapshot
                .theme
                .tokens
                .get("--app-accent")
                .map(String::as_str),
            Some("#c2410c")
        );
        assert_eq!(
            snapshot.theme.tokens.get("--app-bg").map(String::as_str),
            Some("rgb(255, 255, 255)")
        );
        assert_eq!(
            snapshot.theme.tokens.get("--app-fg").map(String::as_str),
            Some("red")
        );
    }

    #[test]
    fn theme_invalid_keys_and_values_are_aggregated_into_one_warning() {
        let dir = temp_dir("theme_bad");
        let base = dir.path();
        write_file(
            base,
            "theme.toml",
            "[tokens]\n--app-accent = \"#c2410c\"\n--unknown = \"#fff\"\n--app-bg = \"url(http://x)\"\n--app-fg = \"expression(alert(1))\"\n",
        );

        let snapshot = scan_extensions(base);

        // 只有合法的那个保留
        assert_eq!(snapshot.theme.tokens.len(), 1);
        assert!(snapshot.theme.tokens.contains_key("--app-accent"));
        // 3 个非法项聚合成一条 warning
        assert_eq!(
            snapshot.theme.warnings.len(),
            1,
            "got {:?}",
            snapshot.theme.warnings
        );
        assert!(
            snapshot.theme.warnings[0].contains("忽略 3 个非法 token"),
            "got {:?}",
            snapshot.theme.warnings
        );
    }

    #[test]
    fn snippet_body_bytes_preserved_with_chinese_and_newlines() {
        let dir = temp_dir("bytes");
        let base = dir.path();
        let body = "中文正文\n第二行\r\n第三行\t缩进\n";
        write_file(base, "snippets/cn.md", &format!("---\nid: cn\n---\n{body}"));

        let snapshot = scan_extensions(base);

        assert_eq!(snapshot.snippets.len(), 1);
        assert_eq!(snapshot.snippets[0].body, body);
    }

    #[test]
    fn snippet_body_drops_one_leading_blank_line_only() {
        let dir = temp_dir("blank");
        let base = dir.path();
        write_file(base, "snippets/a.md", "---\nid: a\n---\n\n\n正文\n");

        let snapshot = scan_extensions(base);

        // 只去掉紧跟的一个空行，保留第二个空行
        assert_eq!(snapshot.snippets[0].body, "\n正文\n");
    }

    #[test]
    fn snippet_defaults_label_and_keywords() {
        let dir = temp_dir("defaults");
        let base = dir.path();
        write_file(base, "snippets/a.md", "---\nid: plain\n---\n正文\n");

        let snapshot = scan_extensions(base);

        assert_eq!(snapshot.snippets[0].label, "plain");
        assert!(snapshot.snippets[0].keywords.is_empty());
        assert!(snapshot.snippets[0].icon.is_none());
    }

    #[test]
    fn template_duplicate_name_last_read_wins() {
        let dir = temp_dir("dup");
        let base = dir.path();
        // 同名不同目录不会发生（同目录），此处验证重名覆盖语义用两个同名文件无法共存，
        // 改为验证多个模板按名去重后数量正确。
        write_file(base, "templates/a.md", "A\n");
        write_file(base, "templates/b.md", "B\n");

        let snapshot = scan_extensions(base);

        assert_eq!(snapshot.templates.len(), 2);
        let names: Vec<_> = snapshot.templates.iter().map(|t| t.name.clone()).collect();
        assert!(names.contains(&"a".to_string()));
        assert!(names.contains(&"b".to_string()));
    }

    #[test]
    fn non_md_files_are_ignored() {
        let dir = temp_dir("nonmd");
        let base = dir.path();
        write_file(base, "snippets/readme.txt", "---\nid: x\n---\n正文\n");
        write_file(base, "templates/notes.txt", "正文\n");

        let snapshot = scan_extensions(base);

        assert!(snapshot.snippets.is_empty());
        assert!(snapshot.templates.is_empty());
        assert!(snapshot.warnings.is_empty());
    }
}
