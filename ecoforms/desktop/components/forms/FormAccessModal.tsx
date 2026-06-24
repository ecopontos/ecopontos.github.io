import { useState } from "react";
import { Users } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUsersByForm } from "@/src/interface/hooks/catalog/forms";

interface FormAccessModalProps {
    formId: string;
    formTitle: string;
}

export function FormAccessModal({ formId, formTitle }: FormAccessModalProps) {
    const [open, setOpen] = useState(false);
    const { users, loading, refetch } = useUsersByForm(open ? formId : undefined);

    const getProfileBadge = (perfil: string) => {
        switch (perfil.toLowerCase()) {
            case "admin":
                return <Badge className="bg-purple-500">Admin</Badge>;
            case "gerente":
                return <Badge className="bg-blue-500">Gerente</Badge>;
            default:
                return <Badge variant="secondary">Operador</Badge>;
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (isOpen && refetch) refetch();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" title="Usuários com acesso a este formulário">
                    <Users className="mr-2 h-4 w-4" /> Acessos
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Usuários com Acesso</DialogTitle>
                </DialogHeader>
                <div className="text-sm text-muted-foreground mb-4">
                    Listando todos os usuários que posssuem acesso ao formulário <strong>{formTitle}</strong> no aplicativo móvel. 
                    Administradores e Gerentes possuem acesso incondicional.
                </div>

                <div className="rounded-md border bg-card">
                    {loading ? (
                        <div className="flex justify-center items-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-secondary z-10">
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Perfil</TableHead>
                                        <TableHead>Vínculo de Acesso</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
                                                Nenhum usuário habilitado para este formulário no momento.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        users.map((u) => (
                                            <TableRow key={u.id}>
                                                <TableCell className="font-medium flex flex-col">
                                                    <span>{u.nome}</span>
                                                    <span className="text-xs text-muted-foreground font-normal">{u.email}</span>
                                                </TableCell>
                                                <TableCell>{getProfileBadge(u.perfil)}</TableCell>
                                                <TableCell>
                                                    {u.explicit_grant ? (
                                                        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Acesso via Array (Explícito)</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-purple-600 bg-purple-50 border-purple-200">Acesso Incondicional (Gestão)</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
