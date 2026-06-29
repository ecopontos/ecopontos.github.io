use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::time::Instant;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, oneshot, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LanRole {
    Hub,
    Spoke,
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub device_id: String,
    pub display_name: String,
    #[serde(skip)]
    pub addr: Option<SocketAddr>,
    pub role: LanRole,
    #[serde(skip)]
    pub last_seen: Option<Instant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerSummary {
    pub device_id: String,
    pub display_name: String,
    pub addr: String,
    pub role: LanRole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanServerInfo {
    pub running: bool,
    pub role: LanRole,
    pub port: u16,
    pub device_id: String,
    pub peer_count: usize,
    pub hub_addr: Option<String>,
}

pub struct LanServerState {
    pub is_running: AtomicBool,
    pub role: RwLock<LanRole>,
    pub peers: RwLock<HashMap<String, PeerInfo>>,
    pub port: RwLock<u16>,
    pub device_id: String,
    pub hub_addr: RwLock<Option<SocketAddr>>,
    pub ws_broadcast: broadcast::Sender<String>,
    pub db_path: RwLock<Option<PathBuf>>,
    pub auth_token: RwLock<Option<String>>,
    pub app_data_dir: RwLock<Option<PathBuf>>,
    pub shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
}

impl LanServerState {
    pub fn new(device_id: String) -> Self {
        let (ws_broadcast, _) = broadcast::channel(256);
        Self {
            is_running: AtomicBool::new(false),
            role: RwLock::new(LanRole::Disabled),
            peers: RwLock::new(HashMap::new()),
            port: RwLock::new(9400),
            device_id,
            hub_addr: RwLock::new(None),
            ws_broadcast,
            db_path: RwLock::new(None),
            auth_token: RwLock::new(None),
            app_data_dir: RwLock::new(None),
            shutdown_tx: Mutex::new(None),
        }
    }

    pub async fn get_info(&self) -> LanServerInfo {
        let role = self.role.read().await.clone();
        let port = *self.port.read().await;
        let peer_count = self.peers.read().await.len();
        let hub_addr = self.hub_addr.read().await.map(|a| a.to_string());
        LanServerInfo {
            running: self.is_running.load(std::sync::atomic::Ordering::Relaxed),
            role,
            port,
            device_id: self.device_id.clone(),
            peer_count,
            hub_addr,
        }
    }

    pub async fn peer_summaries(&self) -> Vec<PeerSummary> {
        self.peers
            .read()
            .await
            .values()
            .map(|p| PeerSummary {
                device_id: p.device_id.clone(),
                display_name: p.display_name.clone(),
                addr: p.addr.map(|a| a.to_string()).unwrap_or_default(),
                role: p.role.clone(),
            })
            .collect()
    }

    pub fn open_db_connection(path: &PathBuf) -> Result<Connection, String> {
        let conn = Connection::open(path).map_err(|e| format!("Failed to open LAN DB: {e}"))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("PRAGMA error: {e}"))?;
        Ok(conn)
    }
}
