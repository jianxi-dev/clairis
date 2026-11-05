mod ai_agent;
mod commands;
mod config;
mod errors;
mod extension_packages;
mod extensions;
mod media_protocol;
mod types;
mod validation;

use commands::ai_agent_cmd::run_agent_turn;
use commands::config_cmd::{
    delete_api_key, get_api_key, list_config_snapshots, list_extensions, load_config,
    restore_config_snapshot, save_config, set_api_key,
};
use commands::directory::{flatten_files, get_file_info, list_media_in_dir, read_directory};
use commands::file::{
    import_media_file, open_file, open_file_direct, pick_folder, read_file_base64,
    reveal_in_finder, save_as_file, save_binary_as_file, save_file,
};
use commands::translate::{stop_translation, translate_text};
use extension_packages::{
    generate_extension_package, import_extension_package, list_extension_packages,
    package_extension_package, pick_extension_source, read_extension_skill,
    remove_extension_package, set_extension_package_enabled,
};

/// Register a media path for the media:// preview protocol (called by the frontend).
#[tauri::command]
fn register_media_path(path: String) {
    media_protocol::register_media_path(path);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("media", |_ctx, request| {
            media_protocol::media_protocol_handler(request)
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .menu(|handle| {
            use tauri::menu::{Menu, MenuItem, Submenu};
            // 菜单项保留点击入口；快捷键由 global_shortcut 提供
            // （macOS WKWebView 聚焦时菜单 accelerator 不触发 key equivalent）
            let zoom_in = MenuItem::with_id(handle, "preview-zoom-in", "放大", true, None::<&str>)?;
            let zoom_out =
                MenuItem::with_id(handle, "preview-zoom-out", "缩小", true, None::<&str>)?;
            let zoom_reset =
                MenuItem::with_id(handle, "preview-zoom-reset", "实际大小", true, None::<&str>)?;
            let view =
                Submenu::with_items(handle, "视图", true, &[&zoom_in, &zoom_out, &zoom_reset])?;
            let settings = MenuItem::with_id(handle, "open-settings", "设置…", true, None::<&str>)?;
            let mut menu = Menu::default(handle)?;
            menu.append(&view)?;
            menu.append(&settings)?;
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            use tauri::Emitter;
            let id = event.id();
            if id == "open-settings" {
                let _ = app.emit("open-settings", ());
                return;
            }
            let delta = if id == "preview-zoom-in" {
                1
            } else if id == "preview-zoom-out" {
                -1
            } else if id == "preview-zoom-reset" {
                0
            } else {
                return;
            };
            let _ = app.emit("preview-scale", delta);
        })
        .setup(|app| {
            use tauri::webview::WebviewWindowBuilder;
            use tauri::Manager;
            use tauri::WebviewUrl;

            // Create overlay window (hidden initially, no decorations, always on top)
            let overlay = WebviewWindowBuilder::new(
                app,
                "overlay",
                WebviewUrl::App("index.html?window=overlay".into()),
            )
            .title("")
            .decorations(false)
            .always_on_top(true)
            .inner_size(420.0, 500.0)
            .min_inner_size(320.0, 280.0)
            .visible(false)
            .skip_taskbar(true)
            .build()
            .expect("failed to create overlay window");

            // Set overlay window background transparent (macOS)
            // CRITICAL: setOpaque(false) MUST come before setBackgroundColor(.clear)
            // Otherwise macOS ignores the clear background and shows white
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::NSColor;
                use cocoa::base::id;
                use objc::sel;
                use objc::sel_impl;
                use raw_window_handle::HasWindowHandle;
                use std::ptr::null_mut;

                if let Ok(handle) = overlay.window_handle() {
                    if let raw_window_handle::RawWindowHandle::AppKit(h) = handle.as_raw() {
                        let ns_view: id = h.ns_view.as_ptr() as id;
                        let ns_window: id = unsafe { objc::msg_send![ns_view, window] };
                        if !ns_window.is_null() {
                            unsafe {
                                // 1. Must precede setBackgroundColor(.clear) or macOS shows white
                                let _: () = objc::msg_send![ns_window, setOpaque: false];
                                // 2. Make titlebar transparent so no gray bar shows
                                let _: () =
                                    objc::msg_send![ns_window, setTitlebarAppearsTransparent: true];
                                // 3. Set NSWindow background to clear
                                let clear: id = NSColor::clearColor(null_mut());
                                let _: () = objc::msg_send![ns_window, setBackgroundColor: clear];
                                // 4. Clear WKWebView layer background (the actual white source)
                                let content_view: id = objc::msg_send![ns_window, contentView];
                                if !content_view.is_null() {
                                    let subviews: id = objc::msg_send![content_view, subviews];
                                    let count: usize = objc::msg_send![subviews, count];
                                    for i in 0..count {
                                        let subview: id =
                                            objc::msg_send![subviews, objectAtIndex: i];
                                        let _: () = objc::msg_send![subview, setWantsLayer: true];
                                        let layer: id = objc::msg_send![subview, layer];
                                        if !layer.is_null() {
                                            let _: () =
                                                objc::msg_send![layer, setBackgroundColor: clear];
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Register global shortcut Cmd+Shift+. to toggle overlay
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers};
            let handle = app.handle().clone();
            let shortcut = tauri_plugin_global_shortcut::Shortcut::new(
                Some(Modifiers::META | Modifiers::SHIFT),
                Code::Period,
            );
            app.global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(overlay) = handle.get_webview_window("overlay") {
                            if overlay.is_visible().unwrap_or(false) {
                                let _ = overlay.hide();
                            } else {
                                let _ = overlay.show();
                                let _ = overlay.set_focus();
                            }
                        }
                    }
                })?;

            // 预览缩放快捷键 Cmd+= / Cmd+- / Cmd+0：
            // 用 global_shortcut 在系统层监听（WKWebView 聚焦时不触发菜单 key equivalent），
            // 主窗口聚焦时才转发，避免全局误触发。
            use tauri::Emitter;
            let emit_scale = |app: &tauri::AppHandle, delta: i32| {
                let focused = app
                    .get_webview_window("main")
                    .map(|w| w.is_focused().unwrap_or(false))
                    .unwrap_or(false);
                if focused {
                    let _ = app.emit("preview-scale", delta);
                }
            };
            for (code, delta) in [(Code::Equal, 1), (Code::Minus, -1), (Code::Digit0, 0)] {
                let s = tauri_plugin_global_shortcut::Shortcut::new(Some(Modifiers::META), code);
                let emit_scale = emit_scale.clone();
                app.global_shortcut()
                    .on_shortcut(s, move |app, _shortcut, event| {
                        if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            emit_scale(app, delta);
                        }
                    })?;
            }

            config::spawn_config_watcher(app.handle().clone());
            config::seed_skill_map(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file,
            open_file_direct,
            pick_folder,
            read_file_base64,
            register_media_path,
            save_file,
            save_as_file,
            save_binary_as_file,
            reveal_in_finder,
            import_media_file,
            translate_text,
            stop_translation,
            read_directory,
            get_file_info,
            flatten_files,
            list_media_in_dir,
            load_config,
            save_config,
            list_config_snapshots,
            restore_config_snapshot,
            list_extensions,
            list_extension_packages,
            import_extension_package,
            set_extension_package_enabled,
            remove_extension_package,
            package_extension_package,
            pick_extension_source,
            generate_extension_package,
            read_extension_skill,
            get_api_key,
            set_api_key,
            delete_api_key,
            commands::capture::append_inbox,
            commands::capture::append_inbox_batch,
            commands::capture::load_today_inbox,
            commands::capture::load_inbox_by_date,
            commands::capture::edit_inbox_entry,
            commands::capture::delete_inbox_entry,
            commands::capture::archive_entry,
            commands::capture::save_config_capture,
            commands::capture::load_config_capture,
            commands::capture::set_overlay_pinned,
            commands::capture::show_overlay_window,
            commands::capture::hide_overlay_window,
            run_agent_turn,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
