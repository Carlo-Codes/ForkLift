// @ts-expect-error -- eslint-plugin-jsx-a11y ships no type declarations
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  react.configs.flat.recommended,
  reactHooks.configs[ "recommended-latest" ],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      "react/jsx-max-props-per-line": [ 1, { maximum: 1 } ],
      "react/prop-types": "off",
      "react/jsx-indent-props": [ 2, 2 ],
      "react/jsx-indent": [
        2,
        2,
        {
          indentLogicalExpressions: true,
          checkAttributes: true
        }
      ]
    },
    settings: { react: { version: "detect" } },
    languageOptions: {
      globals: {
        React: "writable",
        ...globals.browser
      }
    }
  }
];
