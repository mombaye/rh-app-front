import { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { createUser, updateUser, type AdminUser, type UserFormData } from "@/admin/services/adminService";
import adminApi from "@/admin/services/adminService";

type Country = { id: number; name: string; code: string };

type Props = {
  mode: "create" | "edit";
  role: "employee" | "rh" | "manager";
  user?: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function UserFormModal({ mode, role, user, onClose, onSaved }: Props) {
  const [form, setForm] = useState<UserFormData>({
    username: user?.username ?? "",
    email: user?.email ?? "",
    password: "",
    is_staff: role === "rh",
    is_global_admin: false,
    is_planning_manager: false,
    manager_level: role === "manager" ? (user?.manager_level ?? 1) : null,
    country_id: user?.country?.id ?? null,
    is_active: user?.is_active ?? true,
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.get("/api/users/admin/accounts/").then((r) => {
      // Extract unique countries from users list
    });
    // Fetch countries via a known endpoint
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8030"}/api/auth/profile/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_access_token")}` },
    })
      .then((r) => r.json())
      .then((profile) => {
        // We'll try to get countries another way
      });

    // Simple approach: get countries from the users list
    adminApi.get("/api/users/admin/accounts/").then((r) => {
      const users: AdminUser[] = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      const seen = new Map<number, Country>();
      users.forEach((u) => {
        if (u.country) seen.set(u.country.id, u.country);
      });
      setCountries(Array.from(seen.values()));
    });
  }, []);

  const set = (k: keyof UserFormData, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: UserFormData = { ...form };
      if (!payload.password) delete payload.password;
      if (role === "rh") {
        payload.is_staff = true;
        payload.manager_level = null;
      } else if (role === "manager") {
        payload.is_staff = false;
      } else {
        payload.is_staff = false;
        payload.manager_level = null;
      }
      if (mode === "create") {
        await createUser(payload);
      } else {
        await updateUser(user!.id, payload);
      }
      onSaved();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ");
        setError(msgs);
      } else {
        setError("Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = role === "employee" ? "Employé" : role === "rh" ? "RH" : "Manager";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-800">
            {mode === "create" ? `Créer un compte ${roleLabel}` : `Modifier le compte`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nom d'utilisateur *</label>
              <input
                required
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Mot de passe {mode === "create" ? "*" : "(laisser vide = inchangé)"}
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required={mode === "create"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50 pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {role === "manager" && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Niveau Manager *</label>
                <select
                  value={form.manager_level ?? 1}
                  onChange={(e) => set("manager_level", Number(e.target.value))}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50"
                >
                  <option value={1}>Niveau 1</option>
                  <option value={2}>Niveau 2</option>
                </select>
              </div>
            )}

            {countries.length > 0 && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pays</label>
                <select
                  value={form.country_id ?? ""}
                  onChange={(e) => set("country_id", e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50"
                >
                  <option value="">— Aucun —</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {mode === "edit" && (
              <div className="col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => set("is_active", e.target.checked)}
                  className="rounded border-gray-300 text-camublue-900"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Compte actif</label>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium hover:bg-camublue-900/90 transition disabled:opacity-60"
            >
              {loading ? "Enregistrement..." : mode === "create" ? "Créer" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
