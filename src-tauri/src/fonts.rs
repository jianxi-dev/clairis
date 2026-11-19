//! 本机已安装字体族枚举（#1136 / #1178）：macOS 走 AppKit
//! `NSFontManager.availableFontFamilies`，并为每个族取
//! `localizedNameForFamily:face:` 本地化名（空则回落原始族名）。
//! 非 macOS 返回空数组（前端降级手输）；返回值按 `family` 去重，
//! 排序键 = `(非 CJK, localized)`：本地化名为 CJK 的族整体排前，组内按 `localized` 字典序。

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

/// 本机字体族：`family` 为 `availableFontFamilies` 原始名（写盘值），
/// `localized` 为本地化显示名（空则回落 `family`）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FontFamily {
    pub family: String,
    pub localized: String,
}

/// 本地化名缺失 / 为空时回落原始族名。
fn make_font_family(family: String, localized: Option<String>) -> FontFamily {
    let localized = localized
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| family.clone());
    FontFamily { family, localized }
}

/// 本地化名含 CJK 字符（中文优先排序用）。
fn contains_cjk(value: &str) -> bool {
    value.chars().any(|ch| {
        let code = ch as u32;
        (0x2E80..=0x2EFF).contains(&code)      // CJK 部首补充
            || (0x3000..=0x303F).contains(&code) // CJK 符号与标点
            || (0x3040..=0x30FF).contains(&code) // 平假名 / 片假名
            || (0x3100..=0x312F).contains(&code) // 注音符号
            || (0x3400..=0x4DBF).contains(&code) // CJK 扩展 A
            || (0x4E00..=0x9FFF).contains(&code) // CJK 基本区
            || (0xAC00..=0xD7AF).contains(&code) // 谚文音节
            || (0xF900..=0xFAFF).contains(&code) // CJK 兼容表意文字
    })
}

/// 去重（按 `family`）+ 排序，供命令实现与单测共用。
fn normalize_fonts(items: Vec<FontFamily>) -> Vec<FontFamily> {
    let mut seen = BTreeSet::new();
    let mut out: Vec<FontFamily> = items
        .into_iter()
        .filter(|font| !font.family.is_empty() && seen.insert(font.family.clone()))
        .collect();
    out.sort_by(|a, b| {
        (!contains_cjk(&a.localized), a.localized.as_str())
            .cmp(&(!contains_cjk(&b.localized), b.localized.as_str()))
    });
    out
}

#[cfg(target_os = "macos")]
fn enumerate_native() -> Result<Vec<FontFamily>, String> {
    use cocoa::base::id;
    use objc::rc::autoreleasepool;
    use objc::runtime::Class;
    use objc::{sel, sel_impl};
    use std::ffi::CStr;
    use std::os::raw::c_char;

    autoreleasepool(|| unsafe {
        let cls = Class::get("NSFontManager").ok_or("NSFontManager 类不可用")?;
        let manager: id = objc::msg_send![cls, sharedFontManager];
        if manager.is_null() {
            return Err("NSFontManager sharedFontManager 返回空".to_string());
        }
        let families: id = objc::msg_send![manager, availableFontFamilies];
        if families.is_null() {
            return Err("availableFontFamilies 返回空".to_string());
        }
        let count: usize = objc::msg_send![families, count];
        let no_face: id = std::ptr::null_mut();
        let mut fonts = Vec::with_capacity(count);
        for index in 0..count {
            let item: id = objc::msg_send![families, objectAtIndex: index];
            if item.is_null() {
                continue;
            }
            let cstr: *const c_char = objc::msg_send![item, UTF8String];
            if cstr.is_null() {
                continue;
            }
            let family = match CStr::from_ptr(cstr).to_str() {
                Ok(name) if !name.is_empty() => name.to_string(),
                _ => continue,
            };
            let localized: id =
                objc::msg_send![manager, localizedNameForFamily: item face: no_face];
            let localized = if localized.is_null() {
                None
            } else {
                let lstr: *const c_char = objc::msg_send![localized, UTF8String];
                if lstr.is_null() {
                    None
                } else {
                    CStr::from_ptr(lstr).to_str().ok().map(str::to_string)
                }
            };
            fonts.push(make_font_family(family, localized));
        }
        Ok(normalize_fonts(fonts))
    })
}

#[cfg(not(target_os = "macos"))]
fn enumerate_native() -> Result<Vec<FontFamily>, String> {
    Ok(Vec::new())
}

/// 设置面板用：本机字体族列表（含本地化名），去重排序；非 macOS 为空数组。
pub fn list_system_fonts() -> Result<Vec<FontFamily>, String> {
    enumerate_native()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorts_cjk_first_then_by_localized() {
        let raw = vec![
            make_font_family("Menlo".into(), None),
            make_font_family("PingFang SC".into(), Some("苹方-简".into())),
            make_font_family("Arial".into(), None),
            make_font_family("Songti SC".into(), Some("宋体-简".into())),
        ];
        let got = normalize_fonts(raw);
        let families: Vec<&str> = got.iter().map(|f| f.family.as_str()).collect();
        assert_eq!(families, vec!["Songti SC", "PingFang SC", "Arial", "Menlo"]);
    }

    #[test]
    fn dedupes_by_family() {
        let raw = vec![
            make_font_family("PingFang SC".into(), Some("苹方-简".into())),
            make_font_family("PingFang SC".into(), Some("苹方-简".into())),
            make_font_family("Menlo".into(), None),
        ];
        let got = normalize_fonts(raw);
        let families: Vec<&str> = got.iter().map(|f| f.family.as_str()).collect();
        assert_eq!(families, vec!["PingFang SC", "Menlo"]);
    }

    #[test]
    fn localized_falls_back_to_family_when_empty() {
        assert_eq!(
            make_font_family("Menlo".into(), None),
            FontFamily {
                family: "Menlo".into(),
                localized: "Menlo".into(),
            }
        );
        assert_eq!(
            make_font_family("Menlo".into(), Some(String::new())),
            FontFamily {
                family: "Menlo".into(),
                localized: "Menlo".into(),
            }
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_enumeration_is_non_empty_and_cjk_first() {
        let fonts = list_system_fonts().expect("macOS 字体枚举不应失败");
        assert!(!fonts.is_empty());
        for font in &fonts {
            assert!(!font.family.is_empty());
            assert!(!font.localized.is_empty());
        }
        let keys: Vec<(bool, &str)> = fonts
            .iter()
            .map(|f| (!contains_cjk(&f.localized), f.localized.as_str()))
            .collect();
        let mut sorted = keys.clone();
        sorted.sort();
        assert_eq!(keys, sorted);
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn non_macos_returns_empty_instead_of_error() {
        assert_eq!(list_system_fonts().unwrap(), Vec::<FontFamily>::new());
    }
}
