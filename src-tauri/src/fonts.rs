//! 本机已安装字体族枚举（#1136）：macOS 走 AppKit `NSFontManager.availableFontFamilies`。
//! 非 macOS 返回空数组（前端降级手输）；返回值去重、按字典序排序。

use std::collections::BTreeSet;

/// 去重 + 排序，供命令实现与单测共用。
fn normalize_families(names: Vec<String>) -> Vec<String> {
    names
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

#[cfg(target_os = "macos")]
fn enumerate_native() -> Result<Vec<String>, String> {
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
        let mut names = Vec::with_capacity(count);
        for index in 0..count {
            let item: id = objc::msg_send![families, objectAtIndex: index];
            if item.is_null() {
                continue;
            }
            let cstr: *const c_char = objc::msg_send![item, UTF8String];
            if let Ok(name) = CStr::from_ptr(cstr).to_str() {
                if !name.is_empty() {
                    names.push(name.to_string());
                }
            }
        }
        Ok(normalize_families(names))
    })
}

#[cfg(not(target_os = "macos"))]
fn enumerate_native() -> Result<Vec<String>, String> {
    Ok(Vec::new())
}

/// 设置面板用：本机字体族列表，去重排序；非 macOS 为空数组。
pub fn list_system_fonts() -> Result<Vec<String>, String> {
    enumerate_native()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_dedupes_and_sorts() {
        let raw = vec![
            "PingFang SC".to_string(),
            "Menlo".to_string(),
            "PingFang SC".to_string(),
        ];
        assert_eq!(
            normalize_families(raw),
            vec!["Menlo".to_string(), "PingFang SC".to_string()]
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_enumeration_is_non_empty_and_sorted() {
        let fonts = list_system_fonts().expect("macOS 字体枚举不应失败");
        assert!(!fonts.is_empty());
        let mut sorted = fonts.clone();
        sorted.sort();
        assert_eq!(fonts, sorted);
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn non_macos_returns_empty_instead_of_error() {
        assert_eq!(list_system_fonts().unwrap(), Vec::<String>::new());
    }
}
