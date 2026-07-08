const R = 6371008.8; // raio médio WGS84 (m)
const rad = (d) => (d * Math.PI) / 180;

export function haversineMeters(lon1, lat1, lon2, lat2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// projeção planar ponto->segmento (coords em graus); ok para seleção do vizinho
function projSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = ax + t * dx, ny = ay + t * dy;
  const ex = px - nx, ey = py - ny;
  return { d2: ex * ex + ey * ey, nx, ny };
}

export function nearestOnPolyline(lon, lat, coords) {
  let best = { d2: Infinity, nlon: coords[0][0], nlat: coords[0][1] };
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = coords[i - 1];
    const [bx, by] = coords[i];
    const r = projSeg(lon, lat, ax, ay, bx, by);
    if (r.d2 < best.d2) best = { d2: r.d2, nlon: r.nx, nlat: r.ny };
  }
  return best;
}

export function distToPolylineMeters(lon, lat, coords) {
  const { nlon, nlat } = nearestOnPolyline(lon, lat, coords);
  return haversineMeters(lon, lat, nlon, nlat);
}
