import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/api/axios";
import { createEmployee, updateEmployee } from "@/services/employeeService";

interface EmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export default function EmployeeFormModal({ open, onClose, onSuccess, initialData }: EmployeeModalProps) {
  const isEdit = !!initialData;

  const [formData, setFormData] = useState({
    matricule: "",
    nom: "",
    prenom: "",
    fonction: "",
    sexe: "H",
    date_embauche: "",
    business_line: "",
    projet: "",
    service: "",
    manager: "",
    localisation: "",
    email: "",
    telephone: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        matricule: "",
        nom: "",
        prenom: "",
        fonction: "",
        sexe: "H",
        date_embauche: "",
        business_line: "",
        projet: "",
        service: "",
        manager: "",
        localisation: "",
        email: "",
        telephone: "",
      });
    }
  }, [initialData, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateEmployee(initialData.id, formData); // <-- CORRECT
        toast.success("Employé mis à jour !");
      } else {
        await createEmployee(formData);
        toast.success("Employé ajouté !");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'employé" : "Ajouter un employé"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Matricule</Label>
              <Input name="matricule" value={formData.matricule} onChange={handleChange} required />
            </div>
            <div>
              <Label>Sexe</Label>
              <select
                name="sexe"
                value={formData.sexe}
                onChange={handleChange}
                className="w-full rounded-md border p-2"
              >
                <option value="H">Homme</option>
                <option value="F">Femme</option>
              </select>
            </div>
            <div>
              <Label>Nom</Label>
              <Input name="nom" value={formData.nom} onChange={handleChange} required />
            </div>
            <div>
              <Label>Prénom</Label>
              <Input name="prenom" value={formData.prenom} onChange={handleChange} required />
            </div>
            <div>
              <Label>Fonction</Label>
              <Input name="fonction" value={formData.fonction} onChange={handleChange} required />
            </div>
            <div>
              <Label>Date d'embauche</Label>
              <Input type="date" name="date_embauche" value={formData.date_embauche} onChange={handleChange} required />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" name="email" value={formData.email || ""} onChange={handleChange} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input name="telephone" value={formData.telephone || ""} onChange={handleChange} />
            </div>
            <div>
              <Label>Business Line</Label>
              <Input name="business_line" value={formData.business_line || ""} onChange={handleChange} />
            </div>
            <div>
              <Label>Projet</Label>
              <Input name="projet" value={formData.projet || ""} onChange={handleChange} />
            </div>
            <div>
              <Label>Service</Label>
              <Input name="service" value={formData.service || ""} onChange={handleChange} />
            </div>
            <div>
              <Label>Manager</Label>
              <Input name="manager" value={formData.manager || ""} onChange={handleChange} />
            </div>
            <div>
              <Label>Localisation</Label>
              <Input name="localisation" value={formData.localisation || ""} onChange={handleChange} />
            </div>
          </div>

         <Button
          type="submit"
          className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg transition disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Enregistrement..." : isEdit ? "Modifier" : "Ajouter"}
        </Button>

        </form>
      </DialogContent>
    </Dialog>
  );
}
