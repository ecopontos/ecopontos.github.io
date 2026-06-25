"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, KanbanSquare, Truck } from "lucide-react";
import PainelCaixas from "@/components/remocao/PainelCaixas";
import BoardRemocao from "@/components/remocao/BoardRemocao";
import ExecucoesTable from "@/components/remocao/ExecucoesTable";

export default function RemocaoPage() {
    const [tab, setTab] = useState("painel");

    return (
        <div className="container mx-auto py-10">
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="mb-6">
                    <TabsTrigger value="painel" className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Painel
                    </TabsTrigger>
                    <TabsTrigger value="board" className="flex items-center gap-2">
                        <KanbanSquare className="h-4 w-4" />
                        Board
                    </TabsTrigger>
                    <TabsTrigger value="execucoes" className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Execuções
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="painel">
                    <PainelCaixas />
                </TabsContent>
                <TabsContent value="board">
                    <BoardRemocao />
                </TabsContent>
                <TabsContent value="execucoes">
                    <ExecucoesTable />
                </TabsContent>
            </Tabs>
        </div>
    );
}
