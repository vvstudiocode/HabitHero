import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const target = process.argv[2];
const specifications = {
  local: {
    label: '本機',
    files: ['.env.local'],
    requiresHttps: false,
    allowedHosts: new Set(['127.0.0.1', 'localhost']),
  },
  production: {
    label: 'Production',
    files: ['.env.production.local', '.env.production'],
    requiresHttps: true,
    allowedHosts: null,
  },
};

if (!specifications[target]) {
  console.error('用法：node scripts/verify-supabase-env.mjs <local|production>');
  process.exit(1);
}

const specification = specifications[target];
const fileValues = await loadEnvironment(specification.files);
const values = {
  ...fileValues,
  ...(process.env.VITE_SUPABASE_URL ? { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL } : {}),
  ...(process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? { VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY }
    : {}),
  ...(process.env.VITE_SUPABASE_ENV ? { VITE_SUPABASE_ENV: process.env.VITE_SUPABASE_ENV } : {}),
};
const url = values.VITE_SUPABASE_URL?.trim();
const publishableKey = values.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (values.VITE_SUPABASE_ENV && values.VITE_SUPABASE_ENV !== target) {
  fail(`${specification.label}環境的 VITE_SUPABASE_ENV 必須是 ${target}。`);
}

if (target === 'local' && !values.VITE_SUPABASE_ENV) {
  fail('本機環境必須設定 VITE_SUPABASE_ENV=local。');
}

if (target === 'production' && !values.VITE_SUPABASE_ENV) {
  console.warn('Production build 使用部署平台提供的 Supabase 設定；未設定 VITE_SUPABASE_ENV。');
}

if (!url || !publishableKey) {
  fail(`${specification.label}環境缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_PUBLISHABLE_KEY。`);
}

let parsedUrl;
try {
  parsedUrl = new URL(url);
} catch {
  fail(`${specification.label}環境的 VITE_SUPABASE_URL 不是有效網址。`);
}

if (specification.allowedHosts && !specification.allowedHosts.has(parsedUrl.hostname)) {
  fail(`本機環境只能連 localhost 或 127.0.0.1，目前是 ${parsedUrl.hostname}。`);
}

if (specification.requiresHttps && parsedUrl.protocol !== 'https:') {
  fail('Production 環境必須使用 HTTPS。');
}

if (!specification.requiresHttps && parsedUrl.protocol !== 'http:') {
  fail('本機環境必須使用 HTTP。');
}

if (/service_role|sb_secret_/i.test(publishableKey)) {
  fail('VITE_SUPABASE_PUBLISHABLE_KEY 不可以是 service_role 或 secret key。');
}

if (/PASTE_|CHANGE_ME|YOUR_/i.test(publishableKey)) {
  fail('VITE_SUPABASE_PUBLISHABLE_KEY 仍是範例值。');
}

console.log(`Supabase ${specification.label}環境檢查通過：${parsedUrl.origin}`);

async function loadEnvironment(candidates) {
  for (const candidate of candidates) {
    try {
      const content = await readFile(resolve(candidate), 'utf8');
      return dotenv.parse(content);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  if (!process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    fail(`找不到環境檔：${candidates.join(' 或 ')}`);
  }

  return {};
}

function fail(message) {
  console.error(`Supabase 環境檢查失敗：${message}`);
  process.exit(1);
}
