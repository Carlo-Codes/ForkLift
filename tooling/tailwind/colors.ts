// The app's colour tokens, light and dark. Tailwind turns each into a utility
// (`bg-surface`, `text-ink`, `text-accent-soft`…) whose colour follows the
// system setting; the app reads the same values from JS where a style can't
// take a class (the native header, icons, Switch tracks).
//
// Brand orange is an accent only: buttons, links, selection and badges.
export const themeColors = {
  light: {
    // Screen behind the cards.
    background: "#F2F2F7",
    // Cards, list rows and the header.
    surface: "#FFFFFF",
    // Inputs, secondary buttons and unselected chips.
    fill: "#E9E9EE",
    // Hairlines between rows.
    separator: "#E0E0E5",
    // Primary text.
    ink: "#1C1C1E",
    // Secondary text.
    muted: "#6C6C72",
    // Disabled or skipped text.
    faint: "#AEAEB2",
    accent: "#E8590C",
    // Selected chips and badges behind accent text.
    accentSoft: "#FFEBDC",
    // Text and icons on an accent fill.
    onAccent: "#FFFFFF",
    danger: "#D92D2D"
  },
  dark: {
    background: "#000000",
    surface: "#1C1C1E",
    fill: "#2C2C2E",
    separator: "#38383A",
    ink: "#F2F2F7",
    muted: "#9C9CA3",
    faint: "#5A5A60",
    accent: "#E8590C",
    accentSoft: "#3D2414",
    onAccent: "#FFFFFF",
    danger: "#FF6B6B"
  }
} as const satisfies Record<"light" | "dark", Record<string, `#${string}`>>;

export type ColorScheme = keyof typeof themeColors;
export type ThemeColor = keyof typeof themeColors.light;
