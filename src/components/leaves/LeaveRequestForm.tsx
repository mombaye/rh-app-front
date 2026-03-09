// src/components/leaves/LeaveRequestForm.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveTypeService, leaveRequestService } from "@/services/leaveService";
import { getEmployees } from "@/services/employeeService";
import { ContractType, LeaveType } from "@/types/leave";
import { Employee } from "@/types/employee";
import { FiX, FiSearch } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";

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
  employee_id:   "",
  leave_type_id: "",
  start_date:    "",
  end_date:      "",
  days:          "",
  motif:         "",
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
  const [employees,       setEmployees]       = useState<Employee[]>([]);
  const [empSearch,       setEmpSearch]       = useState("");
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [selectedEmp,     setSelectedEmp]     = useState<Employee | null>(null);
  const [form,            setForm]            = useState<FormState>(EMPTY_FORM);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [isLoadingTypes,  setIsLoadingTypes]  = useState(true);
  const [isLoadingEmps,   setIsLoadingEmps]   = useState(true);

  // Charger types de congés → GET /api/leaves/types/
  useEffect(() => {
    setIsLoadingTypes(true);
    leaveTypeService.getAll()
      .then(setLeaveTypes)
      .catch(() => setError("Impossible de charger les types de congé."))
      .finally(() => setIsLoadingTypes(false));
  }, []);

  // Charger les employés selon le type de contrat
  useEffect(() => {
    setIsLoadingEmps(true);
    const params = contractType === "INTERIM" ? { type_contrat: "INTERIM" as const } : undefined;
    getEmployees(params)
      .then((data) => {
        const filtered = contractType === "INTERIM"
          ? data
          : data.filter((e) => e.type_contrat !== "INTERIM");
        setEmployees(filtered);
      })
      .catch(() => setError("Impossible de charger la liste des employés."))
      .finally(() => setIsLoadingEmps(false));
  }, [contractType]);

  // Calcul automatique du nombre de jours
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end   = new Date(form.end_date);
      if (end >= start) {
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmp(emp);
    setForm((f) => ({ ...f, employee_id: String(emp.id) }));
    setEmpSearch("");
    setShowEmpDropdown(false);
    setError(null);
  };

  const clearEmployee = () => {
    setSelectedEmp(null);
    setForm((f) => ({ ...f, employee_id: "" }));
    setEmpSearch("");
  };

  const filteredEmployees = employees.filter((e) => {
    const q = empSearch.toLowerCase();
    return `${e.nom} ${e.prenom}`.toLowerCase().includes(q) || e.matricule?.toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date || !form.motif.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (!form.days || Number(form.days) <= 0) {
      setError("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await leaveRequestService.create({
        employee_id:   parseInt(form.employee_id, 10),
        leave_type_id: parseInt(form.leave_type_id, 10),
        start_date:    form.start_date,
        end_date:      form.end_date,
        days:          parseFloat(form.days),
        motif:         form.motif.trim(),
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(parseDRFErrors(err?.response?.data));
    } finally {
      setLoading(false);
    }
  };

  const contractLabel = contractType === "INTERIM" ? "Intérimaire" : "Interne";

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[540px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start px-4 sm:px-8 pt-6 sm:pt-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nouvelle demande</h2>
            <p className="text-sm text-gray-400 mt-1">Employé {contractLabel} · Remplissez tous les champs</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100">
            <FiX size={18} />
          </button>
        </div>

        <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4">
          {/* Erreur */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2"
              >
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Sélection employé ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Employé <span className="text-red-500">*</span>
            </label>
            {selectedEmp ? (
              <div className="flex items-center justify-between border border-camublue-900 bg-camublue-900/5 rounded-xl px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-camublue-900 truncate">{selectedEmp.nom} {selectedEmp.prenom}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedEmp.matricule}{selectedEmp.service ? ` · ${selectedEmp.service}` : ""}</p>
                </div>
                <button onClick={clearEmployee} className="ml-2 shrink-0 text-gray-400 hover:text-red-500 transition" title="Changer d'employé">
                  <FiX size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-2.5 gap-2 focus-within:border-camublue-900 focus-within:ring-2 focus-within:ring-camublue-900/20 transition">
                  <FiSearch size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => { setEmpSearch(e.target.value); setShowEmpDropdown(true); }}
                    onFocus={() => setShowEmpDropdown(true)}
                    placeholder={isLoadingEmps ? "Chargement des employés…" : "Rechercher par nom ou matricule…"}
                    disabled={isLoadingEmps}
                    className="flex-1 text-sm outline-none bg-transparent disabled:opacity-60"
                  />
                  {isLoadingEmps && <ImSpinner2 className="animate-spin text-gray-400 shrink-0" size={13} />}
                </div>
                <AnimatePresence>
                  {showEmpDropdown && !isLoadingEmps && empSearch.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-52 overflow-y-auto"
                    >
                      {filteredEmployees.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-gray-400 text-center">Aucun employé trouvé</li>
                      ) : (
                        filteredEmployees.slice(0, 30).map((emp) => (
                          <li
                            key={emp.id}
                            onMouseDown={() => handleSelectEmployee(emp)}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-camublue-900/5 cursor-pointer transition"
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 bg-camublue-900">
                              {emp.prenom?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{emp.nom} {emp.prenom}</p>
                              <p className="text-xs text-gray-400 truncate">{emp.matricule}{emp.service ? ` · ${emp.service}` : ""}</p>
                            </div>
                          </li>
                        ))
                      )}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── Type de congé ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Type de congé <span className="text-red-500">*</span>
            </label>
            <select
              name="leave_type_id"
              value={form.leave_type_id}
              onChange={handleChange}
              disabled={isLoadingTypes}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition disabled:opacity-70"
            >
              <option value="">— Sélectionner un type de congé —</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}{type.is_paid ? "" : " · Non payé"}
                </option>
              ))}
            </select>
            {isLoadingTypes && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <ImSpinner2 className="animate-spin" size={12} /> Chargement…
              </p>
            )}
          </div>

          {/* ── Dates ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Date début <span className="text-red-500">*</span>
              </label>
              <input
                type="date" name="start_date" value={form.start_date} onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Date fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date" name="end_date" value={form.end_date} min={form.start_date || undefined} onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
              />
            </div>
          </div>

          {/* Durée calculée */}
          <AnimatePresence>
            {form.days && Number(form.days) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-700 flex items-center gap-2"
              >
                <span>📅</span>
                <span>Durée calculée : {form.days} jour(s) calendaires</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Motif ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Motif <span className="text-red-500">*</span>
            </label>
            <textarea
              name="motif" value={form.motif} onChange={handleChange}
              placeholder="Décrivez le motif de l'absence…" rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition resize-none"
            />
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || isLoadingTypes || isLoadingEmps}
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><ImSpinner2 className="animate-spin" size={14} /> Envoi en cours…</> : "📤 Soumettre la demande"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
