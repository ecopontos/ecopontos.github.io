// Envio opcional das fotos ao Google Drive pelo mesmo Web App Apps Script do
// EcoForms (google-workspace/apps-script/Code.gs, ação `uploadFile`).
//
// A credencial deve ser uma credencial POR DISPOSITIVO ("deviceId.segredo")
// com a ação `uploadFile` e o prefixo `volumosos/` em `filePrefixes` — assim o
// aparelho só consegue gravar nessa pasta e pode ser revogado sozinho.

export const PREFIXO_DRIVE = 'volumosos';

function blobParaBase64(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

export function caminhoFoto(coleta, agendamentoId, fotoId) {
    return `${PREFIXO_DRIVE}/${coleta.data}/${agendamentoId}/${fotoId}.jpg`;
}

async function chamar({ url, token }, corpo) {
    // text/plain evita o preflight CORS, que o Apps Script não responde.
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...corpo, token }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json.ok) throw new Error(`${json.error?.code ?? 'ERRO'}: ${json.error?.message ?? 'falha no Apps Script'}`);
    return json.data;
}

export async function testarConexao(cfg) {
    return chamar(cfg, { action: 'health' });
}

export async function enviarFoto(cfg, path, blob) {
    return chamar(cfg, {
        action: 'uploadFile',
        path,
        contentType: blob.type || 'image/jpeg',
        contentBase64: await blobParaBase64(blob),
    });
}
