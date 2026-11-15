//! 本机已安装字体族枚举（C1 / #853）。
//!
//! 口径与限制（票面要求说明，不得声称「已枚举全部系统字体」）：
//! - macOS 优先走 fontconfig 的 `fc-list : family`。本机 fontconfig 由 Homebrew
//!   安装（`/opt/homebrew/bin/fc-list`），因此同时探测几个常见绝对路径，避免
//!   GUI 启动的 app 拿不到 Homebrew 的 PATH。
//! - `fc-list` 缺失或调用失败时退回内置「常见系统字体预设列表」。预设列表只是
//!   无外部依赖时的兜底，不代表本机字体的完整集合。
//! - 返回值去重、按字典序排序；供设置面板做逐级选择。

use std::process::Command;

/// `fc-list` 候选位置：Homebrew Apple Silicon / Intel、系统、MacPorts，最后按 PATH。
const FC_LIST_CANDIDATES: [&str; 5] = [
    "/opt/homebrew/bin/fc-list",
    "/usr/local/bin/fc-list",
    "/usr/bin/fc-list",
    "/opt/local/bin/fc-list",
    "fc-list",
];

/// 无 `fc-list` 时的兜底预设：只列中英开源字体（#926）。
/// 不硬编码任何国家/厂商专有字体；本机实际字体由 `fc-list` 枚举提供。
const PRESET_FONT_FAMILIES: [&str; 10] = [
    "Fira Code",
    "IBM Plex Sans",
    "Inter",
    "JetBrains Mono",
    "Noto Sans",
    "Noto Sans CJK SC",
    "Noto Serif CJK SC",
    "Source Han Sans SC",
    "Source Han Serif SC",
    "sans-serif",
];

/// 解析 `fc-list : family` 输出：每行是一组逗号分隔的字体族。
fn parse_fc_list(stdout: &str) -> Vec<String> {
    let mut set = std::collections::BTreeSet::new();
    for line in stdout.lines() {
        for family in line.split(',') {
            let name = family.trim();
            if !name.is_empty() {
                set.insert(name.to_string());
            }
        }
    }
    set.into_iter().collect()
}

fn fc_list_via(binary: &str) -> Option<Vec<String>> {
    let output = Command::new(binary).arg(":").arg("family").output().ok()?;
    if !output.status.success() {
        return None;
    }
    Some(parse_fc_list(&String::from_utf8_lossy(&output.stdout)))
}

/// 设置面板用：字体列表 + 是否真枚举成功（预设兜底时 `enumerated = false`，
/// 前端据此跳过「系统可用性」强校验，只做结构性校验）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFonts {
    pub families: Vec<String>,
    pub enumerated: bool,
}

pub fn system_fonts() -> SystemFonts {
    for candidate in FC_LIST_CANDIDATES {
        if let Some(families) = fc_list_via(candidate) {
            if !families.is_empty() {
                return SystemFonts {
                    families,
                    enumerated: true,
                };
            }
        }
    }
    SystemFonts {
        families: PRESET_FONT_FAMILIES
            .iter()
            .map(|name| name.to_string())
            .collect(),
        enumerated: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_comma_separated_families_and_dedupes() {
        let raw = "PingFang SC,苹方-简\nPingFang SC\n, Menlo \n";
        assert_eq!(parse_fc_list(raw), vec!["Menlo", "PingFang SC", "苹方-简"]);
    }

    #[test]
    fn system_fonts_is_non_empty_and_sorted() {
        let fonts = system_fonts();
        assert!(!fonts.families.is_empty());
        let mut sorted = fonts.families.clone();
        sorted.sort();
        assert_eq!(fonts.families, sorted);
    }

    #[test]
    fn preset_families_contain_no_proprietary_national_fonts() {
        let proprietary = [
            "PingFang",
            "Hiragino",
            "Microsoft YaHei",
            "SimHei",
            "SimSun",
            "Songti",
            "Kaiti",
            "Heiti",
            "STHeiti",
            "Arial",
            "Helvetica",
            "Georgia",
            "Times New Roman",
            "Tahoma",
            "Verdana",
        ];
        for name in PRESET_FONT_FAMILIES {
            for bad in proprietary {
                assert!(
                    !name.contains(bad),
                    "预设含专有字体硬编码: {name}（命中 {bad}）"
                );
            }
        }
    }

    #[test]
    fn preset_families_include_open_source_cjk_and_latin() {
        for want in ["Noto Sans CJK SC", "Source Han Sans SC", "Inter"] {
            assert!(PRESET_FONT_FAMILIES.contains(&want), "缺开源预设: {want}");
        }
    }
}
