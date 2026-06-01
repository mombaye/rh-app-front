// src/pages/manager/ManagerAttestationsPage.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, X, CheckCircle, Clock, XCircle,
  Download, ChevronRight, AlertCircle,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import ManagerLayout from "@/layouts/ManagerLayout";
import { attestationService } from "@/services/attestationService";
import {
  AttestationRequest, AttestationDocumentType,
  DOC_TYPE_LABELS, DOC_TYPE_DESCRIPTIONS, EXTRA_FIELDS_CONFIG,
} from "@/types/attestation";

const ALL_TYPES = Object.keys(DOC_TYPE_LABELS) as AttestationDocumentType[];

const STATUS_CONFIG = {
  PENDING:   { label: "En attente",  icon: Clock,       cls: "bg-amber-50 text-amber-700 border-amber-200"       },
  PROCESSED: { label: "Traité",      icon: CheckCircle, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED:  { label: "Refusé",      icon: XCircle,     cls: "bg-red-50 text-red-700 border-red-200"             },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

export default function ManagerAttestationsPage() {
  const [requests,    setRequests]    = useState<AttestationRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [step,        setStep]        = useState<"type" | "fields">("type");
  const [selectedType, setSelectedType] = useState<AttestationDocumentType | null>(null);
  const [extraData,   setExtraData]   = useState<Record<string, string>>({});
  const [submitting,  setSubmitting]  = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRequests(await attestationService.getMine()); }
    catch { toast.error("Erreur lors du chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openModal = () => {
    setStep("type"); setSelectedType(null); setExtraData({}); setShowModal(true);
  };

  const handleSelectType = (t: AttestationDocumentType) => {
    setSelectedType(t);
    if (EXTRA_FIELDS_CONFIG[t].length === 0) { handleSubmit(t, {}); } else { setStep("fields"); }
  };

  const handleSubmit = async (docType: AttestationDocumentType, extra: Record<string, string>) => {
    for (const f of EXTRA_FIELDS_CONFIG[docType]) {
      if (f.required && !extra[f.key]) { toast.error(`"${f.label}" est obligatoire.`); return; }
    }
    setSubmitting(true);
    try {
      await attestationService.create({ document_type: docType, extra_data: extra });
      toast.success("Demande envoyée ! Le RH va traiter votre demande sous peu.");
      setShowModal(false); load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur lors de l'envoi");
    } finally { setSubmitting(false); }
  };

  const pending   = requests.filter(r => r.status === "PENDING");
  const processed = requests.filter(r => r.status === "PROCESSED");
  const rejected  = requests.filter(r => r.status === "REJECTED");

  return (
    <ManagerLayout>
      <div className="space-y-6 pb-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Mes attestations</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Demandez un document officiel — le RH le génère et vous l'envoie par email
            </p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#003c71]/90 transition shadow-sm">
            <Plus size={16} /> Nouvelle demande
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "En attente",      value: pending.length,   color: "text-amber-600",   bg: "bg-amber-50"   },
            { label: "Documents reçus", value: processed.length, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Refusées",        value: rejected.length,  color: "text-red-500",     bg: "bg-red-50"     },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-gray-100`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Liste ── */}
        {loading ? (
          <div className="flex justify-center py-16"><ImSpinner2 className="animate-spin text-[#003c71]" size={28} /></div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <FileText size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">Aucune demande pour le moment</p>
            <p className="text-gray-400 text-sm mt-1">Cliquez sur <span className="font-semibold">Nouvelle demande</span> pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const cfg  = STATUS_CONFIG[r.status];
              const Icon = cfg.icon;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#003c71]/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-[#003c71]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{r.document_type_display}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Demandé le {fmtDate(r.created_at)}
                      {r.processed_at && ` · Traité le ${fmtDate(r.processed_at)}`}
                    </p>
                    {r.notes && r.status === "REJECTED" && (
                      <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertCircle size={11} /> {r.notes}
                      </p>
                    )}
                  </div>
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls} shrink-0`}>
                    <Icon size={12} />{cfg.label}
                  </span>
                  {r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noreferrer" download
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shrink-0">
                      <Download size={13} /> Télécharger
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ Modal ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !submitting && setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

              <div className="bg-[#003c71] px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <FileText size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Nouvelle demande d'attestation</p>
                    <p className="text-white/60 text-xs">
                      {step === "type" ? "Sélectionnez le type de document" : DOC_TYPE_LABELS[selectedType!]}
                    </p>
                  </div>
                </div>
                <button onClick={() => !submitting && setShowModal(false)}
                  className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                  <X size={14} className="text-white" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6">
                {step === "type" && (
                  <div className="space-y-2.5">
                    {ALL_TYPES.map(t => (
                      <button key={t} onClick={() => handleSelectType(t)} disabled={submitting}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:border-[#003c71]/40 hover:bg-[#003c71]/5 transition group text-left disabled:opacity-50">
                        <div className="w-9 h-9 rounded-xl bg-[#003c71]/10 group-hover:bg-[#003c71]/20 flex items-center justify-center shrink-0 transition">
                          <FileText size={16} className="text-[#003c71]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{DOC_TYPE_LABELS[t]}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{DOC_TYPE_DESCRIPTIONS[t]}</p>
                        </div>
                        {submitting && selectedType === t
                          ? <ImSpinner2 className="animate-spin text-[#003c71] shrink-0" size={16} />
                          : <ChevronRight size={16} className="text-gray-300 group-hover:text-[#003c71] shrink-0 transition" />
                        }
                      </button>
                    ))}
                  </div>
                )}

                {step === "fields" && selectedType && (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-xs text-blue-700">Ces informations seront intégrées directement dans le document officiel.</p>
                    </div>
                    {EXTRA_FIELDS_CONFIG[selectedType].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>
                        <input type={field.type} value={extraData[field.key] || ""}
                          onChange={e => setExtraData(p => ({ ...p, [field.key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition" />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setStep("type")}
                        className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                        Retour
                      </button>
                      <button onClick={() => handleSubmit(selectedType, extraData)} disabled={submitting}
                        className="flex-[2] bg-[#003c71] hover:bg-[#003c71]/90 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                        {submitting ? <><ImSpinner2 className="animate-spin" size={14} /> Envoi…</> : "Envoyer la demande"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ManagerLayout>
  );
}
