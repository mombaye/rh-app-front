import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Save, Loader2, TableProperties, Lock, Paintbrush, X as XIcon, Search } from "lucide-react";
import api from "@/api/axios";
import toast from "react-hot-toast";
import ManagerLayout from "@/layouts/ManagerLayout";

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

const CODES = ["", "X", "Y", "Z", "C", "A", "M"] as const;
type DayCode = typeof CODES[number];

const CODE_META: Record<DayCode, { label: string; bg: string; text: string; ring: string; desc: string }> = {
  "":  { label: "—", bg: "bg-gray-100",     text: "text-gray-400",     ring: "ring-gray-400",     desc: "Effacer"      },
  X:   { label: "X", bg: "bg-emerald-100",  text: "text-emerald-700",  ring: "ring-emerald-500",  desc: "Présent"      },
  Y:   { label: "Y", bg: "bg-amber-100",    text: "text-amber-700",    ring: "ring-amber-500",    desc: "Heures sup."  },
  Z:   { label: "Z", bg: "bg-purple-100",   text: "text-purple-700",   ring: "ring-purple-500",   desc: "Astreintes"   },
  C:   { label: "C", bg: "bg-sky-100",      text: "text-sky-700",      ring: "ring-sky-500",      desc: "Congés"       },
  A:   { label: "A", bg: "bg-orange-100",   text: "text-orange-700",   ring: "ring-orange-500",   desc: "Sortie"       },
  M:   { label: "M", bg: "bg-rose-100",     text: "text-rose-700",     ring: "ring-rose-500",     desc: "Maladie"      },
};

interface OmRow {
  employee_id: number;
  matricule: string;
  nom: string;
  prenom: string;
  daily_codes: Record<string, DayCode>;
  days_in_month: number;
  commentaires: string;
}

function computeTotals(codes: Record<string, DayCode>) {
  let nbX = 0, nbY = 0, nbZ = 0;
  for (const v of Object.values(codes)) {
    if (v === "X") nbX++;
    else if (v === "Y") nbY++;
    else if (v === "Z") nbZ++;
  }
  return {
    jours_travailles: nbX + nbY + nbZ,
    jours_normaux: nbX,
    nb_heures_sup: nbY,
    nb_jours_astreintes: nbZ,
    heures_normales: nbX * 8,
    heures_sup_effectuees: nbY * 8,
    heures_astreintes: nbZ * 8,
    heures_totales: (nbX + nbY + nbZ) * 8,
  };
}

/** Compute current period label and year/month from today's date */
function getCurrentPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const label = `15 ${MONTHS_FR[prevMonth - 1]} au 15 ${MONTHS_FR[month - 1]} ${year}`;
  return { year, month, label };
}

/** Popup flottant pour sélection libre (mode normal) */
function CodePicker({
  anchorRef,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  onSelect: (code: DayCode) => void;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  const anchor = anchorRef.current;
  const rect = anchor?.getBoundingClientRect();
  const style: React.CSSProperties = rect
    ? { position: "fixed", top: rect.bottom + 4, left: Math.max(0, rect.left - 24), zIndex: 9999 }
    : { display: "none" };

  return (
    <div ref={popupRef} style={style} className="bg-white rounded-xl shadow-xl border border-slate-200 p-2 flex flex-col gap-1 min-w-[120px]">
      {(CODES as readonly DayCode[]).map(code => {
        const m = CODE_META[code];
        return (
          <button
            key={code || "_empty"}
            onClick={() => { onSelect(code); onClose(); }}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors hover:brightness-95 ${m.bg} ${m.text}`}
          >
            <span className="w-5 h-5 flex items-center justify-center font-bold">{m.label}</span>
            <span className="font-normal">{m.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Cellule individuelle — comportement selon le mode pinceau */
function CellButton({
  code,
  onChange,
  disabled,
  brushCode,
}: {
  code: DayCode;
  onChange: (code: DayCode) => void;
  disabled: boolean;
  brushCode: DayCode | null;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const m = CODE_META[code];

  if (disabled) {
    return (
      <div className={`w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center mx-auto ${m.bg} ${m.text} opacity-70`}>
        {code || "·"}
      </div>
    );
  }

  // Mode pinceau actif : un seul clic applique directement le code du pinceau
  if (brushCode !== null) {
    const bm = CODE_META[brushCode];
    return (
      <button
        onClick={() => onChange(brushCode)}
        className={`w-7 h-7 rounded text-[10px] font-bold transition-all active:scale-90 cursor-crosshair ${m.bg} ${m.text} hover:ring-2 hover:${bm.ring}`}
        title={`Appliquer : ${bm.desc}`}
      >
        {code || "·"}
      </button>
    );
  }

  // Mode normal : popup au clic
  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`w-7 h-7 rounded text-[10px] font-bold transition-all hover:scale-110 active:scale-95 ${m.bg} ${m.text}`}
        title={m.desc}
      >
        {code || "·"}
      </button>
      {open && (
        <CodePicker
          anchorRef={btnRef}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export default function ManagerOmPointagePage() {
  const { year, month, label: periodLabel } = getCurrentPeriod();
  const [rows, setRows] = useState<OmRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [localCodes, setLocalCodes] = useState<Record<number, Record<string, DayCode>>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [search, setSearch] = useState("");
  // Mode pinceau : null = désactivé, code = pinceau actif
  const [brushCode, setBrushCode] = useState<DayCode | null>(null);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.nom.toLowerCase().includes(q) ||
      r.prenom.toLowerCase().includes(q) ||
      r.matricule.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setDirty(new Set());
    setLocalCodes({});
    setBrushCode(null);
    try {
      const res = await api.get(`/api/attendance/om-pointage/my-team/?year=${year}&month=${month}`);
      setRows(res.data.rows || []);
      const initial: Record<number, Record<string, DayCode>> = {};
      for (const row of res.data.rows || []) {
        initial[row.employee_id] = { ...row.daily_codes };
      }
      setLocalCodes(initial);
      const locked = res.data.locked ?? false;
      setIsLocked(locked);
      if (locked) {
        if (res.data.past_deadline) setLockReason("La date limite du 15 est dépassée.");
        else if (res.data.rh_locked) setLockReason("La saisie a été désactivée par le RH.");
      }
    } catch {
      toast.error("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function setCode(employeeId: number, day: number, code: DayCode) {
    if (isLocked) return;
    setLocalCodes(prev => {
      const empCodes = { ...(prev[employeeId] || {}) };
      if (code === "") { delete empCodes[String(day)]; }
      else { empCodes[String(day)] = code; }
      return { ...prev, [employeeId]: empCodes };
    });
    setDirty(prev => new Set(prev).add(employeeId));
  }

  function toggleBrush(code: DayCode) {
    setBrushCode(prev => prev === code ? null : code);
  }

  async function saveRow(employeeId: number) {
    if (isLocked) return;
    setSaving(employeeId);
    try {
      const codes = localCodes[employeeId] || {};
      const row = rows.find(r => r.employee_id === employeeId);
      await api.post("/api/attendance/om-pointage/save/", {
        employee_id: employeeId, year, month,
        daily_codes: codes,
        commentaires: row?.commentaires || "",
      });
      setDirty(prev => { const s = new Set(prev); s.delete(employeeId); return s; });
      toast.success("Pointage enregistré.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(null);
    }
  }

  async function saveAll() {
    if (isLocked) return;
    const dirtyIds = Array.from(dirty);
    if (!dirtyIds.length) return;
    setSaving(-1);
    let ok = 0, errCount = 0;
    for (const eid of dirtyIds) {
      try {
        const codes = localCodes[eid] || {};
        const row = rows.find(r => r.employee_id === eid);
        await api.post("/api/attendance/om-pointage/save/", {
          employee_id: eid, year, month,
          daily_codes: codes,
          commentaires: row?.commentaires || "",
        });
        setDirty(prev => { const s = new Set(prev); s.delete(eid); return s; });
        ok++;
      } catch { errCount++; }
    }
    setSaving(null);
    if (ok > 0) toast.success(`${ok} ligne(s) enregistrée(s).`);
    if (errCount > 0) toast.error(`${errCount} erreur(s).`);
  }

  const activeBrushMeta = brushCode !== null ? CODE_META[brushCode] : null;

  return (
    <ManagerLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Ligne 1 : titre à gauche, recherche + bouton à droite */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#003c71] flex items-center justify-center shadow shrink-0">
                <TableProperties size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Pointage O&M</h1>
                <p className="text-xs text-slate-500">Période : {periodLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Barre de recherche */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un employé..."
                  className="pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 w-72"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <XIcon size={13} />
                  </button>
                )}
              </div>
              {/* Bouton enregistrer */}
              {!isLocked && dirty.size > 0 && (
                <button
                  onClick={saveAll}
                  disabled={saving !== null}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold hover:bg-[#003c71]/90 transition shadow whitespace-nowrap"
                >
                  {saving === -1 ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Tout enregistrer ({dirty.size})
                </button>
              )}
            </div>
          </div>

          {/* Compteur de recherche */}
          {search && (
            <p className="text-xs text-slate-400 self-end">
              {filteredRows.length} résultat{filteredRows.length !== 1 ? "s" : ""} sur {rows.length}
            </p>
          )}

          {/* Bannière verrou */}
          {isLocked && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
              <Lock size={16} className="shrink-0" />
              <span>{lockReason || "La saisie est désactivée pour cette période."}</span>
            </div>
          )}

          {/* Ligne 2 : légende + mode pinceau (seulement si saisie ouverte) */}
          {!isLocked && (
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:justify-end">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 sm:mt-1.5 shrink-0">
                <Paintbrush size={12} className={activeBrushMeta ? activeBrushMeta.text : "text-slate-400"} />
                {activeBrushMeta
                  ? <span className={`font-medium ${activeBrushMeta.text}`}>{activeBrushMeta.label} actif</span>
                  : <span>Pinceau :</span>
                }
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["X","Y","Z","C","A","M",""] as DayCode[]).map(code => {
                  const m = CODE_META[code];
                  const isActive = brushCode === code;
                  return (
                    <button
                      key={code || "_empty"}
                      onClick={() => toggleBrush(code)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all select-none
                        ${m.bg} ${m.text}
                        ${isActive
                          ? `ring-2 ${m.ring} scale-105 shadow-sm`
                          : "ring-1 ring-transparent hover:ring-2 hover:scale-105 opacity-75 hover:opacity-100"
                        }`}
                      title={isActive ? `Désactiver` : `Pinceau : ${m.desc}`}
                    >
                      {code ? <span className="font-bold">{code}</span> : null}
                      <span>{code ? m.desc : "Effacer"}</span>
                      {isActive && <XIcon size={10} className="ml-0.5 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Aucun employé dans votre équipe.</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Aucun résultat pour « {search} ».</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
            <table className="text-xs border-collapse" style={{ minWidth: `${200 + daysInMonth * 30 + 220}px` }}>
              <thead>
                <tr className="bg-[#003c71] text-white select-none">
                  <th className="sticky left-0 bg-[#003c71] px-3 py-2.5 text-left font-semibold min-w-[160px] z-10 border-r border-white/10">Employé</th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                    <th key={d} className="w-7 py-2.5 text-center font-medium text-white/80 text-[10px]">{d}</th>
                  ))}
                  <th className="px-2 py-2.5 text-center font-semibold">Jours</th>
                  <th className="px-2 py-2.5 text-center font-semibold">HS</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Astr.</th>
                  <th className="px-2 py-2.5 text-center font-semibold">H.norm</th>
                  <th className="px-2 py-2.5 text-center font-semibold">H.total</th>
                  {!isLocked && <th className="px-2 py-2.5 text-center font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const codes = localCodes[row.employee_id] || {};
                  const totals = computeTotals(codes);
                  const isDirty = dirty.has(row.employee_id);
                  const isSaving = saving === row.employee_id;
                  return (
                    <tr
                      key={row.employee_id}
                      className={`border-t border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} ${isDirty ? "ring-1 ring-inset ring-amber-300" : ""}`}
                    >
                      <td className="sticky left-0 px-3 py-2 font-medium text-slate-800 z-10 border-r border-slate-100" style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <div className="truncate max-w-[155px]">{row.nom} {row.prenom}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{row.matricule}</div>
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                        const code = (codes[String(d)] as DayCode) || "";
                        return (
                          <td key={d} className="p-0.5 text-center">
                            <CellButton
                              code={code}
                              onChange={newCode => setCode(row.employee_id, d, newCode)}
                              disabled={isLocked}
                              brushCode={isLocked ? null : brushCode}
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center font-semibold text-slate-700">{totals.jours_travailles}</td>
                      <td className="px-2 py-2 text-center font-semibold text-amber-600">{totals.nb_heures_sup}</td>
                      <td className="px-2 py-2 text-center font-semibold text-purple-600">{totals.nb_jours_astreintes}</td>
                      <td className="px-2 py-2 text-center text-slate-600">{totals.heures_normales}h</td>
                      <td className="px-2 py-2 text-center font-bold text-slate-800">{totals.heures_totales}h</td>
                      {!isLocked && (
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => saveRow(row.employee_id)}
                            disabled={!isDirty || saving !== null}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${isDirty ? "bg-[#003c71] text-white hover:bg-[#003c71]/80 shadow-sm" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                          >
                            {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                            {isSaving ? "..." : "Enreg."}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
