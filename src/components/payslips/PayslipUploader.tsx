import { useRef, useState } from "react";
import { FaFilePdf } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";

type Mode = "auto" | "select" | null;

export default function PayslipUploader({
  onUploadAuto,
  onUploadSelect,
}: {
  onUploadAuto: (file: File) => Promise<void>;
  onUploadSelect: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [modeLoading, setModeLoading] = useState<Mode>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
    } else {
      toast.error("Veuillez sélectionner un fichier PDF.");
    }
  };

  const run = async (mode: Exclude<Mode, null>) => {
    if (!file) return toast.error("Aucun fichier sélectionné");

    setModeLoading(mode);

    try {
      // ✅ garde-fous (si props mal passées / mauvais import)
      if (mode === "auto") {
        if (typeof onUploadAuto !== "function") {
          throw new Error("onUploadAuto n’est pas une fonction (prop manquante ? mauvais import ?)");
        }
        await onUploadAuto(file);
      } else {
        if (typeof onUploadSelect !== "function") {
          throw new Error("onUploadSelect n’est pas une fonction (prop manquante ? mauvais import ?)");
        }
        await onUploadSelect(file);
      }

      // ✅ option : vider le fichier après succès
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      console.error("[PayslipUploader] run error:", err);

      const msg =
        err?.response?.data?.error ||  // axios backend
        err?.message ||                // JS error
        "Erreur lors du traitement du fichier";

      toast.error(msg);
    } finally {
      setModeLoading(null);
    }
  };


  const disabled = !file || modeLoading !== null;

  return (
    <div className="p-4 bg-white rounded-xl shadow space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Importer le fichier PDF des bulletins</h2>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <input
          type="file"
          ref={fileRef}
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 inline-flex items-center gap-2 w-fit"
        >
          <FaFilePdf /> Choisir un fichier
        </button>

        {file && <span className="text-sm italic text-gray-600">{file.name}</span>}

        <div className="flex items-center gap-2 md:ml-auto">
          {/* ✅ Flow 1 : auto */}
          <button
            onClick={() => run("auto")}
            disabled={disabled}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-2"
            title="Envoie automatiquement à tous les employés détectés (emails valides)"
          >
            {modeLoading === "auto" ? <ImSpinner2 className="animate-spin" /> : null}
            {modeLoading === "auto" ? "Envoi..." : "Envoyer (auto)"}
          </button>

          {/* ✅ Flow 2 : sélection */}
          <button
            onClick={() => run("select")}
            disabled={disabled}
            className="px-4 py-2 bg-camublue-900 text-white rounded hover:bg-camublue-800 disabled:opacity-50 inline-flex items-center gap-2"
            title="Analyse le PDF, puis vous choisissez les destinataires"
          >
            {modeLoading === "select" ? <ImSpinner2 className="animate-spin" /> : null}
            {modeLoading === "select" ? "Analyse..." : "Importer & sélectionner"}
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        • <b>Envoyer (auto)</b> : envoie à tous les bulletins détectés (emails valides).<br />
        • <b>Importer & sélectionner</b> : vous choisissez précisément les destinataires.
      </div>
    </div>
  );
}
