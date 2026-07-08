import { gunzipSync } from 'node:zlib';
export function decodeNetworkNode(b64) {
  return JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
}
