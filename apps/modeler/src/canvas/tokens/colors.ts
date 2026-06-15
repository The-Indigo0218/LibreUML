/**
 * Resolves the project's CSS custom properties to hex/rgb strings that
 * Konva's canvas context can consume directly.
 *
 * Called at render time (not memoized globally) so theme switches (light ↔ dark)
 * are reflected on the next React render that touches a shape.
 *
 * ENUM nodes use Tailwind utility classes instead of CSS variables in the
 * view-model, so their colors are hardcoded here with light/dark variants.
 */

export interface KonvaNodeColors {
  bg: string;
  border: string;
  headerBg: string;
  text: string;
  textMuted: string;
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/**
 * Returns Konva-compatible colors for a class/interface/abstract/enum node.
 * @param containerClass - the `style.containerClass` string from NodeStyleConfig
 */
export function resolveNodeColors(containerClass: string): KonvaNodeColors {
  const text = getCSSVar('--text-primary');
  const textMuted = getCSSVar('--text-secondary');

  if (containerClass.includes('uml-class-bg')) {
    return {
      bg: getCSSVar('--uml-class-bg'),
      border: getCSSVar('--uml-class-border'),
      headerBg: getCSSVar('--surface-hover'),
      text,
      textMuted,
    };
  }
  if (containerClass.includes('uml-interface-bg')) {
    return {
      bg: getCSSVar('--uml-interface-bg'),
      border: getCSSVar('--uml-interface-border'),
      headerBg: getCSSVar('--surface-secondary'),
      text,
      textMuted,
    };
  }
  if (containerClass.includes('uml-abstract-bg')) {
    return {
      bg: getCSSVar('--uml-abstract-bg'),
      border: getCSSVar('--uml-abstract-border'),
      headerBg: getCSSVar('--surface-hover'),
      text,
      textMuted,
    };
  }

  // ENUM: containerClass uses Tailwind utilities (bg-purple-100 etc.), no CSS vars.
  // Values approximated from Tailwind purple palette + blending for dark mode.
  const dark = isDark();
  return {
    bg: dark ? '#181233' : '#f3e8ff',       // purple-900/20 blended vs purple-100
    border: dark ? '#a855f7' : '#c084fc',   // purple-500 vs purple-400
    headerBg: dark ? '#1e1757' : '#ede9fe', // purple-900/30 blended vs purple-100
    text,
    textMuted,
  };
}

export interface KonvaNoteColors {
  bg: string;
  border: string;
  surfacePrimary: string;
  text: string;
  textMuted: string;
}

/** Returns Konva-compatible colors for note nodes. */
export function resolveNoteColors(): KonvaNoteColors {
  return {
    bg: getCSSVar('--uml-note-bg'),
    border: getCSSVar('--uml-note-border'),
    surfacePrimary: getCSSVar('--surface-primary'),
    text: getCSSVar('--text-primary'),
    textMuted: getCSSVar('--text-secondary'),
  };
}

/** Yellow for generics sublabel (`<T>` etc.) — matches Tailwind yellow-600 / yellow-400. */
export function sublabelColor(): string {
  return isDark() ? '#fbbf24' : '#ca8a04';
}

export interface KonvaUseCaseColors {
  stroke: string;
  fill: string;
  text: string;
}

/** Stick-figure stroke and label color for Actor nodes. */
export function resolveActorColors(): KonvaUseCaseColors {
  const dark = isDark();
  const color = dark ? '#cbd5e1' : '#334155'; // slate-300 on dark, slate-700 on light
  return { stroke: color, fill: 'transparent', text: color };
}

/** Ellipse stroke, fill, and label color for UseCase nodes. */
export function resolveUseCaseColors(): KonvaUseCaseColors {
  const dark = isDark();
  return {
    stroke: dark ? '#60a5fa' : '#2563eb',
    fill: dark ? '#1e3a5f' : '#eff6ff',
    text: getCSSVar('--text-primary'),
  };
}

/** Dashed-rect stroke and label color for SystemBoundary nodes. */
export function resolveSystemBoundaryColors(): KonvaUseCaseColors {
  const text = getCSSVar('--text-secondary');
  return { stroke: text, fill: 'transparent', text };
}

export interface KonvaUCModuleColors {
  border: string;
  tabBg: string;
  bodyBg: string;
  text: string;
}

/** Teal palette for UC Module container nodes. */
export function resolveUCModuleColors(): KonvaUCModuleColors {
  const dark = isDark();
  return {
    border:  dark ? '#2dd4bf' : '#0d9488', // teal-400 / teal-600
    tabBg:   dark ? '#0f3d38' : '#ccfbf1', // teal-900/40 / teal-100
    bodyBg:  dark ? 'rgba(13,148,136,0.06)' : 'rgba(204,251,241,0.35)',
    text:    dark ? '#99f6e4' : '#0f766e', // teal-200 / teal-700
  };
}

export interface KonvaDomainEntityColors {
  bg: string;
  headerBg: string;
  border: string;
  text: string;
  textMuted: string;
}

/** Warm amber palette for Domain Entity nodes. */
export function resolveDomainEntityColors(): KonvaDomainEntityColors {
  const dark = isDark();
  return {
    bg:        dark ? '#1c1208' : '#fffbeb',
    headerBg:  dark ? '#2d1f0a' : '#fef3c7',
    border:    dark ? '#d97706' : '#f59e0b',
    text:      getCSSVar('--text-primary'),
    textMuted: getCSSVar('--text-secondary'),
  };
}

export interface KonvaLifelineColors {
  headBg: string;
  border: string;
  text: string;
  timeline: string;
}

/** Indigo palette for Sequence Diagram lifelines. */
export function resolveLifelineColors(): KonvaLifelineColors {
  const dark = isDark();
  return {
    headBg:   dark ? '#1e1b4b' : '#eef2ff',  // indigo-950 / indigo-50
    border:   dark ? '#818cf8' : '#4f46e5',  // indigo-400 / indigo-600
    text:     getCSSVar('--text-primary'),
    timeline: dark ? '#64748b' : '#94a3b8',  // slate-500 / slate-400
  };
}

export interface KonvaMessageColors {
  stroke: string;
  text: string;
  fill: string;
}

/** Colors for sequence-diagram messages (arrows + label). */
export function resolveMessageColors(): KonvaMessageColors {
  const dark = isDark();
  const stroke = dark ? '#e2e8f0' : '#1e293b'; // slate-200 / slate-800
  return {
    stroke,
    text: stroke,
    fill: stroke,
  };
}

export interface KonvaActivationColors {
  fill: string;
  border: string;
}

/**
 * Activation bar palette — slightly stronger indigo than the lifeline head to
 * stand out. `nestingDepth` steps the fill one indigo shade darker per level so a
 * nested execution (self-call / re-entrant call) is clearly distinguishable from
 * the parent bar it sits inside, instead of blending into it.
 */
export function resolveActivationColors(nestingDepth = 0): KonvaActivationColors {
  const dark = isDark();
  // indigo ramp, light → dark. depth 0 is the base; each level steps one darker,
  // clamped at the end of the ramp so very deep stacks still render.
  const lightRamp = ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1']; // indigo 200→500
  const darkRamp  = ['#a5b4fc', '#818cf8', '#6366f1', '#4f46e5']; // indigo 300→600
  const ramp = dark ? darkRamp : lightRamp;
  const idx = Math.min(Math.max(nestingDepth, 0), ramp.length - 1);
  return {
    fill:   ramp[idx],
    border: dark ? '#6366f1' : '#4338ca', // indigo-500 / indigo-700
  };
}

export interface KonvaFragmentColors {
  border: string;
  labelBg: string;
  labelText: string;
  separator: string;
  guardText: string;
}

/** Combined-fragment palette — translucent border + tab label. */
export function resolveFragmentColors(): KonvaFragmentColors {
  const dark = isDark();
  return {
    border:    dark ? '#94a3b8' : '#475569', // slate-400 / slate-600
    labelBg:   dark ? '#1e293b' : '#e2e8f0', // slate-800 / slate-200
    labelText: dark ? '#e2e8f0' : '#1e293b',
    separator: dark ? '#64748b' : '#94a3b8', // slate-500 / slate-400 (dashed)
    guardText: dark ? '#cbd5e1' : '#334155',
  };
}

export interface KonvaInteractionUseColors {
  border: string;
  fill: string;
  labelBg: string;
  labelText: string;
  refText: string;
}

/** Interaction-use (`ref`) palette — slate box with a tinted corner tab. */
export function resolveInteractionUseColors(): KonvaInteractionUseColors {
  const dark = isDark();
  return {
    border:    dark ? '#94a3b8' : '#475569', // slate-400 / slate-600
    fill:      dark ? 'rgba(148,163,184,0.07)' : 'rgba(71,85,105,0.05)',
    labelBg:   dark ? '#1e293b' : '#e2e8f0', // slate-800 / slate-200
    labelText: dark ? '#e2e8f0' : '#1e293b',
    refText:   getCSSVar('--text-primary'),
  };
}

export interface KonvaGateColors {
  fill: string;
  border: string;
  text: string;
}

/** Gate marker palette — small square on a fragment boundary. */
export function resolveGateColors(): KonvaGateColors {
  const dark = isDark();
  return {
    fill:   dark ? '#0f172a' : '#ffffff', // slate-900 / white
    border: dark ? '#94a3b8' : '#475569', // slate-400 / slate-600
    text:   getCSSVar('--text-primary'),
  };
}

export interface KonvaStateInvariantColors {
  fill: string;
  border: string;
  text: string;
}

/** State-invariant symbol palette — teal-tinted stadium on the lifeline. */
export function resolveStateInvariantColors(): KonvaStateInvariantColors {
  const dark = isDark();
  return {
    fill:   dark ? '#0f3d38' : '#ccfbf1', // teal-900/40 / teal-100
    border: dark ? '#2dd4bf' : '#0d9488', // teal-400 / teal-600
    text:   dark ? '#99f6e4' : '#0f766e', // teal-200 / teal-700
  };
}
