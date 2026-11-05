//! 扩展包管理（layout-portal §9）：`<config_base>/extensions/<id>/` 下的
//! `manifest.json` + `SKILL.md` 包。
//!
//! 只读写包文件本身，**绝不执行包内任何内容**。内置包是静态的，常驻启用、不可
//! 卸载 / 导出。用户包用目录名作为 id，`.disabled` 标记文件表示停用（不改用户
//! manifest）。
//!
//! 目录布局：
//! - `<config_base>/extensions/<id>/manifest.json`
//! - `<config_base>/extensions/<id>/SKILL.md`
//! - `<config_base>/extensions/<id>/.disabled`（可选，停用标记）
//! - `<config_base>/exports/<id>-<timestamp>.zip`（导出产物）

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tracing::warn;

use crate::config::config_base;
use crate::errors::AppError;

const MANIFEST_FILE: &str = "manifest.json";
const SKILL_FILE: &str = "SKILL.md";
const DISABLED_MARKER: &str = ".disabled";

// ── zip 解压资源上限（防 zip bomb）─────────────────────────────
/// 单个 zip 最多条目数。
const MAX_ZIP_ENTRIES: usize = 2000;
/// 解压后总字节数上限（所有文件之和）。
const MAX_ZIP_TOTAL_BYTES: u64 = 64 * 1024 * 1024;
/// 单个条目解压后字节数上限。
const MAX_ZIP_FILE_BYTES: u64 = 16 * 1024 * 1024;

/// 内置包 id：静态、常驻启用、不可卸载 / 导出。
const BUILTIN_READING: &str = "builtin-reading";
const BUILTIN_OUTLINE: &str = "builtin-outline";

const BUILTIN_READING_SKILL: &str = "# 内置阅读\n\n\
标月内置的阅读辅助能力：阅读进度、目录导航与排版相关的基础支持。\n\n\
本扩展由应用自带，始终启用，不可卸载或导出。\n";

const BUILTIN_OUTLINE_SKILL: &str = "# 内置大纲\n\n\
标月内置的大纲辅助能力：标题层级解析与大纲生成的基础支持。\n\n\
本扩展由应用自带，始终启用，不可卸载或导出。\n";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    /// "builtin" | "ai" | "user"
    pub source: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionPackage {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: String,
    pub enabled: bool,
    /// null for built-ins
    pub dir: Option<String>,
    /// full SKILL.md text
    pub skill: String,
}

// ── 错误辅助 ─────────────────────────────────────────────────

fn io(context: &str, source: std::io::Error) -> AppError {
    AppError::Io {
        context: context.into(),
        source,
    }
}

fn validation(context: &str, message: impl Into<String>) -> AppError {
    AppError::Validation {
        context: context.into(),
        message: message.into(),
    }
}

fn zip_err(context: &str, source: zip::result::ZipError) -> AppError {
    validation(context, format!("zip 处理失败：{source}"))
}

// ── 目录布局 ─────────────────────────────────────────────────

fn extensions_dir_base(base: &Path) -> PathBuf {
    base.join("extensions")
}

fn exports_dir_base(base: &Path) -> PathBuf {
    base.join("exports")
}

// ── 校验 ─────────────────────────────────────────────────────

/// `id` 必须匹配 `[a-z0-9-]+`。
fn is_valid_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn is_builtin(id: &str) -> bool {
    matches!(id, BUILTIN_READING | BUILTIN_OUTLINE)
}

fn validate_manifest(manifest: &ExtensionManifest) -> Result<(), AppError> {
    if !is_valid_id(&manifest.id) {
        return Err(validation(
            "manifest.id",
            format!("id {:?} 格式非法（应为 [a-z0-9-]+）", manifest.id),
        ));
    }
    if manifest.name.trim().is_empty() {
        return Err(validation("manifest.name", "name 不能为空"));
    }
    if manifest.version.trim().is_empty() {
        return Err(validation("manifest.version", "version 不能为空"));
    }
    if !matches!(manifest.source.as_str(), "builtin" | "ai" | "user") {
        return Err(validation(
            "manifest.source",
            format!("source {:?} 不属于 builtin|ai|user", manifest.source),
        ));
    }
    Ok(())
}

// ── 读取单个包目录 ───────────────────────────────────────────

/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
fn read_package_dir(dir: &Path) -> Result<(ExtensionManifest, String), AppError> {
    let manifest_path = dir.join(MANIFEST_FILE);
    let raw = std::fs::read_to_string(&manifest_path)
        .map_err(|e| io(&format!("read {}", manifest_path.display()), e))?;
    let manifest: ExtensionManifest =
        serde_json::from_str(&raw).map_err(|e| AppError::Serialization {
            context: format!("parse {}", manifest_path.display()),
            source: e,
        })?;

    let skill_path = dir.join(SKILL_FILE);
    let skill = std::fs::read_to_string(&skill_path)
        .map_err(|e| io(&format!("read {}", skill_path.display()), e))?;

    Ok((manifest, skill))
}

fn package_enabled(dir: &Path) -> bool {
    !dir.join(DISABLED_MARKER).exists()
}

/// 优先取根目录；根目录不含包时，若恰好只有一个子目录含包则下钻一层。
fn locate_zip_root(dir: &Path) -> Option<PathBuf> {
    let has_package = |p: &Path| p.join(MANIFEST_FILE).is_file() && p.join(SKILL_FILE).is_file();
    if has_package(dir) {
        return Some(dir.to_path_buf());
    }
    let mut candidates = Vec::new();
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if path.is_dir() && has_package(&path) {
            candidates.push(path);
        }
    }
    if candidates.len() == 1 {
        candidates.pop()
    } else {
        None
    }
}

fn to_package(manifest: ExtensionManifest, dir: &Path, skill: String) -> ExtensionPackage {
    ExtensionPackage {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        source: manifest.source,
        enabled: package_enabled(dir),
        dir: Some(dir.to_string_lossy().into_owned()),
        skill,
    }
}

// ── 内置包 ───────────────────────────────────────────────────

fn builtin_packages() -> Vec<ExtensionPackage> {
    vec![
        ExtensionPackage {
            id: BUILTIN_READING.into(),
            name: "内置阅读".into(),
            version: "0.1.0".into(),
            description: "标月内置的阅读辅助能力（进度、目录、排版）。".into(),
            source: "builtin".into(),
            enabled: true,
            dir: None,
            skill: BUILTIN_READING_SKILL.into(),
        },
        ExtensionPackage {
            id: BUILTIN_OUTLINE.into(),
            name: "内置大纲".into(),
            version: "0.1.0".into(),
            description: "标月内置的大纲辅助能力（标题解析、大纲生成）。".into(),
            source: "builtin".into(),
            enabled: true,
            dir: None,
            skill: BUILTIN_OUTLINE_SKILL.into(),
        },
    ]
}

fn builtin_by_id(id: &str) -> Option<ExtensionPackage> {
    builtin_packages().into_iter().find(|p| p.id == id)
}

// ── 命令实现（核心逻辑按 base 目录拆分，便于单测）─────────────

/// 列出内置包 + 用户包（按 id 升序）。目录缺失只返回内置包；单个包非法只告警跳过。
pub fn list_extension_packages_at(base: &Path) -> Result<Vec<ExtensionPackage>, AppError> {
    let mut packages = builtin_packages();
    let dir = extensions_dir_base(base);

    let entries = match std::fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(packages),
        Err(e) => return Err(io("list extension packages", e)),
    };

    let mut user_packages = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().into_owned();
        if !is_valid_id(&id) {
            warn!(dir = %id, "扩展目录名非法，已跳过");
            continue;
        }
        if is_builtin(&id) {
            warn!(dir = %id, "内置扩展 id 不可被用户目录占用，已跳过");
            continue;
        }
        match read_package_dir(&path) {
            Ok((manifest, skill)) => {
                if manifest.id != id {
                    warn!(
                        dir = %id,
                        manifest_id = %manifest.id,
                        "扩展目录名与 manifest.id 不一致，已跳过"
                    );
                    continue;
                }
                user_packages.push(to_package(manifest, &path, skill));
            }
            Err(e) => {
                warn!(dir = %id, error = %e, "扩展包无法解析，已跳过");
            }
        }
    }
    user_packages.sort_by(|a, b| a.id.cmp(&b.id));
    packages.extend(user_packages);
    Ok(packages)
}

struct ResolvedSource {
    manifest: ExtensionManifest,
    skill: String,
    dir: PathBuf,
    /// 必须活到复制完成，否则 zip 解压目录会被提前删除。
    _temp: Option<tempfile::TempDir>,
}

fn resolve_import_source(path: &str) -> Result<ResolvedSource, AppError> {
    let src = PathBuf::from(path);
    let meta = std::fs::metadata(&src).map_err(|e| io(&format!("import source {path}"), e))?;

    if meta.is_dir() {
        let (manifest, skill) = read_package_dir(&src)?;
        validate_manifest(&manifest)?;
        return Ok(ResolvedSource {
            manifest,
            skill,
            dir: src,
            _temp: None,
        });
    }

    if meta.is_file() {
        let is_zip = src
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("zip"))
            .unwrap_or(false);
        if !is_zip {
            return Err(validation(
                "import",
                format!("不支持的导入源类型：{path}（应为文件夹或 .zip）"),
            ));
        }
        let temp = tempfile::tempdir().map_err(|e| io("create temp dir", e))?;
        let temp_path = temp.path().to_path_buf();
        extract_zip(&src, &temp_path)?;
        // Finder「压缩」等工具会生成 `folder/manifest.json` 的嵌套 zip，这里下钻一层。
        let root = locate_zip_root(&temp_path).ok_or_else(|| {
            validation(
                "import",
                format!("zip 内缺少 {MANIFEST_FILE} 与 {SKILL_FILE}：{path}"),
            )
        })?;
        let (manifest, skill) = read_package_dir(&root)?;
        validate_manifest(&manifest)?;
        return Ok(ResolvedSource {
            manifest,
            skill,
            dir: root,
            _temp: Some(temp),
        });
    }

    Err(validation(
        "import",
        format!("导入源不存在或不可读：{path}"),
    ))
}

/// 递归复制目录。拒绝符号链接，避免把包外内容带进来。
fn copy_dir(src: &Path, dst: &Path) -> Result<(), AppError> {
    std::fs::create_dir_all(dst).map_err(|e| io(&format!("create {}", dst.display()), e))?;
    for entry in std::fs::read_dir(src).map_err(|e| io(&format!("read {}", src.display()), e))? {
        let entry = entry.map_err(|e| io("read dir entry", e))?;
        let file_type = entry.file_type().map_err(|e| io("read file type", e))?;
        let target = dst.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else if file_type.is_file() {
            std::fs::copy(entry.path(), &target).map_err(|e| {
                io(
                    &format!("copy {} → {}", entry.path().display(), target.display()),
                    e,
                )
            })?;
        } else {
            return Err(validation(
                "import",
                format!("扩展包内不支持符号链接：{}", entry.path().display()),
            ));
        }
    }
    Ok(())
}

/// 导入文件夹或 zip；id 已存在则整体替换。默认启用（源里若带 `.disabled`
/// 标记则原样保留，保证导出 → 再导入的严格相等）。
///
/// 先复制到 `<extensions>/.tmp-<id>-<hash>` 暂存目录，成功后才移除旧目标并
/// 原子 rename。复制 / 校验失败时暂存目录被删除，已安装的旧包保持不变；源目录
/// 就是目标目录（自导入）时，暂存副本先读完整旧目录，因此不会丢数据。
pub fn import_extension_package_at(base: &Path, path: &str) -> Result<ExtensionPackage, AppError> {
    let ResolvedSource {
        manifest,
        skill,
        dir,
        _temp,
    } = resolve_import_source(path)?;

    if is_builtin(&manifest.id) {
        return Err(validation(
            "import",
            format!("内置扩展 id {} 不可导入", manifest.id),
        ));
    }

    let extensions = extensions_dir_base(base);
    std::fs::create_dir_all(&extensions)
        .map_err(|e| io(&format!("create {}", extensions.display()), e))?;
    let staging = extensions.join(format!(".tmp-{}-{}", manifest.id, short_hash(path)));
    if staging.exists() {
        let _ = std::fs::remove_dir_all(&staging);
    }

    let copy_result = copy_dir(&dir, &staging);
    if let Err(e) = copy_result {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(e);
    }

    let target = extensions.join(&manifest.id);
    if target.exists() {
        std::fs::remove_dir_all(&target)
            .map_err(|e| io(&format!("remove old package {}", target.display()), e))?;
    }
    std::fs::rename(&staging, &target).map_err(|e| {
        io(
            &format!("rename {} → {}", staging.display(), target.display()),
            e,
        )
    })?;
    drop(_temp);

    Ok(ExtensionPackage {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        source: manifest.source,
        enabled: package_enabled(&target),
        dir: Some(target.to_string_lossy().into_owned()),
        skill,
    })
}

/// 安全拼接 zip 条目名：拒绝绝对路径与 `..` 穿越。
fn safe_join(base: &Path, entry_name: &str) -> Option<PathBuf> {
    let rel = Path::new(entry_name);
    if rel.is_absolute() {
        return None;
    }
    let mut out = base.to_path_buf();
    for comp in rel.components() {
        match comp {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if !out.starts_with(base) {
        return None;
    }
    Some(out)
}

/// 解压 zip 到 dest。拒绝绝对路径、`..` 穿越与符号链接条目；
/// 并强制条目数 / 单文件 / 总字节数上限，防 zip bomb。
fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), AppError> {
    let file = std::fs::File::open(zip_path)
        .map_err(|e| io(&format!("open {}", zip_path.display()), e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| zip_err("open zip", e))?;

    let entry_count = archive.len();
    if entry_count > MAX_ZIP_ENTRIES {
        return Err(validation(
            "zip",
            format!("zip 条目数 {entry_count} 超过上限 {MAX_ZIP_ENTRIES}",),
        ));
    }

    let mut total_bytes: u64 = 0;
    for index in 0..entry_count {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| zip_err("read zip entry", e))?;
        let raw_name = entry.name().to_string();

        let out_path = safe_join(dest, &raw_name)
            .ok_or_else(|| validation("zip", format!("zip 条目包含非法路径：{raw_name}")))?;

        if entry.is_symlink() {
            return Err(validation(
                "zip",
                format!("zip 条目为符号链接，已拒绝：{raw_name}"),
            ));
        }

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| io(&format!("create {}", out_path.display()), e))?;
            continue;
        }

        let declared = entry.size();
        if declared > MAX_ZIP_FILE_BYTES {
            return Err(validation(
                "zip",
                format!(
                    "zip 条目 {raw_name} 声明大小 {declared} 超过单文件上限 {MAX_ZIP_FILE_BYTES}",
                ),
            ));
        }
        let new_total = total_bytes.saturating_add(declared);
        if new_total > MAX_ZIP_TOTAL_BYTES {
            return Err(validation(
                "zip",
                format!("zip 解压总字节 {new_total} 超过上限 {MAX_ZIP_TOTAL_BYTES}"),
            ));
        }

        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| io(&format!("create {}", parent.display()), e))?;
        }
        let mut out = std::fs::File::create(&out_path)
            .map_err(|e| io(&format!("create {}", out_path.display()), e))?;
        let room = MAX_ZIP_FILE_BYTES.min(MAX_ZIP_TOTAL_BYTES - total_bytes);
        let copied = std::io::copy(&mut entry.by_ref().take(room + 1), &mut out)
            .map_err(|e| io(&format!("extract {raw_name}"), e))?;
        if copied > room {
            return Err(validation(
                "zip",
                format!("zip 条目 {raw_name} 实际解压 {copied} 字节，超过单文件 / 总量上限"),
            ));
        }
        total_bytes += copied;
    }
    Ok(())
}

fn package_dir_at(base: &Path, id: &str) -> Result<PathBuf, AppError> {
    if !is_valid_id(id) {
        return Err(validation(
            "extensionPackage",
            format!("非法的扩展 id：{id}"),
        ));
    }
    let dir = extensions_dir_base(base).join(id);
    if !dir.is_dir() {
        return Err(validation("extensionPackage", format!("扩展不存在：{id}")));
    }
    Ok(dir)
}

pub fn set_extension_package_enabled_at(
    base: &Path,
    id: &str,
    enabled: bool,
) -> Result<(), AppError> {
    if is_builtin(id) {
        return Err(validation(
            "extensionPackage",
            "内置扩展始终启用，不可修改启用状态",
        ));
    }
    let dir = package_dir_at(base, id)?;
    let marker = dir.join(DISABLED_MARKER);
    if enabled {
        if marker.exists() {
            std::fs::remove_file(&marker)
                .map_err(|e| io(&format!("remove {}", marker.display()), e))?;
        }
    } else {
        std::fs::write(&marker, b"").map_err(|e| io(&format!("write {}", marker.display()), e))?;
    }
    Ok(())
}

pub fn remove_extension_package_at(base: &Path, id: &str) -> Result<(), AppError> {
    if is_builtin(id) {
        return Err(validation("extensionPackage", "内置扩展不可卸载"));
    }
    let dir = package_dir_at(base, id)?;
    std::fs::remove_dir_all(&dir).map_err(|e| io(&format!("remove {}", dir.display()), e))?;
    Ok(())
}

fn add_dir_entries<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    base: &Path,
    dir: &Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), AppError> {
    let entries = std::fs::read_dir(dir).map_err(|e| io(&format!("read {}", dir.display()), e))?;
    for entry in entries {
        let entry = entry.map_err(|e| io("read dir entry", e))?;
        let path = entry.path();
        let rel = path
            .strip_prefix(base)
            .map_err(|e| validation("zip", e.to_string()))?;
        let name = rel.to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            zip.add_directory(format!("{name}/"), options)
                .map_err(|e| zip_err("zip directory", e))?;
            add_dir_entries(zip, base, &path, options)?;
        } else {
            zip.start_file(name, options)
                .map_err(|e| zip_err("zip file", e))?;
            let data =
                std::fs::read(&path).map_err(|e| io(&format!("read {}", path.display()), e))?;
            zip.write_all(&data)
                .map_err(|e| io(&format!("write zip entry {}", path.display()), e))?;
        }
    }
    Ok(())
}

fn zip_dir(src: &Path, out: &Path) -> Result<(), AppError> {
    let file =
        std::fs::File::create(out).map_err(|e| io(&format!("create {}", out.display()), e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    add_dir_entries(&mut zip, src, src, options)?;
    zip.finish().map_err(|e| zip_err("finish zip", e))?;
    Ok(())
}

pub fn package_extension_package_at(base: &Path, id: &str) -> Result<String, AppError> {
    if is_builtin(id) {
        return Err(validation("extensionPackage", "内置扩展不可导出"));
    }
    let dir = package_dir_at(base, id)?;
    let exports = exports_dir_base(base);
    std::fs::create_dir_all(&exports)
        .map_err(|e| io(&format!("create {}", exports.display()), e))?;
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S-%6f");
    let out = exports.join(format!("{id}-{stamp}.zip"));
    zip_dir(&dir, &out)?;
    Ok(out.to_string_lossy().into_owned())
}

fn slugify(prompt: &str) -> String {
    let mut slug = String::new();
    let mut pending_dash = false;
    for ch in prompt.chars() {
        if ch.is_ascii_alphanumeric() {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            pending_dash = false;
            slug.push(ch.to_ascii_lowercase());
        } else {
            pending_dash = true;
        }
    }
    if slug.is_empty() {
        slug.push_str("generated");
    }
    if slug.len() > 24 {
        slug.truncate(24);
        while slug.ends_with('-') {
            slug.pop();
        }
    }
    slug
}

fn short_hash(value: &str) -> String {
    let mut hash: u32 = 0x811c9dc5;
    for byte in value.as_bytes() {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("{hash:08x}")
}

fn title_from(prompt: &str) -> String {
    let first = prompt.lines().next().unwrap_or(prompt).trim();
    if first.is_empty() {
        return "AI 扩展".to_string();
    }
    first.chars().take(40).collect()
}

fn render_skill(title: &str, prompt: &str) -> String {
    format!(
        "# {title}\n\n\
> 本扩展由标月的本地确定性生成器创建（不联网）。\n\n\
## 目标\n\n{prompt}\n\n\
## 能力\n\n\
- 围绕上述目标提供背景知识与约束。\n\
- 在标月的 Markdown 阅读 / 编辑上下文中生效。\n\n\
## 使用方式\n\n\
1. 直接描述你的需求。\n\
2. 本扩展作为背景知识参与回答。\n\n\
## 约束\n\n\
- 不臆造目标中未声明的功能。\n\
- 不提供可执行代码或命令。\n"
    )
}

pub fn generate_extension_package_at(
    base: &Path,
    prompt: &str,
) -> Result<ExtensionPackage, AppError> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err(validation("extensionPackage", "提示词不能为空"));
    }

    let id = format!("ai-{}-{}", slugify(&prompt), short_hash(&prompt));
    let title = title_from(&prompt);
    let skill = render_skill(&title, &prompt);
    let manifest = ExtensionManifest {
        id: id.clone(),
        name: title.clone(),
        version: "0.1.0".into(),
        description: prompt.clone(),
        source: "ai".into(),
    };

    let dir = extensions_dir_base(base).join(&id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)
            .map_err(|e| io(&format!("remove old package {}", dir.display()), e))?;
    }
    std::fs::create_dir_all(&dir).map_err(|e| io(&format!("create {}", dir.display()), e))?;
    let manifest_json =
        serde_json::to_string_pretty(&manifest).map_err(|e| AppError::Serialization {
            context: "extension manifest".into(),
            source: e,
        })?;
    std::fs::write(dir.join(MANIFEST_FILE), manifest_json)
        .map_err(|e| io(&format!("write {}", dir.join(MANIFEST_FILE).display()), e))?;
    std::fs::write(dir.join(SKILL_FILE), &skill)
        .map_err(|e| io(&format!("write {}", dir.join(SKILL_FILE).display()), e))?;

    Ok(ExtensionPackage {
        id,
        name: title,
        version: "0.1.0".into(),
        description: prompt,
        source: "ai".into(),
        enabled: true,
        dir: Some(dir.to_string_lossy().into_owned()),
        skill,
    })
}

pub fn read_extension_skill_at(base: &Path, id: &str) -> Result<String, AppError> {
    if let Some(package) = builtin_by_id(id) {
        return Ok(package.skill);
    }
    let dir = package_dir_at(base, id)?;
    let (_, skill) = read_package_dir(&dir)?;
    Ok(skill)
}

/// 汇总当前启用中的用户 / AI 扩展，拼成一段给 AI agent 的背景知识。
/// 内置扩展（`source == "builtin"`）不注入；停用的扩展不注入；无扩展时返回空串。
pub fn enabled_skill_context_at(base: &Path) -> Result<String, AppError> {
    let mut sections = Vec::new();
    for package in list_extension_packages_at(base)? {
        if !package.enabled || package.source == "builtin" {
            continue;
        }
        sections.push(format!("## 扩展：{}\n\n{}", package.name, package.skill));
    }
    Ok(sections.join("\n\n---\n\n"))
}

#[tauri::command]
pub async fn list_extension_packages(app: AppHandle) -> Result<Vec<ExtensionPackage>, AppError> {
    let base = config_base(&app);
    tauri::async_runtime::spawn_blocking(move || list_extension_packages_at(&base))
        .await
        .map_err(|e| AppError::Io {
            context: "list extension packages task join".into(),
            source: std::io::Error::other(e.to_string()),
        })?
}

#[tauri::command]
pub async fn import_extension_package(
    app: AppHandle,
    path: String,
) -> Result<ExtensionPackage, AppError> {
    let base = config_base(&app);
    tauri::async_runtime::spawn_blocking(move || import_extension_package_at(&base, &path))
        .await
        .map_err(|e| AppError::Io {
            context: "import extension package task join".into(),
            source: std::io::Error::other(e.to_string()),
        })?
}

#[tauri::command]
pub async fn set_extension_package_enabled(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<(), AppError> {
    let base = config_base(&app);
    tauri::async_runtime::spawn_blocking(move || {
        set_extension_package_enabled_at(&base, &id, enabled)
    })
    .await
    .map_err(|e| AppError::Io {
        context: "set extension package enabled task join".into(),
        source: std::io::Error::other(e.to_string()),
    })?
}

#[tauri::command]
pub async fn remove_extension_package(app: AppHandle, id: String) -> Result<(), AppError> {
    let base = config_base(&app);
    tauri::async_runtime::spawn_blocking(move || remove_extension_package_at(&base, &id))
        .await
        .map_err(|e| AppError::Io {
            context: "remove extension package task join".into(),
            source: std::io::Error::other(e.to_string()),
        })?
}

#[tauri::command]
pub async fn package_extension_package(app: AppHandle, id: String) -> Result<String, AppError> {
    let base = config_base(&app);
    tauri::async_runtime::spawn_blocking(move || package_extension_package_at(&base, &id))
        .await
        .map_err(|e| AppError::Io {
            context: "package extension package task join".into(),
            source: std::io::Error::other(e.to_string()),
        })?
}

#[tauri::command]
pub async fn pick_extension_source(
    app: AppHandle,
    kind: String,
) -> Result<Option<String>, AppError> {
    let picked = match kind.as_str() {
        "folder" => app.dialog().file().blocking_pick_folder(),
        "zip" => app
            .dialog()
            .file()
            .add_filter("扩展包", &["zip"])
            .blocking_pick_file(),
        other => {
            return Err(validation(
                "pick_extension_source",
                format!("未知的选取类型：{other}"),
            ));
        }
    };
    Ok(picked
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn generate_extension_package(
    app: AppHandle,
    prompt: String,
) -> Result<ExtensionPackage, AppError> {
    let base = config_base(&app);
    tauri::async_runtime::spawn_blocking(move || generate_extension_package_at(&base, &prompt))
        .await
        .map_err(|e| AppError::Io {
            context: "generate extension package task join".into(),
            source: std::io::Error::other(e.to_string()),
        })?
}

#[tauri::command]
pub async fn read_extension_skill(app: AppHandle, id: String) -> Result<String, AppError> {
    let base = config_base(&app);
    tauri::async_runtime::spawn_blocking(move || read_extension_skill_at(&base, &id))
        .await
        .map_err(|e| AppError::Io {
            context: "read extension skill task join".into(),
            source: std::io::Error::other(e.to_string()),
        })?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_base(tag: &str) -> tempfile::TempDir {
        tempfile::Builder::new()
            .prefix(&format!("biaoyue_extpkg_{tag}_"))
            .tempdir()
            .expect("create temp dir")
    }

    fn write_package(base: &Path, id: &str, source: &str, name: &str) -> PathBuf {
        let dir = base.join("extensions").join(id);
        std::fs::create_dir_all(&dir).unwrap();
        let manifest = serde_json::json!({
            "id": id,
            "name": name,
            "version": "1.2.3",
            "description": format!("{name} 的描述"),
            "source": source,
        });
        std::fs::write(
            dir.join(MANIFEST_FILE),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
        std::fs::write(dir.join(SKILL_FILE), format!("# {name}\n\n正文\n")).unwrap();
        dir
    }

    #[test]
    fn list_returns_builtins_and_user_packages_with_disabled_flag() {
        let dir = temp_base("list");
        let base = dir.path().to_path_buf();
        write_package(&base, "user-one", "user", "用户扩展一");
        write_package(&base, "ai-two", "ai", "AI 扩展二");
        std::fs::write(base.join("extensions/ai-two").join(DISABLED_MARKER), b"").unwrap();

        let packages = list_extension_packages_at(&base).unwrap();

        let ids: Vec<&str> = packages.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids[0], BUILTIN_READING);
        assert_eq!(ids[1], BUILTIN_OUTLINE);
        assert!(ids.contains(&"user-one"));
        assert!(ids.contains(&"ai-two"));

        let builtin = &packages[0];
        assert_eq!(builtin.source, "builtin");
        assert!(builtin.enabled);
        assert!(builtin.dir.is_none());

        let user = packages.iter().find(|p| p.id == "user-one").unwrap();
        assert!(user.enabled);
        assert!(user.dir.as_deref().unwrap().ends_with("user-one"));
        assert_eq!(user.skill, "# 用户扩展一\n\n正文\n");

        let ai = packages.iter().find(|p| p.id == "ai-two").unwrap();
        assert!(!ai.enabled, ".disabled 标记应反映为停用");
    }

    #[test]
    fn list_without_extensions_dir_returns_only_builtins() {
        let dir = temp_base("empty");
        let base = dir.path().to_path_buf();
        let packages = list_extension_packages_at(&base).unwrap();
        assert_eq!(packages.len(), 2);
        assert!(packages.iter().all(|p| p.source == "builtin"));
    }

    #[test]
    fn import_folder_copies_manifest_and_skill_and_enables() {
        let dir = temp_base("import");
        let base = dir.path().to_path_buf();
        let src = base.join("incoming");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(
            src.join(MANIFEST_FILE),
            r#"{"id":"my-ext","name":"我的扩展","version":"0.1.0","description":"d","source":"user"}"#,
        )
        .unwrap();
        std::fs::write(src.join(SKILL_FILE), "# 我的扩展\n\n技能正文\n").unwrap();

        let package = import_extension_package_at(&base, src.to_str().unwrap()).unwrap();

        assert_eq!(package.id, "my-ext");
        assert_eq!(package.name, "我的扩展");
        assert_eq!(package.version, "0.1.0");
        assert_eq!(package.source, "user");
        assert!(package.enabled);
        assert_eq!(package.skill, "# 我的扩展\n\n技能正文\n");

        let installed = base.join("extensions/my-ext");
        assert!(installed.join(MANIFEST_FILE).exists());
        assert!(installed.join(SKILL_FILE).exists());
        assert!(!installed.join(DISABLED_MARKER).exists());
    }

    #[test]
    fn builtin_ids_cannot_be_imported_or_shadowed_by_user_dirs() {
        let dir = temp_base("builtin-collision");
        let base = dir.path().to_path_buf();
        write_package(&base, BUILTIN_READING, "user", "影子扩展");

        let packages = list_extension_packages_at(&base).unwrap();
        assert_eq!(packages.len(), 2, "内置 id 的用户目录应被跳过");
        assert_eq!(
            packages.iter().filter(|p| p.id == BUILTIN_READING).count(),
            1
        );

        let src = base.join("incoming-builtin");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(
            src.join(MANIFEST_FILE),
            format!(
                r#"{{"id":"{BUILTIN_READING}","name":"x","version":"0.1.0","description":"d","source":"user"}}"#
            ),
        )
        .unwrap();
        std::fs::write(src.join(SKILL_FILE), "# x\n").unwrap();

        assert!(import_extension_package_at(&base, src.to_str().unwrap()).is_err());
    }

    #[test]
    fn import_replaces_existing_package() {
        let dir = temp_base("replace");
        let base = dir.path().to_path_buf();
        write_package(&base, "dup", "user", "旧版本");

        let src = base.join("incoming");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(
            src.join(MANIFEST_FILE),
            r#"{"id":"dup","name":"新版本","version":"2.0.0","description":"d","source":"user"}"#,
        )
        .unwrap();
        std::fs::write(src.join(SKILL_FILE), "# 新版本\n").unwrap();

        let package = import_extension_package_at(&base, src.to_str().unwrap()).unwrap();
        assert_eq!(package.name, "新版本");
        assert_eq!(package.version, "2.0.0");
    }

    #[test]
    fn self_import_keeps_installed_package_intact() {
        let dir = temp_base("self-import");
        let base = dir.path().to_path_buf();
        let installed = write_package(&base, "self-ext", "user", "自导入扩展");
        let skill_before = std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap();
        let manifest_before = std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap();

        let package =
            import_extension_package_at(&base, installed.to_str().unwrap()).expect("自导入应成功");

        assert_eq!(package.id, "self-ext");
        assert_eq!(package.name, "自导入扩展");
        assert!(installed.is_dir(), "自导入后包目录应仍然存在");
        assert_eq!(
            std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap(),
            skill_before
        );
        assert_eq!(
            std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap(),
            manifest_before
        );
    }

    #[test]
    fn failed_replace_leaves_existing_package_untouched() {
        let dir = temp_base("failed-replace");
        let base = dir.path().to_path_buf();
        let installed = write_package(&base, "keep-me", "user", "旧版本");
        let manifest_before = std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap();
        let skill_before = std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap();

        let src = base.join("incoming-with-symlink");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(
            src.join(MANIFEST_FILE),
            r#"{"id":"keep-me","name":"新版本","version":"2.0.0","description":"d","source":"user"}"#,
        )
        .unwrap();
        std::fs::write(src.join(SKILL_FILE), "# 新版本\n").unwrap();
        let outside = base.join("outside.txt");
        std::fs::write(&outside, "包外内容").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, src.join("link.txt")).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_file(&outside, src.join("link.txt")).unwrap();

        let err = import_extension_package_at(&base, src.to_str().unwrap())
            .expect_err("含符号链接的源应被拒绝");
        assert!(matches!(err, AppError::Validation { .. }), "got {err:?}");

        assert!(installed.is_dir(), "失败的替换不应删除旧包");
        assert_eq!(
            std::fs::read_to_string(installed.join(MANIFEST_FILE)).unwrap(),
            manifest_before
        );
        assert_eq!(
            std::fs::read_to_string(installed.join(SKILL_FILE)).unwrap(),
            skill_before
        );
        assert!(
            !installed.join("link.txt").exists(),
            "符号链接不应出现在旧包目录"
        );
    }

    #[test]
    fn import_rejects_invalid_manifest_and_missing_skill() {
        let dir = temp_base("invalid");
        let base = dir.path().to_path_buf();

        // 非法 id
        let bad_id = base.join("bad-id");
        std::fs::create_dir_all(&bad_id).unwrap();
        std::fs::write(
            bad_id.join(MANIFEST_FILE),
            r#"{"id":"Bad_ID","name":"x","version":"1.0.0","description":"d","source":"user"}"#,
        )
        .unwrap();
        std::fs::write(bad_id.join(SKILL_FILE), "# x\n").unwrap();
        assert!(import_extension_package_at(&base, bad_id.to_str().unwrap()).is_err());

        // 缺 SKILL.md
        let no_skill = base.join("no-skill");
        std::fs::create_dir_all(&no_skill).unwrap();
        std::fs::write(
            no_skill.join(MANIFEST_FILE),
            r#"{"id":"no-skill","name":"x","version":"1.0.0","description":"d","source":"user"}"#,
        )
        .unwrap();
        assert!(import_extension_package_at(&base, no_skill.to_str().unwrap()).is_err());

        // manifest 不是 JSON
        let bad_json = base.join("bad-json");
        std::fs::create_dir_all(&bad_json).unwrap();
        std::fs::write(bad_json.join(MANIFEST_FILE), "not json").unwrap();
        std::fs::write(bad_json.join(SKILL_FILE), "# x\n").unwrap();
        assert!(import_extension_package_at(&base, bad_json.to_str().unwrap()).is_err());

        // 非法 source
        let bad_source = base.join("bad-source");
        std::fs::create_dir_all(&bad_source).unwrap();
        std::fs::write(
            bad_source.join(MANIFEST_FILE),
            r#"{"id":"bad-source","name":"x","version":"1.0.0","description":"d","source":"whatever"}"#,
        )
        .unwrap();
        std::fs::write(bad_source.join(SKILL_FILE), "# x\n").unwrap();
        assert!(import_extension_package_at(&base, bad_source.to_str().unwrap()).is_err());
    }

    #[test]
    fn toggle_writes_and_removes_disabled_marker() {
        let dir = temp_base("toggle");
        let base = dir.path().to_path_buf();
        write_package(&base, "toggle-me", "user", "开关扩展");

        set_extension_package_enabled_at(&base, "toggle-me", false).unwrap();
        assert!(base
            .join("extensions/toggle-me")
            .join(DISABLED_MARKER)
            .exists());
        let packages = list_extension_packages_at(&base).unwrap();
        assert!(
            !packages
                .iter()
                .find(|p| p.id == "toggle-me")
                .unwrap()
                .enabled
        );

        set_extension_package_enabled_at(&base, "toggle-me", true).unwrap();
        assert!(!base
            .join("extensions/toggle-me")
            .join(DISABLED_MARKER)
            .exists());
        let packages = list_extension_packages_at(&base).unwrap();
        assert!(
            packages
                .iter()
                .find(|p| p.id == "toggle-me")
                .unwrap()
                .enabled
        );
    }

    #[test]
    fn toggle_and_remove_refuse_builtins_and_missing_packages() {
        let dir = temp_base("refuse");
        let base = dir.path().to_path_buf();
        assert!(set_extension_package_enabled_at(&base, BUILTIN_READING, false).is_err());
        assert!(remove_extension_package_at(&base, BUILTIN_OUTLINE).is_err());
        assert!(package_extension_package_at(&base, BUILTIN_READING).is_err());
        assert!(set_extension_package_enabled_at(&base, "ghost", true).is_err());
        assert!(remove_extension_package_at(&base, "ghost").is_err());
    }

    #[test]
    fn remove_deletes_package_dir() {
        let dir = temp_base("remove");
        let base = dir.path().to_path_buf();
        write_package(&base, "gone", "user", "待删扩展");
        assert!(base.join("extensions/gone").is_dir());

        remove_extension_package_at(&base, "gone").unwrap();
        assert!(!base.join("extensions/gone").exists());
    }

    #[test]
    fn export_round_trips_through_zip() {
        let dir = temp_base("roundtrip");
        let base = dir.path().to_path_buf();
        write_package(&base, "rt", "user", "回环扩展");

        let zip_path = package_extension_package_at(&base, "rt").unwrap();
        assert!(zip_path.ends_with(".zip"), "got {zip_path}");
        assert!(Path::new(&zip_path).is_file());

        // 改回源目录名后导入同一 zip，字段应严格相等
        let package = import_extension_package_at(&base, &zip_path).unwrap();
        assert_eq!(package.id, "rt");
        assert_eq!(package.name, "回环扩展");
        assert_eq!(package.version, "1.2.3");
        assert_eq!(package.description, "回环扩展 的描述");
        assert_eq!(package.source, "user");
        assert!(package.enabled);
        assert_eq!(package.skill, "# 回环扩展\n\n正文\n");
    }

    #[test]
    fn export_preserves_disabled_state_through_round_trip() {
        let dir = temp_base("rt-disabled");
        let base = dir.path().to_path_buf();
        write_package(&base, "rt2", "user", "停用回环");
        set_extension_package_enabled_at(&base, "rt2", false).unwrap();

        let zip_path = package_extension_package_at(&base, "rt2").unwrap();
        let package = import_extension_package_at(&base, &zip_path).unwrap();
        assert!(!package.enabled, "停用状态应在导出 → 再导入后保留");
    }

    #[test]
    fn generate_creates_ai_package_default_enabled_with_prompt_in_skill() {
        let dir = temp_base("generate");
        let base = dir.path().to_path_buf();

        let package = generate_extension_package_at(&base, "帮我每周总结阅读笔记").unwrap();

        assert!(package.id.starts_with("ai-"), "got {}", package.id);
        assert!(is_valid_id(&package.id));
        assert_eq!(package.source, "ai");
        assert!(package.enabled);
        assert!(package.dir.is_some());
        assert!(
            package.skill.contains("帮我每周总结阅读笔记"),
            "SKILL.md 应包含提示词：{}",
            package.skill
        );
        assert!(package.skill.contains("# "));

        let dir = PathBuf::from(package.dir.as_deref().unwrap());
        assert!(dir.join(MANIFEST_FILE).exists());
        assert!(dir.join(SKILL_FILE).exists());
        assert!(!dir.join(DISABLED_MARKER).exists());

        // 确定性：同一提示词得到同一 id
        let again = generate_extension_package_at(&base, "帮我每周总结阅读笔记").unwrap();
        assert_eq!(package.id, again.id);
    }

    #[test]
    fn generate_rejects_empty_prompt() {
        let dir = temp_base("gen-empty");
        let base = dir.path().to_path_buf();
        assert!(generate_extension_package_at(&base, "   ").is_err());
    }

    #[test]
    fn zip_path_traversal_is_rejected() {
        let dir = temp_base("traversal");
        let base = dir.path().to_path_buf();

        // 构造含 `../evil` 条目的 zip
        let malicious = base.join("evil.zip");
        let file = std::fs::File::create(&malicious).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("../evil.txt", options).unwrap();
        zip.write_all(b"boom").unwrap();
        zip.finish().unwrap();

        let err = import_extension_package_at(&base, malicious.to_str().unwrap())
            .expect_err("穿越条目应被拒绝");
        assert!(matches!(err, AppError::Validation { .. }), "got {err:?}");
        assert!(!base.join("evil.txt").exists(), "穿越文件不应落盘");
    }

    #[test]
    fn zip_import_rejects_missing_manifest() {
        let dir = temp_base("zip-nomanifest");
        let base = dir.path().to_path_buf();
        let zip_path = base.join("empty.zip");
        let file = std::fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("SKILL.md", options).unwrap();
        zip.write_all(b"# x\n").unwrap();
        zip.finish().unwrap();

        assert!(import_extension_package_at(&base, zip_path.to_str().unwrap()).is_err());
    }

    #[test]
    fn zip_entry_count_over_limit_is_rejected() {
        let dir = temp_base("zip-too-many");
        let base = dir.path().to_path_buf();
        let zip_path = base.join("toomany.zip");
        let file = std::fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for i in 0..(MAX_ZIP_ENTRIES + 1) {
            zip.start_file(format!("f{i}.txt"), options).unwrap();
            zip.write_all(b"x").unwrap();
        }
        zip.finish().unwrap();

        let err = import_extension_package_at(&base, zip_path.to_str().unwrap())
            .expect_err("超过条目上限应被拒绝");
        assert!(matches!(err, AppError::Validation { .. }), "got {err:?}");
    }

    #[test]
    fn zip_file_size_over_limit_is_rejected() {
        let dir = temp_base("zip-huge-file");
        let base = dir.path().to_path_buf();
        let zip_path = base.join("huge.zip");
        let file = std::fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("big.bin", options).unwrap();
        zip.write_all(&vec![0u8; (MAX_ZIP_FILE_BYTES + 1) as usize])
            .unwrap();
        zip.finish().unwrap();

        let err = extract_zip(&zip_path, &base.join("out")).expect_err("超过单文件上限应被拒绝");
        assert!(matches!(err, AppError::Validation { .. }), "got {err:?}");
    }

    #[test]
    fn zip_import_accepts_single_nested_folder() {
        let dir = temp_base("zip-nested");
        let base = dir.path().to_path_buf();
        let zip_path = base.join("nested.zip");
        let file = std::fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("nested/manifest.json", options).unwrap();
        let manifest = r#"{"id":"nested-ext","name":"嵌套扩展","version":"0.1.0","description":"d","source":"user"}"#;
        zip.write_all(manifest.as_bytes()).unwrap();
        zip.start_file("nested/SKILL.md", options).unwrap();
        zip.write_all("# 嵌套扩展\n".as_bytes()).unwrap();
        zip.finish().unwrap();

        let package = import_extension_package_at(&base, zip_path.to_str().unwrap()).unwrap();
        assert_eq!(package.id, "nested-ext");
        assert_eq!(package.name, "嵌套扩展");
        assert!(base.join("extensions/nested-ext/SKILL.md").exists());
    }

    #[test]
    fn read_extension_skill_returns_builtin_and_user_text() {
        let dir = temp_base("read");
        let base = dir.path().to_path_buf();
        write_package(&base, "readable", "user", "可读扩展");

        assert_eq!(
            read_extension_skill_at(&base, BUILTIN_READING).unwrap(),
            BUILTIN_READING_SKILL
        );
        assert_eq!(
            read_extension_skill_at(&base, "readable").unwrap(),
            "# 可读扩展\n\n正文\n"
        );
        assert!(read_extension_skill_at(&base, "ghost").is_err());
    }

    #[test]
    fn enabled_skill_context_includes_only_enabled_non_builtin_packages() {
        let dir = temp_base("skill-context");
        let base = dir.path().to_path_buf();
        write_package(&base, "ctx-on", "user", "启用扩展");
        write_package(&base, "ctx-off", "ai", "停用扩展");
        set_extension_package_enabled_at(&base, "ctx-off", false).unwrap();

        let context = enabled_skill_context_at(&base).unwrap();

        assert!(context.contains("## 扩展：启用扩展"), "got {context}");
        assert!(context.contains("# 启用扩展"), "got {context}");
        assert!(!context.contains("停用扩展"), "停用扩展不应注入：{context}");
        assert!(
            !context.contains(BUILTIN_READING) && !context.contains("内置阅读"),
            "内置扩展不应注入：{context}"
        );

        set_extension_package_enabled_at(&base, "ctx-off", true).unwrap();
        let after = enabled_skill_context_at(&base).unwrap();
        assert!(after.contains("停用扩展"), "重新启用后应注入：{after}");
    }

    #[test]
    fn enabled_skill_context_empty_without_user_packages() {
        let dir = temp_base("skill-context-empty");
        let base = dir.path().to_path_buf();
        assert_eq!(enabled_skill_context_at(&base).unwrap(), "");
    }

    #[test]
    fn set_enabled_on_missing_package_is_an_error_not_a_created_dir() {
        let dir = temp_base("no-create");
        let base = dir.path().to_path_buf();
        assert!(set_extension_package_enabled_at(&base, "absent", true).is_err());
        assert!(!base.join("extensions/absent").exists());
    }
}
