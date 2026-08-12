import { readFileSync } from "node:fs";
import { join } from "node:path";

const LANDING_HTML = readFileSync(join(process.cwd(), "src/app/home/landing.html"), "utf-8");

/** Conecta los dos formularios de "Sumarme a la lista" del diseño a POST
 * /api/waitlist. El diseño ya trae su propia UI de confirmación (estado
 * "enviado" manejado por su propio JS del bundle: preventDefault + swap
 * visual a "Anotado"/"Ya estás en la lista"), así que este script no toca
 * el DOM ni previene el submit — sólo dispara el guardado real en paralelo,
 * detectando el formulario por sus campos `name="email"`/`name="phone"`
 * porque el HTML de la landing es el bundle de diseño tal cual. */
const WAITLIST_SCRIPT = `<script>
(function () {
  function esFormularioWaitlist(form) {
    return form instanceof HTMLFormElement && form.querySelector('input[name="email"]') && form.querySelector('input[name="phone"]');
  }

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!esFormularioWaitlist(form)) return;

    var email = form.querySelector('input[name="email"]').value;
    var telefono = form.querySelector('input[name="phone"]').value;
    if (!email) return;

    fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, telefono: telefono }),
    }).catch(function (err) {
      console.error("No se pudo anotar en la waitlist:", err);
    });
  });
})();
</script>`;

const RESPONSE_HTML = LANDING_HTML.replace(/<\/body>\s*<\/html>\s*$/, `${WAITLIST_SCRIPT}</body></html>`);

export function GET() {
  return new Response(RESPONSE_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
