import type { stereotype } from "../../../types/diagram.types";

export const CLASS_ICON_CONFIG: Record<stereotype, { bg: string; letter: string; color: string }> = {
  class: { bg: "#59A869", letter: "C", color: "#FFFFFF" },
  interface: { bg: "#9AA7B0", letter: "I", color: "#FFFFFF" },
  abstract: { bg: "#9AA7B0", letter: "A", color: "#FFFFFF" },
  enum: { bg: "#9876AA", letter: "E", color: "#FFFFFF" },
  note: { bg: "#F0AD4E", letter: "N", color: "#FFFFFF" },
  package: { bg: "#6B8CAE", letter: "P", color: "#FFFFFF" },
};

export const THEME_COLORS = {
  dark: {
    bg: {
      primary: "#252526",
      secondary: "#1e1e1e",
      hover: "#2a2a2a",
      input: "#3c3c3c",
    },
    border: {
      primary: "#2d2d2d",
      secondary: "#2d2d2d/50",
      input: "#454545",
      focus: "blue-500",
    },
    text: {
      primary: "#cccccc",
      secondary: "#9e9e9e",
      muted: "#858585",
      disabled: "#6e6e6e",
    },
  },
  light: {
    bg: {
      primary: "#f3f3f3",
      secondary: "#ffffff",
      hover: "#e8e8e8",
      input: "white",
    },
    border: {
      primary: "#e0e0e0",
      secondary: "#e0e0e0/50",
      input: "#d0d0d0",
      focus: "blue-600",
    },
    text: {
      primary: "#383838",
      secondary: "#757575",
      muted: "#9e9e9e",
      disabled: "#b0b0b0",
    },
  },
} as const;
