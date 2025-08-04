import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FiSend } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchAvailableBulletins, sendBulletinToUser } from "@/services/employeeService";

type AvailableBulletin = { year: number; month: number };

interface BulletinResendModalProps {
  open: boolean;
  onClose: () => void;
  matricule: string;
  email?: string;
  employeeId?: number;
}

export function BulletinResendModal({
  open,
  onClose,
  matricule,
  email,
  employeeId,
}: BulletinResendModalProps) {
  const [loading, setLoading] = useState(false);
  const [avail, setAvail] = useState<AvailableBulletin[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingSend, setLoadingSend] = useState(false);

 useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected([]);
    fetchAvailableBulletins(matricule)
        .then((data) => setAvail(data))
        .catch(() => toast.error("Impossible de charger les mois disponibles"))
        .finally(() => setLoading(false));
}, [open, matricule]);

  const handleCheck = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSend = async () => {
    setLoadingSend(true);
    try {
      await sendBulletinToUser({
        matricule,
        email,
        months: selected.map((key) => {
          const [year, month] = key.split("-");
          return { year: parseInt(year), month: parseInt(month) };
        }),
      });
      toast.success("Bulletins envoyés !");
      onClose();
    } catch (e) {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setLoadingSend(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span>Sélectionner les mois à renvoyer pour </span>
            <span className="text-camublue-900 font-bold">{employeeId}</span>
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <ImSpinner2 className="animate-spin text-2xl text-camublue-900" />
          </div>
        ) : avail.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun bulletin disponible à renvoyer.
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
              {avail.map(({ year, month }) => {
                const label = `${("0" + month).slice(-2)}/${year}`;
                const key = `${year}-${month}`;
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(key)}
                      onChange={() => handleCheck(key)}
                      className="accent-camublue-900"
                      disabled={loadingSend}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            <button
              type="submit"
              className="w-full bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
              disabled={selected.length === 0 || loadingSend}
            >
              {loadingSend ? <ImSpinner2 className="animate-spin" /> : <FiSend />}
              <span>
                {selected.length === 1
                  ? "Renvoyer le bulletin sélectionné"
                  : `Renvoyer les ${selected.length} bulletins sélectionnés`}
              </span>
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
