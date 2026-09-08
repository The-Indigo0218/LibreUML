import type { stereotype } from "../../../types/diagram.types";

export const CLASS_ICON_CONFIG: Record<stereotype, { bg: string; letter: string; color: string }> = {
  class: { bg: "#59A869", letter: "C", color: "#FFFFFF" },
  interface: { bg: "#9AA7B0", letter: "I", color: "#FFFFFF" },
  abstract: { bg: "#9AA7B0", letter: "A", color: "#FFFFFF" },
  enum: { bg: "#9876AA", letter: "E", color: "#FFFFFF" },
  note: { bg: "#F0AD4E", letter: "N", color: "#FFFFFF" },
  package: { bg: "#6B8CAE", letter: "P", color: "#FFFFFF" },
  actor: { bg: "#4CAF50", letter: "A", color: "#FFFFFF" },
  use_case: { bg: "#7C83FF", letter: "U", color: "#FFFFFF" },
  system_boundary: { bg: "#607D8B", letter: "S", color: "#FFFFFF" },
  domain_entity: { bg: "#F59E0B", letter: "E", color: "#FFFFFF" },
  uc_module: { bg: "#5C7CFA", letter: "M", color: "#FFFFFF" },
  lifeline: { bg: "#6366F1", letter: "L", color: "#FFFFFF" },
  actor_lifeline: { bg: "#6366F1", letter: "A", color: "#FFFFFF" },
  activity_node: { bg: "#0EA5E9", letter: "A", color: "#FFFFFF" },
  // Activity Diagram tool ids (A2.5) — never appear in the package tree (activity
  // nodes carry no packageName), but the Record must stay exhaustive.
  action: { bg: "#0EA5E9", letter: "A", color: "#FFFFFF" },
  call_operation: { bg: "#0EA5E9", letter: "C", color: "#FFFFFF" },
  initial_node: { bg: "#0EA5E9", letter: "I", color: "#FFFFFF" },
  activity_final: { bg: "#0EA5E9", letter: "F", color: "#FFFFFF" },
  flow_final: { bg: "#0EA5E9", letter: "F", color: "#FFFFFF" },
  decision: { bg: "#0EA5E9", letter: "D", color: "#FFFFFF" },
  merge: { bg: "#0EA5E9", letter: "M", color: "#FFFFFF" },
  fork: { bg: "#0EA5E9", letter: "F", color: "#FFFFFF" },
  join: { bg: "#0EA5E9", letter: "J", color: "#FFFFFF" },
  activity_partition: { bg: "#0EA5E9", letter: "L", color: "#FFFFFF" },
  object_node: { bg: "#0EA5E9", letter: "O", color: "#FFFFFF" },
  loop_node: { bg: "#0EA5E9", letter: "L", color: "#FFFFFF" },
  conditional_node: { bg: "#0EA5E9", letter: "C", color: "#FFFFFF" },
  sequence_node: { bg: "#0EA5E9", letter: "S", color: "#FFFFFF" },
  interruptible_region: { bg: "#0EA5E9", letter: "R", color: "#FFFFFF" },
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
