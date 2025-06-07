use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::str;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use std::ffi::OsStr;

#[derive(Debug, Deserialize)]
struct FileLabel {
    path: String,
    cluster_name: String//change
}

#[tauri::command]
pub fn count_files_in_folder(folder_path: String) -> i32 {

    const EXTENSIONS: &[&str] = &["pdf", "docx", "txt", "doc", "tex", "epub", "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp", "ico", "heif", "heic", "avif", "eps", "dds", "dis", "im", "mpo", "msp", "pxc", "pfm", "ppm", "tga", "spider", "sgi", "xbm", "psd", "svg"];
    count_recursive(Path::new(&folder_path), EXTENSIONS)
}

fn count_recursive(path: &Path, extensions: &[&str]) -> i32 {
    let mut count = 0;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            
            if entry_path.is_dir() {
                count += count_recursive(&entry_path, extensions);
            } else if let Some(extension) = entry_path.extension().and_then(OsStr::to_str) {
                if extensions.contains(&extension) {
                    count += 1;
                }
            }
        }
    }

    count
}

#[tauri::command]
pub async fn organize_files_from_json(base_output: String, copy_or_move: String, app: tauri::AppHandle) -> Result<(), String> {
    let base_output_path = Path::new(&base_output);

    // Get json path in appdata
    let app_data_path = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to get app data directory: {:?}", err))?;
    
    let json_file_path = app_data_path.join("Organization_Structure.json");


    if !json_file_path.exists() {
        return Err("Organization_Structure.json not found in app data directory".to_string());
    }

    let data = fs::read_to_string(&json_file_path)
        .map_err(|e| format!("Failed to read JSON file: {}", e))?;

    let items: Vec<FileLabel> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    if !base_output_path.exists() {
        fs::create_dir_all(base_output_path)
            .map_err(|e| format!("Failed to create base output directory: {}", e))?;
    }

    for item in items {
        let sanitized_cluster_name = sanitize_filename(&item.cluster_name)?;
        
        let cluster_folder = base_output_path.join(&sanitized_cluster_name);
        
        if !cluster_folder.exists() {
            fs::create_dir_all(&cluster_folder)
                .map_err(|e| format!("Failed to create directory '{}': {}", cluster_folder.display(), e))?;
        }

        let src_path = Path::new(&item.path);
        
        if !src_path.exists() {
            eprintln!("Warning: Source file does not exist: {}", src_path.display());
            continue; 
        }
        let filename = src_path
            .file_name()
            .ok_or_else(|| format!("Invalid filename in path: {}", item.path))?;
        
        let dest_path = cluster_folder.join(filename);

        if dest_path.exists() {
            let dest_backup = generate_unique_filename(&dest_path);
            eprintln!("Warning: Destination file exists, using: {}", dest_backup.display());
            perform_file_operation(&copy_or_move, src_path, &dest_backup)?;
        } else {
            perform_file_operation(&copy_or_move, src_path, &dest_path)?;
        }

        println!("Processed: {} -> {}", src_path.display(), dest_path.display());
    }

    Ok(())
}

fn sanitize_filename(name: &str) -> Result<String, String> {
    let sanitized = name
        .replace("..", "_")
        .replace(['/', '\\'], "_")
        .replace(['<', '>', ':', '"', '|', '?', '*'], "_");
    
    if sanitized.is_empty() {
        return Err("Cluster name cannot be empty after sanitization".to_string());
    }
    Ok(sanitized)
}

fn generate_unique_filename(original: &Path) -> PathBuf {
    let parent = original.parent().unwrap_or(Path::new("."));
    let stem = original.file_stem().unwrap_or_default();
    let extension = original.extension();
    
    for i in 1..1000 {
        let new_name = if let Some(ext) = extension {
            format!("{}_{}.{}", stem.to_string_lossy(), i, ext.to_string_lossy())
        } else {
            format!("{}_{}", stem.to_string_lossy(), i)
        };
        
        let new_path = parent.join(new_name);
        if !new_path.exists() {
            return new_path;
        }
    }

    original.to_path_buf()
}

fn perform_file_operation(operation: &str, src: &Path, dest: &Path) -> Result<(), String> {
    match operation {
        "move" => fs::rename(src, dest)
            .map_err(|e| format!("Failed to move '{}' to '{}': {}", src.display(), dest.display(), e)),
        "copy" => {
            fs::copy(src, dest)
                .map_err(|e| format!("Failed to copy '{}' to '{}': {}", src.display(), dest.display(), e))?;
            Ok(())
        }
        _ => unreachable!("operation already validated"),
    }
}

#[tauri::command]
pub async fn run_organize_model(
    folder_path: String,
    treat_toplevel_folders_as_one: bool,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Check if a sidecar process already exists
    if let Some(state) = app.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let child_process = state.lock().unwrap();
        if child_process.is_some() {
            // A sidecar is already running, do not spawn a new one
            println!("[tauri] Sidecar is already running. Skipping spawn.");
            return Ok(()); 
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
    let treat_toplevel_string = if treat_toplevel_folders_as_one {
        "true"
    } else {
        "false"
    };

    // Run sidecar(python script)
    let sidecar_command = app.shell().sidecar("Organize_Folder").unwrap().args([
        &folder_path,
        &json_file_path,
        treat_toplevel_string,
    ]);
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
                            app_clone
                                .emit("organization_progress", error_message)
                                .unwrap();
                            Err("Not enough files".to_string())
                        }
                        msg if msg.to_lowercase().contains("futurewarning")
                            || msg.to_lowercase().contains("deprecationwarning")
                            || msg.to_lowercase().contains("warning") =>
                        {
                            println!("[Warning] {}", msg);
                            result
                        }
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
