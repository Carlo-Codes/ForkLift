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
  // Config plugins are CommonJS run by the Expo CLI, like the *.config.js
  // files the base config ignores.
  { ignores: [ ".expo/**", "plugins/**" ] }
];
