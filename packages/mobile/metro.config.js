const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Monorepo: resolve workspace packages (e.g. @forklift/db) from the repo root
// node_modules/pnpm symlinks, not just this package's own node_modules.
config.watchFolders = [require("node:path").resolve(__dirname, "../..")];
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: "./src/global.css" });
