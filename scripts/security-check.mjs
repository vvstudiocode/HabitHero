import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const files = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(mjs|ts|tsx|sql|json)$/.test(entry.name)) files.push(path);
  }
}
await collect(root);
const contents = new Map(await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')])));
const source = [...contents.entries()]
  .filter(([file]) => /\/src\/|\/supabase\/migrations\//.test(file))
  .map(([, text]) => text).join('\n');
const migrations = [...contents.entries()]
  .filter(([file]) => file.includes('/supabase/migrations/'))
  .map(([, text]) => text).join('\n');
const failures = [];
const requireText = (label, text, pattern) => { if (!pattern.test(text)) failures.push(label); };

if (files.some((file) => /\/\.env(?:\.|$)/.test(file))) failures.push('no local environment secret files');
if (/service_role|SUPABASE_SERVICE_ROLE|user_metadata/.test(source)) failures.push('no service_role or user_metadata authorization in app/migrations');
if (/VITE_SUPABASE_ANON_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY/.test(source)) failures.push('publishable key contract only');
requireText('all exposed tables enable RLS', migrations, /alter table public\.point_ledger enable row level security/);
for (const [table, policy] of [['tasks', 'tasks_select'], ['child_profiles', 'child_profiles_select'], ['rewards', 'rewards_select'], ['wishlist_items', 'wishlist_select']]) {
  requireText(`${table} child read policy is ownership-scoped`, migrations, new RegExp(`${policy}[\\s\\S]{0,260}private\\.is_child_owner`));
}
requireText('invite RPCs use fixed search_path', migrations, /create or replace function public\.create_family_child_invite[\s\S]*?set search_path = pg_catalog, public/);
requireText('invite RPC execution excludes public and anon', migrations, /revoke all on function public\.redeem_family_child_invite\(text\) from public, anon/);
requireText('child loading filters by authenticated profile', source, /from\('child_profiles'\)[\s\S]*?\.eq\('profile_id', userId\)/);
requireText('logout clears protected provider state', source, /clearProtectedState[\s\S]*?setState\(emptyState\)/);
requireText('wishlist approval uses atomic RPC', source, /rpc\('approve_wishlist_item'/);

if (failures.length) {
  console.error(`Security checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Security checks passed (${files.length} files scanned).`);
