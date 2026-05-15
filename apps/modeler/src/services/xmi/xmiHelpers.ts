/** Escape XML special characters for attribute values and text content. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Sanitize a UUID/arbitrary string into a valid XMI ID (must start with letter or _). */
export function xmiId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/** Standard XMI 2.1 / UML 2.5.1 file header lines. */
export function xmiHeader(modelId: string, modelName: string): string[] {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<xmi:XMI xmi:version="2.1"`,
    `  xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"`,
    `  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML">`,
    `  <xmi:Documentation exporter="LibreUML" exporterVersion="1.0"/>`,
    `  <uml:Model xmi:id="${xmiId(modelId)}" name="${esc(modelName)}">`,
  ];
}

/** Standard XMI footer lines. */
export function xmiFooter(): string[] {
  return [`  </uml:Model>`, `</xmi:XMI>`];
}

/** Trigger a browser download for XML content. */
export function downloadXml(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xmi') ? filename : `${filename}.xmi`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
