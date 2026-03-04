import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createEmployee, updateEmployee } from "@/services/employeeService";
import { ContractType, Employee } from "@/types/employee";

interface EmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Employee | null;
  defaultContractType?: ContractType;
}

// ✅ Type strict aligné sur Partial<Employee> — évite que sexe soit inféré comme string
type FormData = {
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
  sexe: "H" | "F";
  date_embauche: string;
  type_contrat: ContractType | "";  // "" = non sélectionné
  business_line: string;
  projet: string;
  service: string;
  manager: string;
  localisation: string;
  email: string;
  telephone: string;
};

const EMPTY_FORM: FormData = {
  matricule:     "",
  nom:           "",
  prenom:        "",
  fonction:      "",
  sexe:          "H",  // ✅ valeur littérale typée, pas string générique
  date_embauche: "",
  type_contrat:  "",
  business_line: "",
  projet:        "",
  service:       "",
  manager:       "",
  localisation:  "",
  email:         "",
  telephone:     "",
};

export default function EmployeeFormModal({
  open,
  onClose,
  onSuccess,
  initialData,
  defaultContractType,
}: EmployeeModalProps) {
  const isEdit = !!initialData;

  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && initialData) {
      // ✅ Chaque champ extrait explicitement pour garantir les types
      setFormData({
        matricule:     initialData.matricule        ?? "",
        nom:           initialData.nom              ?? "",
        prenom:        initialData.prenom           ?? "",
        fonction:      initialData.fonction         ?? "",
        sexe:          initialData.sexe             ?? "H",
        date_embauche: initialData.date_embauche    ?? "",
        type_contrat:  initialData.type_contrat     ?? "",
        business_line: initialData.business_line    ?? "",
        projet:        initialData.projet           ?? "",
        service:       initialData.service          ?? "",
        manager:       initialData.manager          ?? "",
        localisation:  initialData.localisation     ?? "",
        email:         initialData.email            ?? "",
        telephone:     initialData.telephone        ?? "",
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        // ✅ Pré-remplit le type de contrat fourni par la page parente (ex: "INTERIM")
        type_contrat: defaultContractType ?? "",
      });
    }
  }, [initialData, isEdit, defaultContractType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // ✅ type_contrat vide → on n'envoie pas le champ au backend
    const payload: Partial<Employee> = {
      ...formData,
      type_contrat: formData.type_contrat || undefined,
    };

    try {
      if (isEdit && initialData) {
        await updateEmployee(initialData.id, payload);
        toast.success("Employé mis à jour !");
      } else {
        await createEmployee(payload);
        toast.success("Employé ajouté !");
      }
      onSuccess();
      onClose();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'employé" : "Ajouter un employé"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <Label>Matricule</Label>
              <Input name="matricule" value={formData.matricule} onChange={handleChange} required />
            </div>

            <div>
              <Label>Sexe</Label>
              <select name="sexe" value={formData.sexe} onChange={handleChange} className="w-full rounded-md border p-2">
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

            {/* ✅ Options alignées sur ContractType = 'INTERNE' | 'INTERIM' */}
            <div>
              <Label>Type de contrat</Label>
              <select
                name="type_contrat"
                value={formData.type_contrat}
                onChange={handleChange}
                className="w-full rounded-md border p-2"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="STAGE">Stage</option>
                <option value="INTERIM">Intérim</option>
              </select>
            </div>

            <div>
              <Label>Email</Label>
              <Input type="email" name="email" value={formData.email} onChange={handleChange} />
            </div>

            <div>
              <Label>Téléphone</Label>
              <Input name="telephone" value={formData.telephone} onChange={handleChange} />
            </div>

            <div>
              <Label>Business Line</Label>
              <Input name="business_line" value={formData.business_line} onChange={handleChange} />
            </div>

            <div>
              <Label>Projet</Label>
              <Input name="projet" value={formData.projet} onChange={handleChange} />
            </div>

            <div>
              <Label>Service</Label>
              <Input name="service" value={formData.service} onChange={handleChange} />
            </div>

            <div>
              <Label>Manager</Label>
              <Input name="manager" value={formData.manager} onChange={handleChange} />
            </div>

            <div>
              <Label>Localisation</Label>
              <Input name="localisation" value={formData.localisation} onChange={handleChange} />
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