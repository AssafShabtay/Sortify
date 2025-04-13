use serde::Deserialize;
use tauri::Emitter;
use std::fs;
use std::path::Path;
use std::str;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Deserialize)]
struct FileLabel {
    path: String,
    label: i32,
}

#[tauri::command]
pub async fn organize_files_from_json(
    base_output: String,
    app: tauri::AppHandle
) -> Result<(), String> {  
    let app_data_path = match app.path().app_data_dir() {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(err) => {
            eprintln!("Failed to get app data directory: {:?}", err);
            return Err(format!("Failed to get app data directory: {:?}", err)); 
        }
    };
    let json_file_path_buf = Path::new(&app_data_path).join("Organization_Structure.json");
    let json_path = json_file_path_buf.to_string_lossy().to_string();

    let data = match fs::read_to_string(json_path) {
        Ok(content) => content,
        Err(e) => return Err(e.to_string()),
    };
    
    let items: Vec<FileLabel> = match serde_json::from_str(&data) {
        Ok(parsed) => parsed,
        Err(e) => return Err(e.to_string()),
    };

    for item in items {
        let label_folder = format!("{}/label_{}", base_output, item.label);
        if let Err(e) = fs::create_dir_all(&label_folder) {
            return Err(e.to_string());
        }

        let src = Path::new(&item.path);
        let filename = match src.file_name() {
            Some(name) => name,
            None => return Err(format!("Invalid filename in path: {}", item.path)),
        };
        let dest = Path::new(&label_folder).join(filename);

        if let Err(e) = fs::rename(&src, &dest) {
            return Err(e.to_string());
        }
    }

    Ok(())
}
#[tauri::command]
pub async fn run_organize_model(folder_path: String, app: tauri::AppHandle) -> Result<(), String> {
    // Check if a sidecar process already exists
    println!("im the king");
    let app_data_path = match app.path().app_data_dir() {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(err) => {
            eprintln!("Failed to get app data directory: {:?}", err);
            return Err(format!("Failed to get app data directory: {:?}", err)); 
        }
    };
    let json_file_path_buf = Path::new(&app_data_path).join("Organization_Structure.json");
    let json_file_path = json_file_path_buf.to_string_lossy().to_string();

    if let Some(state) = app.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let child_process = state.lock().unwrap();
        if child_process.is_some() {
            // A sidecar is already running, do not spawn a new one
            println!("[tauri] Sidecar is already running. Skipping spawn.");
            return Ok(()); // Return Ok instead of early exit
        }
    }

    // Prepare the sidecar command
    let sidecar_command = app.shell().sidecar("Organize_Folder").unwrap().args([&folder_path, &json_file_path]);
    let (mut rx, mut _child) = match sidecar_command.spawn() {
        Ok((rx, child)) => (rx, child),
        Err(e) => return Err(format!("Failed to spawn sidecar: {}", e)),
    };
        
    let (tx, rx_complete) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let app_clone = app.clone();
    // Read the stdout from the sidecar process
    tauri::async_runtime::spawn(async move {
        let mut result = Ok(());
        
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(data) => {
                    let output_message = str::from_utf8(&data).unwrap();
                    println!("print{}", output_message);
                }
                CommandEvent::Stderr(data) => {
                    let error_message = str::from_utf8(&data).unwrap();
                    
                    //eprintln!("errror{}", error_message);
                    
                    result = match error_message {
                        "Not enough files" => {
                            app_clone.emit("organization_progress", error_message).unwrap();
                            Err("Not enough files".to_string())
                        },
                        msg if msg.to_lowercase().contains("futurewarning") || msg.to_lowercase().contains("deprecationwarning") || msg.to_lowercase().contains("warning") => {
                            println!("[Warning] {}", msg);
                            result // Keep the current result value
                        },
                        _ => {
                            println!("{}", error_message.to_string());
                            Ok(())
                        }
                    };
                }
                CommandEvent::Terminated(status) => {
                    println!("Sidecar process terminated with status: {:?}", status);
                    
                    // If exit code is not 0, it's an error
                    if let Some(code) = status.code {
                        if code != 0 {
                            result = Err(format!("Process exited with non-zero status: {}", code));
                        }
                    }
                    
                    // Send completion status
                    let _ = tx.send(result);
                    break;
                }
                _ => {}
            }
        }
    });
    // Wait for the process to complete before returning
    match rx_complete.await {
        Ok(result) => result,
        Err(_) => Err("Failed to receive completion status".to_string()),
}
}