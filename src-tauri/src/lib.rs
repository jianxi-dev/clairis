mod commands;
mod config;
mod errors;
mod types;

use commands::file::{open_file, save_file, save_as_file};
use commands::translate::translate_text;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_file,
            save_file,
            save_as_file,
            translate_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
