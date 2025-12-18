#!/usr/bin/env node

/* eslint-disable no-undef */
 

/**
 * Translation Coverage Checker
 *
 * This script compares translation files against the English baseline (en.js)
 * to identify missing or obsolete translation keys.
 *
 * Usage:
 *   node compare-translations.js [options]
 *
 * Options:
 *   --locale=<code>    Check specific locale only (e.g., --locale=ru)
 *   --help, -h         Show help message
 */

import { readdir } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');
const localeArg = args
  .find((arg) => arg.startsWith('--locale='))
  ?.split('=')[1];

if (helpFlag) {
  console.log(`
Translation Coverage Checker

Usage:
  node compare-translations.js [options]

Options:
  --locale=<code>    Check specific locale only (e.g., --locale=ru)
  --help, -h         Show this help message

Examples:
  node compare-translations.js
  node compare-translations.js --locale=ru
  `);
  process.exit(0);
}

async function getAvailableLocales() {
  const files = await readdir(__dirname);
  return files
    .filter(
      (f) =>
        f.endsWith('.js') &&
        f !== 'en.js' &&
        f !== 'index.js' &&
        f !== 'compare-translations.js',
    )
    .map((f) => f.replace('.js', ''));
}

async function promptLocaleSelection(locales) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\nAvailable locales:');
    locales.forEach((locale, idx) => {
      console.log(`  ${idx + 1}. ${locale}`);
    });
    console.log(`  ${locales.length + 1}. Check all locales`);

    rl.question('\nSelect locale (enter number): ', (answer) => {
      rl.close();
      const choice = parseInt(answer);

      if (choice > 0 && choice <= locales.length) {
        resolve([locales[choice - 1]]);
      } else if (choice === locales.length + 1) {
        resolve(locales);
      } else {
        console.log('Invalid selection. Checking all locales.');
        resolve(locales);
      }
    });
  });
}

async function checkTranslation(locale, enKeys) {
  const localeModule = await import(`./${locale}.js`);
  const localeData = localeModule.default || localeModule;
  const localeKeys = Object.keys(localeData);

  const missing = enKeys.filter((key) => !localeKeys.includes(key));
  const extra = localeKeys.filter((key) => !enKeys.includes(key));
  const coverage = ((localeKeys.length / enKeys.length) * 100).toFixed(1);

  return {
    locale,
    totalKeys: localeKeys.length,
    missing,
    extra,
    coverage,
    isComplete: missing.length === 0 && extra.length === 0,
  };
}

async function main() {
  const en = await import('./en.js');
  const enData = en.default || en;
  const enKeys = Object.keys(enData);

  let localesToCheck;

  if (localeArg) {
    localesToCheck = [localeArg];
  } else {
    const availableLocales = await getAvailableLocales();

    if (availableLocales.length === 0) {
      console.log('No translation files found.');
      process.exit(0);
    }

    localesToCheck = await promptLocaleSelection(availableLocales);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TRANSLATION COVERAGE REPORT');
  console.log('='.repeat(60));
  console.log(`Baseline: en.js (${enKeys.length} keys)\n`);

  for (const locale of localesToCheck) {
    try {
      const result = await checkTranslation(locale, enKeys);

      console.log(`Locale: ${locale}.js`);
      console.log(
        `  Coverage: ${result.coverage}% (${result.totalKeys}/${enKeys.length} keys)`,
      );

      if (result.missing.length > 0) {
        console.log(`  Missing: ${result.missing.length} keys`);
        result.missing.forEach((key) => {
          const value = enData[key];
          const preview =
            typeof value === 'string' && value.length > 60
              ? value.substring(0, 60) + '...'
              : value;
          console.log(`    - "${key}": "${preview}"`);
        });
      }

      if (result.extra.length > 0) {
        console.log(`  Extra: ${result.extra.length} keys (not in en.js)`);
        result.extra.forEach((key) => {
          console.log(`    - "${key}"`);
        });
      }

      if (result.isComplete) {
        console.log(`  Status: Complete`);
      } else {
        console.log(`  Status: Incomplete`);
      }

      console.log('');
    } catch (error) {
      console.log(`Locale: ${locale}.js`);
      console.log(`  Error: Failed to load (${error.message})`);
      console.log('');
    }
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
