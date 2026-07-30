// src/pages/employee/EmployeeAttestationsPage.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileBadge, Plus, X, CheckCircle2, Clock, XCircle,
  Download, ChevronRight, AlertCircle, RefreshCw, FileText,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { useAuth } from "@/contexts/useAuth";

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;
import { attestationService, getAttestationProfile, AttestationProfile } from "@/services/attestationService";
import {
  AttestationRequest, AttestationDocumentType,
  DOC_TYPE_LABELS, DOC_TYPE_DESCRIPTIONS, EXTRA_FIELDS_CONFIG,
} from "@/types/attestation";

const ALL_TYPES = Object.keys(DOC_TYPE_LABELS) as AttestationDocumentType[];

const STATUS_CONFIG: Record<string, {
  label: string; Icon: React.ElementType;
  textColor: string; bg: string; borderColor: string; dot: string;
}> = {
  PENDING:   { label: "En attente",  Icon: Clock,         textColor: "text-amber-700",   bg: "bg-amber-50",   borderColor: "border-amber-200",   dot: "bg-amber-400"   },
  GENERATED: { label: "En attente",  Icon: Clock,         textColor: "text-amber-700",   bg: "bg-amber-50",   borderColor: "border-amber-200",   dot: "bg-amber-400"   },
  PROCESSED: { label: "Traité",      Icon: CheckCircle2,  textColor: "text-emerald-700", bg: "bg-emerald-50", borderColor: "border-emerald-200", dot: "bg-emerald-500" },
  REJECTED:  { label: "Refusé",      Icon: XCircle,       textColor: "text-red-600",     bg: "bg-red-50",     borderColor: "border-red-200",     dot: "bg-red-400"     },
};

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const fmt = (d: string) => {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
};

export default function EmployeeAttestationsPage({ layout: Layout = EmployeeLayout, selfOnly = false }: { layout?: LayoutComponent; selfOnly?: boolean }) {
  const { user } = useAuth();
  const [requests,    setRequests]    = useState<AttestationRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [step,        setStep]        = useState<"type" | "fields">("type");
  const [selectedType, setSelectedType] = useState<AttestationDocumentType | null>(null);
  const [extraData,   setExtraData]   = useState<Record<string, string>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [profile,     setProfile]     = useState<AttestationProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = selfOnly && user?.employee_id ? { employee_id: user.employee_id } : undefined;
      setRequests(await attestationService.getMine(params));
    }
    catch { toast.error("Erreur lors du chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [selfOnly, user?.employee_id]);

  const openModal = async () => {
    setStep("type"); setSelectedType(null); setExtraData({}); setShowModal(true);
    // Charger le profil une seule fois
    if (!profile) {
      setProfileLoading(true);
      try { setProfile(await getAttestationProfile()); }
      catch { /* non bloquant */ }
      finally { setProfileLoading(false); }
    }
  };

  const handleSelectType = (t: AttestationDocumentType) => {
    setSelectedType(t);
    const fields = EXTRA_FIELDS_CONFIG[t];
    if (fields.length === 0) {
      handleSubmit(t, {});
    } else {
      setStep("fields");
    }
  };

  const handleSubmit = async (docType: AttestationDocumentType, extra: Record<string, string>) => {
    for (const f of EXTRA_FIELDS_CONFIG[docType]) {
      if (f.required && !extra[f.key]) { toast.error(`Le champ "${f.label}" est obligatoire.`); return; }
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

  const pending   = requests.filter(r => r.status === "PENDING" || r.status === "GENERATED").length;
  const processed = requests.filter(r => r.status === "PROCESSED").length;
  const rejected  = requests.filter(r => r.status === "REJECTED").length;

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-camublue-900/10">
              <FileBadge size={24} className="text-camublue-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-camublue-900">Demandes Attestation</h1>
              <p className="text-sm text-gray-500">
                Demandez un document officiel — généré et envoyé par email par le RH
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg border bg-white hover:bg-gray-50 transition"
              title="Rafraîchir"
            >
              <RefreshCw size={16} className="text-gray-500" />
            </button>
            <button
              onClick={openModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium hover:bg-camublue-900/90 transition"
            >
              <Plus size={16} /> Nouvelle demande
            </button>
          </div>
        </div>

        {/* ── Cartes stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "En attente",      value: pending,   dot: "bg-amber-400"   },
            { label: "Documents reçus", value: processed, dot: "bg-emerald-500" },
            { label: "Refusées",        value: rejected,  dot: "bg-red-400"     },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-200 bg-white">
              <span className="text-2xl font-bold text-camublue-900">{s.value}</span>
              <span className="text-xs mt-1 font-medium text-gray-600 inline-flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Liste des demandes ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <ImSpinner2 className="animate-spin text-camublue-900" size={28} />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm p-16 text-center">
            <FileBadge size={40} className="mx-auto mb-3 text-camublue-900/20" />
            <p className="text-gray-500 font-medium">Aucune demande pour le moment</p>
            <p className="text-gray-400 text-sm mt-1">
              Cliquez sur <span className="font-semibold">Nouvelle demande</span> pour commencer
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Date demande</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map(r => {
                  const cfg  = STATUS_CONFIG[r.status];
                  const Icon = cfg.Icon;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      {/* Document */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-camublue-900 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-800">{r.document_type_display}</p>
                            {r.notes && r.status === "REJECTED" && (
                              <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                                <AlertCircle size={11} /> {r.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {fmt(r.created_at)}
                        {r.processed_at && (
                          <p className="text-gray-400 mt-0.5">Traité le {fmt(r.processed_at)}</p>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.textColor} ${cfg.borderColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <Icon size={12} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {r.pdf_url ? (
                            <a
                              href={r.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-camublue-900 hover:bg-camublue-900/90 text-white text-xs font-medium transition"
                            >
                              <Download size={13} /> Télécharger
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300 italic">En attente de traitement</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Modal Nouvelle Demande ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !submitting && setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <FileBadge size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Nouvelle demande d'attestation</p>
                    <p className="text-white/60 text-xs">
                      {step === "type" ? "Sélectionnez le type de document" : DOC_TYPE_LABELS[selectedType!]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !submitting && setShowModal(false)}
                  className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6">

                {/* ── Étape 1 : Choix du type ── */}
                {step === "type" && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Sélectionnez le type de document que vous souhaitez obtenir.
                    </p>
                    {profileLoading && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                        <ImSpinner2 className="animate-spin" size={12} /> Chargement de votre profil…
                      </div>
                    )}
                    {ALL_TYPES.map(t => (
                      <button
                        key={t}
                        onClick={() => handleSelectType(t)}
                        disabled={submitting}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 hover:border-camublue-900/40 hover:bg-camublue-900/5 transition group text-left disabled:opacity-50"
                      >
                        <div className="w-9 h-9 rounded-xl bg-camublue-900/10 group-hover:bg-camublue-900/15 flex items-center justify-center shrink-0 transition">
                          <FileText size={16} className="text-camublue-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{DOC_TYPE_LABELS[t]}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{DOC_TYPE_DESCRIPTIONS[t]}</p>
                        </div>
                        {submitting && selectedType === t ? (
                          <ImSpinner2 className="animate-spin text-camublue-900 shrink-0" size={16} />
                        ) : (
                          <ChevronRight size={16} className="text-gray-300 group-hover:text-camublue-900 shrink-0 transition" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Étape 2 : Champs supplémentaires ── */}
                {step === "fields" && selectedType && (
                  <div className="space-y-4">

                    {/* Récapitulatif des données du profil utilisées */}
                    {profile && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                        <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Données récupérées depuis votre dossier
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {profile.prenom && profile.nom && (
                            <span className="text-blue-700"><span className="text-blue-500">Nom :</span> {profile.prenom} {profile.nom}</span>
                          )}
                          {profile.fonction && (
                            <span className="text-blue-700"><span className="text-blue-500">Poste :</span> {profile.fonction}</span>
                          )}
                          {profile.date_naissance && (
                            <span className="text-blue-700"><span className="text-blue-500">Date naissance :</span> {profile.date_naissance}</span>
                          )}
                          {profile.lieu_naissance && (
                            <span className="text-blue-700"><span className="text-blue-500">Lieu naissance :</span> {profile.lieu_naissance}</span>
                          )}
                          {profile.numero_piece && (
                            <span className="text-blue-700"><span className="text-blue-500">Pièce d'identité :</span> {profile.numero_piece}</span>
                          )}
                          {profile.date_embauche && (
                            <span className="text-blue-700"><span className="text-blue-500">Date embauche :</span> {profile.date_embauche}</span>
                          )}
                          {(selectedType === "DOMICILIATION_CDI" || selectedType === "DOMICILIATION_CDD") && profile.banque && (
                            <span className="text-blue-700"><span className="text-blue-500">Banque :</span> {profile.banque}</span>
                          )}
                          {(selectedType === "DOMICILIATION_CDI" || selectedType === "DOMICILIATION_CDD") && profile.rib && (
                            <span className="text-blue-700"><span className="text-blue-500">RIB :</span> {profile.rib}</span>
                          )}
                        </div>
                        {((selectedType === "DOMICILIATION_CDI" || selectedType === "DOMICILIATION_CDD") && (!profile.banque || !profile.rib)) && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1">
                            ⚠ Banque / RIB manquants dans votre dossier — renseignez-les auprès du RH.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Champs à saisir */}
                    {EXTRA_FIELDS_CONFIG[selectedType].map(field => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>
                        <input
                          type={field.type}
                          value={extraData[field.key] || ""}
                          onChange={e => setExtraData(p => ({ ...p, [field.key]: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900/20 focus:border-camublue-900 outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer boutons — champs extra uniquement */}
              {step === "fields" && selectedType && (
                <div className="px-6 pb-6 flex gap-2">
                  <button
                    onClick={() => setStep("type")}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Retour
                  </button>
                  <button
                    onClick={() => handleSubmit(selectedType, extraData)}
                    disabled={submitting}
                    className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
                  >
                    {submitting
                      ? <><ImSpinner2 className="animate-spin" size={14} /> Envoi en cours…</>
                      : "Envoyer la demande"
                    }
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
