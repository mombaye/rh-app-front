import { useEffect, useState, useCallback, Fragment, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminAuth } from "@/contexts/useAdminAuth";
import AdminLayout from "@/layouts/AdminLayout";
import {
  getAdminStats,
  getAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  resetAdminPassword,
  toggleAdminActive,
  getAccountHistory,
  type AdminUser,
  type AdminStats,
  type AccountHistoryEntry,
} from "@/services/adminService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import * as XLSX from "xlsx";
import SharedConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import {
  Users,
  UserCheck,
  ShieldCheck,
  Search,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  X,
  Download,
  Upload,
  Activity,
  History,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "employee" | "rh" | "manager";

type UserForm = {
  username: string;
  email: string;
  password: string;
  role: "employee" | "rh" | "manager1" | "manager2";
  is_active: boolean;
};

const EMPTY_FORM: UserForm = {
  username: "",
  email: "",
  password: "",
  role: "employee",
  is_active: true,
};

function formToPayload(form: UserForm) {
  const base: Record<string, unknown> = {
    username: form.username,
    email: form.email,
    is_staff: form.role === "rh",
    is_planning_manager: false,
    manager_level: form.role === "manager1" ? 1 : form.role === "manager2" ? 2 : null,
    is_active: form.is_active,
  };
  if (form.password) base.password = form.password;
  return base;
}

function roleLabel(u: AdminUser) {
  const parts: string[] = [];
  if (u.is_staff) parts.push("RH");
  if (u.manager_level === 1) parts.push("Manager N1");
  if (u.manager_level === 2) parts.push("Manager N2");
  // Double accès : RH ou Manager qui a aussi une fiche employé (service=RH)
  if (u.employee_name && parts.length > 0) parts.push("Employé");
  if (parts.length === 0) parts.push("Employé");
  return parts.join(" + ");
}

// ─── Export columns definition ────────────────────────────────────────────────

const EXPORT_COLS = [
  { key: "username",      label: "Nom d'utilisateur" },
  { key: "email",         label: "Email"             },
  { key: "role",          label: "Rôle"              },
  { key: "status",        label: "Statut"            },
  { key: "employee_name", label: "Employé lié"       },
  { key: "first_login",   label: "Première connexion"},
] as const;

type ExportColKey = typeof EXPORT_COLS[number]["key"];

const DEFAULT_EXPORT_COLS: ExportColKey[] = ["username", "email", "role", "status"];

type ExportScope = "all" | "employee" | "rh" | "manager1" | "manager2";

const EXPORT_SCOPES: { value: ExportScope; label: string }[] = [
  { value: "all",      label: "Tous les comptes"   },
  { value: "employee", label: "Employés"            },
  { value: "rh",       label: "Comptes RH"         },
  { value: "manager1", label: "Managers Niveau 1"  },
  { value: "manager2", label: "Managers Niveau 2"  },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="shadow-sm border-0">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-camublue-900">{value ?? "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ onClose }: { onClose: () => void }) {
  const [selectedCols, setSelectedCols] = useState<ExportColKey[]>(DEFAULT_EXPORT_COLS);
  const [scope, setScope] = useState<ExportScope>("all");
  const [loading, setLoading] = useState(false);

  const toggleCol = (key: ExportColKey) =>
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const handleExport = async () => {
    if (!selectedCols.length) {
      toast.error("Sélectionnez au moins une colonne.");
      return;
    }
    setLoading(true);
    try {
      const role = scope === "all" ? undefined : scope;
      const users = await getAdminAccounts({ role });

      const rows = users.map((u) => {
        const row: Record<string, string> = {};
        if (selectedCols.includes("username"))      row["Nom d'utilisateur"] = u.username;
        if (selectedCols.includes("email"))         row["Email"]             = u.email || "—";
        if (selectedCols.includes("role"))          row["Rôle"]              = roleLabel(u);
        if (selectedCols.includes("status"))        row["Statut"]            = u.is_active ? "Actif" : "Inactif";
        if (selectedCols.includes("employee_name")) row["Employé lié"]       = u.employee_name || "—";
        if (selectedCols.includes("first_login"))   row["Première connexion"]= u.first_login ? "Oui" : "Non";
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Comptes");
      XLSX.writeFile(wb, `comptes_admin_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length} compte(s) exporté(s).`);
      onClose();
    } catch {
      toast.error("Erreur lors de l'export.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-camublue-900">Exporter les comptes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Scope */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Périmètre</p>
          <div className="relative">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ExportScope)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-camublue-900"
            >
              {EXPORT_SCOPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Columns */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Colonnes à inclure</p>
          <div className="grid grid-cols-2 gap-2">
            {EXPORT_COLS.map((col) => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                <input
                  type="checkbox"
                  checked={selectedCols.includes(col.key)}
                  onChange={() => toggleCol(col.key)}
                  className="accent-camublue-900 w-4 h-4"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition">
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={loading || !selectedCols.length}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 text-sm transition disabled:opacity-60"
          >
            <Download size={15} />
            {loading ? "Export..." : "Exporter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

const IMPORT_ROLE_OPTIONS: { value: UserForm["role"]; label: string }[] = [
  { value: "employee", label: "Employé" },
  { value: "rh",       label: "Compte RH" },
  { value: "manager1", label: "Manager Niveau 1" },
  { value: "manager2", label: "Manager Niveau 2" },
];

type ImportRow = { username: string; email: string; password: string; role: UserForm["role"] };

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ ok: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const parsed: ImportRow[] = data.map((r) => ({
          username: String(r["Nom d'utilisateur"] || r["username"] || ""),
          email:    String(r["Email"]             || r["email"]    || ""),
          password: String(r["Mot de passe"]      || r["password"] || ""),
          role: (["employee","rh","manager1","manager2"].includes(r["role"] as string)
            ? r["role"] as UserForm["role"]
            : "employee"),
        }));
        setRows(parsed.filter((r) => r.username));
      } catch {
        toast.error("Impossible de lire le fichier. Vérifiez le format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setLoading(true);
    let ok = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        await createAdminAccount(formToPayload({ ...row, is_active: true }) as any);
        ok++;
      } catch (err: any) {
        const msg = err?.response?.data
          ? Object.values(err.response.data).flat().join(" ")
          : "Erreur inconnue";
        errors.push(`${row.username}: ${msg}`);
      }
    }
    setLoading(false);
    setResults({ ok, errors });
    if (ok > 0) onDone();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      "Nom d'utilisateur": "jdupont",
      "Email": "j.dupont@camusat.com",
      "Mot de passe": "MotDePasse123!",
      "role": "employee",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comptes");
    XLSX.writeFile(wb, "modele_import_comptes.xlsx");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-camublue-900">Importer des comptes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Template download */}
        <div className="mb-4 p-3 bg-camublue-900/5 rounded-xl flex items-center justify-between">
          <p className="text-xs text-gray-600">
            Colonnes attendues : <span className="font-medium">Nom d'utilisateur, Email, Mot de passe, role</span>
          </p>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs text-camublue-900 font-semibold hover:underline shrink-0 ml-3"
          >
            <Download size={13} />
            Modèle
          </button>
        </div>

        {/* File picker */}
        <div className="mb-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-500 hover:border-camublue-900/40 hover:text-camublue-900 transition"
          >
            <Upload size={18} />
            {fileName ? fileName : "Choisir un fichier Excel (.xlsx)"}
          </button>
        </div>

        {/* Preview */}
        {rows.length > 0 && !results && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">{rows.length} ligne(s) détectée(s)</p>
            <div className="max-h-36 overflow-y-auto border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Utilisateur</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Email</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-semibold">Rôle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-3 py-1.5 text-gray-700 font-medium">{r.username}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.email || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {IMPORT_ROLE_OPTIONS.find((o) => o.value === r.role)?.label ?? r.role}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                {results.ok} créé(s)
              </span>
              {results.errors.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold">
                  {results.errors.length} erreur(s)
                </span>
              )}
            </div>
            {results.errors.length > 0 && (
              <div className="max-h-28 overflow-y-auto bg-red-50 rounded-lg p-3 text-xs text-red-600 space-y-1">
                {results.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition">
            {results ? "Fermer" : "Annuler"}
          </button>
          {!results && (
            <button
              onClick={handleImport}
              disabled={loading || !rows.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 text-sm transition disabled:opacity-60"
            >
              <Upload size={15} />
              {loading ? "Import en cours..." : `Importer ${rows.length > 0 ? `(${rows.length})` : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── User Modal (Create / Edit) ───────────────────────────────────────────────

function UserModal({
  mode,
  user,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  user: AdminUser | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<UserForm>(() => {
    if (mode === "edit" && user) {
      return {
        username: user.username,
        email: user.email,
        password: "",
        role: user.is_staff
          ? "rh"
          : user.manager_level === 1
          ? "manager1"
          : user.manager_level === 2
          ? "manager2"
          : "employee",
        is_active: user.is_active,
      };
    }
    return EMPTY_FORM;
  });
  const [loading, setLoading] = useState(false);

  const setField = <K extends keyof UserForm>(k: K, v: UserForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create" && !form.password) {
      toast.error("Le mot de passe est requis à la création.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "create") {
        await createAdminAccount(formToPayload(form) as any);
        toast.success("Compte créé avec succès.");
      } else if (user) {
        await updateAdminAccount(user.id, formToPayload(form) as any);
        toast.success("Compte mis à jour.");
      }
      onSave();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join(" ")
        : "Erreur lors de l'enregistrement.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-camublue-900">
            {mode === "create" ? "Créer un compte" : "Modifier le compte"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Nom d'utilisateur</label>
            <Input value={form.username} onChange={(e) => setField("username", e.target.value)} required placeholder="ex: jdupont" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required placeholder="ex: j.dupont@camusat.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Mot de passe{" "}
              {mode === "edit" && <span className="text-gray-400 font-normal">(laisser vide pour ne pas changer)</span>}
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              required={mode === "create"}
              placeholder={mode === "create" ? "Mot de passe" : "Nouveau mot de passe"}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Rôle</label>
            <div className="relative">
              <select
                value={form.role}
                onChange={(e) => setField("role", e.target.value as UserForm["role"])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-camublue-900"
              >
                <option value="employee">Employé</option>
                <option value="rh">Compte RH</option>
                <option value="manager1">Manager Niveau 1</option>
                <option value="manager2">Manager Niveau 2</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setField("is_active", e.target.checked)} className="accent-camublue-900 w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">Compte actif</span>
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 text-sm transition disabled:opacity-60">
              {loading ? "Enregistrement..." : mode === "create" ? "Créer" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      await resetAdminPassword(user.id, password);
      toast.success("Mot de passe réinitialisé.");
      onSave();
      onClose();
    } catch {
      toast.error("Erreur lors de la réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-camublue-900">Réinitialiser le mot de passe</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-5">Compte : <span className="font-medium text-gray-700">{user.username}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="password" placeholder="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 text-sm transition disabled:opacity-60">
              {loading ? "..." : "Réinitialiser"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  created:        "bg-green-100 text-green-700",
  updated:        "bg-blue-100 text-blue-700",
  password_reset: "bg-amber-100 text-amber-700",
  activated:      "bg-emerald-100 text-emerald-700",
  deactivated:    "bg-red-100 text-red-600",
  deleted:        "bg-gray-100 text-gray-600",
};

function HistoryModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<AccountHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccountHistory(user.id)
      .then(setEntries)
      .catch(() => toast.error("Impossible de charger l'historique."))
      .finally(() => setLoading(false));
  }, [user.id]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-camublue-900">
              <History size={17} />
              <h2 className="text-base font-bold">Historique du compte</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{user.username}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Aucun historique disponible.
            </div>
          ) : (
            <ol className="relative border-l border-gray-200 ml-2 space-y-0">
              {entries.map((entry) => (
                <li key={entry.id} className="mb-6 ml-5">
                  {/* Timeline dot */}
                  <span className="absolute -left-2 flex items-center justify-center w-4 h-4 bg-white border-2 border-camublue-900/30 rounded-full mt-1" />

                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-600"}`}>
                      {entry.action_label}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(entry.timestamp)}</span>
                  </div>

                  <p className="text-xs text-gray-500">
                    Par <span className="font-medium text-gray-700">{entry.changed_by_username}</span>
                  </p>

                  {/* Details */}
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-xs space-y-1">
                      {entry.details.modifications ? (
                        Object.entries(entry.details.modifications).map(([field, diff]: [string, any]) => (
                          <div key={field} className="flex items-start gap-1 text-gray-600">
                            <span className="font-medium shrink-0">{field} :</span>
                            <span className="line-through text-red-400">{diff.avant}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-600">{diff.après}</span>
                          </div>
                        ))
                      ) : (
                        Object.entries(entry.details).map(([k, v]) => (
                          <div key={k} className="text-gray-600">
                            <span className="font-medium">{k} :</span> {String(v)}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Gérer Modal ──────────────────────────────────────────────────────────────

function GererModal({
  user,
  onClose,
  onEdit,
  onResetPwd,
  onDelete,
  onToggle,
  onHistory,
}: {
  user: AdminUser;
  onClose: () => void;
  onEdit: (u: AdminUser) => void;
  onResetPwd: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  onToggle: (u: AdminUser) => void;
  onHistory: (u: AdminUser) => void;
}) {
  const actions = [
    {
      id: "history",
      icon: <History size={15} />,
      label: "Voir l'historique",
      color: "text-indigo-600",
      onClick: () => { onHistory(user); onClose(); },
    },
    {
      id: "edit",
      icon: <Pencil size={15} />,
      label: "Modifier les informations",
      color: "text-amber-600",
      onClick: () => { onEdit(user); onClose(); },
    },
    {
      id: "reset",
      icon: <KeyRound size={15} />,
      label: "Réinitialiser le mot de passe",
      color: "text-blue-600",
      onClick: () => { onResetPwd(user); onClose(); },
    },
    {
      id: "toggle",
      icon: user.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />,
      label: user.is_active ? "Désactiver le compte" : "Activer le compte",
      color: user.is_active ? "text-gray-500" : "text-emerald-600",
      onClick: () => { onToggle(user); onClose(); },
    },
    {
      id: "delete",
      icon: <Trash2 size={15} />,
      label: "Supprimer le compte",
      color: "text-red-600",
      onClick: () => { onDelete(user); onClose(); },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100">
          <X size={14} />
        </button>

        {/* User header */}
        <div className="mb-5 pb-4 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-1">Compte</p>
          <div className="font-bold text-gray-800 text-lg">{user.username}</div>
          <div className="text-xs text-gray-400 mt-0.5">{user.email || "—"}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-camublue-900/10 text-camublue-900">
              {roleLabel(user)}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {user.is_active ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>

        {/* Actions list */}
        <div className="divide-y divide-gray-50">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className="w-full flex items-center justify-between px-1 py-3 text-left group hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={action.color}>{action.icon}</span>
                <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium transition-colors">
                  {action.label}
                </span>
              </div>
              <ChevronRight size={10} className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── User Table ───────────────────────────────────────────────────────────────

function UserTable({
  users,
  tab,
  onGerer,
}: {
  users: AdminUser[];
  tab: Tab;
  onGerer: (u: AdminUser) => void;
}) {
  if (users.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">Aucun compte trouvé.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-4 py-3 font-semibold text-gray-500">Utilisateur</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500">Email</th>
            {tab === "employee" && (
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Employé lié</th>
            )}
            {tab === "manager" && (
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Niveau</th>
            )}
            <th className="text-left px-4 py-3 font-semibold text-gray-500">Statut</th>
            <th className="text-center px-4 py-3 font-semibold text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
              <td className="px-4 py-3 text-gray-600">{u.email || "—"}</td>
              {tab === "employee" && (
                <td className="px-4 py-3 text-gray-600">{u.employee_name || "—"}</td>
              )}
              {tab === "manager" && (
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${u.manager_level === 1 ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    Niveau {u.manager_level}
                  </span>
                </td>
              )}
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {u.is_active ? "Actif" : "Inactif"}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onGerer(u)}
                  className="inline-flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"
                >
                  Gérer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ stats, onExport }: { stats: AdminStats | null; onExport: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-camublue-900">Vue d'ensemble</h2>
          <p className="text-sm text-gray-500 mt-0.5">Statistiques globales des comptes de la plateforme.</p>
        </div>
        <Button
          onClick={onExport}
          variant="outline"
          className="gap-2 border-camublue-900/30 text-camublue-900 hover:bg-camublue-900/5"
        >
          <Download size={15} />
          Exporter
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Comptes Employés"
          value={stats?.employee_accounts}
          icon={<Users size={20} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Comptes RH"
          value={stats?.staff_users}
          icon={<UserCheck size={20} className="text-emerald-600" />}
          color="bg-emerald-50"
        />
        <StatCard
          label="Managers Niveau 1"
          value={stats?.manager_n1}
          icon={<ShieldCheck size={20} className="text-violet-600" />}
          color="bg-violet-50"
        />
        <StatCard
          label="Managers Niveau 2"
          value={stats?.manager_n2}
          icon={<ShieldCheck size={20} className="text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total utilisateurs"
          value={stats?.total_users}
          icon={<Users size={20} className="text-gray-600" />}
          color="bg-gray-100"
        />
        <StatCard
          label="Comptes actifs"
          value={stats?.active_users}
          icon={<Activity size={20} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Gestionnaires planning"
          value={stats?.planning_managers}
          icon={<ShieldCheck size={20} className="text-sky-600" />}
          color="bg-sky-50"
        />
      </div>
    </div>
  );
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab({
  tab,
  users,
  loading,
  search,
  onSearchChange,
  managerLevel,
  onLevelChange,
  onCreate,
  onImport,
  onExport,
  onGerer,
}: {
  tab: Tab;
  users: AdminUser[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  managerLevel: string;
  onLevelChange: (v: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onExport: () => void;
  onGerer: (u: AdminUser) => void;
}) {
  const titles: Record<Tab, string> = {
    overview: "",
    employee: "Comptes Employés",
    rh: "Comptes RH",
    manager: "Comptes Managers",
  };

  const filterBtn = (level: string, label: string) => (
    <button
      onClick={() => onLevelChange(level)}
      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all border ${
        managerLevel === level
          ? "bg-camublue-900/10 text-camublue-900 border-camublue-900/20"
          : "text-gray-500 hover:bg-gray-100 border-transparent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-camublue-900">{titles[tab]}</h2>
      </div>

      {/* Manager level filter */}
      {tab === "manager" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium mr-1">Niveau :</span>
          {filterBtn("all", "Tous")}
          {filterBtn("manager1", "Niveau 1")}
          {filterBtn("manager2", "Niveau 2")}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Recherche — occupe tout l'espace à gauche */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un utilisateur..."
            className="pl-9 bg-white border-gray-300 shadow-sm focus:ring-2 focus:ring-camublue-900"
          />
        </div>

        {/* Boutons à droite */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onImport}
            variant="outline"
            className="gap-2 border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 shadow-sm"
          >
            <Upload size={15} />
            <span className="hidden sm:inline">Importer</span>
          </Button>
          <Button
            onClick={onExport}
            variant="outline"
            className="gap-2 border-camublue-900/30 text-camublue-900 hover:bg-camublue-900/5 shadow-sm"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button
            onClick={onCreate}
            className="bg-camublue-900 text-white hover:bg-camublue-900/90 gap-2 shadow-sm"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Créer compte</span>
          </Button>
        </div>
      </div>

      {/* Table card */}
      <Card className="shadow-sm border-0">
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {loading ? "Chargement..." : `${users.length} compte(s) trouvé(s)`}
            </p>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-8 h-8 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <UserTable users={users} tab={tab} onGerer={onGerer} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  useAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab") as Tab | null;
  const levelParam = searchParams.get("level");

  const activeTab: Tab =
    tabParam && ["overview", "employee", "rh", "manager"].includes(tabParam)
      ? tabParam
      : "overview";

  const managerLevel =
    levelParam === "1" ? "manager1" : levelParam === "2" ? "manager2" : "all";

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modals
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [gererUser, setGererUser] = useState<AdminUser | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser]     = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [historyUser, setHistoryUser] = useState<AdminUser | null>(null);

  const handleDeleteAdmin = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      await deleteAdminAccount(deleteUser.id);
      toast.success("Compte supprimé.");
      setDeleteUser(null);
      fetchUsers();
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => toast.error("Erreur lors du chargement des statistiques."));
  }, []);

  const fetchUsers = useCallback(async () => {
    if (activeTab === "overview") return;
    setLoadingUsers(true);
    try {
      let role: "employee" | "rh" | "manager" | "manager1" | "manager2" | undefined;
      if (activeTab === "employee") role = "employee";
      else if (activeTab === "rh") role = "rh";
      else if (activeTab === "manager") {
        role =
          managerLevel === "manager1" ? "manager1"
          : managerLevel === "manager2" ? "manager2"
          : "manager";
      }
      const data = await getAdminAccounts({ role, search: search || undefined });
      setUsers(data);
    } catch {
      toast.error("Erreur lors du chargement des utilisateurs.");
    } finally {
      setLoadingUsers(false);
    }
  }, [activeTab, managerLevel, search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchUsers, search]);

  useEffect(() => {
    setSearch("");
  }, [activeTab]);

  const handleToggle = async (u: AdminUser) => {
    try {
      await toggleAdminActive(u.id);
      toast.success(`Compte ${u.is_active ? "désactivé" : "activé"}.`);
      fetchUsers();
      if (activeTab === "overview") {
        getAdminStats().then(setStats).catch(() => {});
      }
    } catch {
      toast.error("Erreur lors du changement de statut.");
    }
  };

  const setLevel = (level: string) => {
    if (level === "all") setSearchParams({ tab: "manager" });
    else setSearchParams({ tab: "manager", level: level === "manager1" ? "1" : "2" });
  };

  return (
    <AdminLayout>
      <Toaster position="top-right" />

      <div className="space-y-6">
        {activeTab === "overview" ? (
          <OverviewTab stats={stats} onExport={() => setShowExport(true)} />
        ) : (
          <AccountsTab
            tab={activeTab}
            users={users}
            loading={loadingUsers}
            search={search}
            onSearchChange={setSearch}
            managerLevel={managerLevel}
            onLevelChange={setLevel}
            onCreate={() => setShowCreate(true)}
            onImport={() => setShowImport(true)}
            onExport={() => setShowExport(true)}
            onGerer={setGererUser}
          />
        )}
      </div>

      {/* Modals */}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={fetchUsers} />
      )}

      {showCreate && (
        <UserModal mode="create" user={null} onClose={() => setShowCreate(false)} onSave={fetchUsers} />
      )}

      {editUser && (
        <UserModal mode="edit" user={editUser} onClose={() => setEditUser(null)} onSave={fetchUsers} />
      )}

      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onSave={fetchUsers} />
      )}

      <SharedConfirmDeleteModal
        open={deleteUser !== null}
        title="Supprimer ce compte admin ?"
        message={
          deleteUser
            ? <>Le compte <strong>{deleteUser.username}</strong> sera <strong>définitivement supprimé</strong>. Cette action est irréversible.</>
            : null
        }
        onClose={() => !deleteLoading && setDeleteUser(null)}
        onConfirm={handleDeleteAdmin}
        loading={deleteLoading}
      />

      <AnimatePresence>
        {gererUser && (
          <GererModal
            user={gererUser}
            onClose={() => setGererUser(null)}
            onEdit={(u) => setEditUser(u)}
            onResetPwd={(u) => setResetUser(u)}
            onDelete={(u) => setDeleteUser(u)}
            onToggle={handleToggle}
            onHistory={(u) => setHistoryUser(u)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyUser && (
          <HistoryModal
            user={historyUser}
            onClose={() => setHistoryUser(null)}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
