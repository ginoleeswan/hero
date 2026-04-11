const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

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
