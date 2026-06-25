import ExcelJS from "exceljs";

type SpreadsheetCellValue = string;

export interface ParsedSpreadsheet {
    rows: Record<string, SpreadsheetCellValue>[];
    columns: string[];
}

const MAX_ROWS = 10000;

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function getFileExtension(filename: string): string {
    const match = filename.toLowerCase().match(/\.[^.]+$/);
    return match ? match[0] : '';
}

/**
 * Parses a CSV/XLSX File and returns rows + column names.
 * Returns null and calls onError if parsing fails.
 */
export function parseSpreadsheetFile(
    file: File,
    onSuccess: (result: ParsedSpreadsheet) => void,
    onError: (message: string) => void
): void {
    const fileExt = getFileExtension(file.name);

    if (fileExt === '.csv') {
        const textReader = new FileReader();
        textReader.onload = (e) => {
            try {
                const text = e.target!.result as string;
                const result = parseCSVText(text);
                if (result.rows.length === 0) {
                    onError("O arquivo não contém dados.");
                    return;
                }
                if (result.rows.length > MAX_ROWS) {
                    onError(`Arquivo muito grande. Máximo de ${MAX_ROWS} linhas. Arquivo contém ${result.rows.length} linhas.`);
                    return;
                }
                onSuccess(result);
            } catch (err: unknown) {
                onError("Erro ao ler arquivo CSV: " + getErrorMessage(err, "falha ao processar CSV"));
            }
        };
        textReader.readAsText(file, 'UTF-8');
    } else if (fileExt === '.xlsx') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target!.result as ArrayBuffer;
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.load(buffer);

                const ws = wb.worksheets[0];
                if (!ws || ws.rowCount < 2) {
                    onError("O arquivo não contém dados.");
                    return;
                }

                const dataRowCount = ws.rowCount - 1;
                if (dataRowCount > MAX_ROWS) {
                    onError(`Arquivo muito grande. Máximo de ${MAX_ROWS} linhas. Arquivo contém ${dataRowCount} linhas.`);
                    return;
                }

                const columns: string[] = [];
                ws.getRow(1).eachCell((cell) => {
                    columns.push(String(cell.value ?? ''));
                });

                if (columns.length === 0) {
                    onError("O arquivo não contém dados.");
                    return;
                }

                const rows: Record<string, SpreadsheetCellValue>[] = [];
                ws.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const rowObj: Record<string, SpreadsheetCellValue> = {};
                    columns.forEach((col, i) => {
                        const cell = row.getCell(i + 1);
                        let value = cell.value;
                        if (value instanceof Date) {
                            value = value.toISOString().split('T')[0];
                        } else if (value === null || value === undefined) {
                            value = '';
                        } else {
                            value = String(value);
                        }
                        rowObj[col] = value;
                    });
                    rows.push(rowObj);
                });

                if (rows.length === 0) {
                    onError("O arquivo não contém dados.");
                    return;
                }

                onSuccess({ rows, columns });
            } catch (err: unknown) {
                onError("Erro ao ler arquivo: " + getErrorMessage(err, "falha ao processar planilha"));
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        onError(`Formato de arquivo não suportado: ${fileExt}. Use .csv ou .xlsx`);
    }
}

export function parseCSVText(text: string): ParsedSpreadsheet {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { rows: [], columns: [] };

    const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const columns = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
        const values = parseLine(line);
        const row: Record<string, SpreadsheetCellValue> = {};
        columns.forEach((col, i) => { row[col] = values[i] ?? ''; });
        return row;
    });

    return { columns, rows };
}
