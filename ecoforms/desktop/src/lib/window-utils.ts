export async function openInNewWindow(url: string, label?: string, _title: string = 'EcoSuite') {
    // Check if we are running in Tauri
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

    if (!isTauri) {
        // Fallback for web browser
        window.open(url, '_blank');
        return;
    }

    // Navigate in the same window for consistency
    window.location.href = url;
}
