const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Support the `@/` path alias (maps to ./src) — also declared in tsconfig.json.
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@": "./src",
}

module.exports = config
