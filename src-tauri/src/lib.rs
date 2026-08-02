mod commands;
mod config;
mod errors;
mod types;
mod validation;

use commands::config_cmd::{delete_api_key, get_api_key, load_config, save_config, set_api_key};
use commands::directory::{flatten_files, get_file_info, read_directory};
use commands::file::{open_file, open_file_direct, pick_folder, save_as_file, save_file};
use commands::translate::{stop_translation, translate_text};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
            // CRITICAL: setIsOpaque(false) MUST come before setBackgroundColor(.clear)
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
                        unsafe {
                            let ns_view = h.ns_view.as_ptr() as id;
                            let ns_window: id = objc::msg_send![ns_view, window];
                            if !ns_window.is_null() {
                                // 1. Tell macOS this window is NOT opaque — required for transparency
                                let _: () = objc::msg_send![ns_window, setIsOpaque: false];
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file,
            open_file_direct,
            pick_folder,
            save_file,
            save_as_file,
            translate_text,
            stop_translation,
            read_directory,
            get_file_info,
            flatten_files,
            load_config,
            save_config,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
