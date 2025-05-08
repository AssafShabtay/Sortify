mod ai_scripts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            ai_scripts::organize_model::run_organize_model,
            ai_scripts::organize_model::organize_files_from_json,
            ai_scripts::organize_model::count_files_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
