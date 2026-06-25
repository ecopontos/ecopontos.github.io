"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    /** Label shown in the fallback UI (e.g. "Kanban", "Inbox"). Defaults to "módulo". */
    moduleName?: string;
    /** Optional custom fallback to render instead of the default UI. */
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * ErrorBoundary — captura erros de render em filhos React e exibe uma UI de recuperação.
 *
 * Uso:
 *   <ErrorBoundary moduleName="Kanban">
 *     <KanbanBoard />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[ErrorBoundary] Erro no módulo "${this.props.moduleName ?? 'módulo'}":`, error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const moduleName = this.props.moduleName ?? "módulo";

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8 text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border border-red-100">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="space-y-2 max-w-md">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Erro ao carregar o {moduleName}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Ocorreu um erro inesperado ao renderizar este módulo.
                            Tente atualizar a página ou contate o suporte se o problema persistir.
                        </p>
                        {this.state.error && (
                            <pre className="mt-3 rounded-md bg-gray-50 border px-4 py-3 text-left text-xs text-gray-600 overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" size="sm" onClick={this.handleReset}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Tentar novamente
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                            Recarregar página
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
