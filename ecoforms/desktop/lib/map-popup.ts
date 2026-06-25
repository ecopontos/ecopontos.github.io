import maplibregl from 'maplibre-gl';

const ESC: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function escapeHtml(str: string | number | null | undefined): string {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ESC[c]);
}

export function safePopup(
    map: maplibregl.Map,
    lngLat: maplibregl.LngLatLike,
    lines: Array<{ tag?: string; style?: string; text: string; raw?: boolean }>,
    maxWidth = '280px',
): void {
    const container = document.createElement('div');
    container.style.cssText = 'font-family:sans-serif;font-size:13px;line-height:1.6';

    for (const line of lines) {
        const el = document.createElement(line.tag ?? 'span');
        if (line.style) el.style.cssText = line.style;
        if (line.raw) {
            el.innerHTML = line.text;
        } else {
            el.textContent = line.text;
        }
        container.appendChild(el);
        container.appendChild(document.createElement('br'));
    }

    new maplibregl.Popup({ maxWidth })
        .setLngLat(lngLat)
        .setDOMContent(container)
        .addTo(map);
}
