export default function MaintenancePage() {
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
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔧</div>

        <h1 style={{ color: "#0f2a5e", fontSize: "1.4rem", fontWeight: 700, margin: "0 0 1rem" }}>
          Plateforme eRH
        </h1>

        <div style={{
          background: "#fef9c3",
          border: "1px solid #fde047",
          borderRadius: "0.5rem",
          padding: "1rem",
          marginBottom: "1.5rem",
          color: "#713f12",
          fontWeight: 600,
          fontSize: "1rem",
        }}>
          La plateforme est actuellement en maintenance.
        </div>

        <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>
          Merci de votre compréhension.<br />
          <strong>L'équipe RH CAMUSAT Sénégal</strong>
        </p>
      </div>
    </div>
  );
}
