/**
 * 한국어 리뷰 → 영어 번역 (Claude API)
 *
 * 사용법:
 *   npx tsx scripts/translate-reviews.ts              # 전체
 *   npx tsx scripts/translate-reviews.ts 1000048009   # 특정 상품만
 *
 * 결과: data/reviews/{product_cd}.json 에 content_en 필드 추가
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const REVIEWS_DIR = join(__dirname, '..', 'data', 'reviews');
const BATCH_SIZE = 30;

let totalInputTokens = 0;
let totalOutputTokens = 0;

interface Review {
  id: string;
  rating: number;
  name: string;
  content: string;
  content_en?: string;
  content_ja?: string;
  date: string;
  images: string[];
}

async function translateBatch(reviews: Review[]): Promise<string[]> {
  const numbered = reviews
    .map((r, i) => `[${i + 1}]\n${r.content || '(no content)'}`)
    .join('\n\n');

  const prompt = `You are a pet product review translator. Translate the following Korean reviews into natural English.

Translation notes:
- Pet names or nicknames should be kept as-is or romanized naturally
- Keep emojis as-is
- Casual/emotional expressions should sound natural in English
- Brand-specific Korean names (e.g. 바잇미) should be written as "BITE ME" etc.
- (no content) should be returned as empty string

${numbered}

Return JSON only (no other text):
{"translations":["translation1","translation2",...]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${errText}`);
  }
  const data = await res.json();
  const usage = data.usage || {};
  totalInputTokens += usage.input_tokens || 0;
  totalOutputTokens += usage.output_tokens || 0;
  const text = data.content[0].text.trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`JSON parse failed:\n${text}`);

  const parsed: { translations: string[] } = JSON.parse(match[0]);
  return parsed.translations;
}

async function translateFile(productCd: string) {
  const filePath = join(REVIEWS_DIR, `${productCd}.json`);
  if (!existsSync(filePath)) {
    console.log(`  [${productCd}] file not found, skip`);
    return;
  }

  const data: { product_cd: string; scraped_at: string; total: number; reviews: Review[] } =
    JSON.parse(readFileSync(filePath, 'utf-8'));

  const untranslated = data.reviews.filter(r => !r.content_en && r.content);
  if (untranslated.length === 0) {
    console.log(`  [${productCd}] already translated, skip`);
    return;
  }

  console.log(`  [${productCd}] translating ${untranslated.length} reviews...`);
  let done = 0;

  const reviewMap = new Map(data.reviews.map(r => [r.id, r]));

  for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
    const batch = untranslated.slice(i, i + BATCH_SIZE);
    try {
      const translations = await translateBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        const review = reviewMap.get(batch[j].id);
        if (review) {
          review.content_en = translations[j] || '';
        }
      }
      done += batch.length;
      process.stdout.write(`\r    progress: ${done}/${untranslated.length}`);
    } catch (err) {
      console.error(`\n    batch ${i / BATCH_SIZE + 1} failed:`, err);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  data.reviews = [...reviewMap.values()];
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n    saved`);
}

const args = process.argv.slice(2);
let targets: string[] = [];

if (args.length > 0) {
  targets = args;
} else {
  targets = readdirSync(REVIEWS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

console.log(`Translating ${targets.length} products...`);
for (const productCd of targets) {
  await translateFile(productCd);
}
console.log('\nDone');
console.log(`\nToken usage:`);
console.log(`  Input:  ${totalInputTokens} tokens`);
console.log(`  Output: ${totalOutputTokens} tokens`);
console.log(`  Total:  ${totalInputTokens + totalOutputTokens} tokens`);
const inputCost = (totalInputTokens / 1_000_000) * 0.80;
const outputCost = (totalOutputTokens / 1_000_000) * 4.00;
console.log(`  Cost:   $${(inputCost + outputCost).toFixed(4)} (input $${inputCost.toFixed(4)} + output $${outputCost.toFixed(4)})`);
