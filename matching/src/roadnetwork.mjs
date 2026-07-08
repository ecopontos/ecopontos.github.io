import Flatbush from 'flatbush';

export function bboxOfCoords(coords) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of coords) {
    if (x < minx) minx = x;
    if (y < miny) miny = y;
    if (x > maxx) maxx = x;
    if (y > maxy) maxy = y;
  }
  return [minx, miny, maxx, maxy];
}

export function roadsFromGeoJSON(fc) {
  const roads = [];
  fc.features.forEach((f) => {
    if (!f.geometry || f.geometry.type !== 'LineString') return;
    const name = f.properties?.name;
    roads.push({
      id: roads.length,
      name: name ? String(name) : null,
      highway: f.properties?.highway ? String(f.properties.highway) : '',
      coords: f.geometry.coordinates,
    });
  });
  return roads;
}

export function buildNetwork(roads) {
  const index = new Flatbush(roads.length);
  const byName = new Map();
  for (const r of roads) {
    const [minx, miny, maxx, maxy] = bboxOfCoords(r.coords);
    index.add(minx, miny, maxx, maxy);
    if (r.name) {
      if (!byName.has(r.name)) byName.set(r.name, []);
      byName.get(r.name).push(r.id);
    }
  }
  index.finish();
  return { roads, index, byName };
}
