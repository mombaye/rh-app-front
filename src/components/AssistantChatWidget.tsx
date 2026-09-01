import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Send, Bot, User, CheckCircle2, Loader2,
  ChevronRight, Headphones, Ticket, Sparkles, BarChart2,
  Calendar, Clock, AlertCircle, HelpCircle, FileText,
  TrendingUp, Users, ArrowRight, Info,
} from "lucide-react";
import { ticketService } from "@/services/ticketService";
import { leaveBalanceService, leaveRequestService } from "@/services/leaveService";
import { TicketCategory, CATEGORY_LABELS } from "@/types/ticket";
import { useAuth } from "@/contexts/useAuth";
import type { UserRole } from "@/contexts/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "guide" | "signalement";
type TicketStep = "category" | "describe" | "submitting" | "done" | "error";
type Intent =
  | "LEAVE_BALANCE" | "LEAVE_PENDING" | "LEAVE_APPROVED" | "LEAVE_HISTORY"
  | "HOW_TO_LEAVE" | "HOW_TO_CANCEL" | "HOW_TO_JUSTIF"
  | "PAYSLIP" | "ATTESTATION" | "ATTENDANCE" | "MISSION"
  | "TEAM_PENDING" | "TEAM_STATS" | "MIGRATION_GUIDE" | "ADD_EMPLOYEE"
  | "PLATFORM_GUIDE" | "TICKET" | "UNKNOWN";

interface StatCard { label: string; value: string | number; color: string; icon: string; }
interface BotMessage {
  id: number; from: "bot" | "user"; text: string;
  stats?: StatCard[]; chips?: string[]; loading?: boolean;
}

const CATEGORIES: TicketCategory[] = ["BLOCAGE", "ANOMALIE", "DIFFICULTE", "AUTRE"];
const CATEGORY_ICONS: Record<TicketCategory, string> = {
  BLOCAGE: "🚫", ANOMALIE: "⚠️", DIFFICULTE: "🔧", AUTRE: "💬",
};

// ── Détection d'intention par mots-clés ───────────────────────────────────────
function detectIntent(text: string): Intent {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/solde|restant|combien.*jour|jour.*restant|balance|disponible|acquis/.test(t)) return "LEAVE_BALANCE";
  if (/en attente|non traite|pas.*valide|encours|pending/.test(t)) return "LEAVE_PENDING";
  if (/approuv|accept|valide/.test(t) && /conge|demande/.test(t)) return "LEAVE_APPROVED";
  if (/historique|toutes.*demande|toutes.*conge|liste.*conge/.test(t)) return "LEAVE_HISTORY";
  if (/comment.*demand|comment.*poser|comment.*fair|nouveau.*conge|creer.*dem|soumettre|deposer/.test(t)) return "HOW_TO_LEAVE";
  if (/annul|retirer|supprimer|cancel/.test(t) && /demande|conge/.test(t)) return "HOW_TO_CANCEL";
  if (/justificatif|document|justif|certif.*medical|piece/.test(t)) return "HOW_TO_JUSTIF";
  if (/bulletin|paie|salaire|fiche.*paie|pay.*slip/.test(t)) return "PAYSLIP";
  if (/attestation|certificat.*travail|lettre.*travail|attestation.*emploi/.test(t)) return "ATTESTATION";
  if (/pointage|presence|heure.*travail|badg|entrée|sortie|attendance/.test(t)) return "ATTENDANCE";
  if (/mission|deplacement|voyage/.test(t)) return "MISSION";
  if (/equipe|team.*pend|demande.*equipe|validation/.test(t)) return "TEAM_PENDING";
  if (/statistique|bilan|effectif|rh.*stat|tableau.*bord|dashboard|tous.*employe/.test(t)) return "TEAM_STATS";
  if (/migration|import|fichier|excel|upload/.test(t)) return "MIGRATION_GUIDE";
  if (/ajouter.*employe|creer.*employe|nouveau.*employe|onboard/.test(t)) return "ADD_EMPLOYEE";
  if (/plateforme|utiliser|navigation|aide|guide|tuto|comment.*marche/.test(t)) return "PLATFORM_GUIDE";
  if (/ticket|probleme|bug|bloqu|anomalie|erreur|signaler|panne/.test(t)) return "TICKET";
  return "UNKNOWN";
}

// ── Quick chips selon le rôle ─────────────────────────────────────────────────
function getQuickChips(role: UserRole | null): string[] {
  if (role === "rh") return [
    "📊 Statistiques des congés", "⏳ Demandes en attente", "📂 Guide migration",
    "👤 Ajouter un employé", "📋 Guide plateforme",
  ];
  if (role === "manager1" || role === "manager2") return [
    "👥 Demandes de mon équipe", "📅 Mon solde de congé",
    "❓ Comment valider une demande", "📋 Guide plateforme",
  ];
  return [
    "📅 Mon solde de congé", "⏳ Mes demandes en attente",
    "❓ Comment poser un congé", "🏥 Justificatif médical",
    "📄 Bulletin de paie",
  ];
}

// ── Message de bienvenue selon le rôle ───────────────────────────────────────
function getWelcome(role: UserRole | null, name?: string | null): string {
  const prenom = name?.split(" ").pop() || "";
  if (role === "rh")
    return `Bonjour${prenom ? " " + prenom : ""} 👋\n\nJe suis votre **Assistant eRH CAMUSAT**. Je peux vous aider à :\n\n• Consulter les statistiques et soldes\n• Guider sur les fonctionnalités de la plateforme\n• Répondre à vos questions RH\n\nQue puis-je faire pour vous ?`;
  if (role === "manager1" || role === "manager2")
    return `Bonjour${prenom ? " " + prenom : ""} 👋\n\nJe suis votre **Assistant eRH**. En tant que manager, je peux vous aider à :\n\n• Suivre les demandes de votre équipe\n• Consulter votre solde de congé\n• Vous guider sur la plateforme\n\nComment puis-je vous aider ?`;
  return `Bonjour${prenom ? " " + prenom : ""} 👋\n\nJe suis votre **Assistant eRH CAMUSAT**. Je peux vous aider à :\n\n• Consulter votre solde de congé\n• Suivre vos demandes\n• Vous guider sur la plateforme\n\nQue souhaitez-vous savoir ?`;
}

// ── Handlers de réponses ──────────────────────────────────────────────────────
async function handleLeaveBalance(
  employeeId: number | null | undefined
): Promise<Omit<BotMessage, "id" | "from">> {
  if (!employeeId) {
    return {
      text: "Je n'ai pas accès à votre dossier employé pour afficher votre solde. Vérifiez que votre compte est bien lié à un dossier dans la plateforme.",
      chips: ["📋 Contacter la RH"],
    };
  }
  try {
    const year = new Date().getFullYear();
    const balances = await leaveBalanceService.getByEmployee(employeeId, year);
    const primary = balances.find((b: any) => b.leave_type?.deducts_from_balance) ?? balances[0];
    if (!primary) {
      return { text: `Aucun solde de congé configuré pour ${year}. Contactez la RH pour plus d'informations.` };
    }
    const remaining = Math.round(parseFloat(primary.remaining || "0"));
    const taken = Math.round(parseFloat(primary.taken || "0"));
    const acquired = Math.round(parseFloat(primary.acquired || "0"));
    const fileTaken = Math.round(parseFloat(primary.file_taken || "0"));
    const totalTaken = taken + fileTaken;
    return {
      text: `Voici votre solde de congé **${primary.leave_type?.label || "Congé Annuel"}** pour **${year}** :`,
      stats: [
        { label: "Solde disponible", value: `${remaining} j`, color: "blue", icon: "📅" },
        { label: "Congés pris (plateforme)", value: `${taken} j`, color: "red", icon: "✅" },
        { label: "Jours acquis", value: `${acquired} j`, color: "green", icon: "⬆️" },
        ...(fileTaken > 0 ? [{ label: "Pris avant plateforme", value: `${fileTaken} j`, color: "gray", icon: "📂" }] : []),
      ],
      chips: ["⏳ Mes demandes en attente", "❓ Comment poser un congé"],
    };
  } catch {
    return { text: "Impossible de récupérer votre solde pour l'instant. Réessayez plus tard ou contactez la RH." };
  }
}

async function handleLeavePending(
  employeeId: number | null | undefined
): Promise<Omit<BotMessage, "id" | "from">> {
  if (!employeeId) return { text: "Dossier employé non lié. Contactez la RH.", chips: ["📋 Contacter la RH"] };
  try {
    const reqs = await leaveRequestService.getByEmployee(employeeId);
    const pending = reqs.filter((r: any) => r.status?.startsWith("PENDING"));
    if (pending.length === 0) {
      return {
        text: "Vous n'avez aucune demande de congé en attente de validation en ce moment.",
        chips: ["📅 Mon solde de congé", "❓ Comment poser un congé"],
      };
    }
    const list = pending.slice(0, 3).map((r: any) =>
      `• **${r.leave_type?.label}** — ${r.start_date} → ${r.end_date} (${r.days} j)`
    ).join("\n");
    return {
      text: `Vous avez **${pending.length} demande(s) en attente** :\n\n${list}${pending.length > 3 ? `\n\n_...et ${pending.length - 3} autre(s)_` : ""}`,
      stats: [{ label: "En attente", value: pending.length, color: "amber", icon: "⏳" }],
      chips: ["📅 Mon solde de congé", "❓ Comment annuler une demande"],
    };
  } catch {
    return { text: "Impossible de récupérer vos demandes. Réessayez plus tard." };
  }
}

async function handleLeaveApproved(
  employeeId: number | null | undefined
): Promise<Omit<BotMessage, "id" | "from">> {
  if (!employeeId) return { text: "Dossier employé non lié. Contactez la RH." };
  try {
    const reqs = await leaveRequestService.getByEmployee(employeeId);
    const approved = reqs.filter((r: any) => r.status === "APPROVED");
    if (approved.length === 0) {
      return { text: "Vous n'avez aucun congé approuvé pour le moment.", chips: ["❓ Comment poser un congé"] };
    }
    const totalDays = approved.reduce((s: number, r: any) => s + parseFloat(r.days || "0"), 0);
    const list = approved.slice(0, 3).map((r: any) =>
      `• **${r.leave_type?.label}** — ${r.start_date} → ${r.end_date} (${r.days} j)`
    ).join("\n");
    return {
      text: `Vous avez **${approved.length} congé(s) approuvé(s)** :\n\n${list}${approved.length > 3 ? `\n\n_...et ${approved.length - 3} autre(s)_` : ""}`,
      stats: [
        { label: "Approuvés", value: approved.length, color: "green", icon: "✅" },
        { label: "Total jours", value: `${Math.round(totalDays)} j`, color: "blue", icon: "📅" },
      ],
      chips: ["📅 Mon solde de congé"],
    };
  } catch {
    return { text: "Impossible de récupérer vos congés approuvés." };
  }
}

function handleHowToLeave(role: UserRole | null): Omit<BotMessage, "id" | "from"> {
  return {
    text: `**Comment soumettre une demande de congé :**\n\n1️⃣ Rendez-vous sur **Mes Congés** dans le menu\n2️⃣ Cliquez sur **Nouvelle demande**\n3️⃣ Choisissez le **type de congé**\n4️⃣ Sélectionnez les **dates** (début et fin)\n5️⃣ Ajoutez un **motif** si nécessaire\n6️⃣ Cliquez sur **Envoyer la demande**\n\n✅ Votre manager sera notifié automatiquement.`,
    chips: ["📅 Mon solde de congé", "⏳ Mes demandes en attente", "🏥 Justificatif médical"],
  };
}

function handleHowToCancel(): Omit<BotMessage, "id" | "from"> {
  return {
    text: `**Comment annuler une demande de congé :**\n\n1️⃣ Allez sur **Mes Congés**\n2️⃣ Trouvez la demande que vous voulez annuler\n3️⃣ Cliquez sur la demande pour l'ouvrir\n4️⃣ Cliquez sur **Annuler**\n\n⚠️ Vous ne pouvez annuler que les demandes **En attente**. Pour un congé déjà approuvé, contactez la RH.`,
    chips: ["📅 Mon solde de congé", "📋 Contacter la RH"],
  };
}

function handleHowToJustif(): Omit<BotMessage, "id" | "from"> {
  return {
    text: `**Justificatif médical :**\n\nPour un congé maladie, un justificatif est **obligatoire** :\n\n1️⃣ Lors de la demande : joignez directement le document\n2️⃣ Après le congé : vous disposez d'un délai pour l'uploader\n3️⃣ Ouvrez votre demande → section **Justificatif** → bouton **Uploader**\n\n📄 Formats acceptés : PDF, JPEG, PNG (max 5 Mo)\n\n⚠️ Sans justificatif dans les délais, vous serez marqué **absent**.`,
    chips: ["❓ Comment poser un congé", "📋 Contacter la RH"],
  };
}

function handlePayslip(): Omit<BotMessage, "id" | "from"> {
  return {
    text: `**Accéder à vos bulletins de paie :**\n\n1️⃣ Rendez-vous dans **Mon Profil**\n2️⃣ Section **Bulletins de paie**\n3️⃣ Sélectionnez le mois souhaité\n4️⃣ Téléchargez le PDF\n\n📧 Vous pouvez aussi recevoir vos bulletins par e-mail si l'option est activée.\n\nSi vous ne trouvez pas un bulletin, contactez la RH.`,
    chips: ["📋 Contacter la RH"],
  };
}

function handleAttestation(): Omit<BotMessage, "id" | "from"> {
  return {
    text: `**Demander une attestation de travail :**\n\n1️⃣ Allez dans **Mes Documents** → **Attestations**\n2️⃣ Cliquez sur **Nouvelle demande d'attestation**\n3️⃣ Choisissez le type (travail, salaire, etc.)\n4️⃣ Soumettez la demande\n\n🕐 La RH validera et signera le document. Vous serez notifié dès qu'il est disponible.`,
    chips: ["📋 Contacter la RH"],
  };
}

function handleAttendance(role: UserRole | null): Omit<BotMessage, "id" | "from"> {
  const isRh = role === "rh" || role === "planning";
  return {
    text: isRh
      ? `**Gestion du pointage :**\n\n• **Pointage Normal** : employés en horaires fixes\n• **Pointage Shift** : équipes en rotation / intérimaires\n\n📊 Consultez les présences, absences et heures travaillées dans la section **Pointage** du menu.`
      : `**Votre pointage :**\n\nVotre présence est enregistrée automatiquement via le badge. Vous pouvez consulter votre historique de pointage dans votre profil.\n\nEn cas d'anomalie (oubli de badge, erreur d'horaire), contactez la RH ou signalez un problème.`,
    chips: ["📋 Contacter la RH", "🚨 Signaler un problème"],
  };
}

function handleTeamPending(role: UserRole | null): Omit<BotMessage, "id" | "from"> {
  if (role === "rh") {
    return {
      text: `**Demandes en attente de validation :**\n\nConsultez le tableau de bord RH ou la section **Congés** pour voir toutes les demandes en attente.\n\nVous pouvez filtrer par :\n• Statut (En attente, 2ème validation, Validation RH)\n• Service / département\n• Type de congé\n\n💡 Les demandes sont classées par ancienneté.`,
      chips: ["📊 Statistiques des congés", "📂 Guide migration"],
    };
  }
  return {
    text: `**Demandes de votre équipe :**\n\nRendez-vous dans **Gestion → Congés équipe** pour voir toutes les demandes de votre équipe.\n\nVous pouvez **approuver** ou **rejeter** les demandes directement depuis cette vue.`,
    chips: ["📋 Guide plateforme"],
  };
}

function handleTeamStats(role: UserRole | null): Omit<BotMessage, "id" | "from"> {
  if (role !== "rh" && role !== "manager1" && role !== "manager2") {
    return { text: "Cette information est réservée aux responsables RH et managers.", chips: ["📅 Mon solde de congé"] };
  }
  return {
    text: `**Statistiques et tableaux de bord :**\n\n📊 Le **Dashboard RH** affiche :\n• Effectif total actif\n• Congés en cours et à venir\n• Demandes en attente de validation\n• Soldes moyens par service\n\n📋 La section **Congés** offre des filtres avancés pour analyser par type, service et période.\n\n💡 Utilisez la **page Migration** pour visualiser les soldes de tous les employés.`,
    chips: ["📂 Guide migration", "⏳ Demandes en attente"],
  };
}

function handleMigration(role: UserRole | null): Omit<BotMessage, "id" | "from"> {
  if (role !== "rh") {
    return { text: "La page Migration est réservée au service RH.", chips: ["📅 Mon solde de congé"] };
  }
  return {
    text: `**Guide Migration des soldes :**\n\n1️⃣ Allez dans **Administration → Migration Congés**\n2️⃣ Uploadez le fichier Excel avec les soldes (colonnes : MATRICULE, CONGES_ACQUIS, CONGES_PRIS, SOLDE_ANTERIEUR)\n3️⃣ Vérifiez l'aperçu : **Bleu** = fichier, **Rouge** = congés plateforme\n4️⃣ Cliquez **Synchroniser** pour appliquer\n\n🔄 La page se met à jour automatiquement à chaque nouveau congé approuvé.`,
    chips: ["📊 Statistiques des congés"],
  };
}

function handleAddEmployee(role: UserRole | null): Omit<BotMessage, "id" | "from"> {
  if (role !== "rh") {
    return { text: "L'ajout d'employés est réservé au service RH.", chips: ["📅 Mon solde de congé"] };
  }
  return {
    text: `**Ajouter un employé :**\n\n1️⃣ Allez dans **Employés** → bouton **+ Ajouter**\n2️⃣ Renseignez les informations obligatoires :\n   • Matricule, Nom, Prénom\n   • Poste, Service, Type de contrat\n   • Date d'embauche\n3️⃣ Enregistrez — l'employé sera actif immédiatement\n4️⃣ Créez un compte utilisateur si nécessaire\n\n💡 Le solde de congé se configure automatiquement selon le type de contrat.`,
    chips: ["📊 Statistiques des congés", "📂 Guide migration"],
  };
}

function handlePlatformGuide(): Omit<BotMessage, "id" | "from"> {
  return {
    text: `**Guide de la plateforme eRH :**\n\n📅 **Congés** : demandes, validation, suivi des soldes\n👤 **Profil** : bulletins de paie, attestations, documents\n⏱️ **Pointage** : présences, heures travaillées, absences\n👥 **Équipe** (managers) : validation des congés, suivi\n🏢 **RH** : gestion employés, migration, statistiques\n\nNe trouvez-vous pas ce que vous cherchez ? Posez-moi une question précise ou créez un ticket de support.`,
    chips: ["📅 Mon solde de congé", "❓ Comment poser un congé", "🚨 Signaler un problème"],
  };
}

function handleUnknown(): Omit<BotMessage, "id" | "from"> {
  return {
    text: `Je n'ai pas trouvé de réponse précise à votre question. Voici ce que je peux faire :\n\n• Posez votre question différemment\n• Choisissez une suggestion ci-dessous\n• Créez un ticket pour contacter la RH directement`,
    chips: ["📅 Mon solde de congé", "❓ Comment poser un congé", "🚨 Signaler un problème", "📋 Guide plateforme"],
  };
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function AssistantChatWidget() {
  const { user, activeRole } = useAuth();

  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState<Tab>("guide");

  // Guide tab state
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [input, setInput]       = useState("");
  const [thinking, setThinking] = useState(false);
  const [chipsShown, setChipsShown] = useState(false);

  // Signalement tab state
  const [ticketStep,     setTicketStep]     = useState<TicketStep>("category");
  const [ticketMessages, setTicketMessages] = useState<BotMessage[]>([]);
  const [ticketInput,    setTicketInput]    = useState("");
  const [selectedCat,    setSelectedCat]    = useState<TicketCategory | null>(null);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const ticketBotRef  = useRef<HTMLDivElement>(null);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const BTN_W = 180; const BTN_H = 48;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);

  useEffect(() => {
    setPos({ x: window.innerWidth - BTN_W - 32, y: window.innerHeight - BTN_H - 32 });
  }, []);
  useEffect(() => {
    const onResize = () => setPos(p => p ? {
      x: Math.min(p.x, window.innerWidth  - BTN_W - 4),
      y: Math.min(p.y, window.innerHeight - BTN_H - 4),
    } : p);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragged.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos?.x ?? 0, origY: pos?.y ?? 0 };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX, dy = ev.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged.current = true;
      setPos({ x: clamp(dragRef.current.origX + dx, 0, window.innerWidth - BTN_W), y: clamp(dragRef.current.origY + dy, 0, window.innerHeight - BTN_H) });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  }, [pos]);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]; dragged.current = false;
    dragRef.current = { startX: t.clientX, startY: t.clientY, origX: pos?.x ?? 0, origY: pos?.y ?? 0 };
    const onMove = (ev: TouchEvent) => {
      if (!dragRef.current) return;
      const touch = ev.touches[0];
      const dx = touch.clientX - dragRef.current.startX, dy = touch.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged.current = true;
      ev.preventDefault();
      setPos({ x: clamp(dragRef.current.origX + dx, 0, window.innerWidth - BTN_W), y: clamp(dragRef.current.origY + dy, 0, window.innerHeight - BTN_H) });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onUp);
  }, [pos]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addMsg = (list: BotMessage[], msg: Omit<BotMessage, "id">) =>
    [...list, { ...msg, id: Date.now() + Math.random() }];

  // ── Init guide tab ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || tab !== "guide" || messages.length > 0) return;
    const welcome = getWelcome(activeRole, user?.employee_name);
    setMessages(prev => addMsg(prev, { from: "bot", text: welcome }));
    setChipsShown(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  // ── Init signalement tab ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open || tab !== "signalement" || ticketMessages.length > 0) return;
    setTicketMessages(prev => addMsg(prev, {
      from: "bot",
      text: "Quel type de problème souhaitez-vous signaler ?\n\nVotre demande sera transmise à l'équipe RH.",
    }));
    setTicketStep("category");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);
  useEffect(() => {
    ticketBotRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticketMessages, ticketStep]);

  // ── Close ─────────────────────────────────────────────────────────────────
  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setMessages([]); setInput(""); setChipsShown(false); setThinking(false);
      setTicketMessages([]); setTicketInput(""); setSelectedCat(null); setTicketStep("category");
      setTab("guide");
    }, 300);
  }

  // ── Guide : envoyer un message ────────────────────────────────────────────
  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || thinking) return;
    setInput("");
    setMessages(prev => addMsg(prev, { from: "user", text: msg }));
    setThinking(true);

    // Switch to signalement if requested
    if (detectIntent(msg) === "TICKET" || msg.includes("Signaler un problème")) {
      await new Promise(r => setTimeout(r, 400));
      setThinking(false);
      setMessages(prev => addMsg(prev, {
        from: "bot",
        text: "Je vous redirige vers le formulaire de signalement. Cliquez sur l'onglet **Signaler** ou je l'ouvre pour vous.",
        chips: ["🚨 Ouvrir le signalement"],
      }));
      return;
    }
    if (msg.includes("Ouvrir le signalement")) {
      setThinking(false);
      setTab("signalement");
      return;
    }
    if (msg === "Contacter la RH" || msg.includes("Contacter la RH")) {
      setThinking(false);
      setMessages(prev => addMsg(prev, {
        from: "bot",
        text: "Pour contacter la RH :\n\n📧 Envoyez un e-mail à votre responsable RH\n🎫 Ou créez un ticket via l'onglet **Signaler**\n\nNotre équipe vous répondra dans les meilleurs délais.",
        chips: ["🚨 Signaler un problème"],
      }));
      return;
    }

    const intent = detectIntent(msg);
    let response: Omit<BotMessage, "id" | "from">;

    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));

    switch (intent) {
      case "LEAVE_BALANCE":  response = await handleLeaveBalance(user?.employee_id); break;
      case "LEAVE_PENDING":  response = await handleLeavePending(user?.employee_id); break;
      case "LEAVE_APPROVED": response = await handleLeaveApproved(user?.employee_id); break;
      case "LEAVE_HISTORY":  response = await handleLeaveApproved(user?.employee_id); break;
      case "HOW_TO_LEAVE":   response = handleHowToLeave(activeRole); break;
      case "HOW_TO_CANCEL":  response = handleHowToCancel(); break;
      case "HOW_TO_JUSTIF":  response = handleHowToJustif(); break;
      case "PAYSLIP":        response = handlePayslip(); break;
      case "ATTESTATION":    response = handleAttestation(); break;
      case "ATTENDANCE":     response = handleAttendance(activeRole); break;
      case "TEAM_PENDING":   response = handleTeamPending(activeRole); break;
      case "TEAM_STATS":     response = handleTeamStats(activeRole); break;
      case "MIGRATION_GUIDE": response = handleMigration(activeRole); break;
      case "ADD_EMPLOYEE":   response = handleAddEmployee(activeRole); break;
      case "PLATFORM_GUIDE": response = handlePlatformGuide(); break;
      default:               response = handleUnknown(); break;
    }

    setThinking(false);
    setMessages(prev => addMsg(prev, { from: "bot", ...response }));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ── Signalement : handlers ─────────────────────────────────────────────────
  function addTicketMsg(msg: Omit<BotMessage, "id">) {
    setTicketMessages(prev => addMsg(prev, msg));
  }
  function handleSelectCategory(cat: TicketCategory) {
    addTicketMsg({ from: "user", text: `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}` });
    setSelectedCat(cat);
    setTimeout(() => {
      addTicketMsg({ from: "bot", text: "Décrivez votre problème en quelques mots, je l'enregistre immédiatement :" });
      setTicketStep("describe");
      setTimeout(() => textareaRef.current?.focus(), 100);
    }, 350);
  }
  async function handleSendTicket() {
    const text = ticketInput.trim();
    if (!text || !selectedCat) return;
    addTicketMsg({ from: "user", text });
    setTicketInput("");
    setTicketStep("submitting");
    setTimeout(() => addTicketMsg({ from: "bot", text: "Enregistrement en cours…" }), 150);
    try {
      const ticket = await ticketService.create({ title: text.slice(0, 120), description: text, category: selectedCat });
      setTimeout(() => {
        addTicketMsg({ from: "bot", text: `✅ Signalement enregistré !\n\n📌 Référence : **#${ticket.id}**\n📂 Catégorie : ${ticket.category_label}\n\nL'équipe RH a été notifiée et vous contactera prochainement.` });
        setTicketStep("done");
      }, 700);
    } catch {
      setTimeout(() => {
        addTicketMsg({ from: "bot", text: "❌ Erreur lors de l'enregistrement. Réessayez ou contactez directement la RH." });
        setTicketStep("error");
      }, 700);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderText(text: string) {
    const html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const statColor: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    red: "bg-red-50 border-red-100 text-red-600",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    gray: "bg-gray-50 border-gray-100 text-gray-600",
  };

  const quickChips = getQuickChips(activeRole);

  // N'afficher le widget que si l'utilisateur est connecté
  if (!user) return null;

  return (
    <>
      {/* ── Bouton flottant ─────────────────────────────────────────── */}
      {pos && (
        <button
          ref={btnRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onClick={() => { if (!dragged.current) setOpen(o => !o); }}
          aria-label="Assistant eRH"
          style={{ left: pos.x, top: pos.y, width: BTN_W, height: BTN_H, touchAction: "none" }}
          className={`fixed z-50 flex items-center gap-2.5 pl-4 pr-5 rounded-full shadow-lg select-none transition-colors duration-200
            ${open ? "bg-gray-700 text-white" : "bg-[#003c71] text-white hover:bg-[#004a8f] hover:shadow-xl"}
            ${dragRef.current ? "cursor-grabbing" : "cursor-grab"}`}
        >
          {open ? <X size={18} /> : <Sparkles size={18} />}
          <span className="text-sm font-semibold tracking-wide pointer-events-none">
            {open ? "Fermer" : "Assistant eRH"}
          </span>
        </button>
      )}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="relative w-full flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxWidth: 700, height: "min(680px, calc(100vh - 6rem))" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center gap-4 px-6 py-4 bg-[#003c71] text-white">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center ring-2 ring-white/30">
                <Bot size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight">Assistant eRH · CAMUSAT</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-xs text-white/70">
                    {activeRole === "rh" ? "Interface RH" : activeRole?.startsWith("manager") ? "Interface Manager" : "Interface Employé"} · En ligne
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="shrink-0 flex border-b border-gray-100 bg-white">
              <button
                onClick={() => setTab("guide")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all border-b-2 ${
                  tab === "guide"
                    ? "border-[#003c71] text-[#003c71]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Sparkles size={15} />
                Assistant Guide
              </button>
              <button
                onClick={() => setTab("signalement")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all border-b-2 ${
                  tab === "signalement"
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Ticket size={15} />
                Signaler un problème
              </button>
            </div>

            {/* ── TAB GUIDE ──────────────────────────────────────────── */}
            {tab === "guide" && (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50">

                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white mt-0.5
                        ${msg.from === "bot" ? "bg-[#003c71]" : "bg-gray-400"}`}>
                        {msg.from === "bot" ? <Bot size={14} /> : <User size={14} />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                          ${msg.from === "bot"
                            ? "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
                            : "bg-[#003c71] text-white rounded-tr-sm ml-auto"}`}>
                          {renderText(msg.text)}
                        </div>

                        {/* Stat cards */}
                        {msg.stats && msg.stats.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 max-w-[80%]">
                            {msg.stats.map((s, i) => (
                              <div key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${statColor[s.color] || statColor.gray}`}>
                                <span className="text-lg">{s.icon}</span>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium opacity-75 truncate">{s.label}</p>
                                  <p className="text-base font-bold leading-tight">{s.value}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Follow-up chips */}
                        {msg.chips && msg.chips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-w-[90%]">
                            {msg.chips.map(chip => (
                              <button
                                key={chip}
                                onClick={() => handleSend(chip.replace(/^[^\s]+\s/, ""))}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:border-[#003c71] hover:bg-blue-50 hover:text-[#003c71] text-gray-600 transition-all shadow-sm font-medium"
                              >
                                {chip}
                                <ArrowRight size={10} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Quick chips d'accueil */}
                  {chipsShown && messages.length <= 1 && (
                    <div className="pl-11">
                      <p className="text-xs text-gray-400 mb-2 font-medium">Suggestions rapides :</p>
                      <div className="flex flex-wrap gap-2">
                        {quickChips.map(chip => (
                          <button
                            key={chip}
                            onClick={() => { setChipsShown(false); handleSend(chip.replace(/^[^\s]+\s/, "")); }}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-[#003c71] hover:bg-blue-50 hover:text-[#003c71] text-gray-700 transition-all shadow-sm font-medium"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {thinking && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#003c71] flex items-center justify-center shrink-0">
                        <Bot size={14} className="text-white" />
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* Input guide */}
                <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                  <div className="flex gap-3 items-end bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-[#003c71] focus-within:ring-2 focus-within:ring-[#003c71]/20 transition-all">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Posez votre question… (ex : mon solde de congé)"
                      rows={1}
                      disabled={thinking}
                      className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none leading-relaxed disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || thinking}
                      className="shrink-0 w-9 h-9 rounded-full bg-[#003c71] text-white flex items-center justify-center hover:bg-[#004a8f] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                    Posez n'importe quelle question RH · Données en temps réel depuis la plateforme
                  </p>
                </div>
              </>
            )}

            {/* ── TAB SIGNALEMENT ────────────────────────────────────── */}
            {tab === "signalement" && (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50">
                  {ticketMessages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.from === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white mt-0.5
                        ${msg.from === "bot" ? "bg-red-500" : "bg-gray-400"}`}>
                        {msg.from === "bot" ? <Ticket size={14} /> : <User size={14} />}
                      </div>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                        ${msg.from === "bot" ? "bg-white border border-gray-100 text-gray-800 rounded-tl-sm" : "bg-red-500 text-white rounded-tr-sm"}`}>
                        {renderText(msg.text)}
                      </div>
                    </div>
                  ))}

                  {ticketStep === "category" && (
                    <div className="grid grid-cols-2 gap-3 pl-11">
                      {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => handleSelectCategory(cat)}
                          className="flex items-center gap-3 text-left bg-white border border-gray-200 hover:border-red-400 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-xl px-4 py-3 transition-all shadow-sm group">
                          <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{CATEGORY_LABELS[cat]}</p>
                          </div>
                          <ChevronRight size={14} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500" />
                        </button>
                      ))}
                    </div>
                  )}

                  {ticketStep === "submitting" && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                        <Ticket size={14} className="text-white" />
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
                        <Loader2 size={16} className="animate-spin text-red-500" />
                        <span className="text-sm text-gray-500">Envoi en cours…</span>
                      </div>
                    </div>
                  )}

                  {(ticketStep === "done" || ticketStep === "error") && (
                    <div className="pl-11 flex gap-2 flex-wrap">
                      <button
                        onClick={() => { setSelectedCat(null); setTicketInput(""); setTicketMessages([]); setTicketStep("category"); }}
                        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-200 hover:border-gray-300 rounded-full px-4 py-2 transition-all shadow-sm"
                      >
                        <CheckCircle2 size={14} />
                        Nouveau signalement
                      </button>
                      <button
                        onClick={() => setTab("guide")}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#003c71] hover:text-[#004a8f] bg-blue-50 border border-blue-200 hover:border-[#003c71] rounded-full px-4 py-2 transition-all shadow-sm"
                      >
                        <Sparkles size={14} />
                        Retour à l'assistant
                      </button>
                    </div>
                  )}

                  <div ref={ticketBotRef} />
                </div>

                {ticketStep === "describe" && (
                  <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                    <div className="flex gap-3 items-end bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-400/20 transition-all">
                      <textarea
                        ref={textareaRef}
                        value={ticketInput}
                        onChange={e => setTicketInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendTicket(); } }}
                        placeholder="Décrivez votre problème…"
                        rows={2}
                        className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none leading-relaxed"
                      />
                      <button
                        onClick={handleSendTicket}
                        disabled={!ticketInput.trim()}
                        className="shrink-0 w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
