const compatibilityRule = { meta: { schema: [] }, create: () => ({}) }

export default [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "public/**"],
  },
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "@next/next": { rules: { "no-img-element": compatibilityRule } },
      "react-hooks": { rules: { "exhaustive-deps": compatibilityRule } },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "constructor-super": "error",
      "for-direction": "error",
      "getter-return": "error",
      "no-async-promise-executor": "error",
      "no-class-assign": "error",
      "no-const-assign": "error",
      "no-dupe-args": "error",
      "no-dupe-class-members": "error",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-new-native-nonconstructor": "error",
      "no-obj-calls": "error",
      "no-setter-return": "error",
      "no-this-before-super": "error",
      "no-unreachable": "error",
      "no-unreachable-loop": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-with": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
]
