use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::sync::Arc;

use super::state::{LanServerState, LanRole, PeerInfo};

const SERVICE_TYPE: &str = "_ecoforms._tcp.local.";

pub struct MdnsHandle {
    daemon: ServiceDaemon,
    fullname: String,
}

impl MdnsHandle {
    pub fn stop(self) {
        let _ = self.daemon.unregister(&self.fullname);
        let _ = self.daemon.shutdown();
    }
}

pub fn start_announce(
    device_id: &str,
    port: u16,
    role: &LanRole,
) -> Result<MdnsHandle, String> {
    let daemon = ServiceDaemon::new().map_err(|e| format!("mDNS daemon error: {e}"))?;

    let role_str = match role {
        LanRole::Hub => "hub",
        LanRole::Spoke => "spoke",
        LanRole::Disabled => "disabled",
    };

    let properties = [
        ("device_id", device_id),
        ("role", role_str),
        ("version", env!("CARGO_PKG_VERSION")),
    ];

    let instance_name = format!("ecoforms-{}", &device_id[..8.min(device_id.len())]);
    let host = format!("{instance_name}.local.");

    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        &instance_name,
        &host,
        "",
        port,
        &properties[..],
    ).map_err(|e| format!("ServiceInfo error: {e}"))?;

    let fullname = service_info.get_fullname().to_string();
    daemon.register(service_info).map_err(|e| format!("Register error: {e}"))?;

    Ok(MdnsHandle { daemon, fullname })
}

pub fn start_browse(state: Arc<LanServerState>) -> Result<ServiceDaemon, String> {
    let daemon = ServiceDaemon::new().map_err(|e| format!("mDNS browse daemon error: {e}"))?;
    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| format!("Browse error: {e}"))?;

    let own_device_id = state.device_id.clone();

    tokio::spawn(async move {
        loop {
            match receiver.recv_async().await {
                Ok(event) => handle_mdns_event(&state, &own_device_id, event).await,
                Err(_) => break,
            }
        }
    });

    Ok(daemon)
}

async fn handle_mdns_event(state: &LanServerState, own_device_id: &str, event: ServiceEvent) {
    match event {
        ServiceEvent::ServiceResolved(info) => {
            let device_id = info.get_property_val_str("device_id")
                .unwrap_or_default()
                .to_string();

            if device_id == own_device_id || device_id.is_empty() {
                return;
            }

            let role_str = info.get_property_val_str("role").unwrap_or_default();
            let role = match role_str {
                "hub" => LanRole::Hub,
                _ => LanRole::Spoke,
            };

            let addr = info.get_addresses().iter().next().map(|ip| {
                std::net::SocketAddr::new(*ip, info.get_port())
            });

            let display_name = info.get_fullname()
                .split('.')
                .next()
                .unwrap_or(&device_id)
                .to_string();

            let peer = PeerInfo {
                device_id: device_id.clone(),
                display_name,
                addr,
                role: role.clone(),
                last_seen: Some(std::time::Instant::now()),
            };

            if role == LanRole::Hub {
                if let Some(a) = addr {
                    *state.hub_addr.write().await = Some(a);
                }
            }

            state.peers.write().await.insert(device_id.clone(), peer);

            let join_msg = serde_json::json!({
                "type": "peer_joined",
                "device_id": device_id,
            });
            let _ = state.ws_broadcast.send(join_msg.to_string());
        }
        ServiceEvent::ServiceRemoved(_, fullname) => {
            let instance = fullname.split('.').next().unwrap_or("");
            let device_id_prefix = instance.strip_prefix("ecoforms-").unwrap_or("");

            let mut peers = state.peers.write().await;
            let to_remove: Vec<String> = peers.keys()
                .filter(|k| k.starts_with(device_id_prefix))
                .cloned()
                .collect();
            for key in &to_remove {
                peers.remove(key);
                let leave_msg = serde_json::json!({
                    "type": "peer_left",
                    "device_id": key,
                });
                let _ = state.ws_broadcast.send(leave_msg.to_string());
            }
        }
        _ => {}
    }
}
