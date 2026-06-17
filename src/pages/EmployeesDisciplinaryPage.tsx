import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import AppLayout from "@/layouts/AppLayout";
import {
  disciplinaryService,
  getEmployees,
  type DisciplinaryRecord,
  type DisciplinaryRecordPayload,
  type SanctionType,
  type DisciplinaryStatut,
} from "@/services/employeeService";
import type { Employee } from "@/types/employee";
import { Input } from "@/components/ui/input"; // conservé pour la barre de recherche
import { FaPlus } from "react-icons/fa";
import { FiChevronDown, FiX } from "react-icons/fi";
import { Pencil, Trash2, RefreshCw, Search, User } from "lucide-react";
import { TbFileExcel } from "react-icons/tb";

// ── KpiCard — identique à AlertesEmployesPage ─────────────────────────────
function KpiCard({
  label, value, dot, onClick, active,
}: {
  label: string; value: number; dot: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
        active
          ? "border-[#003c71] ring-2 ring-[#003c71]/20 shadow-sm"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <span className="text-2xl font-bold text-[#003c71] tabular-nums">{value}</span>
      <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {label}
      </span>
    </button>
  );
}

// ─── Constantes ────────────────────────────────────────────────────────────

const SANCTIONS: { code: SanctionType; niveau: number; label: string }[] = [
  { code: "SAN-01", niveau: 1, label: "Réprimande" },
  { code: "SAN-02", niveau: 2, label: "Avertissement verbal ou écrit" },
  { code: "SAN-03", niveau: 3, label: "Mise à pied disciplinaire de 1 à 3 jours" },
  { code: "SAN-04", niveau: 4, label: "Mise à pied disciplinaire de 4 à 8 jours" },
  { code: "SAN-05", niveau: 5, label: "Licenciement disciplinaire" },
  { code: "SAN-06", niveau: 6, label: "Licenciement d'un délégué du personnel" },
];

const NIVEAU_COLOR: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-yellow-100 text-yellow-800",
  3: "bg-orange-100 text-orange-800",
  4: "bg-red-100 text-red-700",
  5: "bg-red-200 text-red-900",
  6: "bg-purple-100 text-purple-900",
};

type FormState = {
  employee: number | "";
  type_sanction: SanctionType;
  date_demande: string;
  date_reception: string;
  date_notification: string;
  duree: string;
  motif: string;
  statut: DisciplinaryStatut;
};

const EMPTY_FORM: FormState = {
  employee: "",
  type_sanction: "SAN-01",
  date_demande: "",
  date_reception: "",
  date_notification: "",
  duree: "",
  motif: "",
  statut: "ACTIF",
};

const fieldCls =
  "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition bg-white";

const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1.5";

type StatutFilter = "" | "ACTIF" | "CLOS";

// ─── Modal création / édition ──────────────────────────────────────────────

function DisciplinaryModal({
  open,
  onClose,
  onSave,
  form,
  onChange,
  employees,
  isEdit,
  saving,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  form: FormState;
  onChange: (f: FormState) => void;
  employees: Employee[];
  isEdit: boolean;
  saving: boolean;
  error?: string;
}) {
  const [empSearch, setEmpSearch] = useState("");
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empRef.current && !empRef.current.contains(e.target as Node))
        setEmpDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!open) return null;

  const set = (key: keyof FormState, val: string) =>
    onChange({ ...form, [key]: val } as FormState);

  const selectedEmployee = employees.find((e) => e.id === form.employee);

  const filteredEmployees = employees.filter((e) => {
    const q = empSearch.toLowerCase();
    return (
      e.matricule.toLowerCase().includes(q) ||
      e.nom.toLowerCase().includes(q) ||
      e.prenom.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  function selectEmp(e: Employee) {
    onChange({ ...form, employee: e.id });
    setEmpSearch("");
    setEmpDropdownOpen(false);
  }

  function clearEmp() {
    onChange({ ...form, employee: "" });
    setEmpSearch("");
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[540px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? "Modifier le dossier" : "Nouveau dossier disciplinaire"}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {isEdit
                ? "Mettez à jour les informations du dossier."
                : "Renseignez les informations de la sanction."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Corps */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4">
          {/* Bannière erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
              <FiX size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Recherche employé */}
          {!isEdit && (
            <div>
              <label className={labelCls}>
                Employé <span className="text-red-400">*</span>
              </label>

              {selectedEmployee ? (
                <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <User size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {selectedEmployee.prenom} {selectedEmployee.nom}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{selectedEmployee.matricule}</p>
                  </div>
                  <button
                    onClick={clearEmp}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/60 transition"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative" ref={empRef}>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search size={14} className="text-gray-400" />
                  </div>
                  <input
                    className={`${fieldCls} pl-9`}
                    placeholder="Rechercher par matricule ou nom…"
                    value={empSearch}
                    onChange={(e) => { setEmpSearch(e.target.value); setEmpDropdownOpen(true); }}
                    onFocus={() => setEmpDropdownOpen(true)}
                    autoComplete="off"
                  />
                  {empDropdownOpen && empSearch.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                      {filteredEmployees.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Aucun résultat</div>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => selectEmp(emp)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                              <User size={13} className="text-camublue-900" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {emp.prenom} {emp.nom}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">{emp.matricule}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Type de sanction */}
          <div>
            <label className={labelCls}>
              Type de sanction <span className="text-red-400">*</span>
            </label>
            <select
              className={fieldCls}
              value={form.type_sanction}
              onChange={(e) => set("type_sanction", e.target.value)}
            >
              {SANCTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — Niveau {s.niveau} — {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Date demande expl.</label>
              <input
                type="date"
                className={fieldCls}
                value={form.date_demande}
                onChange={(e) => set("date_demande", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Date réception rép.</label>
              <input
                type="date"
                className={fieldCls}
                value={form.date_reception}
                onChange={(e) => set("date_reception", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Date notification</label>
              <input
                type="date"
                className={fieldCls}
                value={form.date_notification}
                onChange={(e) => set("date_notification", e.target.value)}
              />
            </div>
          </div>

          {/* Durée */}
          <div>
            <label className={labelCls}>Durée</label>
            <input
              className={fieldCls}
              value={form.duree}
              onChange={(e) => set("duree", e.target.value)}
              placeholder="Ex : 3 jours"
            />
          </div>

          {/* Motif */}
          <div>
            <label className={labelCls}>Motifs de la sanction</label>
            <textarea
              rows={3}
              className={`${fieldCls} resize-none`}
              value={form.motif}
              onChange={(e) => set("motif", e.target.value)}
              placeholder="Décrire les motifs de la sanction…"
            />
          </div>

          {/* Statut */}
          <div>
            <label className={labelCls}>Statut</label>
            <select
              className={fieldCls}
              value={form.statut}
              onChange={(e) => set("statut", e.target.value)}
            >
              <option value="ACTIF">Dossier Actif</option>
              <option value="CLOS">Dossier Clos</option>
            </select>
          </div>

          {/* Footer boutons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer le dossier"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal suppression ─────────────────────────────────────────────────────

function DeleteModal({
  open,
  onClose,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Confirmer la suppression</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
            <FiX size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Voulez-vous vraiment supprimer ce dossier disciplinaire ? Cette action est irréversible.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
          >
            {deleting ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────

export default function EmployeesDisciplinaryPage() {
  const [records, setRecords]       = useState<DisciplinaryRecord[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [statutFilter, setStatutFilter] = useState<StatutFilter>("");

  const [modalOpen, setModalOpen]   = useState(false);
  const [editRecord, setEditRecord] = useState<DisciplinaryRecord | null>(null);
  const [form, setForm]             = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving]         = useState(false);
  const [modalError, setModalError] = useState("");

  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const [statutDropdownOpen, setStatutDropdownOpen] = useState(false);
  const statutDropdownRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Fermer dropdown au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statutDropdownRef.current && !statutDropdownRef.current.contains(e.target as Node))
        setStatutDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setIsLoading(true);
    try {
      const [recs, emps] = await Promise.all([
        disciplinaryService.list({
          statut: statutFilter || undefined,
          search: search || undefined,
        }),
        getEmployees({ status: "ALL" }),
      ]);
      setRecords(recs);
      setEmployees(emps as Employee[]);
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [statutFilter, search]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditRecord(null);
    setForm({ ...EMPTY_FORM });
    setModalError("");
    setModalOpen(true);
  }

  function openEdit(rec: DisciplinaryRecord) {
    setEditRecord(rec);
    setModalError("");
    setForm({
      employee:          rec.employee,
      type_sanction:     rec.type_sanction,
      date_demande:      rec.date_demande ?? "",
      date_reception:    rec.date_reception ?? "",
      date_notification: rec.date_notification ?? "",
      duree:             rec.duree,
      motif:             rec.motif,
      statut:            rec.statut,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.employee) { setModalError("Veuillez sélectionner un employé."); return; }
    setModalError("");
    setSaving(true);
    try {
      const payload: DisciplinaryRecordPayload = {
        employee:          form.employee as number,
        type_sanction:     form.type_sanction,
        date_demande:      form.date_demande || null,
        date_reception:    form.date_reception || null,
        date_notification: form.date_notification || null,
        duree:             form.duree,
        motif:             form.motif,
        statut:            form.statut,
      };
      if (editRecord) {
        await disciplinaryService.update(editRecord.id, payload);
        toast.success("Dossier mis à jour.");
      } else {
        await disciplinaryService.create(payload);
        toast.success("Dossier disciplinaire créé.");
      }
      setModalOpen(false);
      load(true);
    } catch {
      setModalError("Erreur lors de l'enregistrement. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await disciplinaryService.import(form);
      toast.success("Import réalisé avec succès.");
      load(true);
    } catch {
      toast.error("Erreur lors de l'import.");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await disciplinaryService.delete(deleteId);
      toast.success("Dossier supprimé.");
      setDeleteId(null);
      load(true);
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  }

  // Compteurs
  const totalCount = records.length;
  const actifCount = records.filter((r) => r.statut === "ACTIF").length;
  const closCount  = records.filter((r) => r.statut === "CLOS").length;

  const statutLabel =
    statutFilter === "" ? "Tous les statuts" :
    statutFilter === "ACTIF" ? "Dossiers actifs" : "Dossiers clos";

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6"
      >
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-camublue-900">
              Disciplinaire
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Suivi des dossiers disciplinaires et sanctions du personnel
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre statut — dropdown style GlobalEmployeesPage */}
            <div className="relative" ref={statutDropdownRef}>
              <button
                onClick={() => setStatutDropdownOpen((o) => !o)}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border shadow-sm transition font-medium ${
                  statutFilter === ""
                    ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    : statutFilter === "ACTIF"
                    ? "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                    : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {statutLabel}
                <FiChevronDown
                  size={14}
                  className={`transition-transform ${statutDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {statutDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden"
                  >
                    {([
                      { value: "" as StatutFilter,      label: "Tous les statuts" },
                      { value: "ACTIF" as StatutFilter, label: "Dossiers actifs" },
                      { value: "CLOS" as StatutFilter,  label: "Dossiers clos" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setStatutFilter(opt.value); setStatutDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition ${
                          statutFilter === opt.value
                            ? "bg-camublue-900/10 text-camublue-900 font-semibold"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Importer */}
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="bg-white border border-gray-300 hover:border-camublue-900 hover:bg-blue-50 text-gray-600 hover:text-camublue-900 text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <TbFileExcel size={16} className={importing ? "animate-pulse" : ""} />
              {importing ? "Import en cours…" : "Importer"}
            </button>

            {/* Actualiser */}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Actualiser
            </button>

            {/* Nouveau dossier */}
            <button
              onClick={openCreate}
              className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition text-sm"
            >
              <FaPlus size={13} />
              Nouveau dossier
            </button>
          </div>
        </div>

        {/* ── KPI cards — style AlertesEmployesPage ── */}
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <KpiCard
            label="Total dossiers"
            value={totalCount}
            dot="bg-slate-400"
            active={statutFilter === ""}
            onClick={() => setStatutFilter("")}
          />
          <KpiCard
            label="Dossiers actifs"
            value={actifCount}
            dot="bg-orange-400"
            active={statutFilter === "ACTIF"}
            onClick={() => setStatutFilter(statutFilter === "ACTIF" ? "" : "ACTIF")}
          />
          <KpiCard
            label="Dossiers clos"
            value={closCount}
            dot="bg-gray-300"
            active={statutFilter === "CLOS"}
            onClick={() => setStatutFilter(statutFilter === "CLOS" ? "" : "CLOS")}
          />
        </div>

        {/* ── Barre de recherche ── */}
        <div className="shrink-0 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <Input
              className="pl-9"
              placeholder="Rechercher par nom, matricule ou motif…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Tableau ── */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-camublue-900" />
            </div>
          ) : records.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <p className="font-medium text-gray-400 mb-3">Aucun dossier disciplinaire</p>
              <button
                onClick={openCreate}
                className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition text-sm"
              >
                <FaPlus size={13} />
                Créer le premier dossier
              </button>
            </div>
          ) : (
            <div className="h-full overflow-auto rounded-xl border border-gray-200 shadow-sm bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    {[
                      "Code", "Niv.", "Matricule RH", "Employé",
                      "Type de Sanction",
                      "Date demande expl.", "Date réception rép.", "Date notification",
                      "Durée", "Motifs", "Statut", "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-camublue-900 text-xs">
                        {rec.code}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${NIVEAU_COLOR[rec.niveau] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {rec.niveau}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600 text-xs">
                        {rec.employee_matricule}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {rec.employee_prenom} {rec.employee_nom}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                        {rec.type_sanction_label}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {rec.date_demande ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {rec.date_reception ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {rec.date_notification ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{rec.duree || "—"}</td>
                      <td
                        className="px-4 py-3 text-gray-500 max-w-[160px] truncate"
                        title={rec.motif}
                      >
                        {rec.motif || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            rec.statut === "ACTIF"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          {rec.statut_label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(rec)}
                            className="p-1.5 rounded-lg hover:bg-camublue-900/10 text-camublue-900 transition"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(rec.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modalOpen && (
          <DisciplinaryModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
            form={form}
            onChange={setForm}
            employees={employees}
            isEdit={!!editRecord}
            saving={saving}
            error={modalError}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteId !== null && (
          <DeleteModal
            open={deleteId !== null}
            onClose={() => setDeleteId(null)}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
