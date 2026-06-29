"use client";

import { useState } from 'react';
import { Plus, Eye, Rocket, Pencil, Archive } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useModules } from '@/src/interface/hooks/catalog/modules-views';
import { toast } from 'sonner';

export default function AdminModulesPage() {
    const { modules, loading, refetch, createModule, publishModule, archiveModule } = useModules();
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newModule, setNewModule] = useState({ slug: '', name: '', entity_type: '', description: '' });

    const handleCreate = async () => {
        if (!newModule.slug || !newModule.name || !newModule.entity_type) {
            toast.error('Preencha slug, nome e entity_type');
            return;
        }
        try {
            await createModule(newModule);
            toast.success('Módulo criado com sucesso');
            setDialogOpen(false);
            setNewModule({ slug: '', name: '', entity_type: '', description: '' });
            refetch();
        } catch (err) {
            toast.error('Erro ao criar módulo');
        }
    };

    const handlePublish = async (id: string) => {
        try {
            await publishModule(id);
            toast.success('Módulo publicado');
            refetch();
        } catch (err) {
            toast.error('Erro ao publicar');
        }
    };

    const handleArchive = async (id: string) => {
        try {
            await archiveModule(id);
            toast.success('Módulo arquivado');
            refetch();
        } catch (err) {
            toast.error('Erro ao arquivar');
        }
    };

    if (loading) {
        return <div className="p-6">Carregando...</div>;
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Module Registry</h1>
                    <p className="text-muted-foreground">Gerenciar módulos operacionais dinâmicos</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Novo Módulo</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Módulo</DialogTitle>
                            <DialogDescription>Preencha os dados básicos do módulo.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <Input placeholder="Slug (ex: fiscalizacao)" value={newModule.slug} onChange={e => setNewModule({ ...newModule, slug: e.target.value })} />
                            <Input placeholder="Nome (ex: Fiscalização Ambiental)" value={newModule.name} onChange={e => setNewModule({ ...newModule, name: e.target.value })} />
                            <Input placeholder="Entity Type (ex: fiscalizacao)" value={newModule.entity_type} onChange={e => setNewModule({ ...newModule, entity_type: e.target.value })} />
                            <Input placeholder="Descrição" value={newModule.description} onChange={e => setNewModule({ ...newModule, description: e.target.value })} />
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate}>Criar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {modules.map(mod => (
                    <Card key={mod.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">{mod.name}</CardTitle>
                                    <CardDescription>/{mod.slug} — {mod.entity_type}</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={mod.status === 'published' ? 'default' : 'secondary'}>{mod.status}</Badge>
                                    <Badge variant="outline">v{mod.version}</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{mod.description || 'Sem descrição'}</p>
                                <div className="flex gap-2">
                                    <Link href={`/admin/modules/${mod.id}/edit`}>
                                        <Button size="sm" variant="outline">
                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                        </Button>
                                    </Link>
                                    <Button size="sm" variant="outline" onClick={() => router.push(`/modulo/${mod.slug}`)}>
                                        <Eye className="mr-2 h-4 w-4" /> Visualizar
                                    </Button>
                                    {mod.status !== 'published' && (
                                        <Button size="sm" onClick={() => handlePublish(mod.id)}>
                                            <Rocket className="mr-2 h-4 w-4" /> Publicar
                                        </Button>
                                    )}
                                    {mod.status === 'published' && (
                                        <Button size="sm" variant="outline" onClick={() => handleArchive(mod.id)}>
                                            <Archive className="mr-2 h-4 w-4" /> Arquivar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {modules.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        Nenhum módulo criado. Clique em &quot;Novo Módulo&quot; para começar.
                    </div>
                )}
            </div>
        </div>
    );
}
