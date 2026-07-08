import L from 'leaflet';
import { toRoutesGeoJSON, toPointsGeoJSON } from './outputs.mjs';

let map = null;
let baseLayer = null;
let overlay = null;
let currentResultados = [];

function ensureMap() {
  if (map) return;
  map = L.map('map');
  // tiles OSM (só se houver internet); a malha desenhada garante contexto offline
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
}

function drawBackground(network) {
  const feats = network.roads.map((r) => ({
    type: 'Feature', properties: {},
    geometry: { type: 'LineString', coordinates: r.coords },
  }));
  baseLayer = L.geoJSON({ type: 'FeatureCollection', features: feats },
    { style: { color: '#bbb', weight: 1 } }).addTo(map);
}

export function renderMap(network, resultados) {
  ensureMap();
  if (!baseLayer) drawBackground(network);
  currentResultados = resultados;

  // seletor de trajeto
  const status = document.getElementById('status');
  let sel = document.getElementById('trajSel');
  if (!sel) {
    sel = document.createElement('select');
    sel.id = 'trajSel';
    sel.style.margin = '8px 0';
    document.getElementById('map').before(sel);
    // le sempre a referencia atual (currentResultados), nao o parametro
    // capturado na criacao do listener, para nao ficar preso a um array
    // antigo caso main.mjs venha a reatribuir window.__resultados no futuro
    sel.addEventListener('change', () => showTrajeto(currentResultados[sel.value]));
  }
  sel.innerHTML = resultados.map((r, i) =>
    `<option value="${i}">${r.trajeto.placa} — ${r.trajeto.dia}</option>`).join('');

  if (resultados.length) {
    showTrajeto(resultados[0]);
  } else {
    // sem trajetos ainda: mostra a malha de fundo com uma vista padrao
    // (regiao de Florianopolis) em vez de deixar o viewport indefinido
    map.setView([-27.6, -48.5], 11);
  }

  function showTrajeto({ result }) {
    if (overlay) overlay.remove();
    overlay = L.layerGroup().addTo(map);
    const rotas = L.geoJSON(toRoutesGeoJSON(result.segmentos), {
      style: { color: '#e6550d', weight: 4 },
      onEachFeature: (f, layer) => layer.bindPopup(
        `${f.properties.rua ?? '(sem nome)'}<br>${f.properties.entrada} → ${f.properties.saida}`),
    });
    const pontos = L.geoJSON(toPointsGeoJSON(result.pontos_casados), {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 3, color: '#08519c' }),
      onEachFeature: (f, layer) => layer.bindPopup(
        `#${f.properties.seq} — ${f.properties.rua ?? '(sem nome)'}<br>${f.properties.ts}<br>${f.properties.dist_m} m`),
    });
    rotas.addTo(overlay);
    pontos.addTo(overlay);
    // evita TypeError de getBounds() quando o trajeto nao tem segmentos
    // casados (rotas vazio): so ajusta a vista se houver de fato geometria
    if (rotas.getLayers().length > 0) {
      map.fitBounds(rotas.getBounds().pad(0.1));
    }
  }
}
