use rand::RngCore;

pub fn uuid_v7_string() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);

    let timestamp = chrono::Utc::now().timestamp_millis() as u64;
    bytes[0] = ((timestamp >> 40) & 0xff) as u8;
    bytes[1] = ((timestamp >> 32) & 0xff) as u8;
    bytes[2] = ((timestamp >> 24) & 0xff) as u8;
    bytes[3] = ((timestamp >> 16) & 0xff) as u8;
    bytes[4] = ((timestamp >> 8) & 0xff) as u8;
    bytes[5] = (timestamp & 0xff) as u8;
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    let hex: Vec<String> = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!(
        "{}{}{}{}-{}{}-{}{}-{}{}-{}{}{}{}{}{}",
        hex[0], hex[1], hex[2], hex[3],
        hex[4], hex[5],
        hex[6], hex[7],
        hex[8], hex[9],
        hex[10], hex[11], hex[12], hex[13], hex[14], hex[15],
    )
}

#[cfg(test)]
mod tests {
    use super::uuid_v7_string;

    #[test]
    fn generates_uuid_v7() {
        let id = uuid_v7_string();
        assert_eq!(id.len(), 36);
        assert_eq!(&id[14..15], "7");
        assert!(matches!(&id[19..20], "8" | "9" | "a" | "b"));
    }
}
