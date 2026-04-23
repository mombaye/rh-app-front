import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Calendar, CheckCircle2, Clock, XCircle,
  AlertCircle, Pencil, FileDown,
  Loader2, ChevronLeft, ChevronRight, TrendingUp, Filter,
  X, CalendarDays, User, Hash, MessageSquare, ShieldCheck,
  ThumbsUp, Upload, FileCheck, Paperclip, ExternalLink,
  AlertTriangle, UserX, Trash2, Eye, RefreshCw,
  LayoutGrid, List, ArrowUpDown,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE = 8;
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { leaveBalanceService, leaveRequestService, leaveTypeService } from "@/services/leaveService";
import { LeaveBalance, LeaveRequest, LeaveRequestCreate, LeaveType } from "@/types/leave";
import toast from "react-hot-toast";

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; dot: string;
  Icon: React.ElementType; textColor: string; borderColor: string;
}> = {
  PENDING:        { label: "En attente",      color: "#d97706", bg: "#fffbeb", dot: "bg-amber-400",   Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  PENDING_SECOND: { label: "2ème validation", color: "#ea580c", bg: "#fff7ed", dot: "bg-orange-400",  Icon: Clock,        textColor: "text-orange-700", borderColor: "border-orange-200" },
  APPROVED:       { label: "Approuvé",        color: "#059669", bg: "#f0fdf4", dot: "bg-green-500",   Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED:       { label: "Rejeté",          color: "#dc2626", bg: "#fef2f2", dot: "bg-red-500",     Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
  CANCELLED:      { label: "Annulé",          color: "#64748b", bg: "#f8fafc", dot: "bg-gray-400",    Icon: XCircle,      textColor: "text-gray-500",   borderColor: "border-gray-200"   },
  REVOKED:        { label: "Révoqué",         color: "#7c3aed", bg: "#f5f3ff", dot: "bg-purple-500",  Icon: AlertCircle,  textColor: "text-purple-700", borderColor: "border-purple-200" },
};

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const fmt = (d: string) => {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
};
const fmtShort = (d: string) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
};

// ── PDF export with jsPDF (real download) ──────────────────────────────────────
function exportLeavesPDF(
  requests: LeaveRequest[],
  employeeName: string,
  matricule: string,
  columns: string[]
) {
  const colDefs: Record<string, { label: string; get: (r: LeaveRequest) => string }> = {
    type:       { label: "Type de congé",   get: r => r.leave_type.label },
    debut:      { label: "Date début",      get: r => fmtShort(r.start_date) },
    fin:        { label: "Date fin",        get: r => fmtShort(r.end_date) },
    jours:      { label: "Jours",           get: r => String(r.days) },
    statut:     { label: "Statut",          get: r => STATUS_CONFIG[r.status]?.label ?? r.status },
    motif:      { label: "Motif",           get: r => r.motif || "—" },
    validateur: { label: "Validé par",      get: r => r.reviewed_by?.full_name || "—" },
  };

  const selectedCols = columns.map(k => colDefs[k]).filter(Boolean);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // ── En-tête ──
  doc.setFillColor(0, 60, 113);
  doc.rect(0, 0, 297, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Rapport de Congés", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${employeeName}  |  Matricule : ${matricule}`, 14, 20);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, 270, 20, { align: "right" });

  // ── Tableau ──
  const headers = selectedCols.map(c => c.label);
  const rows = requests.map(r => selectedCols.map(c => c.get(r)));

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 34,
    headStyles: {
      fillColor: [0, 60, 113],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { cellPadding: 4 },
    margin: { left: 14, right: 14 },
  });

  // ── Pied de page ──
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Camusat Sénégal RH — Document généré automatiquement — Page ${i}/${pageCount}`,
      148.5,
      207,
      { align: "center" }
    );
  }

  doc.save(`conges_${(employeeName || "employe").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── Modal de demande / modification ────────────────────────────────────────────
type FormMode = "create" | "edit";
interface LeaveFormProps {
  mode: FormMode;
  initial?: Partial<LeaveRequestCreate & { id: number }>;
  leaveTypes: LeaveType[];
  employeeId: number;
  balances?: LeaveBalance[];
  onClose: () => void;
  onSaved: () => void;
}

// ── Traduction des erreurs backend en messages lisibles ─────────────────────
function parseLeaveError(err: any): string {
  const data = err?.response?.data;
  const status = err?.response?.status;

  if (!data && !status) return "Impossible de contacter le serveur. Vérifiez votre connexion.";

  // Erreurs champ par champ
  const fieldMsg =
    data?.non_field_errors?.[0] ||
    data?.start_date?.[0] ||
    data?.end_date?.[0] ||
    data?.days?.[0] ||
    data?.leave_type_id?.[0] ||
    data?.employee_id?.[0] ||
    data?.detail ||
    (typeof data === "string" ? data : null);

  if (fieldMsg) {
    // Traduit les messages backend courants en français plus clairs
    if (fieldMsg.includes("existe déjà sur cette période") || fieldMsg.includes("overlap"))
      return "Vous avez déjà une demande de congé sur cette période. Choisissez d'autres dates.";
    if (fieldMsg.includes("jour ouvrable") || fieldMsg.includes("jours fériés"))
      return "La période sélectionnée ne contient que des jours fériés. Veuillez choisir d'autres dates.";
    if (fieldMsg.includes("date de fin") || fieldMsg.includes("end_date"))
      return "La date de fin doit être égale ou postérieure à la date de début.";
    if (fieldMsg.includes("solde") || fieldMsg.includes("balance") || fieldMsg.includes("insuffisant"))
      return "Votre solde de congés est insuffisant pour cette période.";
    if (fieldMsg.includes("Authentication") || fieldMsg.includes("token") || fieldMsg.includes("credentials"))
      return "Votre session a expiré. Veuillez vous reconnecter.";
    return fieldMsg;
  }

  if (status === 400) return "La demande est invalide. Vérifiez les dates et le type de congé sélectionné.";
  if (status === 401 || status === 403) return "Accès refusé. Votre session a peut-être expiré.";
  if (status === 500) return "Une erreur serveur s'est produite. Veuillez réessayer ou contacter l'administrateur.";
  return "Une erreur inattendue s'est produite. Veuillez réessayer.";
}

function LeaveFormModal({ mode, initial, leaveTypes, employeeId, balances, onClose, onSaved }: LeaveFormProps) {
  const [form, setForm] = useState<Partial<LeaveRequestCreate>>({
    employee_id:    employeeId,
    leave_type_id:  initial?.leave_type_id,
    start_date:     initial?.start_date ?? "",
    end_date:       initial?.end_date ?? "",
    days:           initial?.days,
    motif:          initial?.motif ?? "",
    half_day_start: (initial as any)?.half_day_start ?? false,
    half_day_end:   (initial as any)?.half_day_end   ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Justificatif optionnel (comme sur /leaves/internes)
  const [optDocFile, setOptDocFile] = useState<File | null>(null);
  const optFileRef = useRef<HTMLInputElement>(null);

  // Solde disponible pour le type sélectionné
  const selectedType   = leaveTypes.find(t => t.id === form.leave_type_id);
  const typeBalance    = selectedType?.deducts_from_balance
    ? balances?.find(b => b.leave_type.id === form.leave_type_id)
    : null;
  const availableDays  = typeBalance ? parseFloat(typeBalance.remaining) : null;
  const requestedDays  = typeof form.days === "number" ? form.days : 0;
  const balanceShortfall = selectedType?.deducts_from_balance
    && requestedDays > 0
    && (availableDays === null || requestedDays > availableDays);
  const needsDoc = selectedType?.requires_justification ?? false;

  useEffect(() => {
    if (form.start_date && form.end_date && form.end_date >= form.start_date) {
      const s = new Date(form.start_date);
      const e = new Date(form.end_date);
      let diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      if (form.half_day_start) diff -= 0.5;
      if (form.half_day_end)   diff -= 0.5;
      setForm(p => ({ ...p, days: Math.max(0.5, diff) }));
    }
    setFormError(null);
  }, [form.start_date, form.end_date, form.half_day_start, form.half_day_end]);

  const handleSave = async () => {
    setFormError(null);

    // Validations frontend avant d'envoyer
    if (!form.leave_type_id) {
      setFormError("Veuillez sélectionner un type de congé.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setFormError("Veuillez renseigner les dates de début et de fin.");
      return;
    }
    if (form.end_date < form.start_date) {
      setFormError("La date de fin doit être égale ou postérieure à la date de début.");
      return;
    }
    if (!form.days || form.days <= 0) {
      setFormError("Impossible de calculer la durée. Vérifiez les dates saisies.");
      return;
    }

    // Vérification du solde avant envoi
    if (selectedType?.deducts_from_balance && mode === "create") {
      if (availableDays === null) {
        setFormError(
          `Solde insuffisant pour ${selectedType.label} : 0j disponibles, ` +
          `${form.days}j demandés. Contactez les RH pour configurer votre solde.`
        );
        return;
      }
      if (form.days > availableDays) {
        setFormError(
          `Solde insuffisant pour ${selectedType.label} : ` +
          `${availableDays.toFixed(1)}j disponibles, ${form.days}j demandés.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const created = await leaveRequestService.create(form as LeaveRequestCreate);
        if (optDocFile) {
          try {
            await leaveRequestService.uploadDocument(created.id, optDocFile);
          } catch {
            // Upload échoué : la demande est créée, on continue
          }
        }
        toast.success("Demande envoyée avec succès.");
      } else {
        await leaveRequestService.updatePending(initial!.id!, form);
        toast.success("Demande modifiée.");
      }
      onSaved();
    } catch (err: any) {
      setFormError(parseLeaveError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#003c71] to-[#0055a4] px-6 py-5 rounded-t-3xl sm:rounded-t-2xl">
          <h3 className="text-white font-bold text-lg">
            {mode === "create" ? "Nouvelle demande de congé" : "Modifier la demande"}
          </h3>
          <p className="text-blue-200 text-xs mt-0.5">
            {mode === "create" ? "Remplissez le formulaire ci-dessous" : "Modifiez les informations de votre demande"}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Bannière solde insuffisant */}
          <AnimatePresence>
            {balanceShortfall && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 font-semibold"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>Solde insuffisant — le bouton d'envoi est désactivé.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Alerte d'erreur backend */}
          <AnimatePresence>
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              >
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{formError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Type de congé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Type de congé <span className="text-red-400">*</span>
            </label>
            <select
              value={form.leave_type_id ?? ""}
              onChange={e => { setFormError(null); setForm(p => ({ ...p, leave_type_id: Number(e.target.value) })); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
            >
              <option value="">-- Sélectionner un type --</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.label}</option>
              ))}
            </select>

            {/* Info type de congé nécessitant un justificatif */}
            {needsDoc && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                <Paperclip size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Ce type de congé nécessite un justificatif (acte officiel). Vous pouvez le joindre ci-dessous ou l'envoyer plus tard.
                </p>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Date début <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.start_date ?? ""}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Date fin <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.end_date ?? ""}
                min={form.start_date || undefined}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
              />
            </div>
          </div>

          {/* Résumé jours */}
          <AnimatePresence>
            {form.days && form.days > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2"
              >
                <Calendar size={16} className="text-blue-500 shrink-0" />
                <span className="text-sm text-blue-700 font-semibold">
                  {form.days} jour{form.days > 1 ? "s" : ""} de congé calculé{form.days > 1 ? "s" : ""}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Justificatif optionnel (identique à /leaves/internes) */}
          {mode === "create" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Justificatif <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <div
                className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:border-[#003c71] hover:bg-slate-50 transition"
                onClick={() => optFileRef.current?.click()}
              >
                {optDocFile ? (
                  <>
                    <FileCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{optDocFile.name}</p>
                      <p className="text-xs text-slate-400">{(optDocFile.size / 1024).toFixed(0)} Ko</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOptDocFile(null); }}
                      className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-white"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <Paperclip className="h-5 w-5 text-gray-400 shrink-0" />
                    <p className="text-sm text-gray-400">Joindre un document (PDF, JPEG, PNG — max 5 Mo)</p>
                  </>
                )}
              </div>
              <input
                ref={optFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setOptDocFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm transition font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !!balanceShortfall}
              className="flex-[2] px-4 py-2.5 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {mode === "create" ? "Envoyer la demande" : "Enregistrer"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Modal d'export PDF ─────────────────────────────────────────────────────────
interface ExportModalProps {
  requests: LeaveRequest[];
  employeeName: string;
  matricule: string;
  onClose: () => void;
}

const ALL_COLUMNS = [
  { key: "type",       label: "Type de congé" },
  { key: "debut",      label: "Date début" },
  { key: "fin",        label: "Date fin" },
  { key: "jours",      label: "Jours" },
  { key: "statut",     label: "Statut" },
  { key: "motif",      label: "Motif" },
  { key: "validateur", label: "Validé par" },
];

function ExportModal({ requests, employeeName, matricule, onClose }: ExportModalProps) {
  const [selected, setSelected]     = useState<string[]>(["type","debut","fin","jours","statut"]);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const filtered = filterStatus === "ALL" ? requests : requests.filter(r => r.status === filterStatus);
  const toggle   = (k: string) =>
    setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#003c71] to-[#0055a4] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileDown size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Exporter en PDF</h3>
              <p className="text-blue-200 text-xs">Le fichier sera téléchargé automatiquement</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Filtre statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Filter size={14} className="inline mr-1.5 text-gray-400" />
              Filtrer par statut
            </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-gray-50"
            >
              <option value="ALL">Tous les statuts ({requests.length})</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({requests.filter(r => r.status === k).length})</option>
              ))}
            </select>
          </div>

          {/* Colonnes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Colonnes à inclure</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLUMNS.map(col => (
                <label
                  key={col.key}
                  className={`flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-xl border transition ${
                    selected.includes(col.key)
                      ? "border-[#003c71]/40 bg-blue-50 text-[#003c71] font-medium"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => toggle(col.key)}
                    className="accent-[#003c71]"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Résumé */}
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            filtered.length > 0 ? "bg-green-50 border border-green-100 text-green-700" : "bg-red-50 border border-red-100 text-red-600"
          }`}>
            {filtered.length > 0 ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <XCircle size={16} className="shrink-0" />
            )}
            <span>
              {filtered.length > 0
                ? `${filtered.length} demande(s) seront incluses dans le PDF`
                : "Aucune demande pour ce filtre"}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm transition font-medium"
          >
            Annuler
          </button>
          <button
            disabled={selected.length === 0 || filtered.length === 0}
            onClick={() => {
              exportLeavesPDF(filtered, employeeName, matricule, selected);
              onClose();
              toast.success("PDF téléchargé avec succès !");
            }}
            className="px-5 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition flex items-center gap-2 disabled:opacity-50 font-medium shadow-sm"
          >
            <FileDown size={15} />
            Télécharger le PDF
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Modal de détail (lecture seule) ───────────────────────────────────────────
interface LeaveDetailModalProps {
  req: LeaveRequest;
  onClose: () => void;
  onEdit: () => void;
  onRefresh?: () => void;
}

function LeaveDetailModal({ req, onClose, onEdit, onRefresh }: LeaveDetailModalProps) {
  const [localReq,   setLocalReq]  = useState<LeaveRequest>(req);
  const [docFile,    setDocFile]   = useState<File | null>(null);
  const [docLoading, setDocLoading]= useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUploadDoc = async () => {
    if (!docFile) return;
    setDocLoading(true);
    try {
      const updated = await leaveRequestService.uploadDocument(localReq.id, docFile);
      setLocalReq(updated);
      setDocFile(null);
      toast.success("Justificatif envoyé avec succès !");
      onRefresh?.();
    } catch {
      toast.error("Erreur lors de l'envoi du document.");
    } finally {
      setDocLoading(false);
    }
  };

  const cfg     = STATUS_CONFIG[localReq.status] ?? STATUS_CONFIG.CANCELLED;
  const Icon    = cfg.Icon;
  const canEdit = localReq.status === "PENDING" || localReq.status === "PENDING_SECOND";
  const days    = parseFloat(localReq.days) || 0;

  const fields: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: CalendarDays, label: "Date de début",    value: fmt(localReq.start_date) },
    { icon: CalendarDays, label: "Date de fin",      value: fmt(localReq.end_date)   },
    { icon: Clock,        label: "Durée",            value: `${days} jour${days > 1 ? "s" : ""}` },
    { icon: Calendar,     label: "Soumis le",        value: fmt(localReq.created_at?.slice(0, 10) ?? "") },
    ...(localReq.reviewed_by
      ? [{ icon: User as React.ElementType,         label: "Traité par", value: localReq.reviewed_by.full_name }]
      : []
    ),
    ...(localReq.reviewed_at
      ? [{ icon: CalendarDays as React.ElementType, label: "Traité le",  value: fmt(localReq.reviewed_at.slice(0, 10)) }]
      : []
    ),
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* ── Header coloré selon statut ── */}
          <div
            className="relative px-6 py-5"
            style={{ backgroundColor: cfg.color }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            >
              <X size={16} className="text-white" />
            </button>

            {/* Icône + type */}
            <div className="flex items-center gap-3 pr-10">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">
                  Demande de congé
                </p>
                <h2 className="text-white font-bold text-lg leading-tight">
                  {localReq.leave_type.label}
                </h2>
              </div>
            </div>

            {/* Badge statut */}
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {cfg.label}
              </span>
            </div>
          </div>

          {/* ── Corps ── */}
          <div className="px-6 py-5 space-y-4">

            {/* Grille d'infos */}
            <div className="grid grid-cols-2 gap-3">
              {fields.map(f => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
                  <f.icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Motif */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
              <MessageSquare size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Motif</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {req.motif || <span className="italic text-gray-400">Aucun motif renseigné</span>}
                </p>
              </div>
            </div>

            {/* Motif de rejet */}
            {localReq.reject_reason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2.5">
                <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-red-400 uppercase font-semibold tracking-wide mb-0.5">Motif de rejet</p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{localReq.reject_reason}</p>
                </div>
              </div>
            )}

            {/* Approbation */}
            {localReq.status === "APPROVED" && localReq.reviewed_by && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-green-500 shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  Approuvé par <span className="font-bold">{localReq.reviewed_by.full_name}</span>
                </p>
              </div>
            )}

            {/* ── Justificatif ─────────────────────────────────────────────── */}
            {localReq.leave_type.requires_justification && (
              <div className={`rounded-xl border-2 p-4 space-y-3 ${
                localReq.marked_as_absent
                  ? "border-red-200 bg-red-50"
                  : localReq.justification_document
                    ? localReq.justification_validated
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-blue-200 bg-blue-50"
                    : "border-amber-200 bg-amber-50"
              }`}>
                {/* Titre statut doc */}
                <div className="flex items-center gap-2">
                  {localReq.marked_as_absent
                    ? <UserX      size={16} className="text-red-600 shrink-0" />
                    : localReq.justification_document
                      ? localReq.justification_validated
                        ? <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                        : <FileCheck   size={16} className="text-blue-600 shrink-0" />
                      : <Paperclip    size={16} className="text-amber-600 shrink-0" />
                  }
                  <p className={`text-sm font-bold ${
                    localReq.marked_as_absent
                      ? "text-red-700"
                      : localReq.justification_document
                        ? localReq.justification_validated ? "text-emerald-700" : "text-blue-700"
                        : "text-amber-700"
                  }`}>
                    {localReq.marked_as_absent
                      ? "Absence enregistrée — justificatif non fourni"
                      : localReq.justification_document
                        ? localReq.justification_validated
                          ? "Justificatif validé par le RH ✓"
                          : "Justificatif soumis — en attente de validation RH"
                        : "Justificatif requis après le retour de congé"
                    }
                  </p>
                </div>

                {/* Date limite */}
                {!localReq.marked_as_absent && localReq.justification_deadline && !localReq.justification_validated && (
                  <p className="text-xs text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="shrink-0" />
                    Date limite de dépôt : <span className="font-semibold">{fmtShort(localReq.justification_deadline)}</span>
                  </p>
                )}

                {/* Info marquage absent */}
                {localReq.marked_as_absent && localReq.marked_as_absent_by && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <User size={12} className="shrink-0" />
                    Marqué par <span className="font-semibold">{localReq.marked_as_absent_by.full_name}</span>
                    {localReq.marked_as_absent_at && (
                      <> le {fmtShort(localReq.marked_as_absent_at.slice(0, 10))}</>
                    )}
                  </p>
                )}

                {/* Lien vers le document existant */}
                {localReq.justification_document && (
                  <a
                    href={localReq.justification_document}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition hover:opacity-80 bg-white ${
                      localReq.justification_validated
                        ? "border-emerald-300 text-emerald-700"
                        : "border-blue-300 text-blue-700"
                    }`}
                  >
                    <ExternalLink size={12} /> Voir le document
                  </a>
                )}

                {/* Upload (si pas encore de doc OU doc non validé, et pas marqué absent) */}
                {!localReq.marked_as_absent &&
                 (localReq.status === "APPROVED" || localReq.status === "REVOKED") &&
                 !localReq.justification_validated && (
                  <div className="space-y-2">
                    {localReq.justification_document && (
                      <p className="text-xs text-blue-600">Vous pouvez remplacer le document :</p>
                    )}
                    <div
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                        localReq.justification_document
                          ? "border-blue-300 hover:bg-blue-50"
                          : "border-amber-300 hover:bg-amber-50"
                      }`}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload size={20} className={`mx-auto mb-1 ${localReq.justification_document ? "text-blue-400" : "text-amber-400"}`} />
                      <p className={`text-xs font-semibold ${localReq.justification_document ? "text-blue-600" : "text-amber-600"}`}>
                        {docFile ? docFile.name : "Cliquer pour sélectionner (PDF, JPEG, PNG — max 5 Mo)"}
                      </p>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                    />
                    {docFile && (
                      <button
                        onClick={handleUploadDoc}
                        disabled={docLoading}
                        className={`w-full flex items-center justify-center gap-2 py-2 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 ${
                          localReq.justification_document
                            ? "bg-blue-500 hover:bg-blue-600"
                            : "bg-amber-500 hover:bg-amber-600"
                        }`}
                      >
                        {docLoading
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Upload size={14} />
                        }
                        {localReq.justification_document ? "Remplacer le document" : "Envoyer le justificatif"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Référence */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Hash size={12} />
              <span>Référence : <span className="font-semibold text-gray-500">#{localReq.id}</span></span>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
            >
              Fermer
            </button>
            {canEdit && (
              <button
                onClick={() => { onClose(); onEdit(); }}
                className="flex-1 py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Pencil size={14} />
                Modifier
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Carte de demande ───────────────────────────────────────────────────────────
interface RequestCardProps {
  req: LeaveRequest;
  onView: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onReminder: () => void;
  onSelfApprove?: () => void;
  compact?: boolean;
}

function RequestCard({ req, onView, onEdit, onCancel, onReminder, onSelfApprove, compact = false }: RequestCardProps) {
  const cfg     = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.CANCELLED;
  const Icon    = cfg.Icon;
  const canEdit = req.status === "PENDING" || req.status === "PENDING_SECOND";
  const days    = parseFloat(req.days) || 0;

  // Justification alerts
  const needsJustif  = req.leave_type.requires_justification && req.status === "APPROVED";
  const isAbsent     = req.marked_as_absent;
  const justifDone   = !!req.justification_document;
  const justifPending = req.justification_pending; // approved + ended + no doc

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onView}
      className={`group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer ${
        isAbsent ? "border-red-200 hover:border-red-300" :
        justifPending ? "border-amber-200 hover:border-amber-300" :
        "border-gray-100 hover:border-gray-200"
      }`}
    >
      {/* Bande de couleur statut */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: isAbsent ? "#dc2626" : cfg.color }}
      />

      <div className={`pl-5 pr-4 ${compact ? "py-2.5" : "py-4"}`}>
        <div className="flex items-center justify-between gap-3">
          {/* Infos principales */}
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 flex-wrap ${compact ? "mb-0.5" : "mb-1.5"}`}>
              <span className="font-semibold text-gray-800 text-sm truncate">{req.leave_type.label}</span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.textColor} ${cfg.borderColor}`}
                style={{ backgroundColor: cfg.bg }}
              >
                <Icon size={10} />
                {cfg.label}
              </span>
              {/* Badge non justifié */}
              {isAbsent && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold bg-red-50 text-red-700 border-red-200">
                  <UserX size={10} />
                  Non justifié
                </span>
              )}
              {/* Badge justif. en attente */}
              {!isAbsent && justifPending && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold bg-amber-50 text-amber-700 border-amber-200">
                  <AlertTriangle size={10} />
                  Justificatif requis
                </span>
              )}
            </div>

            {/* Période */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={12} className="text-gray-400 shrink-0" />
              <span>{compact ? fmtShort(req.start_date) : fmt(req.start_date)}</span>
              <span className="text-gray-300">→</span>
              <span>{compact ? fmtShort(req.end_date) : fmt(req.end_date)}</span>
              <span className="ml-1 font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-md">
                {days} j
              </span>
            </div>

            {!compact && (
              <>
                {/* Motif (tronqué) */}
                {req.motif && (
                  <p className="text-xs text-gray-400 italic truncate max-w-sm mt-1">"{req.motif}"</p>
                )}

                {/* Motif de rejet */}
                {req.reject_reason && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-500 truncate max-w-xs">{req.reject_reason}</p>
                  </div>
                )}

                {/* Validateur */}
                {req.reviewed_by && req.status === "APPROVED" && (
                  <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Approuvé par {req.reviewed_by.full_name}
                  </p>
                )}

                {/* Alerte non justifié */}
                {isAbsent && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                    <UserX size={11} />
                    Non justifié — justificatif non fourni
                  </p>
                )}

                {/* Alerte justificatif en attente */}
                {!isAbsent && needsJustif && justifDone && !req.justification_validated && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <FileCheck size={11} />
                    Justificatif soumis — en attente de validation RH
                  </p>
                )}
                {!isAbsent && needsJustif && !justifDone && req.justification_deadline && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertTriangle size={11} />
                    Justificatif requis avant le {fmtShort(req.justification_deadline)}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Badge jours */}
            {!compact && (
              <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-xl border-2 border-gray-100 bg-gray-50 shrink-0">
                <span className="text-lg font-bold text-gray-700 leading-none">{days}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wide">jours</span>
              </div>
            )}

            {/* Bouton Voir le détail */}
            <button
              onClick={e => { e.stopPropagation(); onView(); }}
              title="Voir le détail"
              className="p-2 rounded-lg text-gray-400 hover:text-[#003c71] hover:bg-[#003c71]/8 border border-gray-100 hover:border-[#003c71]/20 transition"
            >
              <Eye size={14} />
            </button>

            {canEdit && (
              <>
                {onSelfApprove && (
                  <button
                    onClick={e => { e.stopPropagation(); onSelfApprove(); }}
                    title="Approuver"
                    className={`flex items-center gap-1.5 text-xs text-green-700 hover:bg-green-50 rounded-lg transition font-medium border border-green-200 hover:border-green-400 ${compact ? "p-2" : "px-3 py-1.5"}`}
                  >
                    <ThumbsUp size={12} />
                    {!compact && <span className="hidden sm:inline">Approuver</span>}
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onReminder(); }}
                  title="Relancer le manager"
                  className={`flex items-center gap-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded-lg transition font-medium border border-amber-200 hover:border-amber-400 ${compact ? "p-2" : "px-3 py-1.5"}`}
                >
                  <RefreshCw size={12} />
                  {!compact && <span className="hidden sm:inline">Relancer</span>}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onEdit(); }}
                  title="Modifier"
                  className={`flex items-center gap-1.5 text-xs text-[#003c71] hover:bg-[#003c71]/10 rounded-lg transition font-medium border border-[#003c71]/20 hover:border-[#003c71]/40 ${compact ? "p-2" : "px-3 py-1.5"}`}
                >
                  <Pencil size={12} />
                  {!compact && <span className="hidden sm:inline">Modifier</span>}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onCancel(); }}
                  title="Annuler la demande"
                  className={`flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition font-medium border border-red-200 hover:border-red-400 ${compact ? "p-2" : "px-3 py-1.5"}`}
                >
                  <Trash2 size={12} />
                  {!compact && <span className="hidden sm:inline">Annuler</span>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

interface EmployeeLeavesPageProps {
  layout?: React.ComponentType<{ children: React.ReactNode }>;
  canSelfApprove?: boolean;
}

export default function EmployeeLeavesPage({
  layout: Layout = EmployeeLayout,
  canSelfApprove = false,
}: EmployeeLeavesPageProps) {
  const { user }    = useAuth();
  const employeeId  = user?.employee_id;

  const [balances,      setBalances]     = useState<LeaveBalance[]>([]);
  const [requests,      setRequests]     = useState<LeaveRequest[]>([]);
  const [leaveTypes,    setLeaveTypes]   = useState<LeaveType[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [showForm,      setShowForm]     = useState(false);
  const [editTarget,    setEditTarget]   = useState<LeaveRequest | null>(null);
  const [detailTarget,  setDetailTarget] = useState<LeaveRequest | null>(null);
  const [cancelTarget,  setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelling,    setCancelling]   = useState(false);
  const [showExport,    setShowExport]   = useState(false);
  const [filterStatus,  setFilterStatus] = useState("ALL");
  const [viewMode,      setViewMode]     = useState<"compact" | "detailed">("detailed");
  const [sortOrder,     setSortOrder]    = useState<"recent" | "oldest" | "longest">("recent");
  const [currentPage,   setCurrentPage]  = useState(1);

  const refresh = useCallback(() => {
    if (!employeeId) return;
    const year = new Date().getFullYear();
    Promise.all([
      leaveBalanceService.getByEmployee(employeeId, year),
      leaveRequestService.getByEmployee(employeeId),
      leaveTypeService.getAll(),
    ]).then(([bal, reqs, types]) => {
      setBalances(bal);
      setRequests((reqs as LeaveRequest[]).slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setLeaveTypes(types);
    }).finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = (filterStatus === "ALL" ? requests : requests.filter(r => r.status === filterStatus))
    .slice()
    .sort((a, b) => {
      if (sortOrder === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return (parseFloat(b.days) || 0) - (parseFloat(a.days) || 0);
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  // Solde principal (cumul de tous les types qui déduisent du solde)
  const primaryBalance = balances.find(b => b.leave_type.deducts_from_balance) ?? balances[0];
  const soldeRestant = primaryBalance ? Math.round(parseFloat(primaryBalance.remaining || "0")) : 0;
  const soldeLabel = primaryBalance?.leave_type.label || "Congé";

  // Stats rapides — couleurs alignées sur la charte (#003c71) + petit indicateur de statut
  const statsData = [
    { label: "Total",      status: "ALL",      count: requests.length,                                             dot: "bg-slate-300"  },
    { label: "En attente", status: "PENDING",  count: requests.filter(r => r.status.startsWith("PENDING")).length, dot: "bg-amber-400"  },
    { label: "Approuvées", status: "APPROVED", count: requests.filter(r => r.status === "APPROVED").length,        dot: "bg-[#003c71]" },
    { label: "Rejetées",   status: "REJECTED", count: requests.filter(r => r.status === "REJECTED").length,        dot: "bg-slate-400"  },
  ];

  const handleSelfApprove = async (req: LeaveRequest) => {
    if (!employeeId) return;
    try {
      await leaveRequestService.approve(req.id, { reviewer_id: employeeId });
      toast.success("Demande auto-approuvée avec succès !");
      refresh();
    } catch {
      toast.error("Erreur lors de l'auto-approbation.");
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await leaveRequestService.cancel(cancelTarget.id);
      toast.success("Demande annulée.");
      setCancelTarget(null);
      refresh();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || "Erreur lors de l'annulation.";
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleReminder = async (req: LeaveRequest) => {
    try {
      await leaveRequestService.sendReminder(req.id);
      toast.success("Email de relance envoyé au manager.");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || "Erreur lors de l'envoi de la relance.";
      toast.error(msg);
    }
  };

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header unifié ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5 flex-wrap gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Mes Congés</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gérez vos demandes de congé</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!loading && primaryBalance && (
              <div
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#003c71]/5 border-2 border-[#003c71]/40 text-[#003c71] shadow-sm"
                title={`Solde ${soldeLabel} ${new Date().getFullYear()}`}
              >
                <TrendingUp size={15} className="shrink-0" />
                <span className="text-sm font-medium">
                  Solde : <span className="font-bold">{soldeRestant} j</span>
                </span>
              </div>
            )}
            <button
              onClick={() => setShowExport(true)}
              disabled={requests.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
              <FileDown size={16} />
              Exporter PDF
            </button>
            <button
              onClick={() => { setEditTarget(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition shadow-sm font-medium"
            >
              <Plus size={16} />
              Nouvelle demande
            </button>
          </div>
        </motion.div>

        {/* ── Vue Congés ── */}

        {/* ── Stats rapides ── */}
        {!loading && requests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            {statsData.map(s => {
              const active = filterStatus === s.status;
              return (
                <button
                  key={s.label}
                  onClick={() => handleFilterChange(s.status)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
                    active
                      ? "border-[#003c71] ring-2 ring-[#003c71]/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl font-bold text-[#003c71]">{s.count}</span>
                  <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}


        {/* ── Liste des demandes ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          {/* Toolbar — Petite interface de gestion de l'affichage */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-800 text-sm">Mes demandes</span>
              {!loading && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold">
                  {filtered.length}
                </span>
              )}
            </div>

            <div className="flex-1" />

            {/* Tri */}
            <div className="relative">
              <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700"
                title="Trier les demandes"
              >
                <option value="recent">Plus récentes</option>
                <option value="oldest">Plus anciennes</option>
                <option value="longest">Durée décroissante</option>
              </select>
            </div>

            {/* Filtre statut */}
            <div className="relative">
              <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={filterStatus}
                onChange={e => handleFilterChange(e.target.value)}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700"
                title="Filtrer par statut"
              >
                <option value="ALL">Tous ({requests.length})</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({requests.filter(r => r.status === k).length})</option>
                ))}
              </select>
            </div>

            {/* Mode d'affichage */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                onClick={() => setViewMode("detailed")}
                title="Affichage détaillé"
                className={`p-1.5 rounded-md transition ${
                  viewMode === "detailed"
                    ? "bg-[#003c71] text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode("compact")}
                title="Affichage compact"
                className={`p-1.5 rounded-md transition ${
                  viewMode === "compact"
                    ? "bg-[#003c71] text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <List size={13} />
              </button>
            </div>
          </div>

          {/* Chips actifs */}
          {!loading && (filterStatus !== "ALL" || sortOrder !== "recent") && (
            <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
              {filterStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {STATUS_CONFIG[filterStatus]?.label ?? filterStatus}
                  <button
                    onClick={() => handleFilterChange("ALL")}
                    className="hover:bg-blue-100 rounded-full p-0.5 transition"
                    title="Retirer le filtre"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
              {sortOrder !== "recent" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                  Tri : {sortOrder === "oldest" ? "Plus anciennes" : "Durée décroissante"}
                  <button
                    onClick={() => setSortOrder("recent")}
                    className="hover:bg-gray-100 rounded-full p-0.5 transition"
                    title="Tri par défaut"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Contenu */}
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Calendar size={28} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune demande trouvée</p>
              <p className="text-xs mt-1 text-gray-400">
                {filterStatus !== "ALL"
                  ? `Aucune demande pour le statut "${STATUS_CONFIG[filterStatus]?.label ?? filterStatus}"`
                  : "Créez votre première demande de congé"}
              </p>
              {filterStatus === "ALL" && (
                <button
                  onClick={() => { setEditTarget(null); setShowForm(true); }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition font-medium"
                >
                  <Plus size={15} /> Nouvelle demande
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`p-4 ${viewMode === "compact" ? "space-y-1.5" : "space-y-3"}`}>
                {paginated.map(req => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onView={() => setDetailTarget(req)}
                    onEdit={() => { setEditTarget(req); setShowForm(true); }}
                    onCancel={() => setCancelTarget(req)}
                    onReminder={() => handleReminder(req)}
                    onSelfApprove={canSelfApprove ? () => handleSelfApprove(req) : undefined}
                    compact={viewMode === "compact"}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  Page {currentPage} / {totalPages} · {filtered.length} demande{filtered.length > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition ${
                        page === currentPage
                          ? "bg-[#003c71] text-white shadow-sm"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Modal compte non lié ── */}
      {showForm && !employeeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Compte non lié</h3>
            <p className="text-gray-500 text-sm mb-5 text-center">
              Votre compte n'est pas encore associé à un dossier employé.
              Contactez l'administrateur RH pour lier votre compte.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition font-medium"
              >
                Compris
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal formulaire ── */}
      {showForm && employeeId && (
        <LeaveFormModal
          mode={editTarget ? "edit" : "create"}
          initial={editTarget ? {
            id:            editTarget.id,
            leave_type_id: editTarget.leave_type.id,
            start_date:    editTarget.start_date,
            end_date:      editTarget.end_date,
            days:          parseFloat(editTarget.days),
            motif:         editTarget.motif,
          } : undefined}
          leaveTypes={leaveTypes}
          employeeId={employeeId}
          balances={balances}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSaved={() => { setShowForm(false); setEditTarget(null); refresh(); }}
        />
      )}

      {/* ── Modal export ── */}
      {showExport && (
        <ExportModal
          requests={requests}
          employeeName={user?.employee_name || user?.username || ""}
          matricule={user?.employee_matricule || ""}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── Modal détail ── */}
      {detailTarget && (
        <LeaveDetailModal
          req={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => { setDetailTarget(null); setEditTarget(detailTarget); setShowForm(true); }}
          onRefresh={refresh}
        />
      )}

      {/* ── Modal confirmation annulation ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">
              Annuler cette demande ?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              <span className="font-medium text-gray-700">{cancelTarget.leave_type.label}</span>
            </p>
            <p className="text-xs text-gray-400 text-center mb-5">
              {cancelTarget.start_date} → {cancelTarget.end_date}
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center mb-5">
              Cette action est irréversible. La demande passera au statut Annulé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Garder
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {cancelling && <Loader2 size={14} className="animate-spin" />}
                Confirmer l'annulation
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </Layout>
  );
}
