export async function decodeNetworkBrowser(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return JSON.parse(text);
}
