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
