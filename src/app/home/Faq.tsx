"use client";

import { useState } from "react";

const PREGUNTAS = [
  {
    q: "¿Cuándo abre el acceso?",
    a: "Estamos en desarrollo activo. La lista se usa para invitar por tandas: los primeros en anotarse entran primero.",
  },
  {
    q: "¿Necesito instalar algo?",
    a: "No. Funciona en el navegador, en computadora y celular. Los técnicos trabajan desde el teléfono sin instalar ninguna aplicación.",
  },
  {
    q: "¿Puedo migrar mis datos de Excel?",
    a: "Sí. La importación masiva toma tu planilla de clientes, establecimientos y matafuegos para que no cargues nada de cero.",
  },
  {
    q: "¿Cuánto va a costar?",
    a: "El plan inicial arranca en $40.000 ARS por mes, con matafuegos, clientes y usuarios sin límite. Quien entre desde la lista arranca con período de prueba sin tarjeta.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="faq-list">
      {PREGUNTAS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} className="faq-item">
            <button type="button" className="faq-question" onClick={() => setOpenIndex(open ? null : i)} aria-expanded={open}>
              <span>{item.q}</span>
              <span className="faq-icon">{open ? "−" : "+"}</span>
            </button>
            {open ? <p className="faq-answer">{item.a}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
