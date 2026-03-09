import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GUIDE_IMAGES = join(ROOT, 'guide-images');
const IMG_OUT = join(ROOT, 'img');

const imageMap = JSON.parse(readFileSync(join(__dirname, 'image-map.json'), 'utf-8'));

const MAIN_WIDTH = 800;
const THUMB_WIDTH = 400;
const HERO_WIDTH = 1200;
const WEBP_QUALITY = 75;
const JPEG_QUALITY = 80;

async function processSegment(segmentId, config) {
  const outDir = join(IMG_OUT, segmentId);
  mkdirSync(outDir, { recursive: true });

  console.log(`\nProcessing ${segmentId} (${config.files.length} images)...`);

  for (let i = 0; i < config.files.length; i++) {
    const sourceNum = config.files[i];
    const outputNum = String(i + 1).padStart(2, '0');
    const sourcePath = join(GUIDE_IMAGES, config.source_dir, `${sourceNum}_amalfi-day-guide-photo.jpg`);

    if (!existsSync(sourcePath)) {
      console.warn(`  MISSING: ${sourcePath}`);
      continue;
    }

    const img = sharp(sourcePath);

    // Main WebP
    await img.clone()
      .resize({ width: MAIN_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(join(outDir, `${outputNum}.webp`));

    // Main JPEG fallback
    await img.clone()
      .resize({ width: MAIN_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(join(outDir, `${outputNum}.jpg`));

    // Thumbnail WebP
    await img.clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(join(outDir, `${outputNum}-thumb.webp`));

    console.log(`  ${sourceNum} -> ${outputNum} ✓`);
  }
}

async function processHeroes(heroConfig) {
  const outDir = join(IMG_OUT, 'hero');
  mkdirSync(outDir, { recursive: true });

  console.log(`\nProcessing hero images...`);

  for (const hero of heroConfig.sources) {
    const segConfig = imageMap[hero.segment];
    if (!segConfig) continue;

    const sourcePath = join(GUIDE_IMAGES, segConfig.source_dir, `${hero.file}_amalfi-day-guide-photo.jpg`);

    if (!existsSync(sourcePath)) {
      console.warn(`  MISSING hero: ${sourcePath}`);
      continue;
    }

    const img = sharp(sourcePath);

    await img.clone()
      .resize({ width: HERO_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(join(outDir, `${hero.output}.webp`));

    await img.clone()
      .resize({ width: HERO_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(join(outDir, `${hero.output}.jpg`));

    console.log(`  hero: ${hero.output} ✓`);
  }
}

async function main() {
  console.log('=== find.amalfi.day Image Processing ===');

  for (const [segId, config] of Object.entries(imageMap)) {
    if (segId === 'hero') continue;
    await processSegment(segId, config);
  }

  if (imageMap.hero) {
    await processHeroes(imageMap.hero);
  }

  console.log('\n=== Done! ===');
}

main().catch(console.error);
