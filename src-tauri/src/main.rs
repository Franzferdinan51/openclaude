#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! DuckHive Desktop — Tauri shell wrapping the React WebUI.
//!
//! Responsibilities:
//! - Spawn the DuckHive backend (council-api-server) on startup.
//! - Bridge IPC calls from the WebUI (via Tauri invoke()) to the backend HTTP API.
//! - Serve the WebUI frontend from the embedded dist/ folder.

use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;
use tracing::{info, error, Level};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct GatewayHealth {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    service: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timestamp: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentInfo {
    id: String,
    name: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    capabilities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_seen: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    role: String,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    id: String,
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    messages: Option<Vec<ChatMessage>>,
    created_at: u64,
    updated_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    run_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendChatOptions {
    #[serde(default = "default_model")]
    model: String,
    #[serde(default)]
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_id: Option<String>,
}

fn default_model() -> String { "auto".to_string() }

#[derive(Debug, Serialize, Deserialize)]
pub struct SendChatRequest {
    messages: Vec<ChatMessage>,
    #[serde(default = "default_model")]
    model: String,
    #[serde(default)]
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunActionRequest {
    #[serde(default)]
    payload: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Backend process handle
// ---------------------------------------------------------------------------

pub struct BackendState {
    port: u16,
    child: Option<Arc<Mutex<Option<tokio::process::Child>>>>,
}

impl BackendState {
    fn base_url(&self) -> String {
        format!("http://localhost:{}", self.port)
    }
}

async fn spawn_backend(port: u16) -> Result<Arc<Mutex<Option<tokio::process::Child>>>, String> {
    // Find council-api-server relative to the binary location.
    // In dev, the binary is at src-tauri/target/... so we go up to project root.
    let exe = std::env::current_exe()
        .map_err(|e| format!("failed to get exe path: {e}"))?;
    let project_root = exe
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|_| std::env::var("CARGO_MANIFEST_DIR").ok())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            exe.parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .to_path_buf()
        });

    let council_path = project_root.join("src/services/council-server/council-api-server.cjs");

    if !council_path.exists() {
        return Err(format!("council-api-server not found at {}", council_path.display()));
    }

    info!("Spawning council-api-server from {}", council_path.display());

    let mut child = Command::new("node")
        .arg(council_path)
        .env("PORT", port.to_string())
        .env("NODE_ENV", "production")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to spawn council-api-server: {e}"))?;

    // Wait for backend to become ready
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    let base = format!("http://localhost:{}/api/health", port);

    loop {
        if std::time::Instant::now() > deadline {
            child.kill().await.ok();
            return Err("council-api-server failed to start within 10s".to_string());
        }
        if let Ok(resp) = reqwest::Client::new().get(&base).timeout(std::time::Duration::from_secs(1)).send() {
            if resp.status().is_success() {
                info!("council-api-server ready on port {}", port);
                break;
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }

    Ok(Arc::new(Mutex::new(Some(child))))
}

fn setup_logging() {
    let log_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("DuckHive")
        .join("logs");

    std::fs::create_dir_all(&log_dir).ok();

    let file_appender = RollingFileAppender::new(Rotation::DAILY, log_dir, "duckhive.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .with(fmt::layer().with_writer(std::io::stderr))
        .init();

    // Keep guard alive for app lifetime — leak it (acceptable for short-lived app).
    Box::leak(Box::new(_guard));
}

// ---------------------------------------------------------------------------
// Tauri IPC commands
// ---------------------------------------------------------------------------

macro_rules! backend_get {
    ($cmd:ident -> $ty:ty : $path:literal) => {
        #[tauri::command]
        async fn $cmd(state: State<'_, BackendState>) -> Result<$ty, String> {
            let url = format!("{}{}", state.base_url(), $path);
            let resp = reqwest::Client::new()
                .get(&url)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                return Err(format!("HTTP {}", resp.status()));
            }
            resp.json::<$ty>().await.map_err(|e| e.to_string())
        }
    };
}

macro_rules! backend_get_with_fallback {
    ($cmd:ident -> $ty:ty : $path:literal, $fallback:expr) => {
        #[tauri::command]
        async fn $cmd(state: State<'_, BackendState>) -> Result<$ty, String> {
            let url = format!("{}{}", state.base_url(), $path);
            match reqwest::Client::new()
                .get(&url)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    resp.json::<$ty>().await.map_err(|e| e.to_string())
                }
                _ => Ok($fallback),
            }
        }
    };
}

macro_rules! backend_post {
    ($cmd:ident -> $ty:ty : $path:literal, $body:ty) => {
        #[tauri::command]
        async fn $cmd(state: State<'_, BackendState>, body: $body) -> Result<$ty, String> {
            let url = format!("{}{}", state.base_url(), $path);
            let resp = reqwest::Client::new()
                .post(&url)
                .json(&body)
                .timeout(std::time::Duration::from_secs(30))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                return Err(format!("HTTP {}", resp.status()));
            }
            resp.json::<$ty>().await.map_err(|e| e.to_string())
        }
    };
}

backend_get!(get_health -> GatewayHealth : "/health");
backend_get_with_fallback!(get_system_status -> serde_json::Value : "/api/status", serde_json::json!({}));
backend_get!(get_agents -> serde_json::Value : "/api/agents");
backend_get!(get_tools -> serde_json::Value : "/api/tools");
backend_get!(get_mcp_servers -> serde_json::Value : "/api/mcp/servers");

#[tauri::command]
async fn create_session(state: State<'_, BackendState>, title: Option<String>) -> Result<Option<SessionInfo>, String> {
    let url = format!("{}/api/sessions", state.base_url());
    let body = serde_json::json!({ "title": title });
    let resp = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<Option<SessionInfo>>().await.map_err(|e| e.to_string())
}

backend_get!(list_sessions -> serde_json::Value : "/api/sessions");

#[tauri::command]
async fn get_session(state: State<'_, BackendState>, session_id: String) -> Result<Option<serde_json::Value>, String> {
    let url = format!("{}/api/sessions/{}", state.base_url(), urlencoding::encode(&session_id));
    match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<Option<serde_json::Value>>().await.map_err(|e| e.to_string())
        }
        _ => Ok(None),
    }
}

#[tauri::command]
async fn send_chat(state: State<'_, BackendState>, messages: Vec<ChatMessage>, options: SendChatOptions) -> Result<Option<serde_json::Value>, String> {
    let url = format!("{}/api/chat", state.base_url());
    let body = serde_json::json!({
        "messages": messages,
        "model": options.model,
        "stream": options.stream,
        "sessionId": options.session_id,
    });
    let resp = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<Option<serde_json::Value>>().await.map_err(|e| e.to_string())
}

backend_get!(list_runs -> serde_json::Value : "/api/runs");

#[tauri::command]
async fn get_run(state: State<'_, BackendState>, run_id: String) -> Result<Option<serde_json::Value>, String> {
    let url = format!("{}/api/runs/{}", state.base_url(), urlencoding::encode(&run_id));
    match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<Option<serde_json::Value>>().await.map_err(|e| e.to_string())
        }
        _ => Ok(None),
    }
}

#[tauri::command]
async fn get_run_events(state: State<'_, BackendState>, run_id: String, limit: Option<u32>) -> Result<serde_json::Value, String> {
    let limit_str = limit.unwrap_or(50);
    let url = format!("{}/api/runs/{}/events?limit={}", state.base_url(), urlencoding::encode(&run_id), limit_str);
    match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
        }
        _ => Ok(serde_json::json!({ "events": [] })),
    }
}

#[tauri::command]
async fn run_action(state: State<'_, BackendState>, run_id: String, action: String, payload: serde_json::Value) -> Result<Option<serde_json::Value>, String> {
    let url = format!("{}/api/runs/{}/{}", state.base_url(), urlencoding::encode(&run_id), action);
    let resp = reqwest::Client::new()
        .post(&url)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<Option<serde_json::Value>>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_search_provider(state: State<'_, BackendState>) -> Result<serde_json::Value, String> {
    let url = format!("{}/api/search-provider", state.base_url());
    match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
        }
        _ => Ok(serde_json::json!({ "configured": false })),
    }
}

#[tauri::command]
async fn set_search_provider(state: State<'_, BackendState>, provider: String, searxng_url: Option<String>) -> Result<serde_json::Value, String> {
    let url = format!("{}/api/search-provider", state.base_url());
    let body = serde_json::json!({ "provider": provider, "searxngUrl": searxng_url });
    let resp = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_cost_stats(state: State<'_, BackendState>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "totalTokens": 0,
        "promptTokens": 0,
        "completionTokens": 0,
        "period": "session"
    }))
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    setup_logging();

    info!("Starting DuckHive Desktop");

    // Spawn backend on a random port > 3000.
    let port: u16 = std::env::var("DUCKHIVE_PORT")
        .unwrap_or_else(|_| "3017".to_string())
        .parse()
        .unwrap_or(3017);

    let backend_state = BackendState {
        port,
        child: None,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .manage(backend_state)
        .invoke_handler(tauri::generate_handler![
            get_health,
            get_system_status,
            get_agents,
            get_tools,
            get_mcp_servers,
            create_session,
            list_sessions,
            get_session,
            send_chat,
            list_runs,
            get_run,
            get_run_events,
            run_action,
            get_search_provider,
            set_search_provider,
            get_cost_stats,
        ])
        .setup(|app| {
            let port: u16 = app.state::<BackendState>().port;

            // Spawn backend async (ignore errors gracefully).
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match spawn_backend(port).await {
                    Ok(child) => {
                        // Store child handle in backend state via interior mutability.
                        if let Some(state) = handle.try_state::<BackendState>() {
                            // We can set it via a channel or just let it leak — the process
                            // will be killed when the app exits.
                        }
                        let _ = child;
                    }
                    Err(e) => {
                        error!("Failed to spawn backend: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                info!("DuckHive window closing");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}