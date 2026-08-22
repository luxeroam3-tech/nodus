export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, justifyContent: "center" }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "linear-gradient(160deg, var(--accent), var(--accent-ink))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            N
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>Nodus</span>
        </div>
        <div className="card" style={{ padding: "28px 26px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
