// Project persistence operations
use rusqlite::{params, Result};
use serde::{Serialize, Deserialize};
use super::database::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub video_path: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Project {
    pub fn new(name: String, video_path: String) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            video_path,
            created_at: now,
            updated_at: now,
        }
    }
}

impl Database {
    pub fn save_project(&self, project: &Project) -> Result<()> {
        self.get_connection().execute(
            "INSERT OR REPLACE INTO projects (id, name, video_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &project.id,
                &project.name,
                &project.video_path,
                &project.created_at,
                &project.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_project(&self, project_id: &str) -> Result<Option<Project>> {
        let mut stmt = self.get_connection().prepare(
            "SELECT id, name, video_path, created_at, updated_at
             FROM projects WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![project_id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                video_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_projects(&self) -> Result<Vec<Project>> {
        let mut stmt = self.get_connection().prepare(
            "SELECT id, name, video_path, created_at, updated_at
             FROM projects
             ORDER BY updated_at DESC"
        )?;

        let projects = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                video_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

        Ok(projects)
    }

    pub fn delete_project(&self, project_id: &str) -> Result<()> {
        self.get_connection().execute(
            "DELETE FROM projects WHERE id = ?1",
            params![project_id],
        )?;
        Ok(())
    }
}
