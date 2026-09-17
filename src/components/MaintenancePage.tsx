import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "@/api/baseUrl";

const POLL_INTERVAL = 10_000; // 10 secondes

export default function MaintenancePage() {
  const navigate = useNavigate();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/license/status/`);
        if (res.ok) {
          const data = await res.json();
          if (data.active) {
            if (timer.current) clearInterval(timer.current);
            navigate("/", { replace: true });
          }
        }
      } catch {
        // réseau coupé — on continue de poller
      }
    }, POLL_INTERVAL);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8fafc",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: "1rem",
    }}>
      <div style={{
        background: "white",
        borderRadius: "1rem",
        padding: "3rem 2rem",
        maxWidth: 480,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        border: "1px solid #e2e8f0",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>

        <h1 style={{ color: "#003c71", fontSize: "1.4rem", fontWeight: 700, margin: "0 0 1rem" }}>
          Plateforme eRH
        </h1>

        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "0.5rem",
          padding: "1rem",
          marginBottom: "1.5rem",
          color: "#dc2626",
          fontWeight: 600,
          fontSize: "1rem",
        }}>
          La clé d'accès a expiré ou a été désactivée.
        </div>

        <p style={{ color: "#64748b", fontSize: "0.95rem", margin: "0 0 1.5rem" }}>
          L'accès à la plateforme est temporairement suspendu.<br />
          La page se rouvrira automatiquement dès la réactivation.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#94a3b8", fontSize: "0.85rem" }}>
          <span style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#94a3b8",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          Vérification en cours…
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>

        <p style={{ marginTop: "2rem", color: "#cbd5e1", fontSize: "0.8rem" }}>
          © {new Date().getFullYear()} Camusat SN RH
        </p>
      </div>
    </div>
  );
}
