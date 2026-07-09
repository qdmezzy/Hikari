module.exports = function (api) {
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Reanimated 4's plugin internally loads the worklets plugin, so we only
      // register this one — listing both causes a "Duplicate plugin" error.
      "react-native-reanimated/plugin",
    ],
  }
}
