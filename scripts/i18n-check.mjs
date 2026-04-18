#!/usr/bin/env node
/**
 * i18n key completeness checker.
 * Compares es.json against en.json (source of truth).
 * Exits 1 if any keys present in EN are missing from ES.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(__dirname, '../src/i18n/locales');

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const en = JSON.parse(readFileSync(resolve(LOCALES_DIR, 'en.json'), 'utf8'));
const es = JSON.parse(readFileSync(resolve(LOCALES_DIR, 'es.json'), 'utf8'));

const enKeys = new Set(flattenKeys(en));
const esKeys = new Set(flattenKeys(es));

const missing = [...enKeys].filter((k) => !esKeys.has(k));
const extra   = [...esKeys].filter((k) => !enKeys.has(k));

if (missing.length > 0) {
  console.error(`\n❌  ${missing.length} key(s) present in EN but missing from ES:\n`);
  for (const k of missing) console.error(`   • ${k}`);
}

if (extra.length > 0) {
  console.warn(`\n⚠️   ${extra.length} key(s) in ES not present in EN (extra / obsolete):\n`);
  for (const k of extra) console.warn(`   • ${k}`);
}

if (missing.length === 0) {
  console.log('\n✅  ES locale is complete — 0 missing keys.\n');
  process.exit(0);
} else {
  console.error('');
  process.exit(1);
}
