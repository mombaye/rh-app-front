import { useEffect, useState, useRef, Fragment } from "react";
import {
  FaEdit, FaFileExcel, FaUserPlus, FaPaperPlane,
  FaSort, FaSortUp, FaSortDown, FaFilePdf,
  FaSearch, FaTimes, FaChevronRight, FaArrowLeft, FaCheck,
  FaChevronLeft, FaAngleDoubleLeft, FaAngleDoubleRight
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
  showContractType?: boolean;
}

// ✅ SortKey étendu avec "service"
type SortKey = "matricule" | "nom" | "prenom" | "fonction" | "sexe" | "service";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Résolution robuste du service ───────────────────────────────────────────
// Inspecte tous les noms de champs possibles que le backend peut renvoyer,
// aligné sur la logique de AttendanceNormalesPage (departmentMap / projectMap)
function resolveService(emp: Employee): string {
  const raw =
    (emp as any).service            ??  // champ principal
    (emp as any).departement        ??  // parfois confondu côté backend
    (emp as any).department         ??  // variante anglaise
    (emp as any).sous_departement   ??  // variante possible
    (emp as any).division           ??  // autre variante
    null;
  return raw ? String(raw).toUpperCase() : "";
}

export default function EmployeesTable({
  employees,
  isLoading,
  onEdit,
  onExit,
  onReinstate,
  onImport,
  showContractType = true,
}: Props) {
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [accountLoading, setAccountLoading] = useState<number | null>(null);
  const [userFilter, setUserFilter] = useState<"all" | "with" | "without">("all");
  const [isExporting, setIsExporting] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipEmp, setPayslipEmp] = useState<Employee | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSendingCodes, setIsSendingCodes] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendScope, setSendScope] = useState<"selected" | "filtered" | "all">("selected");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row action modal
  const [rowOpen, setRowOpen] = useState(false);
  const [rowEmp, setRowEmp] = useState<Employee | null>(null);

  useEffect(() => {
    const q = search.toLowerCase();
    const base = employees.filter((e) => {
      const matchesUser =
        userFilter === "all" ? true : userFilter === "with" ? e.has_user : !e.has_user;
      const matchesSearch =
        e.matricule.toLowerCase().includes(q) ||
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        (e.email?.toLowerCase().includes(q) ?? false) ||
        // ✅ Recherche étendue au champ service (résolution robuste)
        resolveService(e).toLowerCase().includes(q);
      return matchesUser && matchesSearch;
    });

    let result = base;
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result = [...base].sort((a, b) => {
        // ✅ Tri sur "service" via résolution robuste
        const aVal = key === "service"
          ? resolveService(a)
          : ((a as any)[key] ?? "").toString().toLowerCase();
        const bVal = key === "service"
          ? resolveService(b)
          : ((b as any)[key] ?? "").toString().toLowerCase();
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFiltered(result);
    setCurrentPage(1);
  }, [search, employees, userFilter, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedEmployees = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const isAllSelected =
    paginatedEmployees.length > 0 && paginatedEmployees.every((e) => selectedIds.has(e.id));

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      !prev || prev.key !== key
        ? { key, direction: "asc" }
        : { key, direction: prev.direction === "asc" ? "desc" : "asc" }
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <FaSort className="text-xs opacity-60" />;
    return sortConfig.direction === "asc"
      ? <FaSortUp className="text-xs" />
      : <FaSortDown className="text-xs" />;
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (isAllSelected) paginatedEmployees.forEach((e) => n.delete(e.id));
      else paginatedEmployees.forEach((e) => n.add(e.id));
      return n;
    });
  };

  const goToPage = (page: number) => setCurrentPage(Math.min(Math.max(1, page), totalPages));

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const doSendCodes = async () => {
    setIsSendingCodes(true);
    const toastId = toast.loading("Envoi des codes en cours...");
    try {
      let matricules: string[] | undefined;
      if (sendScope === "selected") {
        if (selectedIds.size === 0) {
          toast.error("Aucun employé sélectionné", { id: toastId });
          setIsSendingCodes(false);
          return;
        }
        matricules = employees.filter((e) => selectedIds.has(e.id)).map((e) => e.matricule);
      } else if (sendScope === "filtered") {
        if (filtered.length === 0) {
          toast.error("Aucun employé dans la liste filtrée", { id: toastId });
          setIsSendingCodes(false);
          return;
        }
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

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsImporting(true);
    const toastId = toast.loading("Import en cours...");
    try {
      await onImport(file);
      toast.success("Import terminé avec succès", { id: toastId });
    } catch {
      toast.error("Erreur lors de l'import", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateAccount = async (emp: Employee) => {
    if (!emp.email) return toast.error("L'employé n'a pas d'email !");
    if (emp.status === "EXITED")
      return toast.error("Employé sorti : création de compte non autorisée.");
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
      return (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
          Sorti {e.date_sortie ? `· ${new Date(e.date_sortie).toLocaleDateString()}` : ""}
        </span>
      );
    if (e.status === "SUSPENDED")
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          Suspendu
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Actif
      </span>
    );
  };

  // ✅ Badge Service — badge violet avec truncate + tooltip natif sur hover
  const ServiceBadge = ({ emp }: { emp: Employee }) => {
    const value = resolveService(emp);
    if (!value) return <span className="text-slate-300 text-xs">—</span>;
    return (
      <span
        title={value}
        className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 max-w-[160px] truncate whitespace-nowrap"
      >
        {value}
      </span>
    );
  };

  const RowActionModal = () => {
    if (!rowEmp) return null;
    const isExited = rowEmp.status === "EXITED";
    const service  = resolveService(rowEmp);

    const rowActions = [
      { id: "edit",           icon: <FaEdit size={15} />,            label: "Modifier les informations",    color: "text-amber-600",    show: true },
      { id: "send-code",      icon: <FaPaperPlane size={15} />,      label: "Envoyer le code d'accès",      color: "text-emerald-600",  show: true },
      { id: "create-account", icon: <FaUserPlus size={15} />,        label: "Créer un accès utilisateur",   color: "text-blue-600",     show: !isExited },
      { id: "exit",           icon: <TbLogout size={15} />,          label: "Enregistrer la sortie",        color: "text-red-600",      show: !isExited },
      { id: "reinstate",      icon: <AiOutlineRollback size={15} />, label: "Réintégrer l'employé",         color: "text-camublue-900", show: isExited },
      { id: "payslip",        icon: <FaFilePdf size={15} />,         label: "Renvoyer un bulletin de paie", color: "text-purple-600",   show: true },
    ].filter((a) => a.show);

    const handleRowAction = (id: string) => {
      if (!rowEmp) return;
      if      (id === "edit")           { onEdit(rowEmp); setRowOpen(false); }
      else if (id === "send-code")      { doSendCodeSingle(rowEmp); }
      else if (id === "create-account") { handleCreateAccount(rowEmp); }
      else if (id === "exit")           { onExit(rowEmp); setRowOpen(false); }
      else if (id === "reinstate")      { onReinstate(rowEmp); setRowOpen(false); }
      else if (id === "payslip")        { setPayslipEmp(rowEmp); setPayslipOpen(true); setRowOpen(false); }
    };

    return (
      <div>
        <div className="mb-5 pb-4 border-b border-slate-100">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mb-1">Employé</p>
          <div className="font-bold text-slate-800 text-lg">{rowEmp.prenom} {rowEmp.nom}</div>
          <div className="text-xs text-slate-400">{rowEmp.matricule} · {rowEmp.fonction}</div>
          {/* ✅ Service affiché dans la modale si renseigné */}
          {service && (
            <div className="mt-2">
              <ServiceBadge emp={rowEmp} />
            </div>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {rowActions.map((action) => {
            const loading =
              (action.id === "create-account" && accountLoading === rowEmp.id) ||
              (action.id === "send-code" && isSendingCodes);
            return (
              <button
                key={action.id}
                onClick={() => handleRowAction(action.id)}
                disabled={loading}
                className="w-full flex items-center justify-between px-1 py-3 text-left group hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <span className={action.color}>{action.icon}</span>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium transition-colors">
                    {action.label}
                  </span>
                </div>
                {loading
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

  // ✅ colCount : +1 pour Service, +1 si showContractType
  const colCount = 12 + (showContractType ? 1 : 0);

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <Input
            placeholder="Rechercher par nom, prénom, matricule ou service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full bg-white border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-camublue-900"
          />
        </div>

        <div className="h-6 w-px bg-slate-200 shrink-0" />

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

        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition">
            <FaPaperPlane size={13} />
            Envoyer les codes
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"  leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute left-0 mt-2 w-64 origin-top-left rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none overflow-hidden z-20">
              <div className="py-1">
                {[
                  { scope: "selected" as const, label: `Aux sélectionnés (${selectedIds.size})` },
                  { scope: "filtered" as const, label: `À la liste filtrée (${filtered.length})` },
                  { scope: "all"      as const, label: "À tout le monde" },
                ].map(({ scope, label }) => (
                  <Menu.Item key={scope}>
                    {({ active }) => (
                      <button
                        onClick={() => { setSendScope(scope); setConfirmOpen(true); }}
                        className={`w-full text-left px-4 py-2.5 text-sm ${active ? "bg-slate-50" : ""}`}
                      >
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

        <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".xlsx" className="hidden" />
        <button
          onClick={handleImportClick}
          disabled={isImporting}
          className="bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2 transition shadow-sm"
        >
          {isImporting
            ? <ImSpinner2 className="animate-spin text-green-600" size={14} />
            : <FaFileExcel className="text-green-600" size={14} />}
          {isImporting ? "Importation..." : "Importer"}
        </button>

        <div className="h-6 w-px bg-slate-200 shrink-0" />

        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button
            disabled={isExporting}
            className="bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2 transition shadow-sm"
          >
            {isExporting
              ? <ImSpinner2 className="animate-spin" size={13} />
              : <FaFileExcel className="text-green-600" size={14} />}
            {isExporting ? "Export..." : "Exporter"}
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"  leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none overflow-hidden z-20">
              <div className="py-1">
                {[
                  ["ACTIVE", "Exporter les actifs"],
                  ["EXITED", "Exporter les sortis"],
                  ["ALL",    "Exporter tous"],
                ].map(([status, label]) => (
                  <Menu.Item key={status}>
                    {({ active }) => (
                      <button
                        onClick={() => handleExport(status as any)}
                        className={`w-full text-left px-4 py-2.5 text-sm ${active ? "bg-slate-50" : ""}`}
                      >
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

      {/* ── Tableau — min-w-max + overflow-auto pour la responsivité ── */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0">
        <table className="min-w-max w-full bg-white">
          <thead className="bg-camublue-900 text-white sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 border-b border-camublue-800">
                <input type="checkbox" checked={isAllSelected} onChange={toggleAllFiltered} />
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Statut
              </th>
              {(["matricule", "nom", "prenom", "sexe", "fonction"] as SortKey[]).map((col) => (
                <th key={col} className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort(col)}
                    className="flex items-center gap-1 select-none hover:opacity-80 transition-opacity"
                  >
                    {col === "prenom" ? "Prénom" : col.charAt(0).toUpperCase() + col.slice(1)}
                    {renderSortIcon(col)}
                  </button>
                </th>
              ))}

              {/* Type contrat — optionnel */}
              {showContractType && (
                <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                  Type contrat
                </th>
              )}

              {/* ✅ NOUVELLE COLONNE : Service — triable, largeur min garantie */}
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap min-w-[150px]">
                <button
                  type="button"
                  onClick={() => handleSort("service")}
                  className="flex items-center gap-1 select-none hover:opacity-80 transition-opacity"
                >
                  Service
                  {renderSortIcon("service")}
                </button>
              </th>

              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Date d'embauche
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Projet/Département
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Manager
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Email
              </th>
              <th className="px-4 py-3 text-center border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployees.map((emp) => (
              <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emp.id)}
                    onChange={() => toggleOne(emp.id)}
                  />
                </td>

                <td className="px-4 py-3 align-top">
                  <StatusBadge e={emp} />
                  {emp.status === "EXITED" && emp.motif_sortie && (
                    <div className="mt-1 rounded-md bg-red-50 border border-red-100 px-2 py-1 max-w-xs">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-0.5">
                        Motif
                      </span>
                      <p
                        className="text-xs text-red-700 overflow-hidden text-ellipsis whitespace-nowrap"
                        title={emp.motif_sortie}
                      >
                        {emp.motif_sortie}
                      </p>
                    </div>
                  )}
                </td>

                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.matricule}</td>
                <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{emp.nom}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.prenom}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {emp.sexe === "H" ? "Homme" : emp.sexe === "F" ? "Femme" : ""}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.fonction}</td>

                {/* Type contrat */}
                {showContractType && (
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border whitespace-nowrap ${
                        emp.type_contrat === "INTERIM"
                          ? "bg-orange-50 border-orange-200 text-orange-700"
                          : "bg-blue-50 border-blue-200 text-blue-700"
                      }`}
                    >
                      {emp.type_contrat || "—"}
                    </span>
                  </td>
                )}

                {/* ✅ NOUVELLE CELLULE : Service */}
                <td className="px-4 py-3">
                  <ServiceBadge emp={emp} />
                </td>

                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.date_embauche}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.projet}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.manager}</td>
                <td className="px-4 py-3 text-sm">{emp.email}</td>

                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => { setRowEmp(emp); setRowOpen(true); }}
                    className="inline-flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"
                  >
                    Gérer
                  </button>
                </td>
              </tr>
            ))}

            {paginatedEmployees.length === 0 && !isLoading && (
              <tr>
                <td colSpan={colCount} className="text-center py-12 text-slate-400 text-sm">
                  Aucun employé trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between px-1 gap-2 shrink-0">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} sur{" "}
              <span className="font-semibold text-slate-700">{filtered.length}</span> employé(s)
            </span>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span>Afficher</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-slate-300 rounded-md text-sm px-2 py-1 bg-white focus:ring-2 focus:ring-camublue-900 focus:outline-none shadow-sm"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span>par page</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => goToPage(1)} disabled={currentPage === 1}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <FaAngleDoubleLeft size={12} />
            </button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <FaChevronLeft size={12} />
            </button>
            <div className="flex items-center gap-1 mx-1">
              {getPageNumbers().map((page, i) =>
                page === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm select-none">…</span>
                ) : (
                  <button key={page} onClick={() => goToPage(page as number)}
                    className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                      currentPage === page ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <FaChevronRight size={12} />
            </button>
            <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <FaAngleDoubleRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal confirmation envoi codes ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Confirmer l'envoi des codes</h3>
            <p className="text-slate-600 mb-4">
              Portée :{" "}
              <span className="ml-1 font-medium">
                {sendScope === "selected"
                  ? `Sélectionnés (${selectedIds.size})`
                  : sendScope === "filtered"
                  ? `Liste filtrée (${filtered.length})`
                  : "Tous les employés"}
              </span>
            </p>
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 mb-4">
              Les destinataires recevront un email individuel contenant leur code d'accès permanent.
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} disabled={isSendingCodes}
                className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800">
                Annuler
              </button>
              <button onClick={doSendCodes} disabled={isSendingCodes}
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-2">
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setRowOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setRowOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
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