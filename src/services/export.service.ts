/**
 * export.service.ts — Konva-native image export (MAG-01.13)
 *
 * Replaces html-to-image / ReactFlow DOM capture.
 * PNG/SVG are now produced via stage.toDataURL on the Konva canvas.
 * JSON export is unchanged (no canvas dependency).
 */

import type Konva from 'konva';

export interface ExportImageOptions {
  fileName: string;
  format: 'png' | 'svg';
  scale: number;
  transparent: boolean;
  backgroundColor: string;
}

export const ExportService = {
  // --- JSON (legacy / VFS download) ---
  downloadJson: (
    flowObject: { nodes: unknown[]; edges: unknown[]; viewport?: unknown },
    id: string,
    name: string,
  ): void => {
    const exportData = { id, name, ...flowObject };
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.luml`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // --- IMAGE (PNG / SVG via Konva stage) ---
  downloadImage: async (
    stage: Konva.Stage,
    options: ExportImageOptions,
  ): Promise<void> => {
    const pixelRatio = options.scale;

    let dataUrl: string;

    if (options.format === 'png') {
      dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });

      if (window.electronAPI?.isElectron()) {
        const result = await window.electronAPI.saveImage(dataUrl, options.fileName, 'png');
        if (result.canceled) return;
      } else {
        const link = document.createElement('a');
        link.download = `${options.fileName}.png`;
        link.href = dataUrl;
        link.click();
      }
      return;
    }

    if (options.format === 'svg') {
      // Raster PNG embedded in an SVG envelope — true vector SVG deferred to future.
      const pngDataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
      const w = stage.width() * pixelRatio;
      const h = stage.height() * pixelRatio;
      const svgContent = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
        options.transparent ? '' : `<rect width="${w}" height="${h}" fill="${options.backgroundColor}"/>`,
        `<image href="${pngDataUrl}" width="${w}" height="${h}"/>`,
        '</svg>',
      ].join('');

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const svgDataUrl = URL.createObjectURL(blob);

      if (window.electronAPI?.isElectron()) {
        const result = await window.electronAPI.saveImage(svgDataUrl, options.fileName, 'svg');
        if (result.canceled) { URL.revokeObjectURL(svgDataUrl); return; }
      } else {
        const link = document.createElement('a');
        link.download = `${options.fileName}.svg`;
        link.href = svgDataUrl;
        link.click();
      }
      URL.revokeObjectURL(svgDataUrl);
    }
  },
};
