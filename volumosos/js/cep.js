// Consulta de CEP no ViaCEP (público, com CORS). Melhor esforço: sem rede ou
// CEP desconhecido devolve null e o atendente preenche à mão.

export async function buscarCep(cep, { timeoutMs = 5000 } = {}) {
    const digitos = String(cep ?? '').replace(/\D/g, '');
    if (digitos.length !== 8 || !navigator.onLine) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal: ctrl.signal });
        if (!resp.ok) return null;
        const json = await resp.json();
        if (json.erro) return null;
        return { logradouro: json.logradouro ?? '', bairro: json.bairro ?? '', cidade: json.localidade ?? '', uf: json.uf ?? '' };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
