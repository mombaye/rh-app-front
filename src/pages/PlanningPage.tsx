/**
 * PlanningPage — Page dédiée à la gestion du planning shifts
 * Accessible uniquement aux utilisateurs avec le rôle is_planning_manager.
 *
 * Fonctionnalités :
 *  - Navigation par semaine / mois
 *  - Grille de planning avec glisser-déposer (drag & drop HTML5 natif)
 *  - Changement de shift (jour / soir1 / soir2) par drag & drop
 *  - Changement de date par drag & drop entre colonnes
 *  - Changement de personne via le menu contextuel
 *  - Import Excel du planning mensuel
 *  - Ajout / suppression manuelle d'entrées
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import AppLayout from "@/layouts/AppLayout";
import {
  getShiftPlanning, uploadShiftPlanning, addSinglePlanningEntry,
  deleteSinglePlanningEntry, moveShiftPlanningEntry,
} from "@/services/attendanceService";
import type { PlanningEntry, ShiftPlanningUpload } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import type { Employee } from "@/types/employee";
import toast from "react-hot-toast";
import { parseNOCPlanningExcel } from "@/utils/planningParser";
import {
  ChevronLeft, ChevronRight, Upload, Plus, Trash2, RefreshCw,
  Calendar, Users, Download, GripVertical, AlertTriangle, Pencil, Check, X,
} from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────
const SHIFT_LABELS: Record<string, string> = {
  jour:  "Jour  08H – 16H",
  soir1: "Soir1 16H – 22H",
  soir2: "Soir2 22H – 08H",
};

const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string; header: string }> = {
  jour:  { bg: "bg-sky-50",    text: "text-sky-800",    border: "border-sky-200",    header: "bg-sky-600"   },
  soir1: { bg: "bg-amber-50",  text: "text-amber-800",  border: "border-amber-200",  header: "bg-amber-600" },
  soir2: { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200", header: "bg-violet-700"},
};

const SHIFT_ORDER = ["jour", "soir1", "soir2"];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fmtDay(dateStr: string): { day: string; num: string; month: string } {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return {
    day: days[d.getDay()],
    num: String(d.getDate()).padStart(2, "0"),
    month: months[d.getMonth()],
  };
}

// ── Types internes ────────────────────────────────────────────────────────────
interface DragState {
  date: string;
  shift_type: string;
  employee_name: string;
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PlanningPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; shift_type: string } | null>(null);

  // Modal: ajouter une entrée manuelle
  const [addModal, setAddModal] = useState<{ date: string; shift_type: string } | null>(null);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Modal: modifier un employé dans le planning
  const [editModal, setEditModal] = useState<PlanningEntry | null>(null);
  const [editName, setEditName] = useState("");
  const [editMatricule, setEditMatricule] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Modal: import Excel
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Semaine courante — 7 jours
  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i))),
    [weekStart]
  );

  // ── Chargement des données ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, emps] = await Promise.all([
        getShiftPlanning(weekDates[0], weekDates[6]),
        getEmployees({ status: "ACTIVE" }),
      ]);
      setEntries(data);
      setEmployees(emps);
    } catch {
      toast.error("Erreur lors du chargement du planning");
    } finally {
      setLoading(false);
    }
  }, [weekDates]);

  useEffect(() => { load(); }, [load]);

  // ── Polling temps réel : rafraîchissement silencieux toutes les 30s ───────
  useEffect(() => {
    const poll = async () => {
      try {
        const [data, emps] = await Promise.all([
          getShiftPlanning(weekDates[0], weekDates[6]),
          getEmployees({ status: "ACTIVE" }),
        ]);
        setEntries(data);
        setEmployees(emps);
      } catch {
        // Silencieux : ne pas afficher d'erreur lors du polling
      }
    };
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [weekDates]);

  // ── Map : date + shift → entrées ──────────────────────────────────────────
  const planMap = useMemo(() => {
    const m: Record<string, Record<string, PlanningEntry[]>> = {};
    for (const e of entries) {
      if (!m[e.date]) m[e.date] = {};
      if (!m[e.date][e.shift_type]) m[e.date][e.shift_type] = [];
      m[e.date][e.shift_type].push(e);
    }
    return m;
  }, [entries]);

  // ── Normalisation robuste des noms (accents + espaces) ───────────────────
  const normName = (s: string) =>
    s.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

  // ── Map : nom normalisé → matricule ───────────────────────────────────────
  // Also keep a word-set index for fuzzy matching (same words, any order)
  const { nameToMatricule, wordSetIndex } = useMemo(() => {
    const m = new Map<string, string>();
    const wsi: Array<{ key: string; mat: string }> = [];
    for (const emp of employees) {
      if (!emp.matricule) continue;
      const nom    = emp.nom?.trim()    ?? "";
      const prenom = emp.prenom?.trim() ?? "";
      const fullNameApi = (emp as any).full_name?.trim() ?? "";
      const candidates = [
        `${nom} ${prenom}`,
        `${prenom} ${nom}`,
        fullNameApi,
      ];
      for (const c of candidates) {
        const n = normName(c);
        if (n.trim()) {
          m.set(n, emp.matricule);
          wsi.push({ key: n, mat: emp.matricule });
        }
      }
    }
    return { nameToMatricule: m, wordSetIndex: wsi };
  }, [employees]);

  // ── Resolve matricule : exact match first, then word-set fallback ─────────
  const resolveMatricule = useCallback(
    (entryName: string, storedMat: string | null | undefined): string | null => {
      if (storedMat) return storedMat;
      const norm = normName(entryName);
      const exact = nameToMatricule.get(norm);
      if (exact) return exact;
      // Word-set fallback: same set of words regardless of order / extra chars
      const words = new Set(norm.split(" ").filter(Boolean));
      if (words.size === 0) return null;
      for (const { key, mat } of wordSetIndex) {
        const dbWords = new Set(key.split(" ").filter(Boolean));
        if (words.size === dbWords.size && [...words].every(w => dbWords.has(w))) {
          return mat;
        }
      }
      return null;
    },
    [nameToMatricule, wordSetIndex]
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday  = () => setWeekStart(mondayOf(new Date()));

  const weekLabel = useMemo(() => {
    const s = new Date(weekDates[0] + "T00:00:00");
    const e = new Date(weekDates[6] + "T00:00:00");
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    return `${s.getDate()} ${months[s.getMonth()]} — ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
  }, [weekDates]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, entry: PlanningEntry) => {
    setDragState({ date: entry.date, shift_type: entry.shift_type, employee_name: entry.employee_name });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, date: string, shift_type: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ date, shift_type });
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = async (e: React.DragEvent, newDate: string, newShift: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragState) return;
    if (dragState.date === newDate && dragState.shift_type === newShift) return;

    // Optimistic update
    setEntries(prev => prev.map(entry =>
      entry.date === dragState.date &&
      entry.shift_type === dragState.shift_type &&
      entry.employee_name === dragState.employee_name
        ? { ...entry, date: newDate, shift_type: newShift }
        : entry
    ));

    try {
      await moveShiftPlanningEntry({
        date:            dragState.date,
        shift_type:      dragState.shift_type,
        employee_name:   dragState.employee_name,
        new_date:        newDate,
        new_shift_type:  newShift,
      });
      toast.success(`${dragState.employee_name} déplacé vers ${SHIFT_LABELS[newShift] ?? newShift}`);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflit : un employé occupe déjà cette place");
      } else {
        toast.error("Erreur lors du déplacement");
      }
      // Rollback
      await load();
    } finally {
      setDragState(null);
    }
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropTarget(null);
  };

  // ── Supprimer une entrée ──────────────────────────────────────────────────
  const handleDelete = async (entry: PlanningEntry) => {
    setEntries(prev => prev.filter(e =>
      !(e.date === entry.date && e.shift_type === entry.shift_type && e.employee_name === entry.employee_name)
    ));
    try {
      await deleteSinglePlanningEntry(entry.date, entry.shift_type, entry.employee_name);
      toast.success("Entrée supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
      await load();
    }
  };

  // ── Ajouter une entrée manuelle ───────────────────────────────────────────
  const handleAddConfirm = async () => {
    if (!addModal || !addName.trim()) return;
    setAddLoading(true);
    try {
      const result = await addSinglePlanningEntry({
        date:          addModal.date,
        shift_type:    addModal.shift_type,
        employee_name: addName.trim(),
      });
      setEntries(prev => [...prev, {
        date:               addModal.date,
        shift_type:         addModal.shift_type,
        employee_name:      addName.trim(),
        employee_matricule: result.employee_matricule ?? null,
      }]);
      toast.success(`${addName} ajouté au planning`);
      setAddModal(null);
      setAddName("");
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Modifier l'employé d'une entrée ──────────────────────────────────────
  const handleEditConfirm = async () => {
    if (!editModal) return;
    const newName = editName.trim();
    const newMat  = editMatricule.trim();
    const nameChanged = newName && newName !== editModal.employee_name;
    const matChanged  = newMat !== (editModal.employee_matricule ?? "");
    if (!nameChanged && !matChanged) { setEditModal(null); return; }

    setEditLoading(true);
    try {
      const result = await moveShiftPlanningEntry({
        date:                    editModal.date,
        shift_type:              editModal.shift_type,
        employee_name:           editModal.employee_name,
        ...(nameChanged && { new_employee_name: newName }),
        new_employee_matricule:  newMat || null,
      });
      const oldName = editModal.employee_name;
      const updatedMat = result.employee_matricule || null;
      // Mettre à jour l'entrée modifiée + propager le matricule
      // à TOUTES les occurrences du même nom dans le state local
      setEntries(prev => prev.map(e => {
        if (e.date === editModal.date && e.shift_type === editModal.shift_type && e.employee_name === oldName) {
          return { ...e, employee_name: result.employee_name, employee_matricule: updatedMat };
        }
        // Propager le matricule sur toutes les autres entrées du même nom
        if (updatedMat && e.employee_name === oldName) {
          return { ...e, employee_matricule: updatedMat };
        }
        return e;
      }));
      toast.success("Planning mis à jour");
      setEditModal(null);
      setEditName("");
      setEditMatricule("");
      await load();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflit : cet employé est déjà affecté à ce créneau");
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } finally {
      setEditLoading(false);
    }
  };

  // ── Import Excel ──────────────────────────────────────────────────────────
  const handleFileImport = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const { entries: allEntries } = parseNOCPlanningExcel(ev.target!.result as ArrayBuffer);
        if (!allEntries.length) { toast.error("Aucune entrée valide trouvée dans le fichier"); return; }
        const batchId = `import_${Date.now()}`;
        const payload: ShiftPlanningUpload = { batch_id: batchId, entries: allEntries };
        await uploadShiftPlanning(payload);
        toast.success(`${allEntries.length} entrées importées`);
        setImportOpen(false);
        await load();
      } catch {
        toast.error("Erreur lors de l'import du fichier");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="flex flex-col gap-4 min-h-0 px-4 pb-4 md:px-0 md:pb-0">
        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={20} className="text-camublue-900" />
              Gestion du Planning
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Planification des shifts — glisser-déposer pour modifier
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium hover:bg-camublue-800 transition"
            >
              <Upload size={15} />
              Importer Excel
            </button>
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Actualiser
            </button>
          </div>
        </div>

        {/* ── Navigation semaine ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm">
          <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <span className="flex-1 text-center font-semibold text-slate-800 text-sm">{weekLabel}</span>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition">
            Aujourd'hui
          </button>
          <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>

        {/* ── Grille planning ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={28} className="animate-spin text-camublue-900 opacity-40" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th className="w-28 px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                    Shift
                  </th>
                  {weekDates.map(date => {
                    const { day, num, month } = fmtDay(date);
                    const isToday = date === toISO(new Date());
                    return (
                      <th key={date} className={`px-3 py-3 text-center border-b border-slate-100 ${isToday ? "bg-camublue-900/5" : "bg-slate-50"}`}>
                        <div className="text-xs text-slate-400 font-medium">{day}</div>
                        <div className={`text-base font-bold ${isToday ? "text-camublue-900" : "text-slate-700"}`}>
                          {num}
                        </div>
                        <div className="text-xs text-slate-400">{month}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SHIFT_ORDER.map(shiftKey => {
                  const cfg = SHIFT_COLORS[shiftKey];
                  return (
                    <tr key={shiftKey} className="border-b border-slate-100 last:border-0">
                      {/* Colonne shift */}
                      <td className={`px-3 py-2 ${cfg.bg} ${cfg.border} border-r`}>
                        <div className={`text-xs font-bold ${cfg.text}`}>
                          {SHIFT_LABELS[shiftKey] ?? shiftKey}
                        </div>
                      </td>

                      {/* Colonnes jours */}
                      {weekDates.map(date => {
                        const cellEntries = planMap[date]?.[shiftKey] ?? [];
                        const isDropTarget = dropTarget?.date === date && dropTarget?.shift_type === shiftKey;
                        const isDraggingOver = isDropTarget && !!dragState;

                        return (
                          <td
                            key={date}
                            className={`px-2 py-2 align-top border-r border-slate-50 transition-colors duration-150 min-w-[110px] ${
                              isDraggingOver
                                ? `${cfg.bg} ring-2 ring-inset ring-camublue-900/40`
                                : "hover:bg-slate-50/60"
                            }`}
                            onDragOver={e => handleDragOver(e, date, shiftKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={e => handleDrop(e, date, shiftKey)}
                          >
                            <div className="flex flex-col gap-1 min-h-[40px]">
                              {cellEntries.map(entry => (
                                <DraggableEmployee
                                  key={`${entry.date}-${entry.shift_type}-${entry.employee_name}`}
                                  entry={entry}
                                  cfg={cfg}
                                  isDragging={
                                    dragState?.date === entry.date &&
                                    dragState?.shift_type === entry.shift_type &&
                                    dragState?.employee_name === entry.employee_name
                                  }
                                  matricule={resolveMatricule(entry.employee_name, entry.employee_matricule)}
                                  onDragStart={handleDragStart}
                                  onDragEnd={handleDragEnd}
                                  onDelete={handleDelete}
                                  onEdit={(e) => { setEditModal(e); setEditName(e.employee_name); setEditMatricule(e.employee_matricule ?? ""); }}
                                />
                              ))}

                              {/* Bouton + pour ajouter */}
                              <button
                                onClick={() => { setAddModal({ date, shift_type: shiftKey }); setAddName(""); }}
                                className="mt-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-xs text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition w-full opacity-0 group-hover:opacity-100"
                                title="Ajouter un employé"
                                style={{ opacity: cellEntries.length === 0 ? 1 : undefined }}
                              >
                                <Plus size={11} />
                                <span className="text-[10px]">Ajouter</span>
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Légende ── */}
        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
          <div className="flex items-center gap-1.5">
            <GripVertical size={11} />
            Glisser-déposer pour changer de shift ou de date
          </div>
          <div className="flex items-center gap-1.5">
            <Pencil size={11} className="text-amber-500" />
            Double-clic sur une carte pour modifier l'employé
          </div>
          <div className="flex items-center gap-1.5">
            <Trash2 size={11} />
            Survoler une carte pour supprimer
          </div>
          <div className="flex items-center gap-1.5">
            <Plus size={11} />
            Cliquer &laquo; Ajouter &raquo; en bas de cellule pour insérer
          </div>
        </div>
      </div>

      {/* ── Modal: ajouter une entrée ── */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1">Ajouter un employé</h3>
            <p className="text-xs text-slate-400 mb-4">
              {fmtDay(addModal.date).day} {fmtDay(addModal.date).num} — {SHIFT_LABELS[addModal.shift_type]}
            </p>
            <input
              list="employee-list"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 mb-4"
              placeholder="Nom de l'employé…"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddConfirm()}
              autoFocus
            />
            <datalist id="employee-list">
              {employees.map(emp => (
                <option key={emp.id} value={`${emp.nom} ${emp.prenom}`} />
              ))}
            </datalist>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddModal(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition">
                Annuler
              </button>
              <button
                onClick={handleAddConfirm}
                disabled={!addName.trim() || addLoading}
                className="px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium hover:bg-camublue-800 transition disabled:opacity-50"
              >
                {addLoading ? "Ajout…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: modifier l'employé ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEditModal(null); }}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Pencil size={15} className="text-camublue-900" />
              Modifier l'employé
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {fmtDay(editModal.date).day} {fmtDay(editModal.date).num} — {SHIFT_LABELS[editModal.shift_type]}
            </p>

            {/* Nom */}
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nom</label>
            <input
              list="edit-employee-list"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 mb-3"
              placeholder="Nom de l'employé…"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEditConfirm()}
              autoFocus
            />
            <datalist id="edit-employee-list">
              {employees.map(emp => (
                <option key={emp.id} value={`${emp.nom} ${emp.prenom}`} />
              ))}
            </datalist>

            {/* Matricule */}
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
              Matricule <span className="text-slate-300 font-normal normal-case">(optionnel)</span>
            </label>
            <input
              list="edit-matricule-list"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-camublue-900/30 mb-1"
              placeholder="Ex : CAM-001"
              value={editMatricule}
              onChange={e => setEditMatricule(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEditConfirm()}
            />
            <datalist id="edit-matricule-list">
              {employees.map(emp => (
                <option key={emp.id} value={emp.matricule} label={`${emp.nom} ${emp.prenom}`} />
              ))}
            </datalist>
            <p className="text-[10px] text-slate-400 mb-4">
              Laisser vide pour détecter automatiquement selon le nom saisi.
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition">
                <X size={13} /> Annuler
              </button>
              <button
                onClick={handleEditConfirm}
                disabled={!editName.trim() || editLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium hover:bg-camublue-800 transition disabled:opacity-50"
              >
                {editLoading
                  ? <><RefreshCw size={13} className="animate-spin" /> Mise à jour…</>
                  : <><Check size={13} /> Enregistrer</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: import Excel ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImportOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Upload size={16} className="text-camublue-900" />
              Importer un planning Excel
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Le fichier doit contenir les colonnes : <strong>Date</strong>, <strong>Shift</strong>, <strong>Nom employé</strong>
            </p>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-camublue-900/40 hover:bg-slate-50 transition"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileImport(file);
              }}
            >
              <Download size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">Déposer un fichier .xlsx ici</p>
              <p className="text-xs text-slate-400 mt-1">ou cliquer pour parcourir</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileImport(file);
            }} />
            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                L'import <strong>remplace intégralement</strong> le planning existant pour les dates importées.
              </p>
            </div>
            <button onClick={() => setImportOpen(false)} className="mt-4 w-full px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition">
              Fermer
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── Sous-composant : carte d'un employé (draggable) ───────────────────────────
interface DraggableEmployeeProps {
  entry: PlanningEntry;
  cfg: { bg: string; text: string; border: string };
  isDragging: boolean;
  matricule: string | null;
  onDragStart: (e: React.DragEvent, entry: PlanningEntry) => void;
  onDragEnd: () => void;
  onDelete: (entry: PlanningEntry) => void;
  onEdit: (entry: PlanningEntry) => void;
}

function DraggableEmployee({
  entry, cfg, isDragging, matricule, onDragStart, onDragEnd, onDelete, onEdit,
}: DraggableEmployeeProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, entry)}
      onDragEnd={onDragEnd}
      onDoubleClick={e => { e.stopPropagation(); onEdit(entry); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium cursor-grab select-none transition-all duration-150 ${cfg.bg} ${cfg.text} border ${cfg.border} ${
        isDragging ? "opacity-40 scale-95 shadow-lg ring-2 ring-camublue-900/20" : "hover:shadow-sm"
      }`}
      title="Double-clic pour modifier · Glisser pour déplacer"
    >
      <GripVertical size={10} className="text-current opacity-40 shrink-0" />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate">{entry.employee_name}</span>
        {matricule && (
          <span className="text-[9px] opacity-60 font-mono">{matricule}</span>
        )}
      </div>

      {/* Bouton supprimer (au survol) */}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(entry); }}
          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition shadow-sm"
          title="Supprimer"
        >
          <Trash2 size={9} />
        </button>
      )}
    </div>
  );
}
