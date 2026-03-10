// src/components/leaves/LeaveRequestForm.tsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveTypeService, leaveRequestService } from "@/services/leaveService";
import { ContractType, LeaveType } from "@/types/leave";
import { FiX } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { Upload, FileCheck, Paperclip, CheckCircle2 } from "lucide-react";

interface Props {
  onClose:       () => void;
  onSuccess?:    () => void;
  contractType?: ContractType;
}

interface FormState {
  employee_id:   string;
  leave_type_id: string;
  start_date:    string;
  end_date:      string;
  days:          string;
  motif:         string;
}

const EMPTY_FORM: FormState = {
  employee_id: "", leave_type_id: "", start_date: "",
  end_date: "", days: "", motif: "",
};

function parseDRFErrors(data: unknown): string {
  if (!data || typeof data !== "object") return "Une erreur est survenue.";
  const msgs: string[] = [];
  for (const [, val] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(val)) msgs.push(...val.map(String));
    else if (typeof val === "string") msgs.push(val);
  }
  return msgs.join(" ") || "Une erreur est survenue.";
}

export default function LeaveRequestForm({ onClose, onSuccess, contractType = "INTERNE" }: Props) {
  const [leaveTypes,     setLeaveTypes]     = useState<LeaveType[]>([]);
  const [form,           setForm]           = useState<FormState>(EMPTY_FORM);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);

  // Document upload step
  const [createdId,   setCreatedId]   = useState<number | null>(null);
  const [docFile,     setDocFile]     = useState<File | null>(null);
  const [docLoading,  setDocLoading]  = useState(false);
  const [docDone,     setDocDone]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsLoadingTypes(true);
    leaveTypeService.getAll()
      .then((types) => { setLeaveTypes(types); setIsLoadingTypes(false); })
      .catch(() => { setError("Impossible de charger les types de congé."); setIsLoadingTypes(false); });
  }, []);

  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date), end = new Date(form.end_date);
      if (end >= start) {
        const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
        setForm((f) => ({ ...f, days: String(diff) }));
      } else {
        setForm((f) => ({ ...f, days: "" }));
      }
    }
  }, [form.start_date, form.end_date]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
  };

  const selectedType = leaveTypes.find((t) => String(t.id) === form.leave_type_id);
  const needsDoc     = selectedType?.requires_justification ?? false;

  const handleSubmit = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date || !form.motif.trim()) {
      setError("Veuillez remplir tous les champs obligatoires."); return;
    }
    if (!form.days || Number(form.days) <= 0) {
      setError("La date de fin doit être postérieure ou égale à la date de début."); return;
    }
    setLoading(true); setError(null);
    try {
      const created = await leaveRequestService.create({
        employee_id:   parseInt(form.employee_id, 10),
        leave_type_id: parseInt(form.leave_type_id, 10),
        start_date:    form.start_date,
        end_date:      form.end_date,
        days:          parseFloat(form.days),
        motif:         form.motif.trim(),
      });
      if (needsDoc) {
        // Passer à l'étape upload justificatif
        setCreatedId(created.id);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(parseDRFErrors(err?.response?.data));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDoc = async () => {
    if (!docFile || !createdId) return;
    setDocLoading(true);
    try {
      await leaveRequestService.uploadDocument(createdId, docFile);
      setDocDone(true);
    } catch {
      setError("Erreur lors de l'envoi du document.");
    } finally {
      setDocLoading(false);
    }
  };

  const contractLabel = contractType === "INTERIM" ? "Intérimaire" : "Interne";

  // ── Étape 2 : upload du justificatif ──────────────────────────────────────
  if (createdId !== null) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
        onClick={docDone ? onClose : undefined}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.2 }}
          className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}>

          <div className="flex justify-between items-start px-6 pt-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Justificatif requis</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Demande #{createdId} · {selectedType?.label}
              </p>
            </div>
            <button onClick={() => { onSuccess?.(); onClose(); }}
              className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100">
              <FiX size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {docDone ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-base font-bold text-slate-800">Demande soumise avec succès !</p>
                <p className="text-sm text-slate-500 text-center">
                  Votre demande et le justificatif ont été envoyés au manager.
                </p>
                <button onClick={() => { onSuccess?.(); onClose(); }}
                  className="mt-2 px-6 py-2.5 bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold rounded-xl transition">
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Paperclip className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">
                        Ce type de congé nécessite un justificatif
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Veuillez fournir l'acte officiel correspondant (acte de mariage, de naissance,
                        certificat de décès, etc.) en PDF, JPEG ou PNG (max 5 Mo).
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-camublue-900 hover:bg-slate-50 transition"
                  onClick={() => fileRef.current?.click()}>
                  {docFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck className="h-8 w-8 text-emerald-500" />
                      <p className="text-sm font-semibold text-slate-700">{docFile.name}</p>
                      <p className="text-xs text-slate-400">
                        {(docFile.size / 1024).toFixed(0)} Ko · Cliquer pour changer
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-500">
                        Cliquer pour sélectionner un fichier
                      </p>
                      <p className="text-xs text-slate-400">PDF, JPEG, PNG — max 5 Mo</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={(e) => { setDocFile(e.target.files?.[0] ?? null); setError(null); }} />

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { onSuccess?.(); onClose(); }}
                    className="flex-1 border border-slate-200 text-slate-500 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition">
                    Envoyer plus tard
                  </button>
                  <button onClick={handleUploadDoc} disabled={!docFile || docLoading}
                    className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {docLoading
                      ? <><ImSpinner2 className="animate-spin" size={14} /> Envoi…</>
                      : <><Upload className="h-4 w-4" /> Envoyer le justificatif</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Étape 1 : formulaire de demande ───────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[540px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex justify-between items-start px-4 sm:px-8 pt-6 sm:pt-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nouvelle demande</h2>
            <p className="text-sm text-gray-400 mt-1">Employé {contractLabel} · Remplissez tous les champs</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100">
            <FiX size={18} />
          </button>
        </div>

        <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span><span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              ID Employé <span className="text-red-500">*</span>
            </label>
            <input type="number" name="employee_id" value={form.employee_id} onChange={handleChange}
              placeholder="Ex : 42" min={1}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Type de congé <span className="text-red-500">*</span>
            </label>
            <select name="leave_type_id" value={form.leave_type_id} onChange={handleChange}
              disabled={isLoadingTypes}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition disabled:opacity-70">
              <option value="">— Sélectionner un type de congé —</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label} {type.is_paid ? "" : "· Non payé"}
                  {type.requires_justification ? " 📎" : ""}
                </option>
              ))}
            </select>
            {isLoadingTypes && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <ImSpinner2 className="animate-spin" size={12} /> Chargement…
              </p>
            )}
            {needsDoc && (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Ce type de congé nécessite un justificatif (acte officiel). Vous pourrez le fournir à l'étape suivante.
                  </p>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Date début <span className="text-red-500">*</span>
              </label>
              <input type="date" name="start_date" value={form.start_date} onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Date fin <span className="text-red-500">*</span>
              </label>
              <input type="date" name="end_date" value={form.end_date} min={form.start_date || undefined}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
            </div>
          </div>

          <AnimatePresence>
            {form.days && Number(form.days) > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-700 flex items-center gap-2">
                <span>📅</span>
                <span>Durée calculée : {form.days} jour(s) calendaires</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Motif <span className="text-red-500">*</span>
            </label>
            <textarea name="motif" value={form.motif} onChange={handleChange}
              placeholder="Décrivez le motif de l'absence…" rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={loading || isLoadingTypes}
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading
                ? <><ImSpinner2 className="animate-spin" size={14} /> Envoi en cours…</>
                : needsDoc
                  ? "📎 Soumettre & joindre justificatif"
                  : "📤 Soumettre la demande"
              }
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
