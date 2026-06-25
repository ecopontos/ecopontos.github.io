"use client";

import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface FormLayoutConfigProps {
    formLayout?: { columns?: 1 | 2 | 3 | 4; gap?: 'sm' | 'md' | 'lg' };
    onFormLayoutChange: (layout: { columns?: 1 | 2 | 3 | 4; gap?: 'sm' | 'md' | 'lg' }) => void;
}

export function FormLayoutConfig({ formLayout, onFormLayoutChange }: FormLayoutConfigProps) {
    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="layout" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/30 border-dashed border rounded-md">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <LayoutGrid className="h-4 w-4" />
                        Layout do Formulário (Grid 12 Colunas)
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <Label className="text-xs flex items-center gap-1">
                            Colunas Padrão
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="w-[200px] text-xs">
                                            Define em quantas colunas os campos serão organizados por padrão neste formulário.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                        <Select
                            value={String(formLayout?.columns || 2)}
                            onValueChange={(val) => onFormLayoutChange({
                                ...formLayout,
                                columns: Number(val) as 1 | 2 | 3 | 4
                            })}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 coluna (lista)</SelectItem>
                                <SelectItem value="2">2 colunas</SelectItem>
                                <SelectItem value="3">3 colunas</SelectItem>
                                <SelectItem value="4">4 colunas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1">
                            Espaçamento
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="w-[200px] text-xs">
                                            Controla a distância vertical e horizontal entre os campos do formulário.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                        <Select
                            value={formLayout?.gap || 'md'}
                            onValueChange={(val) => onFormLayoutChange({
                                ...formLayout,
                                gap: val as 'sm' | 'md' | 'lg'
                            })}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sm">Pequeno (12px)</SelectItem>
                                <SelectItem value="md">Médio (24px)</SelectItem>
                                <SelectItem value="lg">Grande (32px)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <p className="text-xs text-muted-foreground mt-3">
                        💡 Campos ocupam automaticamente 6 colunas (metade) ou 12 (largura total) conforme o tipo.
                    </p>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
