import QRCode from "qrcode";

/** SVG inline (no archivo/data URI): se embebe directo en el HTML de la
 * página de impresión, sin pedidos de red adicionales por cada etiqueta. */
export async function renderQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, width: 220 });
}
