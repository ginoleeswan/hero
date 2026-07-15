// getSentryExpoConfig wraps Expo's getDefaultConfig to add source-map handling
// for Sentry symbolication. Every customization below is re-applied on top of
// it (SVG transformer, ext tweaks, web-stub resolver) — order matters.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getSentryExpoConfig(__dirname);

// SVG support: transform .svg into react-native-svg components on every
// platform, instead of treating them as image assets — RN's <Image> can't
// decode SVG on native. Requires moving 'svg' from assetExts to sourceExts.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts.push('svg');

// Metro's default asset extensions are lowercase only; add uppercase variants.
config.resolver.assetExts.push('PNG', 'JPG', 'JPEG');

const webAliases = {
  '@react-native-masked-view/masked-view': path.resolve(__dirname, 'src/web-stubs/MaskedView.js'),
  'react-native-figma-squircle': path.resolve(__dirname, 'src/web-stubs/SquircleView.js'),
  'react-native-touchable-scale': path.resolve(__dirname, 'src/web-stubs/TouchableScale.js'),
  'react-native-circular-progress': path.resolve(__dirname, 'src/web-stubs/CircularProgress.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webAliases[moduleName]) {
    return { filePath: webAliases[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
