/** Strict, bounded parsing: malformed model data is shown as text, never trusted as executable code. */
export type Cell = string | number | boolean | null;
export interface DataTable { columns: string[]; rows: Cell[][] }
export interface ChartDatum { label: string; value: number }
export interface ChartData { type: 'bar' | 'line' | 'area' | 'pie'; title: string; data: ChartDatum[] }
function asCell(value: unknown): Cell { return value === null || ['string', 'number', 'boolean'].includes(typeof value) ? value as Cell : JSON.stringify(value).slice(0, 200); }
export function parseCSV(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quote = false;
  const text = source.slice(0, 250_000).replace(/\r\n?/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (quote && text[i + 1] === '"') { value += '"'; i++; } else quote = !quote;
    } else if (ch === ',' && !quote) { row.push(value); value = ''; }
    else if (ch === '\n' && !quote) { row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += ch;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows.slice(0, 1001);
}
export function parseDataTable(source: string): DataTable | null {
  try {
    const value: unknown = JSON.parse(source);
    if (Array.isArray(value) && value.length && value.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
      const columns = [...new Set(value.slice(0, 1000).flatMap((x: Record<string, unknown>) => Object.keys(x)))].slice(0, 30);
      return { columns, rows: value.slice(0, 1000).map((x: Record<string, unknown>) => columns.map((key) => asCell(x[key] ?? null))) };
    }
    if (value && typeof value === 'object' && 'columns' in value && 'rows' in value) {
      const obj = value as { columns: unknown; rows: unknown };
      if (Array.isArray(obj.columns) && Array.isArray(obj.rows)) {
        const columns = obj.columns.slice(0, 30).map(String);
        return { columns, rows: obj.rows.slice(0, 1000).filter(Array.isArray).map((row: unknown[]) => columns.map((_, index) => asCell(row[index] ?? null))) };
      }
    }
  } catch { /* Might be CSV. */ }
  const csv = parseCSV(source);
  if (!csv.length) return null;
  return { columns: (csv[0] ?? []).slice(0, 30), rows: csv.slice(1).map((r) => r.slice(0, 30)) };
}
export function parseChart(source: string): ChartData | null {
  try {
    const obj: unknown = JSON.parse(source);
    if (!obj || typeof obj !== 'object') return null;
    const data = obj as Record<string, unknown>;
    if (!Array.isArray(data.data)) return null;
    const type = data.type === 'line' || data.type === 'area' || data.type === 'pie' ? data.type : 'bar';
    const items: ChartDatum[] = data.data.slice(0, 120).flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return [];
      const v = entry as Record<string, unknown>;
      return typeof v.value === 'number' && Number.isFinite(v.value) ? [{ label: String(v.label ?? '').slice(0, 80), value: v.value }] : [];
    });
    return items.length ? { type, title: String(data.title ?? '').slice(0, 120), data: items } : null;
  } catch { return null; }
}
export function toCSV(table: DataTable): string {
  const cell = (v: Cell): string => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [table.columns.map(cell), ...table.rows.map((row) => row.map(cell))].map((row) => row.join(',')).join('\r\n');
}
