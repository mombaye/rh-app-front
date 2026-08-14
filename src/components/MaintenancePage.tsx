export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f2a5e 0%, #1a3f8f 100%)",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: "1rem",
    }}>
      <div style={{
        background: "white",
        borderRadius: "1.5rem",
        padding: "3rem 2.5rem",
        maxWidth: 520,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Icône */}
        <div style={{
          width: 80,
          height: 80,
          background: "linear-gradient(135deg, #0f2a5e, #1a3f8f)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
          </svg>
        </div>

        {/* Logo texte */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", letterSpacing: "0.15em", textTransform: "uppercase", margin: 0 }}>
            CAMUSAT Sénégal
          </p>
          <h1 style={{ color: "#0f2a5e", fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0" }}>
            eRH — Espace RH
          </h1>
        </div>

        {/* Titre */}
        <div style={{
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          borderRadius: "0.75rem",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          <span style={{ fontSize: "1.2rem" }}>🔧</span>
          <span style={{ color: "#92400e", fontWeight: 600, fontSize: "0.95rem" }}>
            Maintenance en cours
          </span>
        </div>

        <h2 style={{ color: "#111827", fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
          Plateforme temporairement indisponible
        </h2>

        <p style={{ color: "#6b7280", lineHeight: 1.7, margin: "0 0 1.5rem", fontSize: "0.95rem" }}>
          Nous effectuons des opérations de maintenance afin d'améliorer votre expérience.
          La plateforme sera de nouveau disponible <strong>très prochainement</strong>.
        </p>

        <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: 0 }}>
          Merci de votre compréhension.<br/>
          <strong>L'équipe RH CAMUSAT Sénégal</strong>
        </p>

        {/* Barre animée */}
        <div style={{ marginTop: "2rem", height: 4, background: "#e5e7eb", borderRadius: 9999, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: "40%",
            background: "linear-gradient(90deg, #0f2a5e, #3b82f6)",
            borderRadius: 9999,
            animation: "slide 2s ease-in-out infinite alternate",
          }} />
        </div>

        <style>{`
          @keyframes slide {
            from { transform: translateX(0); }
            to   { transform: translateX(150%); }
          }
        `}</style>
      </div>
    </div>
  );
}
