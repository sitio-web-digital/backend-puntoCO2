import Link from "next/link";

const FEATURES = [
  { title: "Inspección con QR en campo", desc: "Cada matafuego tiene su propio código: escanealo y accedé a su ficha al instante." },
  { title: "Órdenes de trabajo y custodia", desc: "Seguimiento de punta a punta desde el retiro hasta la entrega, sin perder el hilo." },
  { title: "Certificados con validez IRAM", desc: "Documentación técnica trazable, con historial y sin edición retroactiva." },
];

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="row" style={{ gap: 11 }}>
          <div className="auth-brand-mark">M</div>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>Matafuego SaaS</span>
        </div>
        <Link href="/login" className="btn-secondary">
          Iniciar sesión
        </Link>
      </header>

      <main className="landing-hero">
        <span className="landing-eyebrow">Gestión integral de matafuegos</span>
        <h1>Todo tu ciclo de matafuegos, en un solo lugar.</h1>
        <p>Inspección, mantenimiento, certificación y facturación con trazabilidad de punta a punta.</p>
        <Link href="/login" className="btn-primary landing-cta">
          Ingresar al sistema →
        </Link>
      </main>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="landing-feature-card">
            <h2>{f.title}</h2>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="landing-footer">
        <span>Matafuego SaaS</span>
        <span>·</span>
        <span>Argentina</span>
      </footer>
    </div>
  );
}
