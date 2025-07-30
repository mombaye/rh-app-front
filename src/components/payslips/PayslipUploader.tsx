import { useRef, useState } from "react";
import { FaFilePdf } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";

export default function PayslipUploader({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
    } else {
      toast.error("Veuillez sélectionner un fichier PDF.");
    }
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Aucun fichier sélectionné");
    setLoading(true);
    try {
      await onUpload(file);
      toast.success("Fichier envoyé avec succès");
      setFile(null);
    } catch (error) {
      toast.error("Erreur lors de l'envoi du fichier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Importer le fichier PDF des bulletins</h2>

      <div className="flex items-center gap-4">
        <input
          type="file"
          ref={fileRef}
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
        >
          <FaFilePdf /> Choisir un fichier
        </button>

        {file && <span className="text-sm italic text-gray-600">{file.name}</span>}

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="px-4 py-2 bg-camublue-900 text-white rounded hover:bg-camublue-800 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <ImSpinner2 className="animate-spin" /> : null}
          Importer
        </button>
      </div>
    </div>
  );
}
