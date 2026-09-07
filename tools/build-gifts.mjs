// Refresh after adding images: node tools/build-gifts.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../assets/gifts/', import.meta.url));
const defaults = {
  flower: ['Sakura bouquet', '🌸'], heart: ['Heart gem', '❤️'],
  coffee: ['Love you a latte', '☕'], cookie: ['Cookie break', '🍪'],
  ticket: ['Movie night', '🎬'], controller: ['Player two', '🎮'],
  plushie: ['Little lavender cat', '🐱'], star: ['You are a star', '⭐'],
  rose: ['A rose for you', '🌹'], teddy: ['A little bear hug', '🧸'],
  cake: ['Make a wish', '🎂'], chocolates: ['Something sweet', '🍫'],
};
const title = value => value.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export async function buildCatalog(root = ROOT) {
  const gifts = [], ids = new Set();
  async function walk(dir, parts = []) {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relative = [...parts, entry.name];
      if (entry.isDirectory()) { await walk(path.join(dir, entry.name), relative); continue; }
      if (!entry.isFile() || !/\.(png|webp|gif|jpe?g|avif)$/i.test(entry.name)) continue;
      const stem = path.parse(entry.name).name;
      const id = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) throw new Error(`Use a shorter, descriptive filename: ${relative.join('/')}`);
      if (['constructor','prototype','__proto__'].includes(id)) throw new Error(`Choose a different gift filename: ${stem}`);
      if (ids.has(id)) throw new Error(`Duplicate gift filename: ${stem}. Each gift needs a unique filename, even in different categories.`);
      ids.add(id);
      const [name, emoji] = defaults[id] || [title(stem), '🎁'];
      if (name.length > 32) throw new Error(`Gift name must be 32 characters or fewer: ${stem}`);
      gifts.push({ id, name, emoji, category: parts.length ? title(parts[0]) : 'Little extras', image: '/assets/gifts/' + relative.map(encodeURIComponent).join('/') });
    }
  }
  await walk(root);
  return { version: 1, gifts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await buildCatalog();
  await fs.writeFile(path.join(ROOT, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Gift catalogue refreshed: ${catalog.gifts.length} gifts. Include catalog.json when publishing your images.`);
}
