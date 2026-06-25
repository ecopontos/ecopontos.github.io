import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ImportPreviewProps {
    columns: string[];
    rows: Record<string, any>[];
    maxRows?: number;
}

export function ImportPreview({ columns, rows, maxRows = 5 }: ImportPreviewProps) {
    return (
        <div className="border rounded-lg overflow-auto max-h-[200px]">
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map((col) => (
                            <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.slice(0, maxRows).map((row, i) => (
                        <TableRow key={i}>
                            {columns.map((col) => (
                                <TableCell key={col} className="text-xs py-1.5 whitespace-nowrap">
                                    {String(row[col] ?? "")}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
