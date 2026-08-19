// src/components/leaves/LeaveRequestForm.tsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveTypeService, leaveRequestService, leaveBalanceService, holidayService } from "@/services/leaveService";
import { getEmployees } from "@/services/employeeService";
import { ContractType, LeaveType, HolidayCheckResult, ApprovalChainInfo } from "@/types/leave";
import { Employee } from "@/types/employee";
import { FiX } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { Upload, FileCheck, Paperclip, CheckCircle2, Search, User, Star, GitBranch, Loader2 } from "lucide-react";

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
}

const EMPTY_FORM: FormState = {
  employee_id: "", leave_type_id: "", start_date: "",
  end_date: "", days: "",
};

// ── Utilitaires de date ───────────────────────────────────────────────────────
const _pad = (n: number) => String(n).padStart(2, "0");
function _shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const r = new Date(y, m - 1, d + days);
  return `${r.getFullYear()}-${_pad(r.getMonth() + 1)}-${_pad(r.getDate())}`;
}

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

  // Circuit de validation dynamique
  const [chainInfo,    setChainInfo]    = useState<ApprovalChainInfo | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

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

  // Charger le circuit de validation dès qu'un employé est sélectionné
  useEffect(() => {
    if (!selectedEmployee) { setChainInfo(null); return; }
    setLoadingChain(true);
    leaveRequestService.getApprovalChain(selectedEmployee.id)
      .then(setChainInfo)
      .catch(() => setChainInfo(null))
      .finally(() => setLoadingChain(false));
  }, [selectedEmployee]);

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

  // ── Durée fixe : auto-remplir end_date quand start_date ou type change ──────
  useEffect(() => {
    if (!form.leave_type_id) return;
    if (!isFixedDuration) {
      // Nouveau type non-fixe → effacer les dates pour que l'utilisateur re-saisisse
      setForm((f) => f.end_date ? { ...f, end_date: "", days: "" } : f);
      setHolidayCheck(null);
      return;
    }
    if (!form.start_date || fixedDays === null) return;
    const [y, m, d] = form.start_date.split("-").map(Number);
    const endDate   = new Date(y, m - 1, d + fixedDays - 1);
    const pad       = (n: number) => String(n).padStart(2, "0");
    const endStr    = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
    setForm((f) => ({ ...f, end_date: endStr, days: String(fixedDays) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.leave_type_id, form.start_date]);

  // ── Recadrer end_date si elle dépasse le plafond (changement de start ou de type) ──
  useEffect(() => {
    if (isFixedDuration || !form.start_date || !form.end_date) return;
    if (!maxEndDate) return;                        // pas de plafond configuré
    if (form.end_date > maxEndDate) {               // dépassement → recadrer au plafond
      setForm((f) => ({ ...f, end_date: maxEndDate, days: "" }));
      setHolidayCheck(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.start_date, form.leave_type_id]);

  // Auto-calculate days + check holidays
  useEffect(() => {
    if (form.start_date && form.end_date) {
      // Parse dates correctly in local timezone to avoid UTC issues
      const [sy, sm, sd] = form.start_date.split("-").map(Number);
      const [ey, em, ed] = form.end_date.split("-").map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);

      if (end >= start) {
        // Calculate total calendar days (inclusive of both start and end dates)
        const totalDiff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
        setForm((f) => ({ ...f, days: String(totalDiff) }));

        setCheckingDays(true);
        holidayService.checkDays(form.start_date, form.end_date, form.leave_type_id || undefined)
          .then((result) => {
            setHolidayCheck(result);
            // Pour les types à durée fixe (mariage, baptême…), ne pas écraser la durée légale
            setForm((f) => {
              const t = leaveTypes.find((lt) => String(lt.id) === f.leave_type_id);
              const fixed = (t?.min_days_per_request ?? 0) > 0 &&
                            t?.min_days_per_request === t?.max_days_per_request;
              return { ...f, days: fixed ? String(t!.min_days_per_request) : String(result.effective_days) };
            });
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
  }, [form.start_date, form.end_date, form.leave_type_id]);

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

  const selectedType   = leaveTypes.find((t) => String(t.id) === form.leave_type_id);

  // ── Dérivés du type de congé sélectionné ─────────────────────────────────
  // Durée fixe : min === max > 0 (mariage, baptême, décès…)
  const isFixedDuration = (selectedType?.min_days_per_request ?? 0) > 0 &&
                          selectedType?.min_days_per_request === selectedType?.max_days_per_request;
  const fixedDays       = isFixedDuration ? selectedType!.min_days_per_request : null;

  // Justificatif obligatoire AVANT soumission (repos médical : requires_justification=true, justification_after_leave=false)
  const needsDocNow    = (selectedType?.requires_justification ?? false) && !(selectedType?.justification_after_leave ?? false);
  // Justificatif demandé APRÈS le congé (mariage, baptême…)
  const needsDocLater  = (selectedType?.requires_justification ?? false) && (selectedType?.justification_after_leave ?? false);
  const needsDoc       = needsDocNow;

  // Délai de prévenance : start_date doit être >= aujourd'hui + notice_days_required
  const noticeDays     = selectedType?.notice_days_required ?? 0;
  const noticeViolated = noticeDays > 0 && !!form.start_date && (() => {
    const minStart = new Date();
    minStart.setDate(minStart.getDate() + noticeDays);
    minStart.setHours(0, 0, 0, 0);
    const [y, m, d] = form.start_date.split("-").map(Number);
    return new Date(y, m - 1, d) < minStart;
  })();

  // ── Plafond / plancher date de fin dérivés du type ────────────────────────
  // Date de fin max autorisée (start + max_days - 1)
  const maxEndDate: string | undefined = (!isFixedDuration && form.start_date && (selectedType?.max_days_per_request ?? 0) > 0)
    ? _shiftDate(form.start_date, selectedType!.max_days_per_request - 1)
    : undefined;

  // Date de fin min (start + min_days - 1), sinon simplement la date de début
  const minEndDate: string | undefined = (!isFixedDuration && form.start_date && (selectedType?.min_days_per_request ?? 0) > 0)
    ? _shiftDate(form.start_date, selectedType!.min_days_per_request - 1)
    : (form.start_date || undefined);

  const handleSubmit = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date) {
      setError("Veuillez remplir tous les champs obligatoires."); return;
    }
    if (!form.days || Number(form.days) <= 0) {
      setError("La date de fin doit être postérieure ou égale à la date de début."); return;
    }
    if (needsDoc && !optDocFile) {
      setError("Un justificatif est obligatoire pour ce type de congé. Veuillez joindre le document avant de soumettre."); return;
    }
    if (noticeViolated) {
      setError(`Ce type de congé nécessite un délai de prévenance de ${noticeDays} jour(s). Veuillez choisir une date de début plus tardive.`); return;
    }
    if (selectedType?.deducts_from_balance && !selectedType.is_special_leave && balance !== null && Number(form.days) > (balance?.remaining ?? 0)) {
      setError(`Solde insuffisant — ${balance?.remaining ?? 0} jour(s) disponible(s), ${form.days} jour(s) demandé(s).`); return;
    }
    if ((selectedType?.max_days_per_request ?? 0) > 0 && Number(form.days) > selectedType!.max_days_per_request) {
      setError(`Ce type de congé est limité à ${selectedType!.max_days_per_request} jour(s) par demande.`); return;
    }
    if ((selectedType?.min_days_per_request ?? 0) > 0 && Number(form.days) < selectedType!.min_days_per_request) {
      setError(`Ce type de congé requiert au minimum ${selectedType!.min_days_per_request} jour(s) par demande.`); return;
    }
    setLoading(true); setError(null);
    try {
      const created = await leaveRequestService.create({
        employee_id:    parseInt(form.employee_id, 10),
        leave_type_id:  parseInt(form.leave_type_id, 10),
        start_date:     form.start_date,
        end_date:       form.end_date,
        days:           parseFloat(form.days),
        motif:          "",
      });

      // Upload du justificatif (obligatoire ou optionnel) s'il a été sélectionné
      if (optDocFile) {
        try {
          await leaveRequestService.uploadDocument(created.id, optDocFile);
        } catch (uploadErr: any) {
          // La demande est créée mais l'upload a échoué : on informe l'employé
          const msg = uploadErr?.response?.data?.error ?? "Erreur lors de l'envoi du justificatif.";
          setError(`Demande créée (#${created.id}) mais le justificatif n'a pas pu être envoyé : ${msg} Vous pouvez le renvoyer depuis votre espace congés.`);
          setLoading(false);
          return; // ne pas fermer le formulaire, laisser l'utilisateur voir le message
        }
      }
      onSuccess?.();
      onClose();
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
                        Justificatif requis — {selectedType?.label}
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Veuillez fournir le document officiel correspondant à votre{" "}
                        <strong>{selectedType?.label?.toLowerCase()}</strong> en PDF, JPEG ou PNG (max 5 Mo).
                        {selectedType?.justification_grace_days
                          ? ` Délai accordé : ${selectedType.justification_grace_days} jour(s) après la fin du congé.`
                          : ""
                        }
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
            {form.days && selectedType?.deducts_from_balance && !selectedType.is_special_leave &&
              balance !== null && Number(form.days) > (balance?.remaining ?? 0) && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">🚫</span>
                <div>
                  <p className="font-bold">Solde insuffisant</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {balance?.remaining ?? 0} jour{(balance?.remaining ?? 0) > 1 ? "s" : ""} disponible{(balance?.remaining ?? 0) > 1 ? "s" : ""}
                    {" · "}{form.days} demandé{Number(form.days) > 1 ? "s" : ""}
                  </p>
                </div>
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

          {/* ── Circuit de validation dynamique ──────────────────────── */}
          <AnimatePresence>
            {(loadingChain || chainInfo) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3.5"
              >
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <GitBranch size={11} />
                  Circuit de validation — calculé automatiquement
                </p>

                {loadingChain ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 size={12} className="animate-spin" />
                    Calcul du circuit en cours…
                  </div>
                ) : chainInfo && chainInfo.steps.length === 0 ? (
                  <p className="text-xs text-amber-600 italic">
                    ⚠️ Aucun validateur configuré pour cet employé. Contactez le service RH.
                  </p>
                ) : chainInfo && (
                  <>
                    {/* Visualisation Employé → N+1 → N+2 → … */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] px-2 py-1 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 font-semibold">
                        Employé
                      </span>
                      {chainInfo.steps.map((step, i) => {
                        const STEP_COLORS = [
                          "bg-amber-50 border-amber-300 text-amber-800",
                          "bg-orange-50 border-orange-300 text-orange-800",
                          "bg-violet-50 border-violet-300 text-violet-800",
                          "bg-rose-50 border-rose-300 text-rose-800",
                        ];
                        const colorClass = step.level === "DG"
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : (STEP_COLORS[i] ?? STEP_COLORS[STEP_COLORS.length - 1]);
                        return (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-gray-300 font-bold text-sm">→</span>
                            <div className={`flex flex-col items-center px-2 py-1 rounded-lg border text-[10px] font-semibold ${colorClass}`}>
                              <span className="font-bold">{step.level}</span>
                              <span className="font-normal opacity-75 max-w-[110px] truncate">
                                {step.approver_name ?? "—"}
                                {step.is_on_leave ? " 🌴" : ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Légende */}
                    <p className="text-[10px] text-gray-400 mt-2.5 italic">
                      {chainInfo.steps.length === 1
                        ? "1 niveau de validation"
                        : `${chainInfo.steps.length} niveaux de validation — déterminés par l'arborescence`}
                      {chainInfo.steps.some(s => s.is_on_leave) &&
                        " · 🌴 Un validateur est actuellement en congé"}
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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
                  {type.label}
                  {!type.is_paid ? " · Non payé" : ""}
                  {type.requires_justification ? " 📎" : ""}
                </option>
              ))}
            </select>
            {isLoadingTypes && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <ImSpinner2 className="animate-spin" size={12} /> Chargement…
              </p>
            )}

            <AnimatePresence>
              {selectedType && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-2 space-y-1.5">

                  {/* Congé non payé */}
                  {!selectedType.is_paid && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-orange-500 text-sm">💸</span>
                      <p className="text-xs text-orange-700">
                        Ce congé est <strong>non payé</strong> — aucune indemnité ne sera versée pour cette période.
                      </p>
                    </div>
                  )}

                  {/* Congé spécial — droit distinct, non déduit du solde */}
                  {selectedType.is_special_leave && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-violet-500 text-sm">⭐</span>
                      <p className="text-xs text-violet-700">
                        Congé spécial (Art. L147) — ce droit est <strong>distinct du solde de congés annuels</strong> et n'y sera pas déduit.
                      </p>
                    </div>
                  )}

                  {/* Délai de prévenance */}
                  {selectedType.notice_days_required > 0 && (
                    <div className={`rounded-xl px-3 py-2 flex items-start gap-2 border ${
                      noticeViolated
                        ? "bg-red-50 border-red-200"
                        : "bg-blue-50 border-blue-200"
                    }`}>
                      <span className={`shrink-0 mt-0.5 text-sm ${noticeViolated ? "text-red-500" : "text-blue-500"}`}>📅</span>
                      <p className={`text-xs ${noticeViolated ? "text-red-700 font-semibold" : "text-blue-700"}`}>
                        {noticeViolated
                          ? <>Date trop proche — ce type de congé nécessite <strong>{selectedType.notice_days_required} jour(s)</strong> de prévenance minimum.</>
                          : <>Délai de prévenance requis : <strong>{selectedType.notice_days_required} jour(s)</strong> minimum avant le début du congé.</>
                        }
                      </p>
                    </div>
                  )}

                  {/* Durée fixe OU contraintes min/max */}
                  {(selectedType.max_days_per_request > 0 || selectedType.min_days_per_request > 0) && (
                    isFixedDuration ? (
                      <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 text-violet-500 text-sm">📌</span>
                        <p className="text-xs text-violet-700">
                          Durée légale fixe : <strong>{fixedDays} jour{(fixedDays ?? 0) > 1 ? "s" : ""}</strong>.
                          La date de fin sera <strong>calculée automatiquement</strong> dès que vous choisissez la date de début.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 text-blue-500 text-sm">⏱</span>
                        <p className="text-xs text-blue-700">
                          {selectedType.max_days_per_request > 0
                            ? <>Durée maximale : <strong>{selectedType.max_days_per_request} jour(s)</strong> par demande.</>
                            : <>Durée minimale légale : <strong>{selectedType.min_days_per_request} jour(s)</strong> par demande.</>
                          }
                        </p>
                      </div>
                    )
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Dates ───────────────────────────────────────────────── */}
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
                Date fin{" "}
                {isFixedDuration
                  ? <span className="text-violet-600 font-semibold normal-case">
                      · calculée automatiquement ({fixedDays}j)
                    </span>
                  : maxEndDate
                  ? <span className="text-blue-500 font-normal normal-case">
                      · max {selectedType!.max_days_per_request}j
                    </span>
                  : <span className="text-red-500">*</span>
                }
              </label>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                min={isFixedDuration ? undefined : minEndDate}
                max={isFixedDuration ? undefined : maxEndDate}
                onChange={isFixedDuration ? undefined : handleChange}
                readOnly={isFixedDuration}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition ${
                  isFixedDuration
                    ? "border-violet-200 bg-violet-50 text-violet-700 cursor-not-allowed"
                    : "border-gray-200 focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20"
                }`}
              />
              {isFixedDuration && !form.start_date && (
                <p className="text-xs text-slate-400 mt-1">Choisissez d'abord la date de début.</p>
              )}
              {!isFixedDuration && maxEndDate && form.start_date && (
                <p className="text-xs text-blue-400 mt-1">
                  Date de fin limitée au {new Date(maxEndDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} ({selectedType!.max_days_per_request}j max)
                </p>
              )}
            </div>
          </div>

          <AnimatePresence>
            {form.days && Number(form.days) > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-2">
                {/* Résumé jours */}
                <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${
                  isFixedDuration
                    ? "bg-violet-50 border border-violet-100 text-violet-700"
                    : "bg-blue-50 border border-blue-100 text-blue-700"
                }`}>
                  {checkingDays
                    ? <><ImSpinner2 className="animate-spin" size={13} /> Calcul en cours…</>
                    : <>
                        <span>{isFixedDuration ? "📌" : "📅"}</span>
                        <span>
                          {isFixedDuration
                            ? <>Durée légale&nbsp;: <strong>{fixedDays} jour{(fixedDays ?? 0) > 1 ? "s" : ""}</strong> fixe</>
                            : <>Durée&nbsp;: <strong>{form.days}</strong> jour(s)</>
                          }
                          {selectedType?.deducts_from_balance && !selectedType.is_special_leave
                            ? <span className="font-normal"> — prélevé(s) sur votre solde</span>
                            : <span className={`font-normal ${isFixedDuration ? "text-violet-500" : "text-violet-600"}`}> — sans déduction du solde</span>
                          }
                          {!isFixedDuration && holidayCheck && holidayCheck.holidays_count > 0 && (
                            <span className="ml-1 font-normal text-xs opacity-75">
                              ({holidayCheck.total_days} calendaires − {holidayCheck.holidays_count} férié(s))
                            </span>
                          )}
                          {isFixedDuration && holidayCheck && holidayCheck.holidays_count > 0 && (
                            <span className="ml-1 font-normal text-xs opacity-75">
                              · {holidayCheck.holidays_count} jour(s) férié(s) dans la période
                            </span>
                          )}
                        </span>
                      </>
                  }
                </div>

                {/* Durée maximale dépassée */}
                {!checkingDays && selectedType && selectedType.max_days_per_request > 0 && Number(form.days) > selectedType.max_days_per_request && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">🚫</span>
                    <p className="text-xs font-semibold">
                      Durée maximale dépassée : ce type de congé est limité à <strong>{selectedType.max_days_per_request} jour(s)</strong> par demande.
                    </p>
                  </motion.div>
                )}

                {/* Durée minimale non atteinte */}
                {!checkingDays && selectedType && selectedType.min_days_per_request > 0 && Number(form.days) < selectedType.min_days_per_request && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-2.5 flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <p className="text-xs font-semibold">
                      Durée insuffisante : ce type de congé requiert au minimum <strong>{selectedType.min_days_per_request} jour(s)</strong> par demande.
                    </p>
                  </motion.div>
                )}

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

          {/* ── Justificatif ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Justificatif{" "}
              {needsDocNow
                ? <span className="text-red-500">Obligatoire *</span>
                : needsDocLater
                ? <span className="text-amber-600 font-normal normal-case">demandé après le congé</span>
                : <span className="text-gray-400 font-normal normal-case">(optionnel)</span>
              }
            </label>

            {/* Notification : justificatif demandé après le congé (mariage, baptême…) */}
            {needsDocLater && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                <span className="text-amber-500 text-sm shrink-0">📋</span>
                <p className="text-xs text-amber-700">
                  Un justificatif officiel vous sera demandé dans les{" "}
                  <strong>{selectedType!.justification_grace_days} jour{selectedType!.justification_grace_days > 1 ? "s" : ""}</strong>{" "}
                  suivant votre retour. Vous pouvez déjà le joindre si vous l'avez.
                </p>
              </div>
            )}

            <div
              className={`flex items-center gap-3 border border-dashed rounded-xl px-4 py-3 cursor-pointer transition ${
                optDocFile
                  ? "border-emerald-300 bg-emerald-50"
                  : needsDocNow
                  ? "border-red-200 hover:border-red-400 hover:bg-red-50"
                  : "border-gray-300 hover:border-camublue-900 hover:bg-slate-50"
              }`}
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
                  <Paperclip className={`h-5 w-5 shrink-0 ${needsDocNow ? "text-red-400" : "text-gray-400"}`} />
                  <p className="text-sm text-gray-400">PDF, JPEG, PNG — max 5 Mo</p>
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

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={
                loading || isLoadingTypes ||
                !!(needsDoc && !optDocFile) ||
                !!noticeViolated ||
                !!(form.days && selectedType?.deducts_from_balance && !selectedType.is_special_leave && balance !== null && Number(form.days) > (balance?.remaining ?? 0)) ||
                !!(form.days && selectedType && selectedType.max_days_per_request > 0 && Number(form.days) > selectedType.max_days_per_request) ||
                !!(form.days && selectedType && selectedType.min_days_per_request > 0 && Number(form.days) < selectedType.min_days_per_request)
              }
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading
                ? <><ImSpinner2 className="animate-spin" size={14} /> Envoi en cours…</>
                : needsDocNow
                  ? "📎 Soumettre & joindre justificatif"
                  : needsDocLater
                  ? "📤 Soumettre la demande"
                  : "📤 Soumettre la demande"
              }
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
