use tauri::Manager;
use crate::storage::{Database, Project};

/// Save a project to the database
#[tauri::command]
pub async fn save_project(
    project: Project,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?
        .join("emojisubs.db");

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }

    let db = Database::new(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    db.initialize()
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    db.save_project(&project)
        .map_err(|e| format!("Failed to save project: {}", e))?;

    Ok(())
}

/// Load a project from the database
#[tauri::command]
pub async fn load_project(
    project_id: String,
    app_handle: tauri::AppHandle,
) -> Result<Option<Project>, String> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?
        .join("emojisubs.db");

    let db = Database::new(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    db.get_project(&project_id)
        .map_err(|e| format!("Failed to load project: {}", e))
}

/// List all projects
#[tauri::command]
pub async fn list_projects(
    app_handle: tauri::AppHandle,
) -> Result<Vec<Project>, String> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?
        .join("emojisubs.db");

    let db = Database::new(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    db.initialize()
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    db.list_projects()
        .map_err(|e| format!("Failed to list projects: {}", e))
}
