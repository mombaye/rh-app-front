// src/components/leaves/LeaveRequestForm.tsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveTypeService, leaveRequestService, leaveBalanceService, holidayService } from "@/services/leaveService";
import { getEmployees } from "@/services/employeeService";
import { ContractType, LeaveType, HolidayCheckResult } from "@/types/leave";
import { Employee } from "@/types/employee";
import { FiX } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { Upload, FileCheck, Paperclip, CheckCircle2, Search, User, Star } from "lucide-react";

interface Props {
  onClose:       () => void;
  onSuccess?:    () => void;
  contractType?: ContractType;
}

interface FormState {
  employee_id:    string;
  leave_type_id:  string;
  start_date:     string;
  end_date:       string;
  days:           string;
  half_day_start: boolean;
  half_day_end:   boolean;
}

const EMPTY_FORM: FormState = {
  employee_id: "", leave_type_id: "", start_date: "",
  end_date: "", days: "",
  half_day_start: false, half_day_end: false,
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
  const [leaveTypes,      setLeaveTypes]      = useState<LeaveType[]>([]);
  const [form,            setForm]            = useState<FormState>(EMPTY_FORM);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [isLoadingTypes,  setIsLoadingTypes]  = useState(true);
  const [holidayCheck,    setHolidayCheck]    = useState<HolidayCheckResult | null>(null);
  const [checkingDays,    setCheckingDays]    = useState(false);

  // Employee search
  const [allEmployees,     setAllEmployees]     = useState<Employee[]>([]);
  const [empSearch,        setEmpSearch]        = useState("");
  const [empResults,       setEmpResults]       = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmpDrop,      setShowEmpDrop]      = useState(false);
  const empRef = useRef<HTMLDivElement>(null);

  // Balance
  const [balance, setBalance] = useState<{ acquired: number; taken: number; remaining: number } | null>(null);

  // Document upload step
  const [createdId,   setCreatedId]   = useState<number | null>(null);
  const [docFile,     setDocFile]     = useState<File | null>(null);
  const [docLoading,  setDocLoading]  = useState(false);
  const [docDone,     setDocDone]     = useState(false);
  const fileRef    = useRef<HTMLInputElement>(null);
  // Justificatif optionnel sélectionné dès l'étape 1
  const [optDocFile,  setOptDocFile]  = useState<File | null>(null);
  const optFileRef = useRef<HTMLInputElement>(null);

  // Load leave types
  useEffect(() => {
    setIsLoadingTypes(true);
    leaveTypeService.getAll()
      .then((types) => { setLeaveTypes(types); setIsLoadingTypes(false); })
      .catch(() => { setError("Impossible de charger les types de congé."); setIsLoadingTypes(false); });
  }, []);

  // Load employees filtered by contract type
  useEffect(() => {
    getEmployees({ status: "ACTIVE" }).then((list) => {
      const filtered = contractType === "INTERIM"
        ? list.filter((e) => e.type_contrat === "INTERIM")
        : list.filter((e) => e.type_contrat !== "INTERIM");
      setAllEmployees(filtered);
    }).catch(() => {/* silent */});
  }, [contractType]);

  // Filter employees on search input
  useEffect(() => {
    if (!empSearch.trim()) { setEmpResults([]); return; }
    const q = empSearch.toLowerCase();
    const results = allEmployees.filter(
      (e) =>
        e.matricule.toLowerCase().includes(q) ||
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q)
    ).slice(0, 8);
    setEmpResults(results);
  }, [empSearch, allEmployees]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empRef.current && !empRef.current.contains(e.target as Node)) {
        setShowEmpDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load balance when employee and leave type are selected
  useEffect(() => {
    setBalance(null);
    if (!form.employee_id || !form.leave_type_id) return;
    const year = form.start_date ? new Date(form.start_date).getFullYear() : new Date().getFullYear();
    leaveBalanceService.getByEmployee(parseInt(form.employee_id, 10), year)
      .then((balances) => {
        const b = balances.find((bl: any) => String(bl.leave_type?.id) === form.leave_type_id);
        if (b) setBalance({ acquired: Number(b.acquired), taken: Number(b.taken), remaining: Number(b.remaining) });
      })
      .catch(() => {/* silent */});
  }, [form.employee_id, form.leave_type_id, form.start_date]);

  // Auto-calculate days + check holidays
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date), end = new Date(form.end_date);
      if (end >= start) {
        const totalDiff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
        setForm((f) => ({ ...f, days: String(totalDiff) }));

        setCheckingDays(true);
        holidayService.checkDays(form.start_date, form.end_date)
          .then((result) => {
            setHolidayCheck(result);
            // Ajuster pour les demi-journées
            let effectiveDays = result.effective_days;
            if (form.half_day_start) effectiveDays -= 0.5;
            if (form.half_day_end)   effectiveDays -= 0.5;
            if (effectiveDays < 0.5) effectiveDays = 0.5;
            setForm((f) => ({ ...f, days: String(effectiveDays) }));
          })
          .catch(() => { setHolidayCheck(null); })
          .finally(() => setCheckingDays(false));
      } else {
        setForm((f) => ({ ...f, days: "" }));
        setHolidayCheck(null);
      }
    } else {
      setHolidayCheck(null);
    }
  }, [form.start_date, form.end_date, form.half_day_start, form.half_day_end]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
  };

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setForm((f) => ({ ...f, employee_id: String(emp.id) }));
    setEmpSearch("");
    setEmpResults([]);
    setShowEmpDrop(false);
    setError(null);
  };

  const clearEmployee = () => {
    setSelectedEmployee(null);
    setForm((f) => ({ ...f, employee_id: "" }));
    setEmpSearch("");
  };

  const selectedType = leaveTypes.find((t) => String(t.id) === form.leave_type_id);
  const needsDoc     = selectedType?.requires_justification ?? false;

  const handleSubmit = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date) {
      setError("Veuillez remplir tous les champs obligatoires."); return;
    }
    if (!form.days || Number(form.days) <= 0) {
      setError("La date de fin doit être postérieure ou égale à la date de début."); return;
    }
    setLoading(true); setError(null);
    try {
      const created = await leaveRequestService.create({
        employee_id:    parseInt(form.employee_id, 10),
        leave_type_id:  parseInt(form.leave_type_id, 10),
        start_date:     form.start_date,
        end_date:       form.end_date,
        days:           parseFloat(form.days),
        half_day_start: form.half_day_start,
        half_day_end:   form.half_day_end,
      });

      // Si un fichier optionnel a été sélectionné en step 1, l'uploader maintenant
      if (optDocFile) {
        try {
          await leaveRequestService.uploadDocument(created.id, optDocFile);
        } catch {
          // Upload échoué : on continue quand même (la demande est créée)
        }
        onSuccess?.();
        onClose();
      } else if (needsDoc) {
        // Type de congé qui exige un justificatif → étape 2
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

          {/* ── Recherche employé par matricule ────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Employé <span className="text-red-500">*</span>
            </label>

            {selectedEmployee ? (
              /* Carte employé sélectionné */
              <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {selectedEmployee.nom} {selectedEmployee.prenom}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedEmployee.matricule}
                    {selectedEmployee.fonction ? ` · ${selectedEmployee.fonction}` : ""}
                    {selectedEmployee.service ? ` · ${selectedEmployee.service}` : ""}
                  </p>
                </div>
                <button onClick={clearEmployee}
                  className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-white">
                  <FiX size={15} />
                </button>
              </div>
            ) : (
              /* Champ de recherche */
              <div className="relative" ref={empRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => { setEmpSearch(e.target.value); setShowEmpDrop(true); }}
                    onFocus={() => setShowEmpDrop(true)}
                    placeholder="Rechercher par matricule ou nom…"
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                  />
                </div>

                <AnimatePresence>
                  {showEmpDrop && empResults.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                      {empResults.map((emp) => (
                        <li key={emp.id}
                          onMouseDown={() => selectEmployee(emp)}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition">
                          <div className="w-7 h-7 rounded-full bg-camublue-100 flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-camublue-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {emp.nom} {emp.prenom}
                            </p>
                            <p className="text-xs text-slate-400">
                              {emp.matricule}
                              {emp.service ? ` · ${emp.service}` : ""}
                            </p>
                          </div>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                  {showEmpDrop && empSearch.trim() && empResults.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                      Aucun employé trouvé pour «&nbsp;{empSearch}&nbsp;»
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── Type de congé ───────────────────────────────────────── */}
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

          {/* ── Dates ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Date début <span className="text-red-500">*</span>
              </label>
              <input type="date" name="start_date" value={form.start_date} onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
              {form.start_date && (
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.half_day_start}
                    onChange={(e) => setForm((f) => ({ ...f, half_day_start: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded accent-camublue-900"
                  />
                  <span className="text-xs text-gray-500">Commence l'après-midi (½ j)</span>
                </label>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Date fin <span className="text-red-500">*</span>
              </label>
              <input type="date" name="end_date" value={form.end_date} min={form.start_date || undefined}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
              {form.end_date && (
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.half_day_end}
                    onChange={(e) => setForm((f) => ({ ...f, half_day_end: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded accent-camublue-900"
                  />
                  <span className="text-xs text-gray-500">Se termine le matin (½ j)</span>
                </label>
              )}
            </div>
          </div>

          <AnimatePresence>
            {form.days && Number(form.days) > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-2">
                {/* Résumé jours */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-700 flex items-center gap-2">
                  {checkingDays
                    ? <><ImSpinner2 className="animate-spin" size={13} /> Calcul en cours…</>
                    : <>
                        <span>📅</span>
                        <span>
                          Durée&nbsp;: <strong>{form.days}</strong> jour(s) prélevé(s) sur votre solde
                          {holidayCheck && holidayCheck.holidays_count > 0 && (
                            <span className="ml-1 text-blue-500 font-normal text-xs">
                              ({holidayCheck.total_days} calendaires − {holidayCheck.holidays_count} férié(s))
                            </span>
                          )}
                        </span>
                      </>
                  }
                </div>

                {/* Détail des fériés */}
                {holidayCheck && holidayCheck.holidays_count > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
                    <Star size={14} className="text-amber-500 fill-amber-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-700">
                      <span className="font-semibold">{holidayCheck.holidays_count} jour(s) férié(s) dans cette période&nbsp;:</span>{" "}
                      {holidayCheck.holidays.map(h => {
                        const d = new Date(h.date + "T12:00:00");
                        return `${h.name} (${d.getDate()}/${String(d.getMonth()+1).padStart(2,"0")})`;
                      }).join(", ")}
                      . Ces jours <strong>ne seront pas déduits</strong> de votre solde de congés.
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Solde disponible ─────────────────────────────────── */}
          {balance !== null && selectedType && !selectedType.is_special_leave && (
            <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border ${
              balance.remaining <= 0 ? "bg-red-50 border-red-200 text-red-700"
              : form.days && Number(form.days) > balance.remaining ? "bg-red-50 border-red-200 text-red-700"
              : balance.remaining <= 5 ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
              <span>💰</span>
              <span>
                Solde {selectedType.label}&nbsp;: <strong>{balance.remaining.toFixed(1)}</strong>j disponibles
                <span className="ml-1 text-xs font-normal opacity-70">
                  (acquis&nbsp;: {balance.acquired.toFixed(1)}j · pris&nbsp;: {balance.taken.toFixed(1)}j)
                </span>
              </span>
              {form.days && Number(form.days) > balance.remaining && (
                <span className="ml-auto text-xs font-bold text-red-600">Solde insuffisant !</span>
              )}
            </div>
          )}

          {/* ── Justificatif optionnel ───────────────────────────────── */}
          {!needsDoc && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Justificatif <span className="text-gray-400 font-normal normal-case">(optionnel)</span>
              </label>
              <div
                className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:border-camublue-900 hover:bg-slate-50 transition"
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
                      <FiX size={14} />
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
                onChange={(e) => { setOptDocFile(e.target.files?.[0] ?? null); }}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={loading || isLoadingTypes || (form.days && Number(form.days) > (balance?.remaining ?? 0))}
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
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
