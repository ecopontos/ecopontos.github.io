export function uuidv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const ts = BigInt(Date.now());
  const b40 = BigInt(40);
  const b32 = BigInt(32);
  const b24 = BigInt(24);
  const b16 = BigInt(16);
  const b8 = BigInt(8);
  const mask = BigInt(0xff);

  bytes[0] = Number((ts >> b40) & mask);
  bytes[1] = Number((ts >> b32) & mask);
  bytes[2] = Number((ts >> b24) & mask);
  bytes[3] = Number((ts >> b16) & mask);
  bytes[4] = Number((ts >> b8) & mask);
  bytes[5] = Number(ts & mask);

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}
