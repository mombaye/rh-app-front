import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, CheckCircle2, Loader2, ChevronRight, Headphones } from "lucide-react";
import { ticketService } from "@/services/ticketService";
import { TicketCategory, CATEGORY_LABELS } from "@/types/ticket";
import { useAuth } from "@/contexts/useAuth";

// Nouveau flux : welcome → category → describe → submitting → done/error
type Step = "welcome" | "category" | "describe" | "submitting" | "done" | "error";

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
}

const CATEGORIES: TicketCategory[] = ["BLOCAGE", "ANOMALIE", "DIFFICULTE", "AUTRE"];

const CATEGORY_ICONS: Record<TicketCategory, string> = {
  BLOCAGE:    "🚫",
  ANOMALIE:   "⚠️",
  DIFFICULTE: "🔧",
  AUTRE:      "💬",
};

export default function AssistantChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Drag du bouton flottant ──────────────────────────────────────────────
  const BTN_W = 180; const BTN_H = 48;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);

  // Initialise en bas à droite au premier rendu
  useEffect(() => {
    setPos({ x: window.innerWidth - BTN_W - 32, y: window.innerHeight - BTN_H - 32 });
  }, []);

  // Garde le bouton dans les limites si la fenêtre est redimensionnée
  useEffect(() => {
    const onResize = () => setPos(p => p ? {
      x: Math.min(p.x, window.innerWidth  - BTN_W - 4),
      y: Math.min(p.y, window.innerHeight - BTN_H - 4),
    } : p);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragged.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos?.x ?? 0, origY: pos?.y ?? 0 };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged.current = true;
      setPos({
        x: clamp(dragRef.current.origX + dx, 0, window.innerWidth  - BTN_W),
        y: clamp(dragRef.current.origY + dy, 0, window.innerHeight - BTN_H),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [pos]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    dragged.current = false;
    dragRef.current = { startX: t.clientX, startY: t.clientY, origX: pos?.x ?? 0, origY: pos?.y ?? 0 };

    const onMove = (ev: TouchEvent) => {
      if (!dragRef.current) return;
      const touch = ev.touches[0];
      const dx = touch.clientX - dragRef.current.startX;
      const dy = touch.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged.current = true;
      ev.preventDefault();
      setPos({
        x: clamp(dragRef.current.origX + dx, 0, window.innerWidth  - BTN_W),
        y: clamp(dragRef.current.origY + dy, 0, window.innerHeight - BTN_H),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onUp);
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend",  onUp);
  }, [pos]);

  function addMsg(from: "bot" | "user", text: string) {
    const id = Date.now() + Math.random();
    setMessages(msgs => [...msgs, { id, from, text }]);
  }

  useEffect(() => {
    if (!open) return;
    if (step !== "welcome") return;
    setMessages([]);
    const t = setTimeout(() => {
      addMsg("bot", `Bonjour 👋\n\nBienvenue dans votre **Assistance eRH-CAMUSAT**.\n\nQuel type de problème souhaitez-vous signaler ?`);
      setStep("category");
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setStep("welcome");
      setMessages([]);
      setSelectedCategory(null);
      setInput("");
    }, 300);
  }

  // Étape 1 : l'utilisateur choisit une catégorie → on passe à la saisie
  function handleSelectCategory(cat: TicketCategory) {
    addMsg("user", `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`);
    setSelectedCategory(cat);
    setTimeout(() => {
      addMsg("bot", "Parfait ! Décrivez votre problème en quelques mots et j'enregistre votre demande :");
      setStep("describe");
      setTimeout(() => textareaRef.current?.focus(), 100);
    }, 350);
  }

  // Étape 2 : l'utilisateur envoie sa description → on crée le ticket
  async function handleSendDescription() {
    const text = input.trim();
    if (!text || !selectedCategory) return;
    addMsg("user", text);
    setInput("");
    setStep("submitting");
    setTimeout(() => addMsg("bot", "Enregistrement en cours, veuillez patienter…"), 150);

    try {
      const ticket = await ticketService.create({
        title: text.slice(0, 120),
        description: text,
        category: selectedCategory,
      });
      setTimeout(() => {
        addMsg("bot",
          `✅ Votre signalement a bien été enregistré !\n\n📌 Référence : **#${ticket.id}**\n📂 Catégorie : ${ticket.category_label}\n\nNotre équipe RH a été notifiée et vous contactera prochainement.\n\nMerci pour votre retour !`
        );
        setStep("done");
      }, 700);
    } catch {
      setTimeout(() => {
        addMsg("bot", "❌ Une erreur est survenue lors de l'enregistrement. Veuillez réessayer ou contacter directement la RH.");
        setStep("error");
      }, 700);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendDescription();
    }
  }

  function renderText(text: string) {
    // **bold** → <strong>, \n → <br>, rest is escaped
    const html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <>
      {/* ── Bouton flottant draggable ─────────────────────────────────── */}
      {pos && (
        <button
          ref={btnRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onClick={() => { if (!dragged.current) setOpen(o => !o); }}
          aria-label="Assistance eRH"
          style={{ left: pos.x, top: pos.y, width: BTN_W, height: BTN_H, touchAction: "none" }}
          className={`fixed z-50 flex items-center gap-2.5 pl-4 pr-5 rounded-full shadow-lg select-none
            transition-colors duration-200
            ${open
              ? "bg-gray-700 text-white"
              : "bg-camublue-900 text-white hover:bg-camublue-800 hover:shadow-xl"
            }
            ${dragRef.current ? "cursor-grabbing" : "cursor-grab"}`}
        >
          {open ? <X size={18} /> : <Headphones size={18} />}
          <span className="text-sm font-semibold tracking-wide pointer-events-none">
            {open ? "Fermer" : "Assistance eRH"}
          </span>
        </button>
      )}

      {/* ── Overlay + Modal centré ────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="relative w-full flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxWidth: 680, height: "min(620px, calc(100vh - 8rem))" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center gap-4 px-6 py-4 bg-camublue-900 text-white">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center ring-2 ring-white/30">
                <Bot size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight">Assistance eRH-CAMUSAT</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-xs text-white/70">Support RH · En ligne</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Zone messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-gray-50">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white mt-0.5
                    ${msg.from === "bot" ? "bg-camublue-900" : "bg-gray-400"}`}>
                    {msg.from === "bot" ? <Bot size={15} /> : <User size={15} />}
                  </div>
                  {/* Bulle */}
                  <div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                    ${msg.from === "bot"
                      ? "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
                      : "bg-camublue-900 text-white rounded-tr-sm"}`}>
                    {renderText(msg.text)}
                  </div>
                </div>
              ))}

              {/* Choix de catégorie */}
              {step === "category" && (
                <div className="grid grid-cols-2 gap-3 pl-11">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => handleSelectCategory(cat)}
                      className="flex items-center gap-3 text-left bg-white border border-gray-200 hover:border-camublue-900 hover:bg-camublue-50 text-gray-700 hover:text-camublue-900 rounded-xl px-4 py-3 transition-all shadow-sm hover:shadow group"
                    >
                      <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{CATEGORY_LABELS[cat]}</p>
                      </div>
                      <ChevronRight size={14} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-camublue-900" />
                    </button>
                  ))}
                </div>
              )}

              {/* Typing indicator */}
              {step === "submitting" && (
                <div className="flex gap-3 pl-0">
                  <div className="w-8 h-8 rounded-full shrink-0 bg-camublue-900 flex items-center justify-center">
                    <Bot size={15} className="text-white" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1 shadow-sm">
                    <Loader2 size={16} className="animate-spin text-camublue-900" />
                    <span className="text-sm text-gray-500 ml-1">Envoi en cours…</span>
                  </div>
                </div>
              )}

              {/* Nouveau signalement */}
              {(step === "done" || step === "error") && (
                <div className="pl-11">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setInput("");
                      addMsg("bot", "D'accord ! Quel type de problème souhaitez-vous signaler cette fois ?");
                      setStep("category");
                    }}
                    className="inline-flex items-center gap-2 text-sm font-medium text-camublue-900 hover:text-camublue-800 bg-white border border-camublue-200 hover:border-camublue-900 rounded-full px-4 py-2 transition-all shadow-sm"
                  >
                    <CheckCircle2 size={15} />
                    Faire un nouveau signalement
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Zone de saisie */}
            {step === "describe" && (
              <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
                <div className="flex gap-3 items-end bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-camublue-900 focus-within:ring-2 focus-within:ring-camublue-900/20 transition-all">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Décrivez votre problème ici… (Entrée pour envoyer)"
                    rows={2}
                    className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none leading-relaxed"
                  />
                  <button
                    onClick={handleSendDescription}
                    disabled={!input.trim()}
                    className="shrink-0 w-9 h-9 rounded-full bg-camublue-900 text-white flex items-center justify-center hover:bg-camublue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                  >
                    <Send size={15} />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Appuyez sur <kbd className="bg-gray-100 rounded px-1 py-0.5 font-mono">Entrée</kbd> pour envoyer · <kbd className="bg-gray-100 rounded px-1 py-0.5 font-mono">Shift+Entrée</kbd> pour sauter une ligne
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
