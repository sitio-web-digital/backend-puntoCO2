import { WaitlistForm } from "./WaitlistForm";
import { MockupCarousel } from "./MockupCarousel";
import { Faq } from "./Faq";

const FEATURES = [
  {
    n: "01",
    title: "Inventario completo",
    desc: "Ficha por unidad: tipo, agente, capacidad, vencimientos de inspección, recarga y prueba hidráulica, más historial de movimientos.",
  },
  {
    n: "02",
    title: "Código QR por matafuego",
    desc: "Etiqueta imprimible por unidad. El cliente escanea y ve estado y vencimientos sin cuenta; tu técnico entra directo a la ficha desde el celular.",
  },
  {
    n: "03",
    title: "Inspecciones y no conformidades",
    desc: "Checklist técnico en cada inspección, con no conformidades generadas automáticamente y seguimiento hasta que se resuelven.",
  },
  {
    n: "04",
    title: "Mantenimientos programados",
    desc: "Calendario automático de cada servicio por unidad, con reglas configurables según tipo de equipo y agente.",
  },
  {
    n: "05",
    title: "Órdenes de trabajo",
    desc: "De la orden a la factura: asignación de técnico, ejecución y entrega, con cadena de custodia clara entre cliente, tránsito y taller.",
  },
  {
    n: "06",
    title: "Certificados con validez legal",
    desc: "Numeración correlativa según normativa IRAM, historial inmutable y versionado, y página pública para verificar autenticidad por código.",
  },
  {
    n: "07",
    title: "Avisos por WhatsApp y email",
    desc: "Notificación automática al cliente antes de cada vencimiento, sin llamar uno por uno. Menos seguimiento manual, mejor renovación.",
  },
  {
    n: "08",
    title: "Clientes y establecimientos",
    desc: "Alta individual o importación masiva desde Excel, con jerarquía de cliente, establecimiento, sector y ubicación exacta del equipo.",
  },
  {
    n: "09",
    title: "Permisos por rol",
    desc: "Cada empleado con su usuario. Vos decidís qué ve y qué puede hacer cada uno; nadie ve más de lo que le corresponde.",
  },
  {
    n: "10",
    title: "Reportes e indicadores",
    desc: "Cobertura de inspecciones, unidades por vencer, productividad por técnico y no conformidades abiertas, en un solo panel.",
  },
  {
    n: "11",
    title: "Multiempresa y multi-sede",
    desc: "Pensado para escalar: los datos de cada empresa quedan completamente aislados y seguros del resto.",
  },
];

const PASOS = [
  { title: "Cargás tus matafuegos", desc: "uno por uno o importando tu planilla de Excel." },
  { title: "El sistema te avisa", desc: "cuándo vence cada uno, y le avisa al cliente también." },
  { title: "Registrás la inspección o recarga", desc: "escaneando el QR desde el celular, en el lugar." },
  { title: "Emitís el certificado", desc: "numerado, con validez legal y verificable en línea." },
];

export default function LandingPage() {
  return (
    <div className="pc-shell">
      <header className="pc-header">
        <div className="pc-header-inner">
          <div className="pc-brand">
            <span className="pc-brand-mark" />
            <span className="pc-brand-name">PuntoCo2</span>
          </div>
          <div style={{ flex: 1 }} />
          <span className="pc-pill">En desarrollo</span>
        </div>
      </header>

      <main>
        <section className="pc-hero">
          <div className="pc-hero-inner">
            <div className="pc-hero-copy">
              <span className="pc-pill pc-pill-outline">Lista de acceso anticipado</span>
              <h1>Todo el ciclo de vida de un matafuego, en un solo lugar.</h1>
              <p>
                Inventario, vencimientos, órdenes de trabajo y certificados con validez legal, con trazabilidad de punta a punta y sin
                planillas sueltas. Estamos terminando de construirlo: dejá tu correo y te avisamos cuando abramos el acceso.
              </p>
              <WaitlistForm ctaLabel="Sumarme a la lista" helperText="Un solo correo cuando abramos el acceso. Sin publicidad." />
            </div>

            <MockupCarousel />
          </div>
        </section>

        <section className="pc-section">
          <div className="pc-section-inner">
            <div className="pc-section-heading">
              <h2>Todo lo que va a incluir</h2>
              <span className="pc-modules-count">11 módulos</span>
            </div>
            <div className="pc-features-grid">
              {FEATURES.map((f) => (
                <div key={f.n} className="pc-feature-card">
                  <span className="pc-feature-n">{f.n}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pc-section pc-section-alt">
          <div className="pc-section-inner pc-split">
            <div>
              <h2>Cómo va a funcionar</h2>
              <ol className="pc-steps">
                {PASOS.map((p, i) => (
                  <li key={p.title}>
                    <span className="pc-step-n">{i + 1}</span>
                    <span>
                      <strong>{p.title}</strong> {p.desc}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2>Preguntas frecuentes</h2>
              <Faq />
            </div>
          </div>
        </section>

        <section className="pc-cta">
          <div className="pc-cta-inner">
            <h2>Sumate a la lista y entrá en la primera tanda.</h2>
            <p>
              Plan inicial de <span className="mono">$40.000 ARS/mes</span> al momento del lanzamiento, con prueba sin tarjeta para
              quienes estén en la lista.
            </p>
            <WaitlistForm ctaLabel="Sumarme" dark />
          </div>
        </section>
      </main>

      <footer className="pc-footer">
        <div className="pc-footer-inner">
          <div className="pc-brand">
            <span className="pc-brand-mark" />
            <span className="pc-brand-name">PuntoCo2</span>
          </div>
          <span>Argentina · 2026</span>
        </div>
      </footer>
    </div>
  );
}
