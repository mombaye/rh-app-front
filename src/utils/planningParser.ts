/**
 * planningParser.ts
 * Parser robuste pour les fichiers Excel de planning NOC (format Planning_NOC_YYYY.xlsx).
 *
 * Format attendu :
 *   - Blocs de 7 jours, chaque bloc commence par une ligne "SHIFT | date1 | ... | date7"
 *   - Suivie de 3 sections : "08H-16H", "16H-22H", "22H-08H" avec N lignes d'employés
 */

import * as XLSX from "xlsx";
import type { PlanningEntry } from "@/services/attendanceService";
import type { ShiftTeamKey } from "@/types/attendance";

// ─── Helpers date ──────────────────────────────────────────────────────────────

export function cellToDateStr(cell: unknown): string {
  if (cell instanceof Date) {
    return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
  }
  if (typeof cell === "number" && cell > 40000) {
    const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof cell === "string" && cell.trim()) {
    const s = cell.trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return "";
}

export function detectShiftLabel(label: string): ShiftTeamKey | null {
  const s = label.toUpperCase().replace(/\s/g, "");
  if (s.includes("08") && s.includes("16")) return "jour";
  if (s.includes("16") && s.includes("22")) return "soir1";
  if (s.includes("22") && s.includes("08")) return "soir2";
  return null;
}

function getCellBgHex(ws: XLSX.WorkSheet, r: number, c: number): string | null {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr] as any;
  if (!cell?.s) return null;
  const tryColor = (co: any): string | null => {
    if (!co) return null;
    if (co.rgb && typeof co.rgb === "string" && co.rgb.length >= 6) {
      const rgb = co.rgb.toUpperCase().slice(-6);
      if (rgb === "FFFFFF" || rgb === "000000" || rgb === "000001") return null;
      return "#" + rgb;
    }
    return null;
  };
  return tryColor(cell.s.fgColor) ?? tryColor(cell.s.bgColor) ?? null;
}

const FRENCH_MONTHS_MAP: Record<string, number> = {
  jan: 1, janv: 1, janvier: 1,
  fev: 2, févr: 2, fevr: 2, février: 2, fevrier: 2,
  mar: 3, mars: 3,
  avr: 4, avril: 4,
  mai: 5,
  juin: 6,
  juil: 7, juillet: 7,
  aou: 8, aoû: 8, aout: 8, août: 8,
  sep: 9, sept: 9, septembre: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, déc: 12, decembre: 12, décembre: 12,
};

export function extractMonthYearFromSheetName(name: string): { month: number; year: number } {
  let month = 0, year = 0;
  const lower = name.toLowerCase().replace(/[_\-]/g, " ");
  for (const [k, v] of Object.entries(FRENCH_MONTHS_MAP)) {
    if (new RegExp(`\\b${k}\\b`).test(lower)) { month = v; break; }
  }
  const ym = name.match(/\b(20\d{2})\b/);
  if (ym) year = parseInt(ym[1]);
  if (!month) {
    const mmy = name.match(/\b(\d{1,2})[\/\-](20\d{2})\b/);
    if (mmy) { month = parseInt(mmy[1]); year = parseInt(mmy[2]); }
  }
  if (!year) year = new Date().getFullYear();
  return { month, year };
}

// ─── Parser principal ──────────────────────────────────────────────────────────

export function parseNOCPlanningSheet(ws: XLSX.WorkSheet, sheetName = ""): PlanningEntry[] {
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  const entries: PlanningEntry[] = [];
  const { month: ctxMonth, year: ctxYear } = extractMonthYearFromSheetName(sheetName);

  const resolveDate = (cell: unknown): string => {
    const basic = cellToDateStr(cell);
    if (basic) return basic;
    if (typeof cell === "string") {
      const s = cell.trim();
      const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
      if (m2) {
        const d = parseInt(m2[1]), mo = parseInt(m2[2]);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12)
          return `${ctxYear}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
      const dayStr = s.match(/^\s*(\d{1,2})\s*$/);
      if (dayStr && ctxMonth > 0) {
        const d = parseInt(dayStr[1]);
        if (d >= 1 && d <= 31)
          return `${ctxYear}-${String(ctxMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
    if (typeof cell === "number" && cell >= 1 && cell < 100 && ctxMonth > 0)
      return `${ctxYear}-${String(ctxMonth).padStart(2, "0")}-${String(cell).padStart(2, "0")}`;
    return "";
  };

  let blockDates: string[] = [];
  let currentShift: ShiftTeamKey | null = null;
  let shiftRowCounter = 0;

  for (let row = 0; row < rawRows.length; row++) {
    const rowData = rawRows[row] as unknown[];
    const col0 = String(rowData[0] ?? "").trim();

    // Ligne d'en-tête de bloc : col A == "SHIFT"
    if (col0.toUpperCase() === "SHIFT") {
      blockDates = [];
      for (let c = 1; c < rowData.length; c++) {
        blockDates.push(resolveDate(rowData[c]));
      }
      currentShift = null;
      shiftRowCounter = 0;
      continue;
    }

    if (blockDates.length === 0) continue;

    // Ligne de label de shift (col A contient "08H-16H", "16H-22H", "22H-08H")
    if (col0) {
      const detected = detectShiftLabel(col0);
      if (detected) {
        currentShift = detected;
        shiftRowCounter = 0;
      }
    }

    if (!currentShift) continue;

    // Ligne de données employé
    const rowSlot = shiftRowCounter;
    shiftRowCounter++;

    for (let c = 1; c <= blockDates.length; c++) {
      const name = String(rowData[c] ?? "").trim();
      const date = blockDates[c - 1];
      if (!name || !date) continue;
      const cellColor = getCellBgHex(ws, row, c);
      entries.push({
        date,
        shift_type: currentShift,
        employee_name: name,
        team_id: cellColor ?? "",
        row_slot: rowSlot,
      });
    }
  }

  return entries;
}

export interface ParsedSheet {
  name: string;
  count: number;
  dateMin: string;
  dateMax: string;
  teams: number;
}

export function parseNOCPlanningExcel(buffer: ArrayBuffer): { entries: PlanningEntry[]; sheets: ParsedSheet[] } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, cellStyles: true });
  const allEntries: PlanningEntry[] = [];
  const sheets: ParsedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const entries = parseNOCPlanningSheet(ws, sheetName);
    if (!entries.length) continue;
    const dates = entries.map((e) => e.date).filter(Boolean).sort();
    const teamSet = new Set(entries.map((e) => e.team_id).filter(Boolean));
    sheets.push({
      name: sheetName,
      count: entries.length,
      dateMin: dates[0],
      dateMax: dates[dates.length - 1],
      teams: teamSet.size,
    });
    allEntries.push(...entries);
  }

  return { entries: allEntries, sheets };
}
