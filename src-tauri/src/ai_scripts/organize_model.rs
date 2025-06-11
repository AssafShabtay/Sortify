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
use thiserror::Error;
use std::error::Error as StdError;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Any error: {0}")]
    AnyError(#[from] Box<dyn StdError + Send + Sync>), // Added Send + Sync for better error handling with threads
    #[error("Path does not exist: {0}")]
    PathNotFound(String),
    #[error("Path is not a directory: {0}")]
    NotADirectory(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Tauri error: {0}")]
    TauriError(#[from] tauri::Error),
    #[error("JSON parse error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("{0}")]
    CustomError(String),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}



#[derive(Debug, Deserialize)]
struct FileLabel {
    path: String,
    cluster_name: String//change
}

#[tauri::command]
pub fn count_files_in_folder(folder_path: String) -> Result<i32, Error> {
    let path = Path::new(&folder_path);
    
    if !path.exists() {
        return Err(Error::PathNotFound(folder_path));
    }
    
    if !path.is_dir() {
        return Err(Error::NotADirectory(folder_path));
    }
    let canonical_path = path.canonicalize()?;

    const EXTENSIONS: &[&str] = &["pdf", "docx", "txt", "doc", "tex", "epub", "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp", "ico", "heif", "heic", "avif", "eps", "dds", "dis", "im", "mpo", "msp", "pxc", "pfm", "ppm", "tga", "spider", "sgi", "xbm", "psd", "svg"];
    count_recursive(Path::new(&canonical_path), EXTENSIONS)
}

fn count_recursive(path: &Path, extensions: &[&str]) -> Result<i32, Error> {
    let mut count = 0;
    let entries = fs::read_dir(path)?;
    for entry in entries {
        let entry = entry?;
        let entry_path = entry.path();
        
        if entry_path.is_dir() {
            match count_recursive(&entry_path, extensions) {
                Ok(sub_count) => count += sub_count,
                Err(e) => return Err(e), 
        }
        }else if let Some(extension) = entry_path.extension().and_then(|ext| ext.to_str()) {
            if extensions.contains(&extension) {
                count += 1;
            }
        }
    }
    Ok(count)
}   

#[tauri::command]
pub async fn organize_files_from_json(base_output: String, copy_or_move: String, app: tauri::AppHandle) -> Result<(), Error> {
    let base_output_path = Path::new(&base_output);

    // Get json path in appdata
    let app_data_path = app
        .path()
        .app_data_dir()?;
    
    let json_file_path = app_data_path.join("Organization_Structure.json");


    if !json_file_path.exists() {
        return Err(Error::PathNotFound("File structure json doesn't exist".to_string()));
    }

    let data = fs::read_to_string(&json_file_path)?;

    let items: Vec<FileLabel> = serde_json::from_str(&data)?;

    if !base_output_path.exists() {
        fs::create_dir_all(base_output_path)?;
    }

    for item in items {
        let sanitized_cluster_name = sanitize_filename(&item.cluster_name)?;
        
        let cluster_folder = base_output_path.join(&sanitized_cluster_name);
        
        if !cluster_folder.exists() {
            fs::create_dir_all(&cluster_folder)?;
        }

        let src_path = Path::new(&item.path);
        
        if !src_path.exists() {
            eprintln!("Warning: Source file does not exist: {}", src_path.display());
            continue; 
        }
        let filename = match src_path.file_name() {
            Some(name) => name,
            None => continue, 
        };
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

fn sanitize_filename(name: &str) -> Result<String, Error> {
    let sanitized = name
        .replace("..", "_")
        .replace(['/', '\\'], "_")
        .replace(['<', '>', ':', '"', '|', '?', '*'], "_");
    
    if sanitized.is_empty() {
        return Err(Error::CustomError("Cluster name cannot be empty after sanitization".to_string()));
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

fn perform_file_operation(operation: &str, src: &Path, dest: &Path) -> Result<(), Error> {
    match operation {
        "move" => {
            fs::rename(src, dest)?;
            Ok(())
        },
        "copy" => {
            fs::copy(src, dest)?;
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
) -> Result<(), Error> {
    if let Some(state) = app.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let child_process = state.lock().unwrap();
        if child_process.is_some() {
            return Ok(()); 
        }
    }

    let app_data_path = match app.path().app_data_dir() {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(_err) => {
            return Err(Error::CustomError("Failed to get app data directory".to_string()));
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
        Err(_e) => return Err(Error::CustomError("Failed to spawn sidecar:".to_string())),
    };

    let (tx, rx_complete) = tokio::sync::oneshot::channel::<Result<(), Error>>();
    let app_clone = app.clone();

    // Read the outputs from the sidecar
    tauri::async_runtime::spawn(async move {
        let mut result: Result<(), Error> = Ok(());

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
                            Err(Error::CustomError("Not enough files".to_string()))
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
                            result = Err(Error::CustomError(format!("Process exited with non-zero status: {}", code)));
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
        Err(_) => Err(Error::CustomError("Failed to receive completion status".to_string())),
    }
}
