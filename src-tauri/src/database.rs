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
        "CREATE TABLE IF NOT EXISTS ai_data (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table ai_data: {}", e))?;



    conn.execute(
        "CREATE TABLE IF NOT EXISTS widget_instances (
            id TEXT PRIMARY KEY,
            data TEXT
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table widget_instances: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS widget_registry (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table widget_registry: {}", e))?;

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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_instances (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table ai_instances: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_sessions (
            id TEXT PRIMARY KEY,
            instance_id TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            data TEXT NOT NULL
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table ai_sessions: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            data TEXT NOT NULL
         )",
        [],
    )
    .map_err(|e| format!("Failed to create table ai_messages: {}", e))?;

    // Migration logic for legacy `ai_data` table
    let legacy_data: Result<String, _> = conn.query_row(
        "SELECT data FROM ai_data WHERE id = 1",
        [],
        |row| row.get(0),
    );

    if let Ok(data) = legacy_data {
        if data != "{}" {
            #[derive(serde::Deserialize)]
            struct LegacyAiData {
                instances: Option<Vec<serde_json::Value>>,
                sessions: Option<Vec<serde_json::Value>>,
            }
            if let Ok(parsed) = serde_json::from_str::<LegacyAiData>(&data) {
                if let Some(instances) = parsed.instances {
                    for inst in instances {
                        if let Some(id) = inst.get("id").and_then(|i| i.as_str()) {
                            let _ = conn.execute(
                                "INSERT OR IGNORE INTO ai_instances (id, data) VALUES (?1, ?2)",
                                rusqlite::params![id, inst.to_string()],
                            );
                        }
                    }
                }
                if let Some(mut sessions) = parsed.sessions {
                    for sess in sessions.iter_mut() {
                        let id = sess.get("id").and_then(|i| i.as_str()).map(|s| s.to_string());
                        let instance_id = sess.get("instanceId").and_then(|i| i.as_str()).map(|s| s.to_string());
                        let updated_at = sess.get("updatedAt").and_then(|i| i.as_u64());

                        if let (Some(id), Some(instance_id), Some(updated_at)) = (id.clone(), instance_id, updated_at) {
                            if let Some(sess_obj) = sess.as_object_mut() {
                                if let Some(messages) = sess_obj.get_mut("messages").and_then(|m| m.as_array_mut()) {
                                    for msg in messages.iter() {
                                        if let (Some(msg_id), Some(timestamp)) = (
                                            msg.get("id").and_then(|i| i.as_str()),
                                            msg.get("timestamp").and_then(|i| i.as_u64()),
                                        ) {
                                            let _ = conn.execute(
                                                "INSERT OR IGNORE INTO ai_messages (id, session_id, timestamp, data) VALUES (?1, ?2, ?3, ?4)",
                                                rusqlite::params![msg_id, id, timestamp as i64, msg.to_string()],
                                            );
                                        }
                                    }
                                    messages.clear(); // Remove messages from session data to keep it lightweight
                                }
                            }
                            let _ = conn.execute(
                                "INSERT OR IGNORE INTO ai_sessions (id, instance_id, updated_at, data) VALUES (?1, ?2, ?3, ?4)",
                                rusqlite::params![id, instance_id, updated_at as i64, sess.to_string()],
                            );
                        }
                    }
                }
            }
            let _ = conn.execute("UPDATE ai_data SET data = '{}' WHERE id = 1", []);
        }
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
pub async fn load_ai_instances(app: AppHandle) -> std::result::Result<Vec<String>, String> {
    init_database(&app)?;
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT data FROM ai_instances").map_err(|e| e.to_string())?;
    let iter = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for res in iter {
        list.push(res.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub async fn load_ai_sessions(app: AppHandle) -> std::result::Result<Vec<String>, String> {
    init_database(&app)?;
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT data FROM ai_sessions ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    let iter = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for res in iter {
        list.push(res.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub async fn load_ai_messages(app: AppHandle, session_id: String, limit: u32, offset: u32) -> std::result::Result<Vec<String>, String> {
    init_database(&app)?;
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT data FROM ai_messages WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT ?2 OFFSET ?3").map_err(|e| e.to_string())?;
    let iter = stmt.query_map(rusqlite::params![session_id, limit, offset], |row| row.get(0)).map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for res in iter {
        list.push(res.map_err(|e| e.to_string())?);
    }
    // Reverse it to return in chronological order (since we ordered by DESC for limit/offset)
    list.reverse();
    Ok(list)
}

#[tauri::command]
pub async fn save_ai_instance(app: AppHandle, id: String, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("INSERT OR REPLACE INTO ai_instances (id, data) VALUES (?1, ?2)", rusqlite::params![id, data]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_ai_session(app: AppHandle, id: String, instance_id: String, updated_at: i64, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("INSERT OR REPLACE INTO ai_sessions (id, instance_id, updated_at, data) VALUES (?1, ?2, ?3, ?4)", rusqlite::params![id, instance_id, updated_at, data]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_ai_message(app: AppHandle, id: String, session_id: String, timestamp: i64, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("INSERT OR REPLACE INTO ai_messages (id, session_id, timestamp, data) VALUES (?1, ?2, ?3, ?4)", rusqlite::params![id, session_id, timestamp, data]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_ai_instance(app: AppHandle, id: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("DELETE FROM ai_instances WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ai_messages WHERE session_id IN (SELECT id FROM ai_sessions WHERE instance_id = ?1)", rusqlite::params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ai_sessions WHERE instance_id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_ai_session(app: AppHandle, id: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute("DELETE FROM ai_sessions WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ai_messages WHERE session_id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
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

#[tauri::command]
pub async fn load_widget_registry(app: AppHandle) -> std::result::Result<HashMap<String, String>, String> {
    init_database(&app)?;
    let conn = get_db_connection(&app)?;
    let mut stmt = conn.prepare("SELECT id, data FROM widget_registry")
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
pub async fn save_widget_registry(app: AppHandle, id: String, data: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "INSERT OR REPLACE INTO widget_registry (id, data) VALUES (?1, ?2)",
        rusqlite::params![id, data],
    ).map_err(|e| format!("Failed to update widget_registry: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_widget_registry(app: AppHandle, id: String) -> std::result::Result<(), String> {
    let conn = get_db_connection(&app)?;
    conn.execute(
        "DELETE FROM widget_registry WHERE id = ?1",
        rusqlite::params![id],
    ).map_err(|e| format!("Failed to delete widget_registry: {}", e))?;
    Ok(())
}

