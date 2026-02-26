import { useEffect, useState, useRef, Fragment } from "react";
import {
  FaEdit, FaFileExcel, FaUserPlus, FaPaperPlane,
  FaSort, FaSortUp, FaSortDown, FaFilePdf,
  FaSearch, FaTimes, FaChevronRight, FaArrowLeft, FaCheck
} from "react-icons/fa";
import { TbLogout } from "react-icons/tb";
import { AiOutlineRollback } from "react-icons/ai";
import { Employee } from "@/types/employee";
import { createAccountFromEmployee, sendAccessCodes, exportEmployeesExcel } from "@/services/employeeService";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import { Menu, Transition } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import EmployeePayslipResendModal from "@/components/employees/EmployeePayslipResendModal";

interface Props {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onExit: (employee: Employee) => void;
  onReinstate: (employee: Employee) => void;
  onImport: (file: File) => void;
}

type SortKey = "matricule" | "nom" | "prenom" | "fonction" | "sexe";

export default function EmployeesTable({
  employees, isLoading, onEdit, onExit, onReinstate, onImport,
}: Props) {
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [accountLoading, setAccountLoading] = useState<number | null>(null);
  const [userFilter, setUserFilter] = useState<"all" | "with" | "without">("all");
  const [isExporting, setIsExporting] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipEmp, setPayslipEmp] = useState<Employee | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const isAllSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));
  const [isSendingCodes, setIsSendingCodes] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendScope, setSendScope] = useState<"selected" | "filtered" | "all">("selected");

  // Row action modal
  const [rowOpen, setRowOpen] = useState(false);
  const [rowEmp, setRowEmp] = useState<Employee | null>(null);

  useEffect(() => {
    const q = search.toLowerCase();
    const base = employees.filter((e) => {
      const matchesUser = userFilter === "all" ? true : userFilter === "with" ? e.has_user : !e.has_user;
      const matchesSearch =
        e.matricule.toLowerCase().includes(q) ||
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        (e.email?.toLowerCase().includes(q) ?? false);
      return matchesUser && matchesSearch;
    });
    let result = base;
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result = [...base].sort((a, b) => {
        const aVal = ((a as any)[key] ?? "").toString().toLowerCase();
        const bVal = ((b as any)[key] ?? "").toString().toLowerCase();
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFiltered(result);
  }, [search, employees, userFilter, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      !prev || prev.key !== key ? { key, direction: "asc" } : { key, direction: prev.direction === "asc" ? "desc" : "asc" }
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <FaSort className="text-xs opacity-60" />;
    return sortConfig.direction === "asc" ? <FaSortUp className="text-xs" /> : <FaSortDown className="text-xs" />;
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (isAllSelected) filtered.forEach((e) => n.delete(e.id));
      else filtered.forEach((e) => n.add(e.id));
      return n;
    });
  };

  const doSendCodes = async () => {
    setIsSendingCodes(true);
    const toastId = toast.loading("Envoi des codes en cours...");
    try {
      let matricules: string[] | undefined;
      if (sendScope === "selected") {
        if (selectedIds.size === 0) { toast.error("Aucun employé sélectionné", { id: toastId }); setIsSendingCodes(false); return; }
        matricules = employees.filter((e) => selectedIds.has(e.id)).map((e) => e.matricule);
      } else if (sendScope === "filtered") {
        if (filtered.length === 0) { toast.error("Aucun employé dans la liste filtrée", { id: toastId }); setIsSendingCodes(false); return; }
        matricules = filtered.map((e) => e.matricule);
      }
      const res = await sendAccessCodes(matricules);
      const ok = res.sent?.length ?? 0;
      const ko = res.errors?.length ?? 0;
      if (ok > 0 && ko === 0) toast.success(`Codes envoyés à ${ok} employé(s)`, { id: toastId });
      else if (ok > 0) toast.success(`Envoyés : ${ok}, erreurs : ${ko}`, { id: toastId });
      else toast.error("Aucun code envoyé", { id: toastId });
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'envoi", { id: toastId });
    } finally {
      setIsSendingCodes(false);
    }
  };

  const doSendCodeSingle = async (emp: Employee) => {
    setIsSendingCodes(true);
    const toastId = toast.loading("Envoi en cours...");
    try {
      const res = await sendAccessCodes([emp.matricule]);
      const ok = res.sent?.length ?? 0;
      if (ok > 0) toast.success(`Code envoyé à ${emp.prenom} ${emp.nom}`, { id: toastId });
      else toast.error("Aucun code envoyé", { id: toastId });
      setRowOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'envoi", { id: toastId });
    } finally {
      setIsSendingCodes(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return toast.error("Veuillez sélectionner un fichier Excel.");
    setIsImporting(true);
    const toastId = toast.loading("Import en cours...");
    try {
      await onImport(importFile);
      toast.success("Import terminé avec succès", { id: toastId });
      setImportFile(null);
    } catch {
      toast.error("Erreur lors de l'import", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateAccount = async (emp: Employee) => {
    if (!emp.email) return toast.error("L'employé n'a pas d'email !");
    if (emp.status === "EXITED") return toast.error("Employé sorti : création de compte non autorisée.");
    setAccountLoading(emp.id);
    try {
      await createAccountFromEmployee(emp.id);
      toast.success(`Compte créé pour ${emp.prenom} ${emp.nom}`);
      setRowOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de la création du compte");
    } finally {
      setAccountLoading(null);
    }
  };

  const handleExport = async (status: "ACTIVE" | "EXITED" | "ALL") => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("Export en cours...");
    try {
      await exportEmployeesExcel({ status });
      toast.success("Export terminé", { id: toastId });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'export", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const StatusBadge = ({ e }: { e: Employee }) => {
    if (e.status === "EXITED")
      return <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">Sorti {e.date_sortie ? `· ${new Date(e.date_sortie).toLocaleDateString()}` : ""}</span>;
    if (e.status === "SUSPENDED")
      return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Suspendu</span>;
    return <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Actif</span>;
  };

  // ── Row Action Modal
  const RowActionModal = () => {
    if (!rowEmp) return null;
    const isExited = rowEmp.status === "EXITED";

    const rowActions = [
      { id: "edit", icon: <FaEdit size={15} />, label: "Modifier les informations", desc: "Mettre à jour le profil et les données de cet employé", color: "text-amber-600", bg: "bg-amber-50 hover:bg-amber-100 border-amber-200", show: true },
      { id: "send-code", icon: <FaPaperPlane size={15} />, label: "Envoyer le code d'accès", desc: "Envoyer par email le code d'accès à la plateforme eRH", color: "text-emerald-600", bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200", show: true },
      { id: "create-account", icon: <FaUserPlus size={15} />, label: "Créer un accès utilisateur", desc: "Générer un compte eRH pour cet employé", color: "text-blue-600", bg: "bg-blue-50 hover:bg-blue-100 border-blue-200", show: !isExited },
      { id: "exit", icon: <TbLogout size={15} />, label: "Enregistrer la sortie", desc: "Marquer le départ de cet employé de l'entreprise", color: "text-red-600", bg: "bg-red-50 hover:bg-red-100 border-red-200", show: !isExited },
      { id: "reinstate", icon: <AiOutlineRollback size={15} />, label: "Réintégrer l'employé", desc: "Annuler la sortie et réactiver le profil de cet employé", color: "text-camublue-900", bg: "bg-slate-50 hover:bg-slate-100 border-slate-200", show: isExited },
      { id: "payslip", icon: <FaFilePdf size={15} />, label: "Renvoyer un bulletin de paie", desc: "Renvoyer un bulletin de paie existant par email", color: "text-purple-600", bg: "bg-purple-50 hover:bg-purple-100 border-purple-200", show: true },
    ].filter((a) => a.show);

    const handleRowAction = (id: string) => {
      if (!rowEmp) return;
      if (id === "edit") { onEdit(rowEmp); setRowOpen(false); }
      else if (id === "send-code") { doSendCodeSingle(rowEmp); }
      else if (id === "create-account") { handleCreateAccount(rowEmp); }
      else if (id === "exit") { onExit(rowEmp); setRowOpen(false); }
      else if (id === "reinstate") { onReinstate(rowEmp); setRowOpen(false); }
      else if (id === "payslip") { setPayslipEmp(rowEmp); setPayslipOpen(true); setRowOpen(false); }
    };

    return (
      <div>
        {/* En-tête sobre */}
        <div className="mb-5 pb-4 border-b border-slate-100">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mb-1">Employé</p>
          <div className="font-bold text-slate-800 text-lg">{rowEmp.prenom} {rowEmp.nom}</div>
          <div className="text-xs text-slate-400">{rowEmp.matricule} · {rowEmp.fonction}</div>
        </div>

        {/* Liste d'actions minimaliste */}
        <div className="divide-y divide-slate-100">
          {rowActions.map((action) => {
            const isLoading =
              (action.id === "create-account" && accountLoading === rowEmp.id) ||
              (action.id === "send-code" && isSendingCodes);
            return (
              <button
                key={action.id}
                onClick={() => handleRowAction(action.id)}
                disabled={isLoading}
                className="w-full flex items-center justify-between px-1 py-3 text-left group hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <span className={`${action.color}`}>{action.icon}</span>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium transition-colors">
                    {action.label}
                  </span>
                </div>
                {isLoading
                  ? <ImSpinner2 className="animate-spin text-slate-400 shrink-0" size={13} />
                  : <FaChevronRight className="text-slate-300 group-hover:text-slate-400 shrink-0 transition-colors" size={10} />
                }
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">

      {/* ── Toolbar : recherche à gauche, actions à droite ── */}
      <div className="flex items-center gap-2">

        {/* Barre de recherche — prend tout l’espace restant à gauche */}
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <Input
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full bg-white border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-camublue-900"
          />
        </div>

        <div className="h-6 w-px bg-slate-200 shrink-0" />

        {/* Filtre accès eRH */}
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value as any)}
          className="bg-white border border-slate-300 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-camublue-900 focus:outline-none shadow-sm"
        >
          <option value="all">Tous</option>
          <option value="with">Avec accès eRH</option>
          <option value="without">Sans accès eRH</option>
        </select>

        <div className="h-6 w-px bg-slate-200 shrink-0" />

        {/* Envoyer les codes */}
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition">
            <FaPaperPlane size={13} />
            Envoyer les codes
          </Menu.Button>
          <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
            <Menu.Items className="absolute left-0 mt-2 w-64 origin-top-left rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none overflow-hidden z-20">
              <div className="py-1">
                {[
                  { scope: "selected" as const, label: `Aux sélectionnés (${selectedIds.size})` },
                  { scope: "filtered" as const, label: `À la liste filtrée (${filtered.length})` },
                  { scope: "all" as const, label: "À tout le monde" },
                ].map(({ scope, label }) => (
                  <Menu.Item key={scope}>
                    {({ active }) => (
                      <button onClick={() => { setSendScope(scope); setConfirmOpen(true); }} className={`w-full text-left px-4 py-2.5 text-sm ${active ? "bg-slate-50" : ""}`}>
                        {label}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </Transition>
        </Menu>

        <div className="h-6 w-px bg-slate-200 shrink-0" />

        {/* Import */}
        <input type="file" ref={fileInputRef} onChange={(e) => setImportFile(e.target.files?.[0] || null)} accept=".xlsx" className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 transition shadow-sm">
          <FaFileExcel className="text-green-600" size={14} />
          {importFile ? <span className="max-w-[100px] truncate text-camublue-900 font-medium">{importFile.name}</span> : "Choisir un fichier"}
        </button>
        <button onClick={handleImport} disabled={!importFile || isImporting} className="bg-camublue-900 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 disabled:opacity-40 transition shadow-sm">
          {isImporting ? <ImSpinner2 className="animate-spin" size={13} /> : null}
          {isImporting ? "Importation..." : "Importer"}
        </button>

        <div className="h-6 w-px bg-slate-200 shrink-0" />

        {/* Export */}
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button disabled={isExporting} className="bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2 transition shadow-sm">
            {isExporting ? <ImSpinner2 className="animate-spin" size={13} /> : <FaFileExcel className="text-green-600" size={14} />}
            {isExporting ? "Export..." : "Exporter"}
          </Menu.Button>
          <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
            <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none overflow-hidden z-20">
              <div className="py-1">
                {[["ACTIVE", "Exporter les actifs"], ["EXITED", "Exporter les sortis"], ["ALL", "Exporter tous"]].map(([status, label]) => (
                  <Menu.Item key={status}>
                    {({ active }) => (
                      <button onClick={() => handleExport(status as any)} className={`w-full text-left px-4 py-2.5 text-sm ${active ? "bg-slate-50" : ""}`}>
                        {label}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>

      {/* ── Tableau ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full bg-white rounded-xl">
          <thead className="bg-camublue-900 text-white sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 border-b border-camublue-800">
                <input type="checkbox" checked={isAllSelected} onChange={toggleAllFiltered} />
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">Statut</th>
              {(["matricule", "nom", "prenom", "sexe", "fonction"] as SortKey[]).map((col) => (
                <th key={col} className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">
                  <button type="button" onClick={() => handleSort(col)} className="flex items-center gap-1 select-none hover:opacity-80 transition-opacity">
                    {col === "prenom" ? "Prénom" : col.charAt(0).toUpperCase() + col.slice(1)}
                    {renderSortIcon(col)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">Date d'embauche</th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">Projet</th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">Manager</th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">Email</th>
              <th className="px-4 py-3 text-center border-b border-camublue-800 text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleOne(emp.id)} />
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusBadge e={emp} />
                  {emp.status === "EXITED" && emp.motif_sortie && (
                    <div className="mt-1 rounded-md bg-red-50 border border-red-100 px-2 py-1 max-w-xs">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-0.5">Motif</span>
                      <p className="text-xs text-red-700 overflow-hidden text-ellipsis whitespace-nowrap" title={emp.motif_sortie}>{emp.motif_sortie}</p>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{emp.matricule}</td>
                <td className="px-4 py-3 text-sm font-medium">{emp.nom}</td>
                <td className="px-4 py-3 text-sm">{emp.prenom}</td>
                <td className="px-4 py-3 text-sm">{emp.sexe === "H" ? "Homme" : emp.sexe === "F" ? "Femme" : ""}</td>
                <td className="px-4 py-3 text-sm">{emp.fonction}</td>
                <td className="px-4 py-3 text-sm">{emp.date_embauche}</td>
                <td className="px-4 py-3 text-sm">{emp.projet}</td>
                <td className="px-4 py-3 text-sm">{emp.manager}</td>
                <td className="px-4 py-3 text-sm">{emp.email}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => { setRowEmp(emp); setRowOpen(true); }}
                    className="inline-flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                  >
                    Gérer
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={12} className="text-center py-12 text-slate-400 text-sm">
                  Aucun employé trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal confirmation envoi codes ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Confirmer l'envoi des codes</h3>
            <p className="text-slate-600 mb-4">
              Portée : <span className="ml-1 font-medium">
                {sendScope === "selected" ? `Sélectionnés (${selectedIds.size})` : sendScope === "filtered" ? `Liste filtrée (${filtered.length})` : "Tous les employés"}
              </span>
            </p>
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 mb-4">
              Les destinataires recevront un email individuel contenant leur code d'accès permanent.
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800" disabled={isSendingCodes}>Annuler</button>
              <button onClick={doSendCodes} disabled={isSendingCodes} className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-2">
                {isSendingCodes ? <ImSpinner2 className="animate-spin" /> : <FaPaperPlane />}
                {isSendingCodes ? "Envoi..." : "Confirmer l'envoi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Row Actions ── */}
      <AnimatePresence>
        {rowOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRowOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setRowOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100">
                <FaTimes size={14} />
              </button>
              <RowActionModal />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EmployeePayslipResendModal
        open={payslipOpen}
        employee={payslipEmp}
        onClose={() => { setPayslipOpen(false); setPayslipEmp(null); }}
      />
    </div>
  );
}