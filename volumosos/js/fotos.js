// Redimensiona fotos da câmera antes de guardar: celulares geram 4–12 MB por
// foto, o que estoura o IndexedDB e o limite de upload do Apps Script.

const LADO_MAX = 1280;
const QUALIDADE = 0.72;

export async function comprimirFoto(arquivo) {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar a foto'))), 'image/jpeg', QUALIDADE);
    });
}
