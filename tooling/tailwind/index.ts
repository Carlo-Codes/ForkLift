import type { Config } from "tailwindcss";

export enum ColorKey {
  PRIMARY = "primary",
  PRIMARY_DARK = "primaryDark",
  PRIMARY_LIGHT = "primaryLight",
  WHITE = "white",
  BLACK = "black",
  LIGHTER_GRAY = "lighterGray",
  LIGHT_GRAY = "lightGray",
  MEDIUM_GRAY = "mediumGray",
  DARK_GRAY = "darkGray",
  ERROR = "error"
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
      colors: {
        brand: {
          [ ColorKey.PRIMARY ]: "#E8590C",
          [ ColorKey.PRIMARY_DARK ]: "#C2410C",
          [ ColorKey.PRIMARY_LIGHT ]: "#FFF4E6",
          [ ColorKey.WHITE ]: "#FFF",
          [ ColorKey.BLACK ]: "#000",
          [ ColorKey.LIGHTER_GRAY ]: "#F5F5F5",
          [ ColorKey.LIGHT_GRAY ]: "#E0E0E0",
          [ ColorKey.MEDIUM_GRAY ]: "#8A8A8A",
          [ ColorKey.DARK_GRAY ]: "#2E2E2E",
          [ ColorKey.ERROR ]: "#E03131"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
