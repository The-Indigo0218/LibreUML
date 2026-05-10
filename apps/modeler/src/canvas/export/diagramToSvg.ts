/**
 * diagramToSvg.ts — True vector SVG export for LibreUML (MAG-01.15).
 *
 * Pure function — no React, no Konva runtime (measureText only).
 * Converts ShapeDescriptor[] + EdgeDescriptor[] into a self-contained SVG
 * string whose output matches KonvaCanvas visuals: same layout constants,
 * same color tokens, same routing algorithms.
 *
 * Approach: programmatic SVG generation.
 *   canvas2svg cannot intercept Konva's internal Canvas2D context without
 *   patching private Konva internals. Programmatic generation is more reliable,
 *   produces smaller output, and requires no external dependency.
 *
 * Rendering order (matches KonvaCanvas layer order):
 *   1. Optional background rect
 *   2. Edges — lines + arrowhead markers
 *   3. Nodes — ClassShape groups + NoteShape groups
 *
 * Coordinate system:
 *   All shapes and edges are in world-space coordinates.
 *   The <svg viewBox> translates the viewport so (0,0) of the SVG canvas
 *   aligns with the top-left corner of the diagram bounding box.
 */

import type { ShapeDescriptor, EdgeDescriptor } from '../types/canvas.types';
import {
  isNoteViewModel,
  isActorViewModel,
  isUseCaseViewModel,
  isSystemBoundaryViewModel,
  type NodeViewModel,
  type NoteViewModel,
  type ActorViewModel,
  type UseCaseViewModel,
  type SystemBoundaryViewModel,
} from '../../adapters/react-flow/view-models/node.view-model';
import { resolveNodeColors, resolveNoteColors, resolveActorColors, resolveUseCaseColors, resolveSystemBoundaryColors } from '../tokens/colors';
import { getClassShapeSize, computeClassLayout } from '../shapes/ClassShape';
import { getNoteShapeSize } from '../shapes/NoteShape';
import { getActorShapeSize } from '../shapes/ActorShape';
import { getUseCaseShapeSize } from '../shapes/UseCaseShape';
import { getSystemBoundaryShapeSize } from '../shapes/SystemBoundaryShape';
import {
  selectAnchors,
  retractAnchor,
  selfLoopPath,
  faceToMarkerAngle,
} from '../edges/geometry';
import { avoidObstacles } from '../edges/obstacleAvoidance';
import type { NodeBounds, AnchorFace } from '../edges/geometry';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';


const H_PAD = 10;
const BORDER_W = 2;
const RADIUS = 2;
const STEREO_FONT = 10;
const BADGE_FONT = 10;
const NAME_FONT = 14;
const SEC_FONT = 12;
const ROW_H = 20;
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
// Single-quoted font name so the value is valid inside an SVG double-quoted attribute
const FONT_MONO = "'Fira Code', monospace";

const NOTE_W = 224;
const NOTE_FOLD = 12;
const NOTE_H_PAD = 8;
const NOTE_V_PAD = 8;
const NOTE_TITLE_H = 32;
const NOTE_TITLE_FONT = 14;
const NOTE_SEC_FONT = 12;
const NOTE_LINE_H = 1.5;

const DASHED_KINDS = new Set<RelationKind>([
  'REALIZATION', 'DEPENDENCY', 'USAGE', 'INCLUDE', 'EXTEND',
]);

const MARKER_RETRACT: Partial<Record<RelationKind, number>> = {
  GENERALIZATION: 16,
  REALIZATION: 16,
  AGGREGATION: 24,
  COMPOSITION: 24,
};

/**
 * Margin around the diagram bounding box.
 * 80px (vs 50px in PNG) to accommodate self-loop arcs that extend ~78px
 * beyond the source node's right edge.
 */
const EXPORT_MARGIN = 80;

export interface DiagramToSvgOptions {
  backgroundColor: string;
  transparent: boolean;
}

interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Generates a complete, self-contained SVG string for the given diagram.
 *
 * @param shapes  - ShapeDescriptor[] from useKonvaCanvasController
 * @param edges   - EdgeDescriptor[] from useKonvaCanvasController
 * @param options - Background color + transparency flag
 * @returns SVG markup string
 */
export function diagramToSvg(
  shapes: ShapeDescriptor[],
  edges: EdgeDescriptor[],
  options: DiagramToSvgOptions,
): string {
  if (shapes.length === 0 && edges.length === 0) {
    const fill = options.transparent ? 'none' : escapeXml(options.backgroundColor);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${fill}"/></svg>`;
  }

  const boundsMap = buildBoundsMap(shapes);
  const bounds = calculateBounds(boundsMap);

  const bgSvg = options.transparent
    ? ''
    : `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${escapeXml(options.backgroundColor)}"/>`;

  const edgesSvg = edges
    .map((edge) => svgEdge(edge, boundsMap))
    .filter(Boolean)
    .join('\n');

  const shapesSvg = shapes
    .map((shape) => {
      const vm = shape.data;
      if (isNoteViewModel(vm))            return svgNoteShape(shape, vm);
      if (isActorViewModel(vm))           return svgActorShape(shape, vm);
      if (isUseCaseViewModel(vm))         return svgUseCaseShape(shape, vm);
      if (isSystemBoundaryViewModel(vm))  return svgSystemBoundaryShape(shape, vm);
      return svgClassShape(shape, vm as NodeViewModel);
    })
    .join('\n');

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"`,
    `     width="${bounds.width}" height="${bounds.height}">`,
    bgSvg,
    `<g id="edges">`,
    edgesSvg,
    `</g>`,
    `<g id="nodes">`,
    shapesSvg,
    `</g>`,
    `</svg>`,
  ];

  return parts.filter(Boolean).join('\n');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * SVG path for a rect with rounded top corners only (same as Konva cornerRadius=[r,r,0,0]).
 */
function roundedTopPath(W: number, H: number, r: number): string {
  return `M 0,${r} A ${r},${r} 0 0,1 ${r},0 L ${W - r},0 A ${r},${r} 0 0,1 ${W},${r} L ${W},${H} L 0,${H} Z`;
}

/** Returns SVG font-weight/font-style attributes from a Konva fontStyle string. */
function svgFontAttrs(fontStyle: string): string {
  const bold = fontStyle.includes('bold');
  const italic = fontStyle.includes('italic');
  return `font-weight="${bold ? 'bold' : 'normal'}" font-style="${italic ? 'italic' : 'normal'}"`;
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getEdgeColor(): string {
  return getCSSVar('--edge-base') || '#64748b';
}

function getCanvasBg(): string {
  return getCSSVar('--canvas-base') || '#f8fafc';
}

/**
 * Simple word-wrap for monospace note content.
 * Matches the character-count estimate used by NoteShape.tsx (0.55 em/char).
 */
function wrapNoteLines(text: string): string[] {
  const contentW = NOTE_W - 2 * NOTE_H_PAD; // 208px
  const avgCharW = NOTE_SEC_FONT * 0.55;     // ~6.6px per monospace char
  const charsPerLine = Math.max(1, Math.floor(contentW / avgCharW));

  const result: string[] = [];
  for (const para of text.split('\n')) {
    if (!para) { result.push(''); continue; }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= charsPerLine) {
        current += ' ' + word;
      } else {
        result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

function buildBoundsMap(shapes: ShapeDescriptor[]): Map<string, NodeBounds> {
  const map = new Map<string, NodeBounds>();
  for (const shape of shapes) {
    const vm = shape.data;
    let width: number, height: number;
    if (isNoteViewModel(vm))            { ({ width, height } = getNoteShapeSize(vm)); }
    else if (isActorViewModel(vm))      { ({ width, height } = getActorShapeSize(vm)); }
    else if (isUseCaseViewModel(vm))    { ({ width, height } = getUseCaseShapeSize(vm)); }
    else if (isSystemBoundaryViewModel(vm)) { ({ width, height } = getSystemBoundaryShapeSize(vm)); }
    else                                { ({ width, height } = getClassShapeSize(vm as NodeViewModel)); }
    map.set(shape.id, { x: shape.x, y: shape.y, width, height });
  }
  return map;
}

function calculateBounds(boundsMap: Map<string, NodeBounds>): DiagramBounds {
  if (boundsMap.size === 0) {
    return { x: 0, y: 0, width: 800, height: 600 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boundsMap.values()) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return {
    x: minX - EXPORT_MARGIN,
    y: minY - EXPORT_MARGIN,
    width: maxX - minX + EXPORT_MARGIN * 2,
    height: maxY - minY + EXPORT_MARGIN * 2,
  };
}

// ─── Use Case Diagram shapes ──────────────────────────────────────────────────

const ACTOR_HEAD_R = 12;
const ACTOR_HEAD_CY = ACTOR_HEAD_R + 2;
const ACTOR_BODY_TOP = ACTOR_HEAD_CY + ACTOR_HEAD_R;
const ACTOR_BODY_BOT = ACTOR_BODY_TOP + 32;
const ACTOR_ARM_Y = ACTOR_BODY_TOP + 16;
const ACTOR_ARM_HALF = 18;
const ACTOR_LEG_DX = 16;
const ACTOR_LEG_DY = 18;
const ACTOR_NAME_Y = ACTOR_BODY_BOT + ACTOR_LEG_DY + 8;
const ACTOR_NAME_FONT = 13;
const STROKE_W = 1.5;

function svgActorShape(shape: ShapeDescriptor, vm: ActorViewModel): string {
  const colors = resolveActorColors();
  const { width: W } = getActorShapeSize(vm);
  const cx = W / 2;
  const x = shape.x;
  const y = shape.y;
  const stroke = escapeXml(colors.stroke);
  const fontStyle = vm.isAbstract ? 'italic' : 'normal';

  return [
    `<g transform="translate(${x},${y})">`,
    `  <circle cx="${cx}" cy="${ACTOR_HEAD_CY}" r="${ACTOR_HEAD_R}" fill="none" stroke="${stroke}" stroke-width="${STROKE_W}"/>`,
    `  <line x1="${cx}" y1="${ACTOR_BODY_TOP}" x2="${cx}" y2="${ACTOR_BODY_BOT}" stroke="${stroke}" stroke-width="${STROKE_W}"/>`,
    `  <line x1="${cx - ACTOR_ARM_HALF}" y1="${ACTOR_ARM_Y}" x2="${cx + ACTOR_ARM_HALF}" y2="${ACTOR_ARM_Y}" stroke="${stroke}" stroke-width="${STROKE_W}"/>`,
    `  <line x1="${cx}" y1="${ACTOR_BODY_BOT}" x2="${cx - ACTOR_LEG_DX}" y2="${ACTOR_BODY_BOT + ACTOR_LEG_DY}" stroke="${stroke}" stroke-width="${STROKE_W}"/>`,
    `  <line x1="${cx}" y1="${ACTOR_BODY_BOT}" x2="${cx + ACTOR_LEG_DX}" y2="${ACTOR_BODY_BOT + ACTOR_LEG_DY}" stroke="${stroke}" stroke-width="${STROKE_W}"/>`,
    `  <text x="${cx}" y="${ACTOR_NAME_Y}" text-anchor="middle" font-family="${FONT_SANS}" font-size="${ACTOR_NAME_FONT}" font-style="${fontStyle}" fill="${escapeXml(colors.text)}">${escapeXml(vm.name)}</text>`,
    `</g>`,
  ].join('\n');
}

const UC_BASE_H = 56;
const UC_EP_H = 16;
const UC_EP_SEP_PAD = 6;
const UC_EP_FONT = 11;
const UC_NAME_FONT_SVG = 13;

function svgUseCaseShape(shape: ShapeDescriptor, vm: UseCaseViewModel): string {
  const colors = resolveUseCaseColors();
  const { width: W, height: H } = getUseCaseShapeSize(vm);
  const cx = W / 2;
  const cy = H / 2;
  const rx = cx - 2;
  const ry = cy - 2;
  const x = shape.x;
  const y = shape.y;
  const hasEP = vm.extensionPoints.length > 0;
  const sepY = UC_BASE_H - UC_EP_SEP_PAD - 1;
  const nameY = UC_BASE_H / 2 + UC_NAME_FONT_SVG / 2 - (hasEP ? 4 : 0);

  const epLines = vm.extensionPoints.map((ep, i) => {
    const epY = UC_BASE_H + UC_EP_SEP_PAD + i * UC_EP_H + UC_EP_FONT;
    return `  <text x="${cx}" y="${epY}" text-anchor="middle" font-family="${FONT_MONO}" font-size="${UC_EP_FONT}" fill="${escapeXml(colors.text)}">${escapeXml(ep)}</text>`;
  });

  return [
    `<g transform="translate(${x},${y})">`,
    `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${escapeXml(colors.fill)}" stroke="${escapeXml(colors.stroke)}" stroke-width="${STROKE_W}"/>`,
    `  <text x="${cx}" y="${nameY}" text-anchor="middle" font-family="${FONT_SANS}" font-size="${UC_NAME_FONT_SVG}" fill="${escapeXml(colors.text)}">${escapeXml(vm.name)}</text>`,
    hasEP ? `  <line x1="${cx - rx + 4}" y1="${sepY}" x2="${cx + rx - 4}" y2="${sepY}" stroke="${escapeXml(colors.stroke)}" stroke-width="1" stroke-dasharray="3,2"/>` : '',
    ...epLines,
    `</g>`,
  ].filter(Boolean).join('\n');
}

const SB_TITLE_FONT = 13;
const SB_TITLE_PAD_X = 10;
const SB_TITLE_PAD_Y = 4;
const SB_TITLE_H = 22;

function svgSystemBoundaryShape(shape: ShapeDescriptor, vm: SystemBoundaryViewModel): string {
  const colors = resolveSystemBoundaryColors();
  const W = vm.width;
  const H = vm.height;
  const x = shape.x;
  const y = shape.y;
  const stroke = escapeXml(colors.stroke);

  return [
    `<g transform="translate(${x},${y})">`,
    `  <rect width="${W}" height="${H}" fill="none" stroke="${stroke}" stroke-width="${STROKE_W}" stroke-dasharray="8,5"/>`,
    `  <text x="${SB_TITLE_PAD_X}" y="${SB_TITLE_PAD_Y + SB_TITLE_FONT}" font-family="${FONT_SANS}" font-size="${SB_TITLE_FONT}" fill="${stroke}">${escapeXml(vm.name)}</text>`,
    `  <line x1="0" y1="${SB_TITLE_PAD_Y + SB_TITLE_H}" x2="${W}" y2="${SB_TITLE_PAD_Y + SB_TITLE_H}" stroke="${stroke}" stroke-width="1" opacity="0.4"/>`,
    `</g>`,
  ].join('\n');
}

// ─── Class Diagram shapes ─────────────────────────────────────────────────────

function svgClassShape(shape: ShapeDescriptor, vm: NodeViewModel): string {
  const colors = resolveNodeColors(vm.style.containerClass);
  const layout = computeClassLayout(vm);
  const { width: W, height: H, headerH, stereotypeY, badgeY, nameY, fontStyle, separators, sections } = layout;

  const stereoText = vm.style.showStereotype && vm.stereotype ? `<<${vm.stereotype}>>` : null;
  const stereoIsItalic = vm.style.labelFormat.includes('italic');
  const nameText = vm.sublabel ? `${vm.label}${vm.sublabel}` : vm.label;

  const lines: string[] = [];
  lines.push(`<g transform="translate(${shape.x}, ${shape.y})">`);

  // Background rect (full, rounded corners)
  lines.push(
    `  <rect x="0" y="0" width="${W}" height="${H}"` +
    ` fill="${escapeXml(colors.bg)}" stroke="${escapeXml(colors.border)}"` +
    ` stroke-width="${BORDER_W}" rx="${RADIUS}" ry="${RADIUS}"/>`,
  );

  // Header background (rounded top corners only)
  lines.push(
    `  <path d="${roundedTopPath(W, headerH, RADIUS)}"` +
    ` fill="${escapeXml(colors.headerBg)}"/>`,
  );

  // Stereotype text
  if (stereoText !== null && stereotypeY >= 0) {
    lines.push(
      `  <text x="${W / 2}" y="${stereotypeY + 2}"` +
      ` font-size="${STEREO_FONT}" font-family="${FONT_MONO}"` +
      ` fill="${escapeXml(colors.border)}" text-anchor="middle" dominant-baseline="hanging"` +
      ` font-style="${stereoIsItalic ? 'italic' : 'normal'}">${escapeXml(stereoText)}</text>`,
    );
  }

  // Badge text
  if (vm.badge !== undefined && badgeY >= 0) {
    lines.push(
      `  <text x="${W / 2}" y="${badgeY + 2}"` +
      ` font-size="${BADGE_FONT}" font-family="${FONT_SANS}"` +
      ` fill="${escapeXml(colors.textMuted)}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(vm.badge)}</text>`,
    );
  }

  // Name text
  lines.push(
    `  <text x="${W / 2}" y="${nameY + 3}"` +
    ` font-size="${NAME_FONT}" font-family="${FONT_SANS}"` +
    ` fill="${escapeXml(colors.text)}" text-anchor="middle" dominant-baseline="hanging"` +
    ` ${svgFontAttrs(fontStyle)}>${escapeXml(nameText)}</text>`,
  );

  // Separator lines
  for (const sepY of separators) {
    lines.push(
      `  <line x1="0" y1="${sepY}" x2="${W}" y2="${sepY}"` +
      ` stroke="${escapeXml(colors.border)}" stroke-width="${BORDER_W}"/>`,
    );
  }

  // Section items
  vm.sections.forEach((section, sIdx) => {
    const secLayout = sections[sIdx];
    if (!secLayout) return;
    section.items.forEach((item, iIdx) => {
      const itemOffset = secLayout.itemOffsets?.[iIdx] ?? iIdx * ROW_H;
      const itemY = secLayout.itemsY + itemOffset + 2;
      const fontStyleVal = item.isAbstract ? 'italic' : 'normal';
      const decoAttr = item.isStatic ? ' text-decoration="underline"' : '';
      lines.push(
        `  <text x="${H_PAD}" y="${itemY}"` +
        ` font-size="${SEC_FONT}" font-family="${FONT_MONO}"` +
        ` fill="${escapeXml(colors.textMuted)}" dominant-baseline="hanging"` +
        ` font-style="${fontStyleVal}"${decoAttr}>${escapeXml(item.text)}</text>`,
      );
    });
  });

  lines.push('</g>');
  return lines.join('\n');
}

function svgNoteShape(shape: ShapeDescriptor, vm: NoteViewModel): string {
  const colors = resolveNoteColors();
  const { height: H } = getNoteShapeSize(vm);
  const W = NOTE_W;
  const titleH = vm.title !== undefined ? NOTE_TITLE_H : 0;
  const contentY = titleH + NOTE_V_PAD;
  const wrappedLines = wrapNoteLines(vm.content);

  const lines: string[] = [];
  lines.push(`<g transform="translate(${shape.x}, ${shape.y})">`);

  // Note body — custom path with cut corner
  lines.push(
    `  <path d="M 0,0 L ${W - NOTE_FOLD},0 L ${W},${NOTE_FOLD} L ${W},${H} L 0,${H} Z"` +
    ` fill="${escapeXml(colors.bg)}" stroke="${escapeXml(colors.border)}" stroke-width="1"/>`,
  );

  // Fold flap triangle
  lines.push(
    `  <path d="M ${W - NOTE_FOLD},0 L ${W},0 L ${W},${NOTE_FOLD} Z"` +
    ` fill="${escapeXml(colors.surfacePrimary)}" stroke="${escapeXml(colors.border)}" stroke-width="1"/>`,
  );

  if (vm.title !== undefined) {
    // Title bar background
    lines.push(
      `  <rect x="0" y="0" width="${W - NOTE_FOLD}" height="${NOTE_TITLE_H}"` +
      ` fill="${escapeXml(colors.surfacePrimary)}" opacity="0.5"/>`,
    );
    // Title text
    lines.push(
      `  <text x="${NOTE_H_PAD}" y="${NOTE_V_PAD / 2 + 2}"` +
      ` font-size="${NOTE_TITLE_FONT}" font-family="${FONT_SANS}"` +
      ` fill="${escapeXml(colors.border)}" dominant-baseline="hanging" font-weight="bold">${escapeXml(vm.title)}</text>`,
    );
    // Dashed separator line
    lines.push(
      `  <line x1="0" y1="${NOTE_TITLE_H}" x2="${W - NOTE_FOLD}" y2="${NOTE_TITLE_H}"` +
      ` stroke="${escapeXml(colors.border)}" stroke-width="1" stroke-dasharray="4 3"/>`,
    );
  }

  // Content text with word-wrap via <tspan>
  if (wrappedLines.length > 0) {
    const tspans = wrappedLines
      .map((line, i) => {
        const dyAttr = i === 0 ? '' : ` dy="${NOTE_SEC_FONT * NOTE_LINE_H}"`;
        return `<tspan x="${NOTE_H_PAD}"${dyAttr}>${escapeXml(line)}</tspan>`;
      })
      .join('');
    lines.push(
      `  <text x="${NOTE_H_PAD}" y="${contentY}"` +
      ` font-size="${NOTE_SEC_FONT}" font-family="${FONT_MONO}"` +
      ` fill="${escapeXml(colors.textMuted)}" dominant-baseline="hanging">${tspans}</text>`,
    );
  }

  lines.push('</g>');
  return lines.join('\n');
}

function svgEdgeStereotypeLabel(kind: RelationKind): string | null {
  switch (kind) {
    case 'INCLUDE':       return '«include»';
    case 'EXTEND':        return '«extend»';
    case 'PACKAGE_IMPORT': return '«import»';
    case 'PACKAGE_MERGE':  return '«merge»';
    case 'PACKAGE_ACCESS': return '«access»';
    default: return null;
  }
}

function svgEdge(edge: EdgeDescriptor, boundsMap: Map<string, NodeBounds>): string {
  const isSelfLoop = edge.sourceId === edge.targetId;
  const sourceBounds = boundsMap.get(edge.sourceId);
  const targetBounds = isSelfLoop ? sourceBounds : boundsMap.get(edge.targetId);

  if (!sourceBounds || !targetBounds) return '';

  const retract = MARKER_RETRACT[edge.kind] ?? 0;
  const dashed = DASHED_KINDS.has(edge.kind);
  const stroke = getEdgeColor();
  const bg = getCanvasBg();

  let lineSvg: string;
  let markerX: number;
  let markerY: number;
  let markerFace: AnchorFace;
  let midX: number;
  let midY: number;

  if (isSelfLoop) {
    const loop = selfLoopPath(sourceBounds, retract);
    const pts = loop.points;
    lineSvg = bezierPath(
      pts[0]!, pts[1]!, pts[2]!, pts[3]!, pts[4]!, pts[5]!, pts[6]!, pts[7]!,
      stroke, dashed,
    );
    markerX = loop.markerX;
    markerY = loop.markerY;
    markerFace = loop.markerFace;
    midX = (pts[0]! + pts[6]!) / 2;
    midY = (pts[1]! + pts[7]!) / 2 - 12;
  } else {
    const { src, tgt } = selectAnchors(sourceBounds, targetBounds);
    const retractedTgt = retract > 0 ? retractAnchor(tgt, retract) : tgt;

    const obstacles = [...boundsMap.entries()]
      .filter(([id]) => id !== edge.sourceId && id !== edge.targetId)
      .map(([, b]) => b);

    const points = avoidObstacles(src, retractedTgt, obstacles);
    lineSvg = polylinePath(points, stroke, dashed);
    markerX = tgt.x;
    markerY = tgt.y;
    markerFace = tgt.face;
    // Midpoint of the path for label placement
    const n = points.length;
    midX = (points[0]! + points[n - 2]!) / 2;
    midY = (points[1]! + points[n - 1]!) / 2 - 10;
  }

  const marker = svgMarker(edge.kind, markerX, markerY, markerFace, stroke, bg);

  // Stereotype label («include», «extend», etc.)
  const stereotypeText = svgEdgeStereotypeLabel(edge.kind);
  const labelSvg = stereotypeText
    ? `<text x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" ` +
      `text-anchor="middle" font-family="${FONT_MONO}" font-size="11" ` +
      `fill="${escapeXml(getEdgeColor())}" ` +
      `style="paint-order:stroke" stroke="${escapeXml(getCanvasBg())}" stroke-width="3" stroke-linejoin="round">` +
      `${escapeXml(stereotypeText)}</text>`
    : '';

  return [lineSvg, marker, labelSvg].filter(Boolean).join('\n');
}

function svgMarker(
  kind: RelationKind,
  x: number,
  y: number,
  face: AnchorFace,
  stroke: string,
  bg: string,
): string {
  const rotation = faceToMarkerAngle(face);
  const transform = `translate(${x}, ${y}) rotate(${rotation})`;
  const s = escapeXml(stroke);
  const b = escapeXml(bg);

  switch (kind) {
    case 'GENERALIZATION':
    case 'REALIZATION':
      // Hollow triangle: tip at (0,0), base at x = -16 (matches EdgeMarker.tsx)
      return (
        `<g transform="${transform}">` +
        `<polygon points="-16,-8 -16,8 0,0"` +
        ` fill="${b}" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>` +
        `</g>`
      );

    case 'AGGREGATION':
      // Hollow diamond: right tip at (0,0), left tip at (-24,0)
      return (
        `<g transform="${transform}">` +
        `<polygon points="0,0 -12,6 -24,0 -12,-6"` +
        ` fill="${b}" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>` +
        `</g>`
      );

    case 'COMPOSITION':
      // Filled diamond
      return (
        `<g transform="${transform}">` +
        `<polygon points="0,0 -12,6 -24,0 -12,-6"` +
        ` fill="${s}" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>` +
        `</g>`
      );

    default:
      // Open chevron arrow: tip at (0,0)
      return (
        `<g transform="${transform}">` +
        `<polyline points="-14,-7 0,0 -14,7"` +
        ` fill="none" stroke="${s}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</g>`
      );
  }
}

// ─── SVG path generators ──────────────────────────────────────────────────────

/** Flat [x0,y0, x1,y1, …] array → SVG <polyline>. */
function polylinePath(points: number[], stroke: string, dashed: boolean): string {
  const pts: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    pts.push(`${points[i]},${points[i + 1]}`);
  }
  const dashAttr = dashed ? ' stroke-dasharray="6 4"' : '';
  return (
    `<polyline points="${pts.join(' ')}" fill="none"` +
    ` stroke="${escapeXml(stroke)}" stroke-width="2"${dashAttr}` +
    ` stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** 8-element bezier array [x0,y0, cp1x,cp1y, cp2x,cp2y, x1,y1] → SVG cubic <path>. */
function bezierPath(
  x0: number, y0: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x1: number, y1: number,
  stroke: string,
  dashed: boolean,
): string {
  const dashAttr = dashed ? ' stroke-dasharray="6 4"' : '';
  return (
    `<path d="M ${x0},${y0} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1}"` +
    ` fill="none" stroke="${escapeXml(stroke)}" stroke-width="2"${dashAttr}` +
    ` stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
