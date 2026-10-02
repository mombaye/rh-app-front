// Export Excel commun aux pages « Pointages normaux » et « Pointages shift » :
// ligne de titre avec la période, en-têtes en bleu Camusat (#003C71) comme la page,
// lignes alternées blanc / bleu très clair.
import * as XLSX from "xlsx-js-style";

const BLUE = "003C71";
const LIGHT = "EBF2FA";

export interface PeriodInfo { label: string; slug: string }

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function frDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Période exportée : ligne de titre + suffixe du nom de fichier. */
export function periodInfo(start: string, end: string): PeriodInfo {
  const today = todayISO();
  const arrete = end > today && start <= today ? ` (données arrêtées au ${frDate(today)})` : "";
  return {
    label: start === end ? `Date : ${frDate(start)}` : `Période : du ${frDate(start)} au ${frDate(end)}${arrete}`,
    slug: start === end ? start : `${start}_au_${end}`,
  };
}

/** Feuille stylée : titre (ligne 1), ligne vide, tableau à partir de la ligne 3. */
export function styledSheet(rows: Record<string, any>[], title: string): XLSX.WorkSheet {
  const keys = Object.keys(rows[0] ?? {});
  const ws = XLSX.utils.aoa_to_sheet([[title], []]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A3" });
  const lastCol = Math.max(keys.length - 1, 0);

  // Titre : bandeau bleu sur toute la largeur du tableau
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
  for (let c = 0; c <= lastCol; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = {
      font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: BLUE } },
      alignment: { horizontal: "left", vertical: "center" },
    };
  }

  // En-têtes du tableau
  for (let c = 0; c <= lastCol; c++) {
    const ref = XLSX.utils.encode_cell({ r: 2, c });
    if (ws[ref]) ws[ref].s = {
      font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: BLUE } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
    };
  }

  // Lignes de données alternées
  rows.forEach((_, i) => {
    for (let c = 0; c <= lastCol; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3 + i, c });
      if (ws[ref]) ws[ref].s = {
        font: { sz: 10 },
        fill: { fgColor: { rgb: i % 2 ? LIGHT : "FFFFFF" } },
        border: { bottom: { style: "thin", color: { rgb: "D9E2EC" } } },
      };
    }
  });

  ws["!cols"] = keys.map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 3,
  }));
  ws["!rows"] = [{ hpt: 24 }, { hpt: 6 }, { hpt: 30 }];
  return ws;
}

/** Classeur d'une ou plusieurs feuilles ; renvoie false s'il n'y a rien à exporter. */
export function exportSheets(filename: string, period: PeriodInfo, sheets: { name: string; rows: Record<string, any>[] }[]): boolean {
  const filled = sheets.filter((s) => s.rows.length);
  if (!filled.length) {
    alert("Aucune donnée à exporter.");
    return false;
  }
  const wb = XLSX.utils.book_new();
  filled.forEach((s) => XLSX.utils.book_append_sheet(wb, styledSheet(s.rows, period.label), s.name));
  XLSX.writeFile(wb, `${filename}_${period.slug}.xlsx`);
  return true;
}

export function exportAttendanceXLSX(filename: string, rows: Record<string, any>[], period: PeriodInfo): boolean {
  return exportSheets(filename, period, [{ name: "Pointages", rows }]);
}
