import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import type { Employee } from "@/types/employee";
import { fetchAvailableBulletins, sendBulletinsToUser, type BulletinMonth } from "@/services/employeeService";

function keyOf(m: BulletinMonth) {
  return `${m.year}-${String(m.month).padStart(2, "0")}`;
}

function labelOf(m: BulletinMonth) {
  return dayjs(`${m.year}-${String(m.month).padStart(2, "0")}-01`).format("MMMM YYYY");
}

export default function EmployeePayslipResendModal({
  open,
  employee,
  onClose,
}: {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [months, setMonths] = useState<BulletinMonth[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");

  const matricule = employee?.matricule || "";

  useEffect(() => {
    if (!open || !employee) return;
    setEmail(employee.email || "");
    setSelected(new Set());
    setMonths([]);

    (async () => {
      setLoading(true);
      try {
        const res = await fetchAvailableBulletins(employee.matricule);
        // tri récent -> ancien
        const sorted = [...res].sort((a, b) => (b.year - a.year) || (b.month - a.month));
        setMonths(sorted);
      } catch (e: any) {
        toast.error(e?.response?.data?.error || "Impossible de charger les bulletins disponibles");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, employee]);

  const selectedList = useMemo(() => {
    const map = new Map(months.map((m) => [keyOf(m), m]));
    return Array.from(selected).map((k) => map.get(k)).filter(Boolean) as BulletinMonth[];
  }, [selected, months]);

  const toggle = (k: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const selectLastN = (n: number) => {
    // prend les N plus récents réellement disponibles
    const take = months.slice(0, n);
    setSelected(new Set(take.map(keyOf)));
  };

  const clear = () => setSelected(new Set());

  const onSend = async () => {
    if (!employee) return;
    if (selectedList.length === 0) return toast.error("Sélectionne au moins un mois.");
    if (!email?.trim() && !employee.email) return toast.error("Aucun email disponible.");

    setSending(true);
    const t = toast.loading("Envoi des bulletins...");
    try {
      const res = await sendBulletinsToUser({
        matricule: employee.matricule,
        mois: selectedList,
        email: email?.trim() || undefined,
      });

      toast.success(res?.message || "Bulletins envoyés.", { id: t });
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l’envoi", { id: t });
    } finally {
      setSending(false);
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 p-4 flex items-center justify-center">
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <Dialog.Panel className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <Dialog.Title className="text-lg font-semibold text-slate-800">
                  Renvoyer un bulletin existant
                </Dialog.Title>
                <div className="text-sm text-slate-600 mt-1">
                  {employee ? (
                    <>
                      <span className="font-medium">{employee.prenom} {employee.nom}</span> · Matricule{" "}
                      <span className="font-mono">{employee.matricule}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Email destinataire (modifiable)</div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-camublue-900 outline-none"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    Par défaut : email de l’employé. Tu peux le remplacer si besoin.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectLastN(1)}
                    className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                    disabled={loading || months.length === 0}
                  >
                    Mois le + récent
                  </button>
                  <button
                    type="button"
                    onClick={() => selectLastN(3)}
                    className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                    disabled={loading || months.length === 0}
                  >
                    3 derniers dispo
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                    disabled={loading || selected.size === 0}
                  >
                    Effacer
                  </button>

                  <div className="ml-auto text-sm text-slate-600">
                    Sélection : <span className="font-semibold">{selected.size}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-300 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 border-b border-slate-300">
                    Bulletins disponibles
                  </div>

                  {loading ? (
                    <div className="p-6 flex items-center gap-2 text-slate-600">
                      <ImSpinner2 className="animate-spin" /> Chargement...
                    </div>
                  ) : months.length === 0 ? (
                    <div className="p-6 text-slate-500">Aucun bulletin trouvé sur le serveur pour ce matricule.</div>
                  ) : (
                    <div className="max-h-64 overflow-auto">
                      {months.map((m) => {
                        const k = keyOf(m);
                        return (
                          <label key={k} className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 hover:bg-slate-50">
                            <input type="checkbox" checked={selected.has(k)} onChange={() => toggle(k)} />
                            <div className="flex-1">
                              <div className="font-medium text-slate-800">{labelOf(m)}</div>
                              <div className="text-xs text-slate-500">{k}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
                  disabled={sending}
                >
                  Fermer
                </button>
                <button
                  onClick={onSend}
                  disabled={sending || loading || !employee}
                  className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-800 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {sending ? <ImSpinner2 className="animate-spin" /> : null}
                  Envoyer les bulletins
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
