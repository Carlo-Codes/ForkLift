import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importX from "eslint-plugin-import-x";
import turbo from "eslint-plugin-turbo";
import globals from "globals";

// flat/* configs exist at runtime but aren't reflected in the plugin's .d.ts
const flatRecommendedTypeChecked =
  /** @type {import('eslint').Linter.Config[]} */ (
    tsPlugin.configs[ "flat/recommended-type-checked" ]
  );

const flatStylisticTypeChecked =
  /** @type {import('eslint').Linter.Config[]} */ (
    tsPlugin.configs[ "flat/stylistic-type-checked" ]
  );

export default [
  ...flatRecommendedTypeChecked,
  ...flatStylisticTypeChecked,
  {
    plugins: {
      "@typescript-eslint": tsPlugin,
      "import-x": importX,
      turbo
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        extraFileExtensions: [ ".json" ]
      },
      globals: {
        ...globals.es2022,
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      "quotes": [ "error", "double" ],
      "quote-props": [ "error", "consistent-as-needed" ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "import-x/no-cycle": [ 2, { maxDepth: 2 } ],
      "semi": [ "error", "always" ],
      "semi-style": [ "error", "last" ],
      "indent": [
        "error",
        2,
        {
          SwitchCase: 1,
          flatTernaryExpressions: true,
          ignoredNodes: [
            "JSXFragment",
            "JSXOpeningFragment",
            "JSXClosingFragment",
            "JSXIdentifier",
            "JSXNamespacedName",
            "JSXMemberExpression",
            "JSXEmptyExpression",
            "JSXExpressionContainer",
            "JSXElement",
            "JSXClosingElement",
            "JSXOpeningElement",
            "JSXAttribute",
            "JSXSpreadAttribute",
            "JSXText"
          ]
        }
      ],
      "comma-dangle": [ "error", "never" ],
      "no-trailing-spaces": [ "error" ],
      "operator-linebreak": [ "error", "after" ],
      "brace-style": [ "error" ],
      "no-multiple-empty-lines": [
        "error",
        {
          max: 1,
          maxBOF: 0,
          maxEOF: 0
        }
      ],
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: "import",
          next: "*"
        },
        {
          blankLine: "any",
          prev: "import",
          next: "import"
        },
        {
          blankLine: "always",
          prev: "expression",
          next: "export"
        },
        {
          blankLine: "always",
          prev: "*",
          next: "multiline-const"
        },
        {
          blankLine: "always",
          prev: "multiline-const",
          next: "*"
        },
        {
          blankLine: "never",
          prev: [ "singleline-const", "singleline-let" ],
          next: [ "singleline-const", "singleline-let" ]
        },
        {
          blankLine: "always",
          prev: "*",
          next: [
            "if",
            "for",
            "try",
            "switch",
            "do",
            "while"
          ]
        },
        {
          blankLine: "always",
          prev: "*",
          next: "expression"
        },
        {
          blankLine: "never",
          prev: "expression",
          next: "expression"
        },
        {
          blankLine: "always",
          prev: "*",
          next: "multiline-expression"
        },
        {
          blankLine: "always",
          prev: "*",
          next: "return"
        }
      ],
      "padded-blocks": [
        "error",
        {
          blocks: "never",
          switches: "never"
        }
      ],
      "keyword-spacing": [ "error" ],
      "space-before-blocks": [ "error" ],
      "space-in-parens": [ "error", "never" ],
      "array-bracket-newline": [
        "error",
        {
          multiline: true,
          minItems: 3
        }
      ],
      "array-element-newline": [
        "error",
        {
          ArrayExpression: {
            multiline: true,
            minItems: 3
          },
          ArrayPattern: {
            multiline: true,
            minItems: 3
          }
        }
      ],
      "array-bracket-spacing": [ "error", "always" ],
      "object-shorthand": [ "error" ],
      "object-curly-spacing": [ "error", "always" ],
      "object-property-newline": [ "error", { allowAllPropertiesOnSameLine: false } ],
      "object-curly-newline": [
        "error",
        {
          ObjectExpression: {
            multiline: true,
            minProperties: 3
          },
          ObjectPattern: {
            multiline: true,
            minProperties: 3
          },
          ImportDeclaration: {
            multiline: true,
            minProperties: 3
          },
          ExportDeclaration: {
            multiline: true,
            minProperties: 3
          }
        }
      ],
      "key-spacing": [
        "error",
        {
          beforeColon: false,
          afterColon: true
        }
      ],
      "dot-location": [ "error", "property" ],
      "comma-style": [ "error", "last" ],
      "comma-spacing": [
        "error",
        {
          before: false,
          after: true
        }
      ],
      "space-before-function-paren": [
        "error",
        {
          anonymous: "always",
          named: "never",
          asyncArrow: "always"
        }
      ],
      "arrow-spacing": [
        "error",
        {
          before: true,
          after: true
        }
      ],
      "block-spacing": [ "error", "always" ],
      "no-multi-spaces": [ "error" ],
      "template-curly-spacing": [ "error", "never" ],
      "computed-property-spacing": [ "error", "always" ],
      "one-var-declaration-per-line": [ "error", "always" ],
      "function-call-argument-newline": [ "error", "consistent" ],
      "no-async-promise-executor": [ "warn" ],
      "arrow-parens": [ "error", "as-needed" ],
      "space-infix-ops": [ "error" ],
      "no-console": [ "warn", { allow: [ "warn", "error" ] } ],
      "no-alert": [ "warn" ],
      "no-control-regex": "off",
      "import-x/no-unresolved": [ "off" ],
      "import-x/namespace": [ "off" ],
      "import-x/no-named-as-default": [ "off" ],
      "import-x/newline-after-import": [ "error" ],
      "import-x/no-useless-path-segments": [
        "error",
        {
          noUselessIndex: true,
          commonjs: true
        }
      ],
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
          // The MCP SDK's subpath exports map to its files only with their
          // .js extension.
          pathGroupOverrides: [
            {
              pattern: "@modelcontextprotocol/sdk/**",
              action: "ignore"
            }
          ]
        }
      ],
      "import-x/export": [ "error" ],
      "import-x/no-unused-modules": [ "error" ],
      "import-x/first": [ "error" ],
      "import-x/no-duplicates": [ "error" ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports"
        }
      ],
      "@typescript-eslint/no-misused-promises": [ 2, { checksVoidReturn: { attributes: false } } ],
      "import-x/consistent-type-specifier-style": [ "error", "prefer-top-level" ],
      "import-x/order": [
        "error",
        {
          "newlines-between": "always",
          "groups": [
            "builtin",
            "external",
            "internal",
            [
              "index",
              "parent",
              "sibling"
            ],
            "object",
            "unknown"
          ],
          "pathGroups": [
            {
              pattern: "@forklift/**",
              group: "internal"
            },
            {
              pattern: "storybook/**",
              group: "internal"
            },
            {
              pattern: "assets/**",
              group: "internal",
              position: "after"
            },
            {
              // package-private subpath imports, e.g. core's #utils/*
              pattern: "#*/**",
              group: "internal",
              position: "after"
            }
          ],
          "pathGroupsExcludedImportTypes": [ "builtin" ]
        }
      ]
    }
  },
  {
    ignores: [
      "**/.eslintrc.cjs",
      "**/*.config.js",
      "**/*.config.cjs",
      "**/*.config.mjs",
      "**/*.test.ts",
      "dist/**",
      "yarn.lock"
    ]
  }
];
