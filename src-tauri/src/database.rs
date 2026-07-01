use rusqlite::{Connection, Result};
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, Manager};

// Helper function to get the absolute database path and initialize connection
fn get_db_connection(app: &AppHandle) -> std::result::Result<Connection, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    let db_path = app_data_dir.join("app_state.db");
    Connection::open(db_path).map_err(|e| format!("Database open error: {}", e))
}

// Function to initialize the database, tables, and default seed data
fn init_database(app: &AppHandle) -> std::result::Result<(), String> {
    let conn = get_db_connection(app)?;

    // Create table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS layout (
            layout TEXT PRIMARY KEY,
            data TEXT
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table layout: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS global_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table global_settings: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS widget_registry (
            type_name TEXT PRIMARY KEY,
            data TEXT
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table widget_registry: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS widget_instances (
            id TEXT PRIMARY KEY,
            data TEXT
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table widget_instances: {}", e))?;

    // Check if the default row already exists
    let mut stmt = conn
        .prepare("SELECT COUNT(*) FROM layout WHERE layout = 'default'")
        .map_err(|e| format!("Failed to prepare check statement: {}", e))?;
    
    let count: i64 = stmt
        .query_row([], |row| row.get(0))
        .map_err(|e| format!("Failed to execute check query: {}", e))?;

    // Seed default row if the table is freshly created/empty for 'default'
    if count == 0 {
        conn.execute(
            "INSERT INTO layout (layout, data) VALUES ('default', '{}')",
            [],
        )
        .map_err(|e| format!("Failed to insert default row: {}", e))?;
        println!("Database initialized and seeded with default layout successfully.");
    }

    // Check if the default global_settings row already exists
    let mut stmt_settings = conn
        .prepare("SELECT COUNT(*) FROM global_settings WHERE id = 1")
        .map_err(|e| format!("Failed to prepare check statement for settings: {}", e))?;
    
    let count_settings: i64 = stmt_settings
        .query_row([], |row| row.get(0))
        .map_err(|e| format!("Failed to execute check query for settings: {}", e))?;

    if count_settings == 0 {
        conn.execute(
            "INSERT INTO global_settings (id, data) VALUES (1, '{}')",
            [],
        )
        .map_err(|e| format!("Failed to insert default settings row: {}", e))?;
        println!("Database seeded with default global settings successfully.");
    }

    Ok(())
}

// Tauri command that initializes and fetches all layouts for the frontend
#[tauri::command]
pub async fn load_all_layouts(app: AppHandle) -> std::result::Result<HashMap<String, String>, String> {
    // Ensure database is initialized
    init_database(&app)?;

    let conn = get_db_connection(&app)?;
    let mut stmt = conn
        .prepare("SELECT layout, data FROM layout")
        .map_err(|e| format!("Failed to prepare select statement: {}", e))?;

    let layout_iter = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to map query rows: {}", e))?;

    let mut layouts_map = HashMap::new();
    for layout_result in layout_iter {
        let (layout_name, data_json) = layout_result.map_err(|e| format!("Row iteration error: {}", e))?;
        layouts_map.insert(layout_name, data_json);
    }

    Ok(layouts_map)
}

#[tauri::command]
pub async fn save_layout(app: AppHandle, layout_name: String, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "INSERT OR REPLACE INTO layout (layout, data) VALUES (?1, ?2)",
        rusqlite::params![layout_name, data],
    )
    .map_err(|e| format!("Failed to update layout: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_global_settings(app: AppHandle) -> std::result::Result<String, String> {
    init_database(&app)?;
    let conn = get_db_connection(&app)?;
    
    let mut stmt = conn
        .prepare("SELECT data FROM global_settings WHERE id = 1")
        .map_err(|e| format!("Failed to prepare select statement for settings: {}", e))?;

    let data = stmt
        .query_row([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query settings: {}", e))?;

    Ok(data)
}

#[tauri::command]
pub async fn save_global_settings(app: AppHandle, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "INSERT OR REPLACE INTO global_settings (id, data) VALUES (1, ?1)",
        rusqlite::params![data],
    )
    .map_err(|e| format!("Failed to update global settings: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_widget_registry(app: AppHandle) -> std::result::Result<HashMap<String, String>, String> {
    init_database(&app)?;
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT type_name, data FROM widget_registry")
        .map_err(|e| format!("Failed to prepare select for widget_registry: {}", e))?;

    let iter = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| format!("Failed to map query rows: {}", e))?;

    let mut map = HashMap::new();
    for res in iter {
        let (k, v) = res.map_err(|e| format!("Row iteration error: {}", e))?;
        map.insert(k, v);
    }
    Ok(map)
}

#[tauri::command]
pub async fn save_widget_type_settings(app: AppHandle, type_name: String, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "INSERT OR REPLACE INTO widget_registry (type_name, data) VALUES (?1, ?2)",
        rusqlite::params![type_name, data],
    ).map_err(|e| format!("Failed to update widget_registry: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_widget_instances(app: AppHandle) -> std::result::Result<HashMap<String, String>, String> {
    init_database(&app)?;
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT id, data FROM widget_instances")
        .map_err(|e| format!("Failed to prepare select for widget_instances: {}", e))?;

    let iter = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| format!("Failed to map query rows: {}", e))?;

    let mut map = HashMap::new();
    for res in iter {
        let (k, v) = res.map_err(|e| format!("Row iteration error: {}", e))?;
        map.insert(k, v);
    }
    Ok(map)
}

#[tauri::command]
pub async fn save_widget_instance_settings(app: AppHandle, id: String, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "INSERT OR REPLACE INTO widget_instances (id, data) VALUES (?1, ?2)",
        rusqlite::params![id, data],
    ).map_err(|e| format!("Failed to update widget_instances: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_widget_instance(app: AppHandle, id: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "DELETE FROM widget_instances WHERE id = ?1",
        rusqlite::params![id],
    ).map_err(|e| format!("Failed to delete widget_instance: {}", e))?;
    Ok(())
}
