use std::sync::Mutex;
use tauri::Manager;

mod video_server;
mod commands;
mod storage;
mod transcription;
mod rendering;

pub struct AppState {
    pub video_server_port: Mutex<Option<u16>>,
    pub encoding_state: Mutex<commands::frame_export::EncodingState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            video_server_port: Mutex::new(None),
            encoding_state: Mutex::new(commands::frame_export::EncodingState::new()),
        }
    }
}

#[tauri::command]
async fn get_video_server_port(
    state: tauri::State<'_, AppState>,
) -> Result<u16, String> {
    let port = state.video_server_port.lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;

    port.ok_or_else(|| "Video server not started".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Get cache directory
            let cache_dir = app.handle()
                .path()
                .app_cache_dir()
                .expect("Failed to get cache directory");

            // Start video server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match video_server::start_video_server(cache_dir).await {
                    Ok(port) => {
                        println!("Video server started on port: {}", port);

                        // Store port in app state
                        if let Ok(mut port_lock) = app_handle.state::<AppState>().video_server_port.lock() {
                            *port_lock = Some(port);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to start video server: {}", e);
                    }
                }
            });

            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_video_server_port,
            commands::transcribe_video,
            commands::trim_video_file,
            commands::get_available_models,
            commands::copy_video_to_cache,
            commands::get_file_info,
            commands::get_video_url,
            commands::copy_image_to_cache,
            commands::get_image_url,
            commands::save_project,
            commands::load_project,
            commands::list_projects,
            commands::save_video_blob,
            commands::start_video_encoding,
            commands::add_video_frame,
            commands::finish_video_encoding,
            commands::cancel_video_encoding,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
