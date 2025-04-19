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
pub fn count_files_in_folder(folder_path: String)-> i32
{
    let extensions = vec!["pdf","docx" ,"txt" ,"doc" ,"tex" ,"epub"];
    let path = Path::new(&folder_path);
    let mut count = 0;

    if path.is_dir() {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Some(extension) = entry.path().extension() {
                    if extensions.contains(&extension.to_str().unwrap_or("")) {
                        count += 1;
                    }
                }
            }
        }
    }

    count 
}

#[tauri::command]
pub async fn organize_files_from_json(
    base_output: String,
    app: tauri::AppHandle,
    copy_or_move: String

) -> Result<(), String> {  
    // Get json path in appdata
    let app_data_path = match app.path().app_data_dir() {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(err) => {
            eprintln!("Failed to get app data directory: {:?}", err);
            return Err(format!("Failed to get app data directory: {:?}", err)); 
        }
    };
    let json_file_path_buf = Path::new(&app_data_path).join("Organization_Structure.json");
    let json_path = json_file_path_buf.to_string_lossy().to_string();

    // Read json data
    let data = match fs::read_to_string(json_path) {
        Ok(content) => content,
        Err(e) => return Err(e.to_string()),
    };
    
    let items: Vec<FileLabel> = match serde_json::from_str(&data) {
        Ok(parsed) => parsed,
        Err(e) => return Err(e.to_string()),
    };

    // Copy/Move the files to the designated 
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
        if copy_or_move.as_str() == "move"{
            if let Err(e) = fs::rename(&src, &dest) {
                return Err(e.to_string());
            }
        }
        if copy_or_move.as_str() == "copy"{
            if let Err(e) = fs::copy(&src, &dest) {
                return Err(e.to_string());
            }
        }
    }
    Ok(())
}
#[tauri::command]
pub async fn run_organize_model(folder_path: String, app: tauri::AppHandle) -> Result<(), String> {
    // Check if a sidecar process already exists
    if let Some(state) = app.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let child_process = state.lock().unwrap();
        if child_process.is_some() {
            // A sidecar is already running, do not spawn a new one
            println!("[tauri] Sidecar is already running. Skipping spawn.");
            return Ok(()); // Return Ok instead of early exit
        }
    }

    // Get json path in appdata
    let app_data_path = match app.path().app_data_dir() {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(err) => {
            eprintln!("Failed to get app data directory: {:?}", err);
            return Err(format!("Failed to get app data directory: {:?}", err)); 
        }
    };

    let json_file_path_buf = Path::new(&app_data_path).join("Organization_Structure.json");
    let json_file_path = json_file_path_buf.to_string_lossy().to_string();

    // Run sidecar(python script)
    let sidecar_command = app.shell().sidecar("Organize_Folder").unwrap().args([&folder_path, &json_file_path]);
    let (mut rx, mut _child) = match sidecar_command.spawn() {
        Ok((rx, child)) => (rx, child),
        Err(e) => return Err(format!("Failed to spawn sidecar: {}", e)),
    };
        
    let (tx, rx_complete) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let app_clone = app.clone();

    // Read the outputs from the sidecar
    tauri::async_runtime::spawn(async move {
        let mut result = Ok(());
        
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(data) => {
                    let output_message = str::from_utf8(&data).unwrap();
                    println!("{}", output_message);
                }
                CommandEvent::Stderr(data) => {
                    let error_message = str::from_utf8(&data).unwrap();
                    
                    eprintln!("-ERROR- {}", error_message.to_string());
                    
                    result = match error_message {
                        "Not enough files" => {
                            app_clone.emit("organization_progress", error_message).unwrap();
                            Err("Not enough files".to_string())
                        },
                        msg if msg.to_lowercase().contains("futurewarning") || msg.to_lowercase().contains("deprecationwarning") || msg.to_lowercase().contains("warning") => {
                            println!("[Warning] {}", msg);
                            result 
                        },
                        _ => {
                            println!("{}", error_message.to_string());
                            Ok(())
                        }
                    };
                }
                CommandEvent::Terminated(status) => {
                    println!("Sidecar process exited with status: {:?}", status);
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