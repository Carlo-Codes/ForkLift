/**
 * Defines base jest config that can be consumed and optionally overridden
 * by modules that implement jest testing
 * TODO: look at centralising shared config at some point down the line
 *  when all packages have a more finalised set up
 */
export const jestModuleBaseConfig = {
  preset: "ts-jest",
  extensionsToTreatAsEsm: [ ".ts" ],
  globalSetup: "<rootDir>/jest.setup.ts",
  displayName: "@forklift",
  passWithNoTests: true,
  testMatch: [ "<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)" ],
  modulePathIgnorePatterns: [ "<rootDir>/.yarn", "<rootDir>/templates" ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/types/"
  ],
  transform: {
    "\\.[jt]sx?$": [
      "ts-jest",
      {
        useESM: true,
        loaders: {
          ".spec.js": "jsx",
          ".js": "jsx"
        }
      }
    ]
  }
};
