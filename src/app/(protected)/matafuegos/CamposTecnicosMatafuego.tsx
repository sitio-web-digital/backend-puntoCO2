const TIPOS = ["PORTATIL", "RODANTE", "VEHICULAR", "OTRO"];
const AGENTES = ["POLVO_QUIMICO_ABC", "CO2", "AGUA", "ESPUMA", "AGENTE_LIMPIO", "OTRO"];

/** Campos técnicos del alta de un matafuego, compartidos entre el alta rápida
 * desde /matafuegos y el alta con contexto fijo desde la ficha del
 * establecimiento — mismo set de inputs no controlados, leídos vía FormData
 * por el formulario que los envuelve. */
export function CamposTecnicosMatafuego() {
  return (
    <>
      <div className="grid2">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="codigoInterno">Código interno</label>
          <input id="codigoInterno" name="codigoInterno" className="mono" required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="numeroSerie">N° de serie</label>
          <input id="numeroSerie" name="numeroSerie" className="mono" required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="codigoBarras">Código de barras</label>
          <input id="codigoBarras" name="codigoBarras" className="mono" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={TIPOS[0]} required>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="agenteExtintor">Agente extintor</label>
          <select id="agenteExtintor" name="agenteExtintor" defaultValue={AGENTES[0]} required>
            {AGENTES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="capacidadNominal">Capacidad nominal</label>
          <input id="capacidadNominal" name="capacidadNominal" placeholder="5kg" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="marca">Marca</label>
          <input id="marca" name="marca" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="modelo">Modelo</label>
          <input id="modelo" name="modelo" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="fabricante">Fabricante</label>
          <input id="fabricante" name="fabricante" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="pesoNominal">Peso nominal (kg)</label>
          <input id="pesoNominal" name="pesoNominal" type="number" step="0.01" min="0" className="mono" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="fechaFabricacion">Fecha de fabricación</label>
          <input id="fechaFabricacion" name="fechaFabricacion" type="date" className="mono" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="fechaPuestaServicio">Fecha de puesta en servicio</label>
          <input id="fechaPuestaServicio" name="fechaPuestaServicio" type="date" className="mono" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="normaTecnica">Norma técnica</label>
          <input id="normaTecnica" name="normaTecnica" />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="observaciones">Observaciones</label>
        <textarea id="observaciones" name="observaciones" rows={3} />
      </div>
    </>
  );
}
