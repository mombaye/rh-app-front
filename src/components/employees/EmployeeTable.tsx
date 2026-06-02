import { useEffect, useState, useRef, Fragment } from "react";
import {
  FaEdit, FaFileExcel, FaUserPlus, FaPaperPlane,
  FaSort, FaSortUp, FaSortDown, FaFilePdf, FaHistory, FaBriefcase, FaExchangeAlt,
  FaSearch, FaTimes, FaChevronRight, FaArrowLeft, FaCheck,
  FaChevronLeft, FaAngleDoubleLeft, FaAngleDoubleRight, FaUsers, FaUserTimes, FaTrash,
} from "react-icons/fa";
import { TbLogout, TbPlane } from "react-icons/tb";
import { AiOutlineRollback } from "react-icons/ai";
import { motion, AnimatePresence } from "framer-motion";
import { Employee } from "@/types/employee";
import { createAccountFromEmployee, deleteAccountFromEmployee, sendAccessCodes } from "@/services/employeeService";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import { Menu, Transition } from "@headlessui/react";
import EmployeePayslipResendModal from "@/components/employees/EmployeePayslipResendModal";
import EmployeeHistoryModal from "@/components/employees/EmployeeHistoryModal";
import CareerHistoryModal from "@/components/employees/CareerHistoryModal";
import ContractChangeModal from "@/components/employees/ContractChangeModal";
import InterimTransferModal from "@/components/employees/InterimTransferModal";

interface Props {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onExit: (employee: Employee) => void;
  onReinstate: (employee: Employee) => void;
  onMission?: (employee: Employee) => void;
  onImport: (file: File) => void;
  onEmployeeUpdated?: (employee: Employee) => void;
  showContractType?: boolean;
}

type SortKey = "matricule" | "nom" | "prenom" | "fonction" | "service";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Colonnes export personnalisé employés ────────────────────────────────────
const EMP_EXPORT_COLS = [
  // ── Identité ──────────────────────────────────────────────────────────────
  { key: "Matricule",              label: "Matricule",                    group: "Identité"    },
  { key: "Nom",                    label: "Nom",                          group: "Identité"    },
  { key: "Prénom",                 label: "Prénom",                       group: "Identité"    },
  { key: "Genre",                  label: "Genre",                        group: "Identité"    },
  { key: "Date naissance",         label: "Date de naissance",            group: "Identité"    },
  // ── Contacts ──────────────────────────────────────────────────────────────
  { key: "Email",                  label: "Email",                        group: "Contacts"    },
  { key: "Téléphone",              label: "Téléphone",                    group: "Contacts"    },
  // ── Poste ─────────────────────────────────────────────────────────────────
  { key: "Fonction",               label: "Fonction",                     group: "Poste"       },
  { key: "Catégorie",              label: "Catégorie",                    group: "Poste"       },
  { key: "Service",                label: "Service",                      group: "Poste"       },
  { key: "Business Line",          label: "Business Line",                group: "Poste"       },
  { key: "Localisation",           label: "Localisation",                 group: "Poste"       },
  { key: "Manager",                label: "Manager",                      group: "Poste"       },
  // ── Contrat ───────────────────────────────────────────────────────────────
  { key: "Type contrat",           label: "Type de contrat",              group: "Contrat"     },
  { key: "Statut",                 label: "Statut",                       group: "Contrat"     },
  { key: "Date embauche",          label: "Date d'embauche",              group: "Contrat"     },
  { key: "Date fin CDD",           label: "Date de fin de CDD",           group: "Contrat"     },
  { key: "Fin période essai",      label: "Fin période d'essai",          group: "Contrat"     },
  { key: "Fin essai renouvellé",   label: "Fin période d'essai (renouv.)", group: "Contrat"    },
  // ── Sortie ────────────────────────────────────────────────────────────────
  { key: "Date sortie",            label: "Date de sortie",               group: "Sortie"      },
  { key: "Motif sortie",           label: "Motif de sortie",              group: "Sortie"      },
  // ── Ancienneté ────────────────────────────────────────────────────────────
  { key: "Ancienneté",             label: "Ancienneté (ans)",             group: "Ancienneté"  },
] as const;
type EmpExportColKey = typeof EMP_EXPORT_COLS[number]["key"];
const EMP_DEFAULT_COLS: EmpExportColKey[] = [
  "Matricule","Nom","Prénom","Email","Fonction","Service","Type contrat","Statut","Date embauche",
  "Date fin CDD","Fin période essai",
];

// ─── Export XLSX client-side employés ─────────────────────────────────────────
function exportEmployeesXLSX(employees: Employee[], selectedCols: EmpExportColKey[]) {
  if (!employees.length || !selectedCols.length) return;
  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" }); }
    catch { return d; }
  };
  // resolveService is defined below — call via inline logic here
  const getSvc = (e: Employee) =>
    String((e as any).service ?? (e as any).departement ?? (e as any).department ?? "").toUpperCase() || "—";

  const buildRow = (e: Employee): Record<EmpExportColKey, any> => ({
    // Identité
    "Matricule":              e.matricule ?? "—",
    "Nom":                    e.nom ?? "—",
    "Prénom":                 e.prenom ?? "—",
    "Genre":                  e.sexe === "H" ? "Homme" : e.sexe === "F" ? "Femme" : e.sexe ?? "—",
    "Date naissance":         fmtDate(e.date_naissance),
    // Contacts
    "Email":                  e.email ?? "—",
    "Téléphone":              e.telephone ?? "—",
    // Poste
    "Fonction":               e.fonction ?? "—",
    "Catégorie":              e.categorie ?? "—",
    "Service":                getSvc(e),
    "Business Line":          e.business_line ?? "—",
    "Localisation":           e.localisation ?? "—",
    "Manager":                e.n1_manager_name ?? e.manager ?? "—",
    // Contrat
    "Type contrat":           e.type_contrat ?? "—",
    "Statut":                 e.status === "ACTIVE" ? "Actif" : e.status === "EXITED" ? "Sorti" : e.status === "SUSPENDED" ? "Suspendu" : e.status ?? "—",
    "Date embauche":          fmtDate(e.date_embauche),
    "Date fin CDD":           fmtDate(e.date_fin_cdd),
    "Fin période essai":      fmtDate(e.date_fin_periode_essai),
    "Fin essai renouvellé":   fmtDate(e.date_fin_periode_essai_2),
    // Sortie
    "Date sortie":            fmtDate(e.date_sortie),
    "Motif sortie":           e.motif_sortie ?? "—",
    // Ancienneté
    "Ancienneté":             e.anciennete != null ? String(e.anciennete) : "—",
  });
  const rows = employees.map((e) =>
    Object.fromEntries(selectedCols.map((k) => [k, buildRow(e)[k]]))
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  // Largeurs optimisées par contenu
  ws["!cols"] = selectedCols.map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 3,
  }));

  // Gel de la première ligne d'en-tête
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, "Employés");
  XLSX.writeFile(wb, `employes_export_${new Date().toISOString().slice(0,10)}.xlsx`);
}

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
  onMission,
  onImport,
  onEmployeeUpdated,
  showContractType = true,
}: Props) {
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [accountLoading, setAccountLoading] = useState<number | null>(null);
  const [userFilter, setUserFilter] = useState<"all" | "with" | "without">("all");
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDlg, setShowExportDlg] = useState(false);
  const [exportCols,    setExportCols]    = useState<EmpExportColKey[]>([...EMP_DEFAULT_COLS]);
  const [exportStatus,  setExportStatus]  = useState<"ACTIVE" | "EXITED" | "ALL">("ALL");
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipEmp, setPayslipEmp] = useState<Employee | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEmp, setHistoryEmp] = useState<Employee | null>(null);
  const [careerOpen, setCareerOpen] = useState(false);
  const [careerEmp, setCareerEmp] = useState<Employee | null>(null);
  const [contractChangeOpen, setContractChangeOpen] = useState(false);
  const [contractChangeEmp, setContractChangeEmp] = useState<Employee | null>(null);
  const [interimTransferOpen, setInterimTransferOpen] = useState(false);
  const [interimTransferEmp, setInterimTransferEmp] = useState<Employee | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSendingCodes, setIsSendingCodes] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendScope, setSendScope] = useState<"selected" | "filtered" | "all">("selected");
  const [createAccountConfirmEmp, setCreateAccountConfirmEmp] = useState<Employee | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string; empName: string } | null>(null);
  const [selectedManagerLevel, setSelectedManagerLevel] = useState<0 | 1 | 2>(0);
  const [deleteAccountConfirmEmp, setDeleteAccountConfirmEmp] = useState<Employee | null>(null);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

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

  const handleCreateAccount = (emp: Employee) => {
    if (!emp.email) return toast.error("L'employé n'a pas d'email !");
    if (emp.status === "EXITED")
      return toast.error("Employé sorti : création de compte non autorisée.");
    if (emp.has_user)
      return toast.error("Un compte utilisateur existe déjà pour cet employé.");
    setRowOpen(false);
    // Auto-détecter le niveau manager à proposer par défaut.
    // N2 a la priorité : un manager qui a des managers sous lui est plus senior.
    const n1 = emp.manages_n1_count ?? 0;
    const n2 = emp.manages_n2_count ?? 0;
    if (n2 > 0) setSelectedManagerLevel(2);
    else if (n1 > 0) setSelectedManagerLevel(1);
    else setSelectedManagerLevel(0);
    setCreateAccountConfirmEmp(emp);
  };

  const doCreateAccount = async (emp: Employee) => {
    setAccountLoading(emp.id);
    try {
      const ml = selectedManagerLevel > 0 ? (selectedManagerLevel as 1 | 2) : undefined;
      const res = await createAccountFromEmployee(emp.id, ml);
      if (res.warning) {
        toast.success(`Compte créé pour ${emp.prenom} ${emp.nom}`);
        // Email échoué : afficher les identifiants dans une modale pour communication manuelle
        if (res.password) {
          setCreatedCredentials({ username: res.username, password: res.password, empName: `${emp.prenom} ${emp.nom}` });
        } else {
          toast.error(`Attention : ${res.warning}`, { duration: 6000 });
        }
      } else {
        toast.success(`Compte créé et identifiants envoyés à ${emp.email} !`);
      }
      setCreateAccountConfirmEmp(null);
      // Mise à jour immédiate : l'employé a maintenant un compte
      setFiltered(prev =>
        prev.map(e => e.id === emp.id ? { ...e, has_user: true } : e)
      );
      onEmployeeUpdated?.({ ...emp, has_user: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de la création du compte");
    } finally {
      setAccountLoading(null);
    }
  };

  const handleDeleteAccount = (emp: Employee) => {
    if (!emp.has_user) return toast.error("Cet employé n'a pas de compte utilisateur.");
    setRowOpen(false);
    setDeleteAccountConfirmEmp(emp);
  };

  const doDeleteAccount = async (emp: Employee) => {
    setDeleteAccountLoading(true);
    try {
      await deleteAccountFromEmployee(emp.id);
      toast.success(`Compte supprimé pour ${emp.prenom} ${emp.nom}`);
      setDeleteAccountConfirmEmp(null);
      // Mise à jour immédiate du tableau : disparaît si filtre "Avec compte",
      // sinon on reflète has_user=false sans attendre le refetch parent.
      setFiltered(prev =>
        userFilter === "with"
          ? prev.filter(e => e.id !== emp.id)
          : prev.map(e => e.id === emp.id ? { ...e, has_user: false, user_id: null } : e)
      );
      onEmployeeUpdated?.({ ...emp, has_user: false, user_id: null });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de la suppression du compte");
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const doExport = () => {
    const toExport = exportStatus === "ALL"
      ? filtered
      : filtered.filter((e) => e.status === exportStatus);
    exportEmployeesXLSX(toExport, exportCols);
    setShowExportDlg(false);
    toast.success(`${toExport.length} employé(s) exporté(s) ✓`);
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
    if (e.on_mission)
      return (
        <span
          title={e.mission_label || "En mission"}
          className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
        >
          En Mission
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
      { id: "edit",            icon: <FaEdit size={15} />,            label: "Modifier les informations",    color: "text-amber-600",    show: true },
      { id: "contract-change", icon: <FaExchangeAlt size={15} />,     label: "Mutation contractuelle",       color: "text-orange-600",   show: !isExited },
      { id: "interim-transfer", icon: <FaExchangeAlt size={15} />,    label: "Basculement intérimaire",      color: "text-violet-600",   show: !isExited && rowEmp.type_contrat === "INTERIM" },
      { id: "career",          icon: <FaBriefcase size={15} />,       label: "Parcours de carrière",         color: "text-teal-600",     show: true },
      { id: "history",         icon: <FaHistory size={15} />,         label: "Voir l'historique des modifs", color: "text-indigo-600",   show: true },
      { id: "send-code",       icon: <FaPaperPlane size={15} />,      label: "Envoyer le code d'accès",      color: "text-emerald-600",  show: true },
      { id: "create-account",  icon: <FaUserPlus size={15} />,    label: "Créer un accès utilisateur",    color: "text-blue-600",  show: !isExited && !rowEmp.has_user },
      { id: "delete-account",  icon: <FaUserTimes size={15} />,  label: "Supprimer le compte utilisateur", color: "text-red-500",  show: !!rowEmp.has_user },
      { id: "mission",         icon: <TbPlane size={15} />,           label: rowEmp.on_mission ? "Gérer la mission" : "Définir en mission", color: "text-indigo-600", show: !isExited },
      { id: "exit",            icon: <TbLogout size={15} />,          label: "Enregistrer la sortie",        color: "text-red-600",      show: !isExited },
      { id: "reinstate",       icon: <AiOutlineRollback size={15} />, label: "Réintégrer l'employé",         color: "text-camublue-900", show: isExited },
      { id: "payslip",         icon: <FaFilePdf size={15} />,         label: "Renvoyer un bulletin de paie", color: "text-purple-600",   show: true },
    ].filter((a) => a.show);

    const handleRowAction = (id: string) => {
      if (!rowEmp) return;
      if      (id === "edit")            { onEdit(rowEmp); setRowOpen(false); }
      else if (id === "contract-change") { setContractChangeEmp(rowEmp); setContractChangeOpen(true); setRowOpen(false); }
      else if (id === "interim-transfer") { setInterimTransferEmp(rowEmp); setInterimTransferOpen(true); setRowOpen(false); }
      else if (id === "career")          { setCareerEmp(rowEmp); setCareerOpen(true); setRowOpen(false); }
      else if (id === "history")         { setHistoryEmp(rowEmp); setHistoryOpen(true); setRowOpen(false); }
      else if (id === "send-code")       { doSendCodeSingle(rowEmp); }
      else if (id === "create-account")  { handleCreateAccount(rowEmp); }
      else if (id === "delete-account")  { handleDeleteAccount(rowEmp); }
      else if (id === "mission")         { onMission?.(rowEmp); setRowOpen(false); }
      else if (id === "exit")            { onExit(rowEmp); setRowOpen(false); }
      else if (id === "reinstate")       { onReinstate(rowEmp); setRowOpen(false); }
      else if (id === "payslip")         { setPayslipEmp(rowEmp); setPayslipOpen(true); setRowOpen(false); }
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

  const colCount = 13 + (showContractType ? 1 : 0);

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

        <button
          onClick={() => setShowExportDlg(true)}
          className="bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 inline-flex items-center gap-2 transition shadow-sm"
        >
          <FaFileExcel className="text-green-600" size={14} />
          Exporter
        </button>
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
              {(["matricule", "nom", "prenom", "fonction"] as SortKey[]).map((col) => (
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
                  Contrat
                </th>
              )}

              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Date d'embauche
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Projet
              </th>

              {/* Service — triable */}
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap min-w-[130px]">
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
                Manager
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Email
              </th>
              <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                Téléphone
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
                <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {emp.nom}
                    {emp.is_dg && (
                      <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full leading-none">DG</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.prenom}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.fonction || <span className="text-slate-300">—</span>}</td>

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

                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.date_embauche || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.projet || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3">
                  <ServiceBadge emp={emp} />
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {(() => {
                    const fromHierarchy = emp.n1_manager_name;
                    const display = fromHierarchy || emp.manager;
                    if (!display) return (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium italic">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        Non défini
                      </span>
                    );
                    return (
                      <div className="flex items-center gap-1.5 min-w-0">
                        {fromHierarchy && (
                          <span
                            title="Manager défini dans la hiérarchie"
                            className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400"
                          />
                        )}
                        <span className="truncate max-w-[150px]" title={display}>{display}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-sm">{emp.email || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{emp.telephone || <span className="text-slate-300">—</span>}</td>

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

      <EmployeeHistoryModal
        open={historyOpen}
        employee={historyEmp}
        onClose={() => { setHistoryOpen(false); setHistoryEmp(null); }}
      />

      <CareerHistoryModal
        open={careerOpen}
        employee={careerEmp}
        onClose={() => { setCareerOpen(false); setCareerEmp(null); }}
      />

      <ContractChangeModal
        open={contractChangeOpen}
        employee={contractChangeEmp}
        onClose={() => { setContractChangeOpen(false); setContractChangeEmp(null); }}
        onSuccess={(updatedEmp) => {
          setContractChangeOpen(false);
          setContractChangeEmp(null);
          if (onEmployeeUpdated) onEmployeeUpdated(updatedEmp);
        }}
      />

      <InterimTransferModal
        open={interimTransferOpen}
        employee={interimTransferEmp}
        onClose={() => { setInterimTransferOpen(false); setInterimTransferEmp(null); }}
        onSuccess={(updatedEmp) => {
          setInterimTransferOpen(false);
          setInterimTransferEmp(null);
          if (onEmployeeUpdated) onEmployeeUpdated(updatedEmp);
        }}
      />

      {/* ── Confirmation création de compte utilisateur ── */}
      <AnimatePresence>
        {createAccountConfirmEmp && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
            onClick={() => setCreateAccountConfirmEmp(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 shrink-0">
                  <FaUserPlus className="text-white" size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Créer un accès utilisateur</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {createAccountConfirmEmp.prenom} {createAccountConfirmEmp.nom} · {createAccountConfirmEmp.matricule}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Un compte de connexion va être créé pour cet employé. Les identifiants générés seront envoyés automatiquement à :
                </p>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <span className="text-blue-700 font-mono font-semibold text-sm">{createAccountConfirmEmp.email}</span>
                </div>

                {/* ── Détection manager automatique ── */}
                {((createAccountConfirmEmp.manages_n1_count ?? 0) > 0 || (createAccountConfirmEmp.manages_n2_count ?? 0) > 0) && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FaUsers className="text-purple-600 shrink-0" size={14} />
                      <p className="text-sm font-semibold text-purple-800">
                        Cet employé manage{" "}
                        {(createAccountConfirmEmp.manages_n1_count ?? 0) + (createAccountConfirmEmp.manages_n2_count ?? 0)}{" "}
                        personne(s)
                      </p>
                    </div>
                    <p className="text-xs text-purple-600 leading-relaxed">
                      Choisissez le type d'accès à créer. Avec le double accès, il pourra se connecter en tant qu'Employé <strong>et</strong> en tant que Manager avec les mêmes identifiants.
                    </p>

                    <div className="space-y-2 pt-1">
                      {/* Employé seulement */}
                      <button
                        type="button"
                        onClick={() => setSelectedManagerLevel(0)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                          selectedManagerLevel === 0
                            ? "border-slate-400 bg-white shadow-sm"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition ${selectedManagerLevel === 0 ? "border-slate-500" : "border-slate-300"}`}>
                          {selectedManagerLevel === 0 && <div className="w-2 h-2 rounded-full bg-slate-500" />}
                        </div>
                        <span className="text-sm font-medium text-slate-700">Espace Employé uniquement</span>
                      </button>

                      {/* N1 */}
                      {(createAccountConfirmEmp.manages_n1_count ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedManagerLevel(1)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                            selectedManagerLevel === 1
                              ? "border-purple-500 bg-white shadow-sm"
                              : "border-slate-200 bg-white hover:bg-purple-50/40"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition ${selectedManagerLevel === 1 ? "border-purple-500" : "border-slate-300"}`}>
                            {selectedManagerLevel === 1 && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-slate-800">Employé + Manager Niveau 1</span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({createAccountConfirmEmp.manages_n1_count} managé(s))
                            </span>
                          </div>
                        </button>
                      )}

                      {/* N2 */}
                      {(createAccountConfirmEmp.manages_n2_count ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedManagerLevel(2)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                            selectedManagerLevel === 2
                              ? "border-violet-500 bg-white shadow-sm"
                              : "border-slate-200 bg-white hover:bg-violet-50/40"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition ${selectedManagerLevel === 2 ? "border-violet-500" : "border-slate-300"}`}>
                            {selectedManagerLevel === 2 && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-slate-800">Employé + Manager Niveau 2</span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({createAccountConfirmEmp.manages_n2_count} managé(s))
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <strong>Email envoyé :</strong> Bienvenue sur la plateforme + identifiant + mot de passe provisoire.<br />
                    L'employé devra changer son mot de passe à la première connexion.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={() => setCreateAccountConfirmEmp(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  disabled={accountLoading === createAccountConfirmEmp.id}
                  onClick={() => doCreateAccount(createAccountConfirmEmp)}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-60"
                >
                  {accountLoading === createAccountConfirmEmp.id
                    ? <><ImSpinner2 className="animate-spin" size={14} /> Création…</>
                    : <><FaUserPlus size={13} /> Créer & envoyer</>
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Credentials Dialog (email failed) ── */}
        {createdCredentials && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
            onClick={() => setCreatedCredentials(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 shrink-0">
                  <FaUserPlus className="text-white" size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Compte créé — email non envoyé</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{createdCredentials.empName}</p>
                </div>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    L'email n'a pas pu être envoyé. Communiquez ces identifiants à l'employé par un autre moyen.
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Identifiant</span>
                    <span className="font-mono font-semibold text-camublue-900 text-sm">{createdCredentials.username}</span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Mot de passe provisoire</span>
                    <span className="font-mono font-bold text-camublue-900 bg-white border border-slate-300 rounded px-2 py-0.5 text-sm tracking-wider">{createdCredentials.password}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">L'employé devra changer son mot de passe à la première connexion.</p>
              </div>
              <div className="px-6 pb-5">
                <button
                  onClick={() => setCreatedCredentials(null)}
                  className="w-full py-2.5 bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold rounded-xl transition"
                >
                  Compris, fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}

      {/* ── Confirmation suppression de compte utilisateur ── */}
      <AnimatePresence>
        {deleteAccountConfirmEmp && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
            onClick={() => !deleteAccountLoading && setDeleteAccountConfirmEmp(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-600 shrink-0">
                  <FaUserTimes className="text-white" size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Supprimer le compte utilisateur</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {deleteAccountConfirmEmp.prenom} {deleteAccountConfirmEmp.nom} · {deleteAccountConfirmEmp.matricule}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <FaTrash className="text-red-500 mt-0.5 shrink-0" size={13} />
                  <p className="text-sm text-red-700 leading-relaxed">
                    Cette action supprimera définitivement le compte de connexion de{" "}
                    <strong>{deleteAccountConfirmEmp.prenom} {deleteAccountConfirmEmp.nom}</strong>.
                    L'employé perdra tout accès à la plateforme.
                  </p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Les données de l'employé (fiche, contrat, historique) seront conservées. Seul l'accès utilisateur sera révoqué. Un nouveau compte pourra être recréé ultérieurement.
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={() => setDeleteAccountConfirmEmp(null)}
                  disabled={deleteAccountLoading}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => doDeleteAccount(deleteAccountConfirmEmp)}
                  disabled={deleteAccountLoading}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleteAccountLoading ? (
                    <ImSpinner2 className="animate-spin" size={15} />
                  ) : (
                    <FaTrash size={12} />
                  )}
                  {deleteAccountLoading ? "Suppression…" : "Supprimer le compte"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Export Dialog ── */}
      <AnimatePresence>
        {showExportDlg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="font-black text-camublue-900 text-base">Export personnalisé</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Sélectionnez le périmètre et les colonnes à inclure</p>
                </div>
                <button onClick={() => setShowExportDlg(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Périmètre */}
              <div className="px-5 pt-4 pb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Périmètre</p>
                <div className="flex gap-2">
                  {([["ALL","Tous"],["ACTIVE","Actifs"],["EXITED","Sortis"]] as const).map(([s, l]) => (
                    <button key={s} onClick={() => setExportStatus(s)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        exportStatus === s
                          ? "bg-camublue-900 text-white border-camublue-900"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colonnes */}
              <div className="px-5 py-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-semibold text-slate-500">
                    {exportCols.length}/{EMP_EXPORT_COLS.length} colonnes sélectionnées
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setExportCols(EMP_EXPORT_COLS.map((c) => c.key))}
                      className="text-xs text-camublue-700 hover:underline font-medium">Tout</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setExportCols([])}
                      className="text-xs text-slate-500 hover:underline font-medium">Aucun</button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1 space-y-4">
                  {Array.from(new Set(EMP_EXPORT_COLS.map((c) => c.group))).map((group) => {
                    const groupCols = EMP_EXPORT_COLS.filter((c) => c.group === group);
                    const allChecked = groupCols.every((c) => exportCols.includes(c.key));
                    return (
                      <div key={group}>
                        {/* En-tête groupe + toggle tout le groupe */}
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group}</p>
                          <button
                            onClick={() =>
                              setExportCols((prev) =>
                                allChecked
                                  ? prev.filter((k) => !groupCols.some((c) => c.key === k))
                                  : [...new Set([...prev, ...groupCols.map((c) => c.key)])]
                              )
                            }
                            className="text-[10px] text-camublue-700 hover:underline font-semibold"
                          >
                            {allChecked ? "Désélectionner" : "Tout sélectionner"}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {groupCols.map((col) => {
                            const checked = exportCols.includes(col.key);
                            return (
                              <label key={col.key}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition text-xs ${
                                  checked
                                    ? "bg-camublue-50 border-camublue-200 text-camublue-800"
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}>
                                <input type="checkbox" checked={checked} onChange={() => {
                                  setExportCols((prev) =>
                                    prev.includes(col.key) ? prev.filter((k) => k !== col.key) : [...prev, col.key]
                                  );
                                }} className="accent-camublue-700 w-3 h-3 shrink-0" />
                                <span className="font-medium leading-tight">{col.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setShowExportDlg(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                  Annuler
                </button>
                <button onClick={doExport} disabled={exportCols.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-bold hover:bg-camublue-800 disabled:opacity-50 transition">
                  <FaFileExcel className="text-green-300" size={13} />
                  Télécharger
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}