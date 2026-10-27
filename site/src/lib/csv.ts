// CSV for the static download endpoints: UTF-8 with a BOM so Hebrew opens correctly in Excel.

type Cell = string | number | boolean | null | undefined;

const esc = (v: Cell) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv<T>(rows: T[], columns: [string, (row: T) => Cell][]): string {
  const lines = [columns.map(([name]) => name).join(",")];
  for (const r of rows) lines.push(columns.map(([, get]) => esc(get(r))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export const csvResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8" } });

/** The JSON downloads, served the same way. */
export const jsonResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8" } });
