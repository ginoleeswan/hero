/**
 * Expo config plugin: re-pads Android adaptive icon foreground and
 * splash screen logo after expo prebuild generates them.
 *
 * Expo's prebuild pipeline uses adaptive-icon.png at full canvas size,
 * which makes the mask too large inside the adaptive icon safe zone.
 * This plugin scales the content to SCALE (60%) of each canvas,
 * centred, so the mask sits well inside the safe zone.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

const SCALE = 0.60;

const FOREGROUND_SIZES = {
  'mipmap-mdpi':    108,
  'mipmap-hdpi':    162,
  'mipmap-xhdpi':   216,
  'mipmap-xxhdpi':  324,
  'mipmap-xxxhdpi': 432,
};

const SPLASH_SIZES = {
  'drawable-mdpi':    288,
  'drawable-hdpi':    432,
  'drawable-xhdpi':   576,
  'drawable-xxhdpi':  864,
  'drawable-xxxhdpi': 1152,
};

// Background colour for the splash icon (#293c43)
const SPLASH_BG = { r: 41, g: 60, b: 67, alpha: 1 };

async function repadImages(projectRoot) {
  const adaptiveSrc = path.join(projectRoot, 'assets', 'adaptive-icon.png');
  const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

  // --- Adaptive icon foreground ---
  for (const [folder, canvas] of Object.entries(FOREGROUND_SIZES)) {
    const contentSize = Math.round(canvas * SCALE);
    const pad = Math.floor((canvas - contentSize) / 2);
    const outPath = path.join(resDir, folder, 'ic_launcher_foreground.webp');

    await sharp(adaptiveSrc)
      .resize(contentSize, contentSize)
      .extend({ top: pad, bottom: canvas - contentSize - pad, left: pad, right: canvas - contentSize - pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 100 })
      .toFile(outPath);
  }

  // --- Splash screen logo ---
  for (const [folder, canvas] of Object.entries(SPLASH_SIZES)) {
    const contentSize = Math.round(canvas * SCALE);
    const pad = Math.floor((canvas - contentSize) / 2);
    const outPath = path.join(resDir, folder, 'splashscreen_logo.png');

    fs.mkdirSync(path.join(resDir, folder), { recursive: true });

    // Composite padded adaptive icon over dark background
    const fg = await sharp(adaptiveSrc)
      .resize(contentSize, contentSize)
      .extend({ top: pad, bottom: canvas - contentSize - pad, left: pad, right: canvas - contentSize - pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: SPLASH_BG } })
      .composite([{ input: fg, blend: 'over' }])
      .png()
      .toFile(outPath);
  }

  // Remove any density-less splashscreen_logo that prebuild may have created
  const plain = path.join(resDir, 'drawable', 'splashscreen_logo.png');
  if (fs.existsSync(plain)) fs.unlinkSync(plain);
}

module.exports = function withAndroidIconPadding(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      await repadImages(config.modRequest.projectRoot);
      return config;
    },
  ]);
};
