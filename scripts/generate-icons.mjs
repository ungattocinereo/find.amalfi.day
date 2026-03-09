import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE = join(ROOT, 'guide-images', '001-From-Amalfi-to-Atrani', '028_amalfi-day-guide-photo.jpg');
const ICONS_DIR = join(ROOT, 'icons');

async function generateIcons() {
  // Regular icons — center-crop to square
  for (const size of [192, 512]) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toFile(join(ICONS_DIR, `icon-${size}.png`));
    console.log(`icon-${size}.png ✓`);
  }

  // Maskable icon — needs safe area padding (10% each side)
  // Create with extra padding by using a smaller crop area
  const maskableSize = 512;
  const innerSize = Math.round(maskableSize * 0.8);
  const padding = Math.round((maskableSize - innerSize) / 2);

  const inner = await sharp(SOURCE)
    .resize(innerSize, innerSize, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 26, g: 82, b: 118, alpha: 1 }, // navy background
    }
  })
    .composite([{ input: inner, left: padding, top: padding }])
    .png()
    .toFile(join(ICONS_DIR, 'icon-512-maskable.png'));

  console.log('icon-512-maskable.png ✓');

  // Favicon (32x32)
  await sharp(SOURCE)
    .resize(32, 32, { fit: 'cover', position: 'center' })
    .png()
    .toFile(join(ROOT, 'favicon.ico'));
  console.log('favicon.ico ✓');
}

generateIcons().catch(console.error);
