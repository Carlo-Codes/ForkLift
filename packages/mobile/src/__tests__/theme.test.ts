import { describe, expect, it } from "@jest/globals";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

import forkliftTailwindConfig from "@forklift/tailwind-config";
import { themeColors } from "@forklift/tailwind-config/colors";
import type { ThemeColor } from "@forklift/tailwind-config/colors";

import { cssToReactNativeRuntime } from "react-native-css-interop/dist/css-to-rn";

const tokens = Object.keys(themeColors.light) as ThemeColor[];
const kebab = (token: string) => token.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

function channels(hex: string) {
  return [
    1,
    3,
    5
  ].map(i => parseInt(hex.slice(i, i + 2), 16));
}

// Compiles utilities the way NativeWind does on device: Tailwind, then the
// CSS to React Native step.
async function compile(classNames: string[]) {
  const { css } = await postcss([
    tailwindcss({
      ...forkliftTailwindConfig,
      content: [ { raw: classNames.join(" ") } ]
    })
  ]).process("@tailwind base;\n@tailwind utilities;", { from: undefined });

  return cssToReactNativeRuntime(css);
}

describe("theme tokens", () => {
  it("defines every token for both light and dark", () => {
    expect(Object.keys(themeColors.dark).sort()).toEqual([ ...tokens ].sort());

    for (const scheme of [ themeColors.light, themeColors.dark ]) {
      for (const token of tokens) {
        expect(scheme[ token ]).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it("keeps brand orange as the accent in both themes", () => {
    expect(themeColors.light.accent).toBe("#E8590C");
    expect(themeColors.dark.accent).toBe("#E8590C");
  });

  it("gives each token a light value and a dark value that follows the system setting", async () => {
    const { rootVariables } = await compile(tokens.map(t => `bg-${kebab(t)}`));

    for (const token of tokens) {
      const variable = rootVariables?.[ `--color-${kebab(token)}` ];

      expect(variable?.light).toEqual(channels(themeColors.light[ token ]));
      expect(variable?.dark).toEqual(channels(themeColors.dark[ token ]));
    }
  });

  it("styles a token utility through its variable", async () => {
    const { rules } = await compile([ "bg-surface", "text-ink" ]);

    expect(JSON.stringify(rules?.[ "bg-surface" ])).toContain("--color-surface");
    expect(JSON.stringify(rules?.[ "text-ink" ])).toContain("--color-ink");
  });

  it("has a 44pt minimum touch target", async () => {
    const { rules } = await compile([ "min-h-touch", "min-w-touch" ]);

    expect(JSON.stringify(rules?.[ "min-h-touch" ])).toContain("\"minHeight\":44");
    expect(JSON.stringify(rules?.[ "min-w-touch" ])).toContain("\"minWidth\":44");
  });

  it("caps the Workout Mode menu's height with a class", async () => {
    const { rules } = await compile([ "max-h-[90%]" ]);

    expect(JSON.stringify(rules?.[ "max-h-[90%]" ])).toContain("\"maxHeight\":\"90%\"");
  });

  // The rest countdown keeps an inline fontVariant style for this reason; if
  // this starts failing, switch it to the class.
  it("has no native style for tabular-nums", async () => {
    const { rules } = await compile([ "tabular-nums" ]);

    expect(JSON.stringify(rules?.[ "tabular-nums" ])).not.toContain("fontVariant");
  });
});
