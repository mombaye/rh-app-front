import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck, KeyRound, Eye, EyeOff, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import { forgotPassword, verifyOtp, resetPasswordOtp } from "@/services/userService";

// ── Types ──────────────────────────────────────────────────────────────────────
type Step = "email" | "otp" | "password" | "success";

// ── Indicateur d'étapes ────────────────────────────────────────────────────────
const STEPS: { id: Step; label: string }[] = [
  { id: "email",    label: "Email"          },
  { id: "otp",      label: "Vérification"   },
  { id: "password", label: "Nouveau mot de passe" },
];

function StepIndicator({ current }: { current: Step }) {
  const order: Step[] = ["email", "otp", "password", "success"];
  const idx = order.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => {
        const done    = i < idx;
        const active  = s.id === current;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex flex-col items-center gap-1`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done   ? "bg-camublue-900 text-white" :
                active ? "bg-camublue-900 text-white ring-4 ring-camublue-900/20" :
                         "bg-slate-100 text-slate-400"
              }`}>
                {done ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-camublue-900" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 rounded-full transition-all ${i < idx ? "bg-camublue-900" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Input OTP 6 cases ──────────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/, "").slice(-1);
    const arr = value.split("").concat(Array(6).fill("")).slice(0, 6);
    arr[i] = digit;
    const next = arr.join("");
    onChange(next);
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, "").slice(0, 6));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          className={`w-11 h-13 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
            ${value[i] ? "border-camublue-900 bg-camublue-900/5 text-camublue-900" : "border-slate-200 bg-slate-50 text-slate-800"}
            focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20`}
        />
      ))}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step,        setStep]        = useState<Step>("email");
  const [email,       setEmail]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown renvoi OTP
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const clearError = () => setError(null);

  // ── Étape 1 : envoi email ──────────────────────────────────────────────────
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); clearError();
    try {
      await forgotPassword(email.trim());
      setOtp("");
      setStep("otp");
      setResendTimer(60);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erreur lors de l'envoi. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true); clearError();
    try {
      await forgotPassword(email.trim());
      setOtp("");
      setResendTimer(60);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erreur lors du renvoi.");
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 2 : vérification OTP ─────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.replace(/\s/g, "").length < 6) {
      setError("Entrez le code à 6 chiffres reçu par email.");
      return;
    }
    setLoading(true); clearError();
    try {
      await verifyOtp(email, otp);
      setStep("password");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 3 : nouveau mot de passe ─────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPwd) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true); clearError();
    try {
      await resetPasswordOtp(email, otp, newPassword);
      setStep("success");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erreur lors de la réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    enter:  { x: 40, opacity: 0 },
    center: { x: 0,  opacity: 1 },
    exit:   { x: -40, opacity: 0 },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-8 pb-4">
            <div className="flex items-center gap-3 mb-6">
              <Link
                to="/login"
                className="p-1.5 rounded-xl text-slate-400 hover:text-camublue-900 hover:bg-slate-100 transition"
              >
                <ArrowLeft size={18} />
              </Link>
              <img src={logo} alt="Camusat" className="h-8 object-contain" />
            </div>

            {step !== "success" && (
              <>
                <h1 className="text-2xl font-bold text-slate-800 mb-1">Mot de passe oublié</h1>
                <p className="text-sm text-slate-400 mb-5">
                  {step === "email"    && "Entrez votre adresse email pour recevoir un code de vérification."}
                  {step === "otp"      && `Code envoyé à ${email}. Vérifiez votre boîte email.`}
                  {step === "password" && "Choisissez un nouveau mot de passe sécurisé."}
                </p>
                <StepIndicator current={step} />
              </>
            )}
          </div>

          {/* Contenu animé */}
          <div className="px-8 pb-8">
            <AnimatePresence mode="wait">

              {/* ── Étape 1 : Email ── */}
              {step === "email" && (
                <motion.form
                  key="email"
                  variants={variants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSendEmail}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                      Adresse email
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        placeholder="votre.email@camusat.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); clearError(); }}
                        required
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                      />
                    </div>
                  </div>

                  {error && <ErrorBox msg={error} />}

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={15} /> Envoyer le code</>}
                  </button>
                </motion.form>
              )}

              {/* ── Étape 2 : OTP ── */}
              {step === "otp" && (
                <motion.form
                  key="otp"
                  variants={variants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.2 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-5"
                >
                  <OtpInput value={otp} onChange={(v) => { setOtp(v); clearError(); }} />

                  {error && <ErrorBox msg={error} />}

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><ShieldCheck size={15} /> Vérifier le code</>}
                  </button>

                  {/* Renvoi */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendTimer > 0 || loading}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-camublue-900 disabled:cursor-not-allowed disabled:opacity-50 transition"
                    >
                      <RefreshCw size={12} />
                      {resendTimer > 0 ? `Renvoyer le code (${resendTimer}s)` : "Renvoyer le code"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setStep("email"); clearError(); }}
                    className="w-full text-xs text-slate-400 hover:text-slate-600 transition"
                  >
                    ← Changer d'email
                  </button>
                </motion.form>
              )}

              {/* ── Étape 3 : Nouveau mot de passe ── */}
              {step === "password" && (
                <motion.form
                  key="password"
                  variants={variants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.2 }}
                  onSubmit={handleResetPassword}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPwd ? "text" : "password"}
                        placeholder="Au moins 6 caractères"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); clearError(); }}
                        required
                        autoFocus
                        className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                      />
                      <button type="button" onClick={() => setShowPwd((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Répétez le mot de passe"
                        value={confirmPwd}
                        onChange={(e) => { setConfirmPwd(e.target.value); clearError(); }}
                        required
                        className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                      />
                      <button type="button" onClick={() => setShowConfirm((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Indicateur force */}
                  {newPassword.length > 0 && (
                    <PasswordStrength password={newPassword} />
                  )}

                  {error && <ErrorBox msg={error} />}

                  <button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPwd}
                    className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><KeyRound size={15} /> Réinitialiser le mot de passe</>}
                  </button>
                </motion.form>
              )}

              {/* ── Succès ── */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-5 py-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"
                  >
                    <CheckCircle size={36} className="text-green-500" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Mot de passe mis à jour !</h2>
                    <p className="text-sm text-slate-500">
                      Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full flex items-center justify-center gap-2 bg-camublue-900 hover:bg-camublue-800 text-white py-3 rounded-xl font-semibold text-sm transition"
                  >
                    Se connecter
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-xs text-slate-300 mt-5">
          © {new Date().getFullYear()} Camusat Sénégal — RH
        </p>
      </motion.div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function ErrorBox({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700"
    >
      <span className="mt-0.5">⚠</span>
      <span>{msg}</span>
    </motion.div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "6 caractères minimum", ok: password.length >= 6 },
    { label: "Lettre majuscule",      ok: /[A-Z]/.test(password) },
    { label: "Chiffre",               ok: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const color = score === 3 ? "bg-green-500" : score === 2 ? "bg-amber-400" : "bg-red-400";
  const label = score === 3 ? "Fort" : score === 2 ? "Moyen" : "Faible";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < score ? color : "bg-slate-100"}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${score === 3 ? "text-green-600" : score === 2 ? "text-amber-600" : "text-red-500"}`}>
        Sécurité : {label}
      </p>
    </div>
  );
}
