// RH : modèle Word de l'attestation de congé (généré à la clôture du DG).
// Le modèle contient des champs {{…}} que eRH remplace par les données de la demande.
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Eye, FileText, Loader2, RotateCcw, Upload, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { AttestationTemplateState, attestationTemplateService } from "@/services/attestationTemplateService";

const frDateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default function AttestationTemplateModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<AttestationTemplateState | null>(null);
  const [busy, setBusy] = useState<"" | "upload" | "preview" | "reset">("");
  const [error, setError] = useState<{ message: string; unknown: string[] } | null>(null);
  const [copied, setCopied] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    attestationTemplateService.get().then(setState).catch(() => toast.error("Impossible de charger le modèle"));
  }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      setState(await attestationTemplateService.upload(file));
      toast.success("Modèle importé : il sera utilisé pour les prochaines attestations.");
    } catch (e: any) {
      const d = e?.response?.data ?? {};
      setError({ message: d.error ?? "Import impossible", unknown: d.unknown ?? [] });
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  };

  const run = async (kind: "preview" | "reset", fn: () => Promise<unknown>) => {
    setBusy(kind);
    try { await fn(); } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Action impossible");
    } finally { setBusy(""); }
  };

  const reset = () => {
    if (!window.confirm("Revenir au modèle par défaut ? Le modèle importé sera supprimé.")) return;
    run("reset", async () => {
      setState(await attestationTemplateService.resetToDefault());
      toast.success("Modèle par défaut rétabli.");
    });
  };

  const copy = (tag: string) => {
    navigator.clipboard?.writeText(tag).then(() => {
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const used = new Set(state?.fields ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-camublue-900 flex items-center gap-2"><FileText size={18} /> Modèle d'attestation de congé</h2>
            <p className="text-xs text-slate-500">Document Word généré automatiquement quand le DG clôture une demande.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
        </div>

        {!state ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-camublue-900" /></div>
        ) : (
          <div className="flex-1 overflow-auto p-5 space-y-5">
            {/* Modèle utilisé */}
            <div className="rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Modèle utilisé</p>
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {state.is_default ? "Modèle par défaut (Camusat Burkina Faso)" : state.template?.name}
                </p>
                {!state.is_default && state.template && (
                  <p className="text-xs text-slate-500">
                    Importé le {frDateTime(state.template.uploaded_at)}{state.template.uploaded_by ? ` par ${state.template.uploaded_by}` : ""}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-0.5">{state.fields.length} champ(s) rempli(s) automatiquement</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => run("preview", attestationTemplateService.preview)} disabled={!!busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {busy === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Aperçu
                </button>
                <button onClick={() => attestationTemplateService.download("current", state.template?.name || "modele_attestation_conge.docx")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                  <Download size={14} /> Télécharger
                </button>
                {!state.is_default && (
                  <button onClick={reset} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    {busy === "reset" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Modèle par défaut
                  </button>
                )}
              </div>
            </div>

            {/* Import */}
            <div>
              <button onClick={() => input.current?.click()} disabled={!!busy}
                className="w-full flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-camublue-200 bg-camublue-50/40 hover:bg-camublue-50 px-4 py-5 text-camublue-900 disabled:opacity-60">
                {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                <span className="text-sm font-semibold">Importer un nouveau modèle (.docx)</span>
                <span className="text-xs text-slate-500">Le modèle importé remplace le modèle utilisé pour les prochaines attestations.</span>
              </button>
              <input ref={input} type="file" accept=".docx" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              {error && (
                <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  {error.message}
                </div>
              )}
            </div>

            {/* Mode d'emploi */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-800">Préparer le modèle</p>
              <p>1. Partez du{" "}
                <button onClick={() => attestationTemplateService.download("default", "modele_attestation_conge_exemple.docx")}
                  className="text-camublue-700 font-semibold hover:underline">modèle d'exemple</button>
                {" "}ou de votre attestation habituelle, dans Word.</p>
              <p>2. Remplacez chaque information qui change d'un employé à l'autre par un champ de la liste ci-dessous,
                écrit exactement comme indiqué, avec les doubles accolades. Exemple : « atteste que {"{{CIVILITE}}"} {"{{EMPLOYE}}"} ».</p>
              <p>3. Gardez la mise en forme voulue (gras, police…) : le champ prend la mise en forme de son premier caractère.
                Le texte fixe (adresse, logo, signature) reste tel quel.</p>
              <p>4. Enregistrez en <b>.docx</b>, importez, puis vérifiez avec <b>Aperçu</b>.</p>
            </div>

            {/* Champs disponibles */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Champs disponibles (cliquez pour copier)</p>
              <div className="border border-slate-100 rounded-xl divide-y divide-slate-100">
                {state.available_fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-3 px-3 py-2">
                    <button onClick={() => copy(f.tag)} title="Copier"
                      className="shrink-0 w-40 flex items-center justify-between gap-1 font-mono text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 text-camublue-900 hover:border-camublue-300">
                      {f.tag} {copied === f.tag ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-slate-300" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{f.label}</p>
                      <p className="text-xs text-slate-400 truncate">ex. {f.example}</p>
                    </div>
                    {used.has(f.key) && (
                      <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">dans le modèle</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
