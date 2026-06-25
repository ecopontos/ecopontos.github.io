
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GalleryPage() {
    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Galeria de Imagens</h1>
                    <p className="text-muted-foreground">
                        Visualize e gerencie as fotos enviadas pelos usuários.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Arquivos</CardTitle>
                    <CardDescription>
                        Navegue pelas pastas de usuários para ver as fotos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <GalleryGrid />
                </CardContent>
            </Card>
        </div>
    );
}
