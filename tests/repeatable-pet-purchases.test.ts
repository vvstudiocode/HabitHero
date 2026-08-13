import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const projectRoot = process.cwd();
const childGamePanelSource = readFileSync(
  join(projectRoot, 'src/features/world/components/ChildGamePanel.tsx'),
  'utf8',
);
const migrationSources = readdirSync(join(projectRoot, 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(join(projectRoot, 'supabase/migrations', name), 'utf8'))
  .join('\n');

describe('repeatable pet purchases', () => {
  it('keeps an owned pet purchasable while preserving single-ownership items', () => {
    assert.match(
      childGamePanelSource,
      /const owned = ownedCatalogIds\.has\(item\.id\) && item\.itemType !== 'pet' && !item\.isStackable;/,
    );
    assert.match(childGamePanelSource, /disabled=\{mutationPending \|\| owned \|\| gameData\.walletBalance < price\}/);
  });

  it('creates one inventory instance per pet purchase and replays the exact instance idempotently', () => {
    assert.match(migrationSources, /allow repeatable pet purchases/i);
    assert.match(migrationSources, /add column if not exists instance_number integer/);
    assert.match(migrationSources, /unique \(child_profile_id, catalog_item_id, instance_number\)/);
    assert.match(migrationSources, /add column if not exists inventory_item_id uuid/);
    assert.match(migrationSources, /catalog_row\.item_type = 'pet'/);
    assert.match(migrationSources, /purchase_row\.inventory_item_id/);
    assert.match(migrationSources, /max\(existing_inventory\.instance_number\)/);
    assert.doesNotMatch(migrationSources, /if inventory_found and not catalog_row\.is_stackable then\s+raise exception 'item is already owned'/);
  });
});
