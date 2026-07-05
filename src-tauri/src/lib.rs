mod commands;
mod config;
mod errors;
mod types;
mod validation;

use commands::config_cmd::{load_config, save_config, get_api_key, set_api_key, delete_api_key};
use commands::directory::{read_directory, get_file_info, flatten_files};
use commands::file::{open_file, save_file, save_as_file, open_file_direct, pick_folder};
use commands::translate::{translate_text, stop_translation};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
