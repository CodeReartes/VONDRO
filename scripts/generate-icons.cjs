const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Full App Icon SVG (512x512) for PWA, Web, and Legacy/Play Store
const fullIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="45%" stop-color="#6D28D9" />
      <stop offset="100%" stop-color="#4C1D95" />
    </linearGradient>

    <!-- Speed Lines Gradient -->
    <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FCD34D" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>

    <!-- White Bag Gradient -->
    <linearGradient id="whiteBagGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>

    <!-- Inner V Gradient -->
    <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#581C87" />
    </linearGradient>

    <!-- Soft Drop Shadow -->
    <filter id="iconShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#1E0A3C" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Background Base Canvas -->
  <rect width="512" height="512" rx="120" fill="url(#bgGrad)" />

  <!-- Subtle Ambient Glow Rings -->
  <circle cx="430" cy="80" r="160" fill="#FFFFFF" fill-opacity="0.04" />
  <circle cx="90" cy="430" r="140" fill="#FFFFFF" fill-opacity="0.03" />

  <!-- Main VONDRO Symbol Group (Scaled and Centered) -->
  <g transform="translate(256, 218) scale(1.68) translate(-100, -96)" filter="url(#iconShadow)">
    <!-- Speed Motion Lines on Left -->
    <rect x="18" y="75" width="40" height="8" rx="4" fill="url(#speedGrad)" />
    <rect x="6" y="94" width="56" height="9" rx="4.5" fill="url(#speedGrad)" />
    <rect x="22" y="114" width="32" height="8" rx="4" fill="url(#speedGrad)" />

    <!-- Bag Handle -->
    <path 
      d="M74 58 C74 34, 126 34, 126 58" 
      stroke="#FFFFFF" 
      stroke-width="12" 
      stroke-linecap="round" 
      fill="none" 
    />

    <!-- Bag Body in Crisp White -->
    <path 
      d="M62 60 H138 C146 60, 153 66, 154 74 L162 144 C163 154, 155 162, 145 162 H55 C45 162, 37 154, 38 144 L46 74 C47 66, 54 60, 62 60 Z" 
      fill="url(#whiteBagGrad)" 
    />

    <!-- Stylized Dynamic V Cutout in Signature Purple -->
    <path 
      d="M50 84 C74 84, 84 92, 102 144 C116 96, 136 72, 170 68 C148 82, 132 116, 114 160 C104 160, 94 156, 90 146 L64 94 C58 86, 52 84, 50 84 Z" 
      fill="url(#vGrad)" 
    />

    <!-- Small Golden Flash Badge in Upper Right of Bag -->
    <polygon points="144,80 134,96 142,97 132,112 152,94 143,93" fill="#F59E0B" />
  </g>

  <!-- VONDRO Brand Text Typography -->
  <text 
    x="256" 
    y="432" 
    text-anchor="middle" 
    font-family="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif" 
    font-size="44" 
    font-weight="900" 
    letter-spacing="9" 
    fill="#FFFFFF"
  >
    VONDRO
  </text>
  <text 
    x="256" 
    y="464" 
    text-anchor="middle" 
    font-family="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif" 
    font-size="16" 
    font-weight="800" 
    letter-spacing="3" 
    fill="#DDD6FE"
  >
    CÓRDOBA
  </text>
</svg>
`;

// 2. Adaptive Foreground Icon SVG (Transparent canvas, centered inside Android safe circle)
const foregroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Speed Lines Gradient -->
    <linearGradient id="foreSpeedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FCD34D" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>

    <!-- White Bag Gradient -->
    <linearGradient id="foreWhiteBag" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>

    <!-- Inner V Gradient -->
    <linearGradient id="foreVGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#581C87" />
    </linearGradient>

    <filter id="foreShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#1E0A3C" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Centered inside Android 66% safe mask -->
  <g transform="translate(256, 230) scale(1.6) translate(-100, -100)" filter="url(#foreShadow)">
    <!-- Speed Motion Lines on Left -->
    <rect x="18" y="75" width="40" height="8" rx="4" fill="url(#foreSpeedGrad)" />
    <rect x="6" y="94" width="56" height="9" rx="4.5" fill="url(#foreSpeedGrad)" />
    <rect x="22" y="114" width="32" height="8" rx="4" fill="url(#foreSpeedGrad)" />

    <!-- Bag Handle -->
    <path 
      d="M74 58 C74 34, 126 34, 126 58" 
      stroke="#FFFFFF" 
      stroke-width="12" 
      stroke-linecap="round" 
      fill="none" 
    />

    <!-- Bag Body in Crisp White -->
    <path 
      d="M62 60 H138 C146 60, 153 66, 154 74 L162 144 C163 154, 155 162, 145 162 H55 C45 162, 37 154, 38 144 L46 74 C47 66, 54 60, 62 60 Z" 
      fill="url(#foreWhiteBag)" 
    />

    <!-- Stylized Dynamic V Cutout in Signature Purple -->
    <path 
      d="M50 84 C74 84, 84 92, 102 144 C116 96, 136 72, 170 68 C148 82, 132 116, 114 160 C104 160, 94 156, 90 146 L64 94 C58 86, 52 84, 50 84 Z" 
      fill="url(#foreVGrad)" 
    />

    <!-- Small Golden Flash Badge in Upper Right of Bag -->
    <polygon points="144,80 134,96 142,97 132,112 152,94 143,93" fill="#F59E0B" />
  </g>

  <!-- VONDRO Brand Text Typography -->
  <text 
    x="256" 
    y="410" 
    text-anchor="middle" 
    font-family="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif" 
    font-size="38" 
    font-weight="900" 
    letter-spacing="8" 
    fill="#FFFFFF"
  >
    VONDRO
  </text>
</svg>
`;

// 3. Splash Screen SVG (1080x1920) for Android Splash Screen
const splashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs>
    <linearGradient id="splashBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="50%" stop-color="#6D28D9" />
      <stop offset="100%" stop-color="#4C1D95" />
    </linearGradient>

    <linearGradient id="splashSpeed" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FCD34D" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>

    <linearGradient id="splashV" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#581C87" />
    </linearGradient>

    <filter id="splashShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#1E0A3C" flood-opacity="0.5" />
    </filter>
  </defs>

  <rect width="1080" height="1920" fill="url(#splashBg)" />

  <!-- Center Symbol -->
  <g transform="translate(540, 880) scale(3.4) translate(-100, -100)" filter="url(#splashShadow)">
    <rect x="18" y="75" width="40" height="8" rx="4" fill="url(#splashSpeed)" />
    <rect x="6" y="94" width="56" height="9" rx="4.5" fill="url(#splashSpeed)" />
    <rect x="22" y="114" width="32" height="8" rx="4" fill="url(#splashSpeed)" />

    <path 
      d="M74 58 C74 34, 126 34, 126 58" 
      stroke="#FFFFFF" 
      stroke-width="12" 
      stroke-linecap="round" 
      fill="none" 
    />

    <path 
      d="M62 60 H138 C146 60, 153 66, 154 74 L162 144 C163 154, 155 162, 145 162 H55 C45 162, 37 154, 38 144 L46 74 C47 66, 54 60, 62 60 Z" 
      fill="#FFFFFF" 
    />

    <path 
      d="M50 84 C74 84, 84 92, 102 144 C116 96, 136 72, 170 68 C148 82, 132 116, 114 160 C104 160, 94 156, 90 146 L64 94 C58 86, 52 84, 50 84 Z" 
      fill="url(#splashV)" 
    />

    <polygon points="144,80 134,96 142,97 132,112 152,94 143,93" fill="#F59E0B" />
  </g>

  <!-- Typography -->
  <text 
    x="540" 
    y="1260" 
    text-anchor="middle" 
    font-family="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif" 
    font-size="74" 
    font-weight="900" 
    letter-spacing="14" 
    fill="#FFFFFF"
  >
    VONDRO
  </text>
  <text 
    x="540" 
    y="1310" 
    text-anchor="middle" 
    font-family="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif" 
    font-size="24" 
    font-weight="700" 
    letter-spacing="4" 
    fill="#DDD6FE"
  >
    TODO LO QUE NECESITÁS, MÁS CERCA
  </text>
</svg>
`;

async function generateAll() {
  console.log('🚀 Starting VONDRO Icon generation for Mobile & Android Studio...');

  const fullSvgBuffer = Buffer.from(fullIconSvg);
  const foreSvgBuffer = Buffer.from(foregroundSvg);
  const splashSvgBuffer = Buffer.from(splashSvg);

  // 1. Write public SVG
  fs.writeFileSync(path.join(__dirname, '../public/icon.svg'), fullIconSvg);
  console.log('✓ public/icon.svg written');

  // 2. Generate Web / PWA PNGs
  await sharp(fullSvgBuffer).resize(512, 512).png().toFile(path.join(__dirname, '../public/icon-512.png'));
  console.log('✓ public/icon-512.png (512x512)');

  await sharp(fullSvgBuffer).resize(192, 192).png().toFile(path.join(__dirname, '../public/icon-192.png'));
  console.log('✓ public/icon-192.png (192x192)');

  await sharp(fullSvgBuffer).resize(180, 180).png().toFile(path.join(__dirname, '../public/apple-touch-icon.png'));
  console.log('✓ public/apple-touch-icon.png (180x180)');

  // 3. Android Mipmap Densities for Android Studio
  const androidDensities = [
    { dir: 'mipmap-mdpi', size: 48, foreSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, foreSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, foreSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, foreSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, foreSize: 432 },
  ];

  const resDir = path.join(__dirname, '../android/app/src/main/res');

  for (const item of androidDensities) {
    const targetDir = path.join(resDir, item.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Standard square launcher
    await sharp(fullSvgBuffer).resize(item.size, item.size).png().toFile(path.join(targetDir, 'ic_launcher.png'));

    // Round launcher (circular mask)
    const circleMask = Buffer.from(
      `<svg><circle cx="${item.size / 2}" cy="${item.size / 2}" r="${item.size / 2}" fill="#000"/></svg>`
    );
    await sharp(fullSvgBuffer)
      .resize(item.size, item.size)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // Adaptive foreground (transparent)
    await sharp(foreSvgBuffer)
      .resize(item.foreSize, item.foreSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`✓ Android ${item.dir} icons generated`);
  }

  // 4. Android Splash Screen
  const splashPngBuffer = await sharp(splashSvgBuffer).resize(1080, 1920).png().toBuffer();
  fs.writeFileSync(path.join(resDir, 'drawable/splash.png'), splashPngBuffer);

  // Also write splash to landscape and portrait drawable dirs if they exist
  const drawableDirs = fs.readdirSync(resDir).filter(d => d.startsWith('drawable-'));
  for (const d of drawableDirs) {
    const splashPath = path.join(resDir, d, 'splash.png');
    fs.writeFileSync(splashPath, splashPngBuffer);
  }
  console.log('✓ Android splash screens updated');

  // 5. Update Android adaptive icon background color to #6D28D9
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#6D28D9</color>
</resources>
`;
  fs.writeFileSync(path.join(resDir, 'values/ic_launcher_background.xml'), bgXml);
  console.log('✓ values/ic_launcher_background.xml updated to #6D28D9');

  console.log('🎉 All mobile and Android icons generated successfully!');
}

generateAll().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
