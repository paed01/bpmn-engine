#!/usr/bin/env node
/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const TOC_START = '<!-- toc -->';
const TOC_END = '<!-- tocstop -->';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const args = process.argv.slice(2);
const files = (args.length ? args : ['README.md']).flatMap((arg) => arg.split(',')).filter(Boolean);

let exitCode = 0;
for (const arg of files) {
  try {
    await processFile(resolve(repoRoot, arg));
  } catch (err) {
    console.error(`${arg}: ${err.message}`);
    exitCode = 1;
  }
}
process.exit(exitCode);

/** @param {string} mdPath */
async function processFile(mdPath) {
  const source = await readFile(mdPath, 'utf8');

  const inFence = (() => {
    const fences = [];
    let open = false;
    for (const [i, line] of source.split('\n').entries()) {
      if (/^```/.test(line)) {
        open = !open;
      }
      fences[i] = open;
    }
    return (i) => fences[i];
  })();

  const lines = source.split('\n');
  /** @type {Array<{ level: number, text: string, slug: string }>} */
  const headlines = [];
  const slugCounts = new Map();
  let firstHeadlineIdx = -1;
  let titleSkipped = false;

  for (const [i, line] of lines.entries()) {
    if (inFence(i)) continue;
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    if (level === 1 && !titleSkipped) {
      titleSkipped = true;
      continue;
    }
    const text = match[2].replace(/\*/g, '\\*');
    const baseSlug = slugify(match[2]);
    const n = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, n + 1);
    const slug = n === 0 ? baseSlug : `${baseSlug}-${n}`;
    headlines.push({ level, text, slug });
    if (firstHeadlineIdx === -1) firstHeadlineIdx = i;
  }

  if (firstHeadlineIdx === -1 || headlines.length === 0) {
    console.error(`${mdPath}: no non-title headlines found; nothing to do.`);
    return;
  }

  const minLevel = Math.min(...headlines.map((h) => h.level));
  const tocLines = headlines.map(({ level, text, slug }) => `${'  '.repeat(level - minLevel)}- [${text}](#${slug})`);
  const tocBlock = [TOC_START, '', ...tocLines, '', TOC_END].join('\n');

  const startIdx = lines.findIndex((l) => l.trim() === TOC_START);
  const endIdx = lines.findIndex((l) => l.trim() === TOC_END);

  let updated;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    updated = [...lines.slice(0, startIdx), tocBlock, ...lines.slice(endIdx + 1)].join('\n');
  } else {
    updated = [...lines.slice(0, firstHeadlineIdx), tocBlock, '', ...lines.slice(firstHeadlineIdx)].join('\n');
  }

  if (updated === source) {
    console.log(`${mdPath}: TOC already up to date.`);
  } else {
    await writeFile(mdPath, updated);
    console.log(`${mdPath}: wrote TOC with ${headlines.length} entries.`);
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
