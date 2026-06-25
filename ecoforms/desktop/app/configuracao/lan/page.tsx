'use client';

import { useState } from 'react';
import { useLanSync } from '../../../contexts/LanSyncContext';

export default function LanConfigPage() {
    const {
        serverRunning, role, peers, connectionStatus, port,
        startServer, stopServer, setRole, discoverPeers,
    } = useLanSync();

    const [selectedRole, setSelectedRole] = useState<'hub' | 'spoke'>(role === 'spoke' ? 'spoke' : 'hub');
    const [selectedPort, setSelectedPort] = useState(port);
    const [hubAddr, setHubAddr] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        setLoading(true);
        setError(null);
        try {
            await startServer(selectedRole, selectedPort);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        setLoading(true);
        try {
            await stopServer();
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const handleSetRole = async () => {
        setLoading(true);
        setError(null);
        try {
            await setRole(selectedRole, selectedRole === 'spoke' ? hubAddr : undefined);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">Rede Local (LAN)</h1>
            <p className="text-gray-600">
                Configure a comunicacao entre instancias do EcoForms na rede local.
            </p>

            {/* Status */}
            <div className="rounded-lg border p-4 space-y-2">
                <h2 className="font-semibold">Status</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">Servidor:</span>
                    <span className={serverRunning ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {serverRunning ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-gray-500">Papel:</span>
                    <span className="capitalize">{role}</span>
                    <span className="text-gray-500">Conexao:</span>
                    <span>{connectionStatus}</span>
                    <span className="text-gray-500">Porta:</span>
                    <span>{port}</span>
                    <span className="text-gray-500">Peers:</span>
                    <span>{peers.length}</span>
                </div>
            </div>

            {/* Configuracao */}
            <div className="rounded-lg border p-4 space-y-4">
                <h2 className="font-semibold">Configuracao</h2>

                <div className="space-y-2">
                    <label className="block text-sm font-medium">Papel nesta maquina</label>
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as 'hub' | 'spoke')}
                        className="w-full rounded border px-3 py-2"
                        disabled={serverRunning}
                    >
                        <option value="hub">Hub (servidor central)</option>
                        <option value="spoke">Spoke (conecta ao hub)</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium">Porta</label>
                    <input
                        type="number"
                        value={selectedPort}
                        onChange={(e) => setSelectedPort(Number(e.target.value))}
                        className="w-full rounded border px-3 py-2"
                        disabled={serverRunning}
                        min={1024}
                        max={65535}
                    />
                </div>

                {selectedRole === 'spoke' && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Endereco do Hub (IP:porta)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={hubAddr}
                                onChange={(e) => setHubAddr(e.target.value)}
                                placeholder="192.168.1.100:9400"
                                className="flex-1 rounded border px-3 py-2"
                            />
                            <button
                                onClick={() => discoverPeers()}
                                className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                            >
                                Descobrir
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <p className="text-red-600 text-sm">{error}</p>
                )}

                <div className="flex gap-2">
                    {!serverRunning ? (
                        <button
                            onClick={handleStart}
                            disabled={loading}
                            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Iniciando...' : 'Iniciar Servidor'}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleStop}
                                disabled={loading}
                                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                Parar Servidor
                            </button>
                            <button
                                onClick={handleSetRole}
                                disabled={loading}
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                            >
                                Atualizar Papel
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Peers */}
            {peers.length > 0 && (
                <div className="rounded-lg border p-4 space-y-2">
                    <h2 className="font-semibold">Peers Conectados</h2>
                    <div className="divide-y">
                        {peers.map((peer) => (
                            <div key={peer.device_id} className="py-2 flex justify-between text-sm">
                                <div>
                                    <span className="font-medium">{peer.display_name}</span>
                                    <span className="text-gray-400 ml-2">{peer.addr}</span>
                                </div>
                                <span className="text-gray-500 capitalize">{peer.role}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
