import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

import { themeColors } from "./colors";
import type { ColorScheme, ThemeColor } from "./colors";

const tokens = Object.keys(themeColors.light) as ThemeColor[];
// accentSoft → accent-soft, the class and variable name.
const kebab = (token: string) => token.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

// "#E8590C" → "232 89 12", so a utility can add its opacity.
function rgbChannels(hex: string) {
  return [
    1,
    3,
    5
  ].map(i => parseInt(hex.slice(i, i + 2), 16)).join(" ");
}

function cssVariables(scheme: ColorScheme) {
  return Object.fromEntries(tokens.map(token => [ `--color-${kebab(token)}`, rgbChannels(themeColors[ scheme ][ token ]) ]));
}

export default {
  content: [ "" ],
  theme: {
    extend: {
      fontFamily: {
        Inter_Regular: [
          "Inter_400Regular",
          "helvetica",
          "sans-serif"
        ],
        Inter_SemiBold: [
          "Inter_600SemiBold",
          "helvetica",
          "sans-serif"
        ],
        Inter_Bold: [
          "Inter_700Bold",
          "helvetica",
          "sans-serif"
        ]
      },
      // The smallest touch target: compact, but never under 44pt.
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
      colors: Object.fromEntries(tokens.map(token => [ kebab(token), `rgb(var(--color-${kebab(token)}) / <alpha-value>)` ]))
    }
  },
  plugins: [
    // Light values on :root, dark ones when the system is in dark mode.
    // NativeWind reads both and switches with the phone's appearance.
    plugin(api => {
      api.addBase({
        ":root": cssVariables("light"),
        "@media (prefers-color-scheme: dark)": { ":root": cssVariables("dark") }
      });
    })
  ]
} satisfies Config;
