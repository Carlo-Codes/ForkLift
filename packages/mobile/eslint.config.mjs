import baseConfig from "@forklift/eslint-config/base";
import reactConfig from "@forklift/eslint-config/react";

export default [
  ...baseConfig,
  ...reactConfig,
  {
    // import-x/no-unused-modules and no-cycle both walk resolved imports into
    // node_modules; React Native's own entrypoint uses Flow syntax the TS
    // parser can't read, so they error trying to parse react-native/index.js
    // rather than lint our code.
    rules: {
      "import-x/no-unused-modules": "off",
      "import-x/no-cycle": "off"
    }
  },
  {
    // As the base rule, but the MCP SDK's subpath exports map to its files
    // only with their .js extension.
    rules: {
      "import-x/extensions": [
        "error",
        "never",
        {
          pattern: {
            jpg: "always",
            jpeg: "always",
            gif: "always",
            pdf: "always",
            svg: "always",
            png: "always",
            api: "always",
            json: "always",
            ttf: "always",
            config: "always"
          },
          pathGroupOverrides: [
            {
              pattern: "@modelcontextprotocol/sdk/**",
              action: "ignore"
            }
          ]
        }
      ]
    }
  },
  { ignores: [".expo/**"] }
];
