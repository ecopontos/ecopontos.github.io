"use client";

import { useRef, useState, useCallback } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { computeCentroid, computeAreaM2, saveTerrenosBatch } from '@/src/interface/hooks/catalog/logistica';
import { useAuth } from '@/contexts/AuthContext';
import { EPSG_31981, EPSG_31982, looksProjected, reprojectGeometry } from '@/lib/geo/reproject';

const MAX_FEATURES = 200_000;
const WARN_FEATURES = 50_000;

// Mapeamento heurístico de property names comuns em cadastros municipais
function extractProp(props: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = props[k] ?? props[k.toLowerCase()] ?? props[k.toUpperCase()];
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
}

interface ImportResult {
    total: number;
    inserted: number;
    skipped: number;
}

interface Props {
    onImported: () => void;
}

export default function TerrenoImport({ onImported }: Props) {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [phase, setPhase] = useState<'idle' | 'preview' | 'importing' | 'done' | 'error'>('idle');
    const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const pendingRef = useRef<ReturnType<typeof prepareTerrenosFromGeojson> | null>(null);

    const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhase('idle');
        setPreview(null);
        setResult(null);
        setErrorMsg('');

        try {
            const text = await file.text();
            let parsed: FeatureCollection;
            try {
                parsed = JSON.parse(text) as FeatureCollection;
            } catch {
                throw new Error('ArquivoJSON inválido. Verifique a formatação.');
            }
            if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
                throw new Error('Arquivo deve ser um GeoJSON do tipo FeatureCollection.');
            }
            if (parsed.features.length === 0) {
                throw new Error('Arquivo não contém feições (features).');
            }
            if (parsed.features.length > MAX_FEATURES) {
                throw new Error(`Arquivo muito grande: ${parsed.features.length} feições. Máximo suportado: ${MAX_FEATURES.toLocaleString('pt-BR')}.`);
            }
            const prepared = prepareTerrenosFromGeojson(parsed, user?.id ?? null);
            if (prepared.length === 0) {
                const polyCount = parsed.features.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon').length;
                throw new Error(
                    polyCount === 0
                        ? 'Nenhuma feição com geometria do tipo Polygon/MultiPolygon encontrada. Apenas polígonos são aceitos.'
                        : 'Nenhuma feição com geometria válida encontrada no arquivo.'
                );
            }
            pendingRef.current = prepared;
            setPreview({
                count: prepared.length,
                sample: prepared.slice(0, 3).map(t => t.nome + (t.codigo_cadastral ? ` (${t.codigo_cadastral})` : '')),
            });
            setPhase('preview');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Erro ao ler arquivo.');
            setPhase('error');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [user]);

    const handleConfirm = useCallback(async () => {
        if (!pendingRef.current) return;
        const terrenos = pendingRef.current;
        setPhase('importing');
        setProgress(0);
        try {
            const inserted = await saveTerrenosBatch(terrenos, (done, total) => {
                setProgress(Math.round((done / total) * 100));
            });
            setResult({ total: terrenos.length, inserted, skipped: terrenos.length - inserted });
            setPhase('done');
            onImported();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro na importação.';
            if (msg.includes('Database is locked') || msg.includes('SQLITE_BUSY')) {
                setErrorMsg('Banco de dados ocupado. Feche outras janelas do app e tente novamente.');
            } else {
                setErrorMsg(msg);
            }
            setPhase('error');
        }
    }, [onImported]);

    return (
        <div className="space-y-3">
            <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json"
                className="hidden"
                onChange={handleFile}
            />

            {phase === 'idle' && (
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Importar cadastro (.geojson)
                </Button>
            )}

            {phase === 'preview' && preview && (
                <div className="border rounded-md p-3 space-y-3 bg-blue-50/50 text-sm">
                    <p className="font-medium text-blue-900">{preview.count} terrenos encontrados</p>
                    {preview.count > WARN_FEATURES && (
                        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                            Arquivo grande. A importação pode demorar alguns minutos.
                        </p>
                    )}
                    {preview.sample.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                            {preview.sample.map((s, i) => <li key={i} className="truncate">· {s}</li>)}
                            {preview.count > 3 && <li className="text-muted-foreground">... e mais {preview.count - 3}</li>}
                        </ul>
                    )}
                    <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={handleConfirm}>Importar</Button>
                        <Button size="sm" variant="outline" onClick={() => { setPhase('idle'); pendingRef.current = null; }}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}

            {phase === 'importing' && (
                <div className="border rounded-md p-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Importando... {progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            {phase === 'done' && result && (
                <div className="border rounded-md p-3 space-y-2 bg-green-50/50 text-sm">
                    <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">{result.inserted} importados</span>
                    </div>
                    {result.skipped > 0 && (
                        <p className="text-xs text-muted-foreground">{result.skipped} ignorados (já existiam)</p>
                    )}
                    <Button size="sm" variant="outline" className="w-full" onClick={() => { setPhase('idle'); setResult(null); }}>
                        Importar outro
                    </Button>
                </div>
            )}

            {phase === 'error' && (
                <div className="border rounded-md p-3 space-y-2 bg-red-50/50 text-sm">
                    <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errorMsg}</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => { setPhase('idle'); }}>
                        Tentar novamente
                    </Button>
                </div>
            )}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extrai o código EPSG do membro `crs` legado do GeoJSON (RFC 7946 não usa mais,
// mas cadastros municipais exportados de softwares GIS ainda incluem).
function detectEpsgFromCrs(fc: FeatureCollection): string | null {
    const name = (fc as unknown as { crs?: { properties?: { name?: string } } }).crs?.properties?.name;
    if (!name) return null;
    if (name.includes('31982')) return EPSG_31982;
    if (name.includes('31981')) return EPSG_31981;
    return null;
}

function firstCoord(geom: Geometry): number[] | null {
    if (geom.type === 'Polygon') return geom.coordinates[0]?.[0] ?? null;
    if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0]?.[0] ?? null;
    return null;
}

function prepareTerrenosFromGeojson(
    fc: FeatureCollection,
    criadoPor: string | null
) {
    const crsEpsg = detectEpsgFromCrs(fc);

    return fc.features
        .filter(f => f.geometry != null && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
        .map((f, idx) => {
            const props = (f.properties ?? {}) as Record<string, unknown>;
            let geom = f.geometry as Geometry;

            // Cadastros municipais frequentemente vêm em SIRGAS 2000 / UTM (metros).
            // GeoJSON/MapLibre e os filtros de bbox em SQLite exigem WGS84 (lon/lat).
            const coord = firstCoord(geom);
            const sourceEpsg = crsEpsg ?? (coord && looksProjected(coord) ? EPSG_31982 : null);
            if (sourceEpsg) {
                geom = reprojectGeometry(geom, sourceEpsg);
            }

            const centroid = computeCentroid(geom);
            const area = computeAreaM2(geom);

            const nome = extractProp(props, ['nome', 'name', 'descricao', 'NOME', 'DESCRICAO', 'logradouro', 'LOGRADOURO'])
                ?? `Terreno ${idx + 1}`;
            const codigo = extractProp(props, ['codigo_cadastral', 'cadastral', 'codigo', 'inscricao', 'CODIGO', 'INSCRICAO', 'cod_imovel', 'id']);
            const tipo = normalizeTipo(extractProp(props, ['tipo', 'type', 'uso', 'USO', 'TIPO']) ?? '');
            const bairro = extractProp(props, ['bairro', 'BAIRRO', 'district', 'neighbourhood']);
            const logradouro = extractProp(props, ['logradouro', 'rua', 'street', 'LOGRADOURO']);
            const numero = extractProp(props, ['numero', 'number', 'NUMERO', 'num']);
            const cidade = extractProp(props, ['cidade', 'municipio', 'city', 'CIDADE']);
            const estado = extractProp(props, ['estado', 'uf', 'state', 'ESTADO', 'UF']);

            const id = codigo
                ? `terreno-${codigo.replace(/\W/g, '-')}`
                : `terreno-${Date.now()}-${idx}`;

            return {
                id,
                nome,
                codigo_cadastral: codigo,
                tipo,
                geojson: JSON.stringify(geom),
                centroid_lat: centroid ? centroid[1] : null,
                centroid_lng: centroid ? centroid[0] : null,
                area_m2: area ? Math.round(area) : null,
                bairro,
                logradouro,
                numero,
                cidade,
                estado,
                criado_por: criadoPor,
            };
        });
}

function normalizeTipo(raw: string): 'residencial' | 'comercial' | 'industrial' | 'publico' | 'rural' | 'outro' {
    const v = raw.toLowerCase();
    if (v.includes('resid') || v.includes('habitac')) return 'residencial';
    if (v.includes('comerc') || v.includes('servic')) return 'comercial';
    if (v.includes('indust')) return 'industrial';
    if (v.includes('public') || v.includes('govern') || v.includes('munic')) return 'publico';
    if (v.includes('rural') || v.includes('agricol')) return 'rural';
    return 'outro';
}
