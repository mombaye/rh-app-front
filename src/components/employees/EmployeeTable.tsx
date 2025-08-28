// src/components/employees/EmployeesTable.tsx
import { useEffect, useState, useRef, Fragment } from "react";
import { FaEdit, FaTrash, FaFileExcel, FaUserPlus, FaPaperPlane } from "react-icons/fa";
import { Employee } from "@/types/employee";
import { createAccountFromEmployee } from "@/services/employeeService";
import { sendAccessCodes } from "@/services/employeeService";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import { Menu, Transition } from "@headlessui/react";

interface Props {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (id: number) => void;
  onImport: (file: File) => void;
}
export default function EmployeesTable({ employees, isLoading, onEdit, onDelete, onImport }: Props) {
  const [search, setSearch] = useState<string>("");
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [accountLoading, setAccountLoading] = useState<number | null>(null);
  const [userFilter, setUserFilter] = useState<"all" | "with" | "without">("all");

  // --- Sélection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const allFilteredIds = filtered.map((e) => e.id);
  const isAllSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));

  // --- Modal d’envoi codes
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendScope, setSendScope] = useState<"selected" | "filtered" | "all">("selected");
  const [isSendingCodes, setIsSendingCodes] = useState(false);

  useEffect(() => {
    setFiltered(
      employees.filter((e) => {
        const q = search.toLowerCase();
        const matchesUser =
          userFilter === "all" ? true : userFilter === "with" ? e.has_user : !e.has_user;
        return (
          matchesUser &&
          (e.matricule.toLowerCase().includes(q) ||
            e.nom.toLowerCase().includes(q) ||
            e.prenom.toLowerCase().includes(q) ||
            (e.email ? e.email.toLowerCase().includes(q) : false))
        );
      })
    );
  }, [search, employees, userFilter]);

  const handleDeleteClick = (id: number) => onDelete(id);

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
    if (!emp.email) {
      toast.error("L'employé n'a pas d'email !");
      return;
    }
    setAccountLoading(emp.id);
    try {
      await createAccountFromEmployee(emp.id);
      toast.success(`Compte utilisateur créé pour ${emp.prenom} ${emp.nom}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de la création du compte");
    } finally {
      setAccountLoading(null);
    }
  };

  // --- Sélection helpers
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      if (isAllSelected) {
        // unselect all filtered
        const n = new Set(prev);
        filtered.forEach((e) => n.delete(e.id));
        return n;
      } else {
        // add all filtered
        const n = new Set(prev);
        filtered.forEach((e) => n.add(e.id));
        return n;
      }
    });
  };

  // --- Envoi codes
  const openConfirmFor = (scope: "selected" | "filtered" | "all") => {
    setSendScope(scope);
    setConfirmOpen(true);
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
        matricules = employees
          .filter((e) => selectedIds.has(e.id))
          .map((e) => e.matricule);
      } else if (sendScope === "filtered") {
        if (filtered.length === 0) {
          toast.error("Aucun employé dans la liste filtrée", { id: toastId });
          setIsSendingCodes(false);
          return;
        }
        matricules = filtered.map((e) => e.matricule);
      } else {
        // all → undefined => backend envoie à tout le monde
        matricules = undefined;
      }

      const res = await sendAccessCodes(matricules);
      const ok = res.sent?.length ?? 0;
      const ko = res.errors?.length ?? 0;
      if (ok > 0 && ko === 0) toast.success(`Codes envoyés à ${ok} employé(s)`, { id: toastId });
      else if (ok > 0 && ko > 0)
        toast.success(`Envoyés: ${ok}, erreurs: ${ko}`, { id: toastId });
      else toast.error("Aucun code envoyé", { id: toastId });

      if (ko > 0) {
        console.warn("Erreurs envoi codes:", res.errors);
      }
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l’envoi des codes", { id: toastId });
    } finally {
      setIsSendingCodes(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barre de recherche + import + filtres + actions */}
      <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
        <Input
          placeholder="Rechercher par nom, prénom ou matricule..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/3"
        />

        <div className="flex items-center gap-2">
          {/* Filtre utilisateurs */}
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value as any)}
            className="bg-gray-200 text-gray-700 px-3 py-2 rounded-md focus:ring-2 focus:ring-camublue-900"
          >
            <option value="all">Tous</option>
            <option value="with">Avec accès sur eRH</option>
            <option value="without">Sans accès sur eRH</option>
          </select>

          {/* Actions d’envoi de codes */}
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md flex items-center gap-2 shadow-sm">
              <FaPaperPlane />
              Envoyer les codes
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none overflow-hidden">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => openConfirmFor("selected")}
                        className={`w-full text-left px-4 py-2 ${active ? "bg-gray-100" : ""}`}
                      >
                        Aux sélectionnés ({selectedIds.size})
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => openConfirmFor("filtered")}
                        className={`w-full text-left px-4 py-2 ${active ? "bg-gray-100" : ""}`}
                      >
                        À la liste filtrée ({filtered.length})
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => openConfirmFor("all")}
                        className={`w-full text-left px-4 py-2 ${active ? "bg-gray-100" : ""}`}
                      >
                        À tout le monde (tous)
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            accept=".xlsx"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-300"
          >
            <FaFileExcel /> Choisir un fichier
          </button>
          <button
            onClick={handleImport}
            disabled={!importFile || isImporting}
            className="bg-camublue-900 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-camublue-800 disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <ImSpinner2 className="animate-spin" />
                Importation...
              </>
            ) : (
              "Importer"
            )}
          </button>
        </div>
      </div>

      {importFile && (
        <div className="text-sm text-gray-500 italic">Fichier sélectionné : {importFile.name}</div>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-xl shadow-md">
          <thead className="bg-camublue-900 text-white">
            <tr>
              <th className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAllFiltered}
                  aria-label="Tout sélectionner (filtrés)"
                />
              </th>
              <th className="px-4 py-2 text-left">Matricule</th>
              <th className="px-4 py-2 text-left">Nom</th>
              <th className="px-4 py-2 text-left">Prénom</th>
              <th className="px-4 py-2 text-left">Sexe</th>
              <th className="px-4 py-2 text-left">Fonction</th>
              <th className="px-4 py-2 text-left">Date d’embauche</th>
              <th className="px-4 py-2 text-left">Projet</th>
              <th className="px-4 py-2 text-left">Manager</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-right">Actions</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emp.id)}
                    onChange={() => toggleOne(emp.id)}
                    aria-label={`Sélectionner ${emp.nom} ${emp.prenom}`}
                  />
                </td>
                <td className="px-4 py-2">{emp.matricule}</td>
                <td className="px-4 py-2">{emp.nom}</td>
                <td className="px-4 py-2">{emp.prenom}</td>
                <td className="px-4 py-2">{emp.sexe === "H" ? "Homme" : emp.sexe === "F" ? "Femme" : ""}</td>
                <td className="px-4 py-2">{emp.fonction}</td>
                <td className="px-4 py-2">{emp.date_embauche}</td>
                <td className="px-4 py-2">{emp.projet}</td>
                <td className="px-4 py-2">{emp.manager}</td>
                <td className="px-4 py-2">{emp.email}</td>

                <td className="px-4 py-2 text-right space-x-3">
                  {/* Envoyer code - unitaire */}
                  <button
                    onClick={() => {
                      setSelectedIds(new Set([emp.id]));
                      openConfirmFor("selected");
                    }}
                    className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-900"
                    title="Envoyer le code à cet employé"
                  >
                    <FaPaperPlane />
                  </button>

                  <button
                    onClick={() => handleCreateAccount(emp)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Créer un accès utilisateur"
                    disabled={accountLoading === emp.id}
                  >
                    {accountLoading === emp.id ? <ImSpinner2 className="animate-spin" /> : <FaUserPlus />}
                  </button>

                  <button
                    onClick={() => onEdit(emp)}
                    className="text-yellow-500 hover:text-yellow-700"
                    title="Modifier"
                  >
                    <FaEdit />
                  </button>

                  <button
                    onClick={() => handleDeleteClick(emp.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Supprimer"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={12} className="text-center py-4 text-gray-500">
                  Aucun employé trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Confirmer l’envoi des codes</h3>
            <p className="text-slate-600 mb-4">
              Portée :
              <span className="ml-2 font-medium">
                {sendScope === "selected"
                  ? `Sélectionnés (${selectedIds.size})`
                  : sendScope === "filtered"
                  ? `Liste filtrée (${filtered.length})`
                  : "Tous les employés"}
              </span>
            </p>

            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 mb-4">
              Les destinataires recevront un email individuel contenant leur code d’accès permanent.
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
                disabled={isSendingCodes}
              >
                Annuler
              </button>
              <button
                onClick={doSendCodes}
                disabled={isSendingCodes}
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-2"
              >
                {isSendingCodes ? <ImSpinner2 className="animate-spin" /> : <FaPaperPlane />}
                {isSendingCodes ? "Envoi..." : "Confirmer l’envoi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
