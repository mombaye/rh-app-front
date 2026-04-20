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
  deleteSinglePlanningEntry, moveShiftPlanningEntry, activateShiftPlanning,
  getShiftPlanningStatus,
} from "@/services/attendanceService";
import type { PlanningEntry, ShiftPlanningUpload, ShiftPlanningStatus } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import type { Employee } from "@/types/employee";
import toast from "react-hot-toast";
import { parseNOCPlanningExcel } from "@/utils/planningParser";
import {
  ChevronLeft, ChevronRight, Upload, Plus, Trash2, RefreshCw,
  Calendar, Users, Download, GripVertical, AlertTriangle, Pencil, Check, X, Search, Zap,
} from "lucide-react";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";

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
  const [deleteTarget, setDeleteTarget]   = useState<PlanningEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  // Progression de l'import Excel (barre de progression)
  type ImportPhase = "idle" | "reading" | "parsing" | "uploading" | "processing" | "done" | "error";
  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
  const [importPercent, setImportPercent] = useState(0);
  const [importFilename, setImportFilename] = useState<string>("");

  // Indicateur d'activation persistant (state serveur - survit au reload)
  const [planningStatus, setPlanningStatus] = useState<ShiftPlanningStatus | null>(null);

  // Activer planning (bascule SHIFT)
  const [activateOpen, setActivateOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateResult, setActivateResult] = useState<{
    activated: number;
    already_shift: number;
    total_planned: number;
    matched: number;
    unmatched: string[];
    missing_matricules: string[];
  } | null>(null);

  // ── Recherche d'employé ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // Semaine courante — 7 jours
  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i))),
    [weekStart]
  );

  // ── Chargement des données ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, emps, status] = await Promise.all([
        getShiftPlanning(weekDates[0], weekDates[6]),
        getEmployees({ status: "ACTIVE" }),
        getShiftPlanningStatus().catch(() => null),
      ]);
      setEntries(data);
      setEmployees(emps);
      if (status) setPlanningStatus(status);
    } catch {
      toast.error("Erreur lors du chargement du planning");
    } finally {
      setLoading(false);
    }
  }, [weekDates]);

  const refreshPlanningStatus = useCallback(async () => {
    try {
      const status = await getShiftPlanningStatus();
      setPlanningStatus(status);
    } catch {
      // silencieux
    }
  }, []);

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
    const q = searchQuery.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const filtered = q
      ? entries.filter(e => {
          const name = e.employee_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const mat  = (e.employee_matricule ?? "").toLowerCase();
          return name.includes(q) || mat.includes(q);
        })
      : entries;

    const m: Record<string, Record<string, PlanningEntry[]>> = {};
    for (const e of filtered) {
      if (!m[e.date]) m[e.date] = {};
      if (!m[e.date][e.shift_type]) m[e.date][e.shift_type] = [];
      m[e.date][e.shift_type].push(e);
    }
    return m;
  }, [entries, searchQuery]);

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
  const handleDelete = (entry: PlanningEntry) => {
    setDeleteTarget(entry);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setEntries(prev => prev.filter(e =>
      !(e.date === deleteTarget.date && e.shift_type === deleteTarget.shift_type && e.employee_name === deleteTarget.employee_name)
    ));
    try {
      await deleteSinglePlanningEntry(deleteTarget.date, deleteTarget.shift_type, deleteTarget.employee_name);
      toast.success("Entrée supprimée");
      setDeleteTarget(null);
    } catch {
      toast.error("Erreur lors de la suppression");
      await load();
    } finally {
      setDeleteLoading(false);
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

  // ── Import Excel (avec barre de progression par phases) ──────────────────
  const handleFileImport = async (file: File) => {
    setImportFilename(file.name);
    setImportPhase("reading");
    setImportPercent(0);

    // Phase 1 : lecture du fichier (avec progress reader natif)
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.min(30, Math.round((ev.loaded / ev.total) * 30));
          setImportPercent(pct);
        }
      };
      reader.onload   = () => resolve(reader.result as ArrayBuffer);
      reader.onerror  = () => reject(reader.error ?? new Error("read error"));
      reader.readAsArrayBuffer(file);
    }).catch(() => null);

    if (!buffer) {
      setImportPhase("error");
      toast.error("Erreur lors de la lecture du fichier");
      return;
    }

    try {
      // Phase 2 : parsing Excel (CPU intensif — laisser le navigateur respirer)
      setImportPhase("parsing");
      setImportPercent(35);
      await new Promise<void>(r => setTimeout(r, 10)); // force re-render avant le parse bloquant

      const { entries: allEntries, sheets } = parseNOCPlanningExcel(buffer);
      setImportPercent(50);

      if (!allEntries.length) {
        setImportPhase("error");
        const totalBlocks = sheets.reduce((a, s) => a + (s.blocksDetected ?? 0), 0);
        const totalShifts = sheets.reduce((a, s) => a + (s.shiftSectionsDetected ?? 0), 0);
        if (totalBlocks === 0) {
          toast.error("Aucun en-tête de dates détecté. Vérifiez que la ligne SHIFT ou une ligne contenant au moins 3 dates est présente.");
        } else if (totalShifts === 0) {
          toast.error("Dates détectées mais aucune section de shift (08H-16H / 16H-22H / 22H-08H). Vérifiez les libellés des shifts.");
        } else {
          toast.error("Aucun employé détecté sous les sections de shift. Vérifiez que les noms sont bien en dessous des dates.");
        }
        return;
      }

      // Phase 3 : upload au serveur avec suivi de progression réel (axios)
      setImportPhase("uploading");
      const batchId = `import_${Date.now()}`;
      const payload: ShiftPlanningUpload = { batch_id: batchId, entries: allEntries };
      const res = await uploadShiftPlanning(payload, ({ percent }) => {
        // Upload occupe la plage 50 → 90 %
        setImportPercent(50 + Math.round((Math.min(percent, 100) * 40) / 100));
      });

      // Phase 4 : traitement côté serveur terminé
      setImportPhase("processing");
      setImportPercent(95);

      // Toast principal : nombre d'entrées réellement créées en base + plage
      const created = res.created ?? allEntries.length;
      const rangeLabel = res.date_min && res.date_max
        ? ` (${res.date_min} → ${res.date_max})`
        : "";
      toast.success(`${created} entrée${created > 1 ? "s" : ""} importée${created > 1 ? "s" : ""}${rangeLabel}`);

      // Diagnostic : entrées rejetées par le backend
      const rejected = (res.skipped_invalid_date ?? 0) + (res.skipped_invalid_shift ?? 0);
      if (rejected > 0) {
        toast.error(`${rejected} entrée${rejected > 1 ? "s" : ""} rejetée${rejected > 1 ? "s" : ""} (dates ou shifts invalides)`);
      }

      // Diagnostic : matricules non résolus (noms absents de la base employés)
      const unresolvedCount = res.unresolved_names?.length ?? 0;
      if (unresolvedCount > 0) {
        toast(`${unresolvedCount} nom${unresolvedCount > 1 ? "s" : ""} sans matricule détecté${unresolvedCount > 1 ? "s" : ""}`, { icon: "⚠️" });
      }

      // Activation automatique post-import
      if ((res.activated ?? 0) > 0) {
        toast.success(`${res.activated} employé${res.activated! > 1 ? "s" : ""} activé${res.activated! > 1 ? "s" : ""} en shift`);
      }

      setImportPercent(100);
      setImportPhase("done");
      setTimeout(() => {
        setImportOpen(false);
        setImportPhase("idle");
        setImportPercent(0);
        setImportFilename("");
      }, 700);

      // Naviguer automatiquement vers la semaine du premier import
      // si la plage importée ne recouvre pas la semaine affichée —
      // évite d'avoir une grille vide alors que des données existent.
      if (res.date_min) {
        const minDate = new Date(res.date_min + "T00:00:00");
        const importedWeekStart = mondayOf(minDate);
        const currentWeekStart = weekStart;
        const overlapsCurrent =
          res.date_max &&
          res.date_max >= weekDates[0] &&
          res.date_min <= weekDates[6];
        if (!overlapsCurrent && importedWeekStart.getTime() !== currentWeekStart.getTime()) {
          setWeekStart(importedWeekStart);
          return; // useEffect sur weekStart relancera load()
        }
      }

      await load();
    } catch {
      setImportPhase("error");
      toast.error("Erreur lors de l'import du fichier");
    }
  };

  // ── Activer planning : bascule tous les employés planifiés en SHIFT ──────
  const handleActivatePlanning = async () => {
    if (activating) return;
    setActivating(true);
    try {
      const res = await activateShiftPlanning();
      setActivateResult({
        activated: res.activated,
        already_shift: res.already_shift ?? 0,
        total_planned: res.total_planned,
        matched: res.matched ?? 0,
        unmatched: res.unmatched ?? [],
        missing_matricules: res.missing_matricules ?? [],
      });
      const activeCount = res.activated + (res.already_shift ?? 0);
      if (res.activated > 0) {
        toast.success(`${res.activated} employé${res.activated > 1 ? "s" : ""} activé${res.activated > 1 ? "s" : ""} en shift`);
      } else if (activeCount > 0) {
        toast.success(`Planning actif — ${activeCount} employé${activeCount > 1 ? "s" : ""} en SHIFT`);
      } else if ((res.unmatched?.length ?? 0) === 0 && (res.missing_matricules?.length ?? 0) === 0) {
        toast("Aucun employé à activer", { icon: "ℹ️" });
      }
      // Avertissements (non bloquants) — l'activation est considérée réussie
      if ((res.unmatched?.length ?? 0) > 0) {
        toast(`${res.unmatched!.length} nom(s) à corriger manuellement depuis la grille`, { icon: "⚠️" });
      }
      if ((res.missing_matricules?.length ?? 0) > 0) {
        toast(`${res.missing_matricules!.length} matricule(s) planifié(s) introuvable(s) en base`, { icon: "⚠️" });
      }
      // Rafraîchir l'indicateur persistant (survit au reload)
      await refreshPlanningStatus();
    } catch {
      toast.error("Erreur lors de l'activation du planning");
    } finally {
      setActivating(false);
    }
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
            {planningStatus?.has_planning && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    planningStatus.is_active
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : planningStatus.active_count > 0
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                  title="Cet etat persiste apres rechargement : c'est le planning utilise pour les pointages."
                >
                  <Zap size={10} />
                  {planningStatus.is_active
                    ? `Planning actif — ${planningStatus.active_count} employe${planningStatus.active_count > 1 ? "s" : ""}`
                    : planningStatus.active_count > 0
                      ? `Planning partiel — ${planningStatus.active_count}/${planningStatus.total_planned} actifs`
                      : `Planning importe — ${planningStatus.total_planned} a activer`}
                </span>
                {planningStatus.date_min && planningStatus.date_max && (
                  <span className="text-[11px] text-slate-400">
                    {planningStatus.date_min} → {planningStatus.date_max}
                  </span>
                )}
                {planningStatus.pending_count > 0 && (
                  <span
                    className="text-[11px] text-amber-600 font-medium"
                    title="Employes planifies qui ne sont pas encore en attendance_status=SHIFT"
                  >
                    ({planningStatus.pending_count} en attente)
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setActivateResult(null); setActivateOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
              title="Basculer tous les employés du planning en attendance_status=SHIFT"
            >
              <Zap size={15} />
              Activer planning
            </button>
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

        {/* ── Recherche d'employé ── */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher un employé par nom ou matricule…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 focus:border-camublue-900/40 placeholder:text-slate-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                title="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery.trim() && (() => {
            const q = searchQuery.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const matched = new Set(entries.filter(e => {
              const name = e.employee_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const mat  = (e.employee_matricule ?? "").toLowerCase();
              return name.includes(q) || mat.includes(q);
            }).map(e => e.employee_name)).size;
            return (
              <p className="text-xs text-slate-500 pl-1">
                {matched === 0
                  ? <span className="text-red-400">Aucun employé trouvé pour « {searchQuery} »</span>
                  : <><span className="font-medium text-camublue-900">{matched}</span> employé{matched > 1 ? "s" : ""} trouvé{matched > 1 ? "s" : ""}</>
                }
              </p>
            );
          })()}
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
      {importOpen && (() => {
        const importBusy = importPhase !== "idle" && importPhase !== "error" && importPhase !== "done";
        const showProgress = importPhase !== "idle" && importPhase !== "error";
        const phaseLabel: Record<ImportPhase, string> = {
          idle:       "",
          reading:    "Lecture du fichier…",
          parsing:    "Analyse du planning…",
          uploading:  "Envoi au serveur…",
          processing: "Traitement côté serveur…",
          done:       "Import terminé",
          error:      "Erreur lors de l'import",
        };
        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !importBusy && setImportOpen(false)}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Upload size={16} className="text-camublue-900" />
              Importer un planning Excel
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Le fichier doit contenir les colonnes : <strong>Date</strong>, <strong>Shift</strong>, <strong>Nom employé</strong>
            </p>

            {!showProgress && (
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
            )}

            {showProgress && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  {importPhase === "done" ? (
                    <Check size={16} className="text-emerald-600" />
                  ) : (
                    <RefreshCw size={14} className="animate-spin text-camublue-900" />
                  )}
                  <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                    {phaseLabel[importPhase]}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{importPercent}%</span>
                </div>
                {importFilename && (
                  <p className="text-[11px] text-slate-400 truncate mb-2" title={importFilename}>
                    {importFilename}
                  </p>
                )}
                <div
                  className="w-full h-2 rounded-full bg-slate-200 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={importPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full transition-all duration-200 ${
                      importPhase === "done" ? "bg-emerald-500" : "bg-camublue-900"
                    }`}
                    style={{ width: `${importPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Merci de patienter, ne fermez pas cette fenêtre.
                </p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importBusy}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileImport(file);
                // Reset input pour permettre la selection du meme fichier apres erreur
                e.target.value = "";
              }}
            />
            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                L'import <strong>remplace intégralement</strong> le planning existant pour les dates importées.
              </p>
            </div>
            <button
              onClick={() => { if (!importBusy) { setImportOpen(false); setImportPhase("idle"); setImportPercent(0); setImportFilename(""); } }}
              disabled={importBusy}
              className="mt-4 w-full px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Fermer
            </button>
          </div>
        </div>
        );
      })()}
      {/* ── Modal: activer planning ── */}
      {activateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !activating && setActivateOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Zap size={16} className="text-emerald-600" />
              Activer le planning
            </h3>
            {!activateResult ? (
              <>
                <p className="text-sm text-slate-500 mb-4">
                  Tous les employés présents dans le planning seront basculés en
                  <strong> Shift</strong> (attendance_status = SHIFT). Les employés
                  déjà en shift ne seront pas modifiés.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setActivateOpen(false)}
                    disabled={activating}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleActivatePlanning}
                    disabled={activating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {activating
                      ? <><RefreshCw size={13} className="animate-spin" /> Activation…</>
                      : <><Zap size={13} /> Activer</>
                    }
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Bandeau de succès : actif dès que ≥ 1 matricule est pris en compte */}
                {(activateResult.activated + activateResult.already_shift) > 0 && (
                  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                    <Check size={16} className="text-emerald-700 mt-0.5 shrink-0" />
                    <div className="text-xs text-emerald-800">
                      <div className="font-semibold text-sm mb-0.5">Planning actif</div>
                      {activateResult.activated > 0 && (
                        <div>{activateResult.activated} employé{activateResult.activated > 1 ? "s" : ""} basculé{activateResult.activated > 1 ? "s" : ""} en SHIFT à l'instant.</div>
                      )}
                      {activateResult.already_shift > 0 && (
                        <div>{activateResult.already_shift} employé{activateResult.already_shift > 1 ? "s" : ""} déjà en SHIFT.</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-sm text-slate-600 mb-3">
                  <div className="flex items-center justify-between py-1">
                    <span>Employés basculés en SHIFT</span>
                    <span className="font-semibold text-emerald-700">{activateResult.activated}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-slate-100">
                    <span>Déjà en SHIFT</span>
                    <span className="font-semibold text-slate-700">{activateResult.already_shift}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-slate-100">
                    <span>Matricules planifiés</span>
                    <span className="font-semibold text-slate-800">{activateResult.total_planned}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-slate-100">
                    <span>Matricules retrouvés en base</span>
                    <span className={`font-semibold ${activateResult.matched < activateResult.total_planned ? "text-amber-700" : "text-slate-800"}`}>
                      {activateResult.matched} / {activateResult.total_planned}
                    </span>
                  </div>
                </div>
                {activateResult.missing_matricules.length > 0 && (
                  <div className="mb-3 p-3 bg-rose-50 border border-rose-100 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 mb-1">
                      <AlertTriangle size={13} /> {activateResult.missing_matricules.length} matricule{activateResult.missing_matricules.length > 1 ? "s" : ""} introuvable{activateResult.missing_matricules.length > 1 ? "s" : ""} dans la base employés
                    </div>
                    <ul className="text-xs text-rose-700 list-disc pl-4 max-h-32 overflow-y-auto font-mono">
                      {activateResult.missing_matricules.map(m => <li key={m}>{m}</li>)}
                    </ul>
                    <p className="text-[10px] text-rose-600 mt-1">
                      Ces matricules figurent dans le planning mais ne correspondent à aucun employé actif.
                    </p>
                  </div>
                )}
                {activateResult.unmatched.length > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
                      <AlertTriangle size={13} /> {activateResult.unmatched.length} nom{activateResult.unmatched.length > 1 ? "s" : ""} à corriger manuellement
                    </div>
                    <ul className="text-xs text-amber-700 list-disc pl-4 max-h-32 overflow-y-auto">
                      {activateResult.unmatched.map(n => <li key={n}>{n}</li>)}
                    </ul>
                    <p className="text-[10px] text-amber-600 mt-1">
                      Cliquez sur les cartes entourées en orange dans la grille pour saisir le matricule.
                      Le matricule sera automatiquement propagé à toutes les occurrences du même nom.
                    </p>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={() => { setActivateOpen(false); setActivateResult(null); }}
                    className="px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium hover:bg-camublue-800 transition"
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="Supprimer cette entrée de planning ?"
        message={
          deleteTarget
            ? <><strong>{deleteTarget.employee_name}</strong> sera retiré du shift <strong>{deleteTarget.shift_type}</strong> du <strong>{deleteTarget.date}</strong>. Cette action est irréversible.</>
            : null
        }
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />
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
  const missingMatricule = !matricule;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, entry)}
      onDragEnd={onDragEnd}
      onDoubleClick={e => { e.stopPropagation(); onEdit(entry); }}
      onClick={e => {
        // Un seul clic suffit à éditer quand le matricule est manquant
        if (missingMatricule) { e.stopPropagation(); onEdit(entry); }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium cursor-grab select-none transition-all duration-150 ${cfg.bg} ${cfg.text} border ${
        missingMatricule
          ? "border-amber-400 ring-1 ring-amber-300/60"
          : cfg.border
      } ${
        isDragging ? "opacity-40 scale-95 shadow-lg ring-2 ring-camublue-900/20" : "hover:shadow-sm"
      }`}
      title={missingMatricule
        ? "Matricule manquant — cliquez pour le saisir"
        : "Double-clic pour modifier · Glisser pour déplacer"
      }
    >
      <GripVertical size={10} className="text-current opacity-40 shrink-0" />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate">{entry.employee_name}</span>
        {matricule ? (
          <span className="text-[9px] opacity-60 font-mono">{matricule}</span>
        ) : (
          <span className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5">
            <AlertTriangle size={9} /> Matricule à saisir
          </span>
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
