import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);

describe('world entity RPC qualification', () => {
  it('ships a migration that disambiguates entity_kind in placement queries', () => {
    const migrationName = readdirSync(migrationsDirectory)
      .find((name) => name.endsWith('_fix_ambiguous_entity_kind.sql'));
    assert.ok(migrationName, 'missing fix_ambiguous_entity_kind migration');

    const migrationSource = readFileSync(new URL(migrationName, migrationsDirectory), 'utf8');
    assert.match(migrationSource, /v_entity_kind\s+text;/);
    assert.match(migrationSource, /from public\.child_world_entities as world_entity/);
    assert.match(migrationSource, /world_entity\.entity_kind\s*=\s*'decoration'/);
    assert.match(migrationSource, /world_entity\.entity_kind\s*=\s*'pet'/);
    assert.match(migrationSource, /update public\.child_world_entities as world_entity/);
    assert.match(migrationSource, /world_entity\.entity_kind\s*=\s*'decoration'/);
  });

  it('ships a migration that disambiguates position_x in transform validation', () => {
    const migrationName = readdirSync(migrationsDirectory)
      .find((name) => name.endsWith('_fix_ambiguous_position_x.sql'));
    assert.ok(migrationName, 'missing fix_ambiguous_position_x migration');

    const migrationSource = readFileSync(new URL(migrationName, migrationsDirectory), 'utf8');
    assert.match(migrationSource, /create or replace function private\.validate_world_transform/);
    assert.match(migrationSource, /target_position_x\s+numeric/);
    assert.match(migrationSource, /target_position_y\s+numeric/);
    assert.match(migrationSource, /target_position_z\s+numeric/);
    assert.match(migrationSource, /entity\.position_x\s*-\s*target_position_x/);
    assert.match(migrationSource, /entity\.position_z\s*-\s*target_position_z/);
    assert.doesNotMatch(migrationSource, /entity\.position_x\s*-\s*position_x/);
    assert.doesNotMatch(migrationSource, /entity\.position_z\s*-\s*position_z/);
  });

  it('ships a migration that lets decorations use the visible meadow beyond the walkable boundary', () => {
    const migrationName = readdirSync(migrationsDirectory)
      .find((name) => name.endsWith('_allow_outer_grass_decoration_placement.sql'));
    assert.ok(migrationName, 'missing allow_outer_grass_decoration_placement migration');

    const migrationSource = readFileSync(new URL(migrationName, migrationsDirectory), 'utf8');
    assert.match(migrationSource, /visible_grass_boundary\s+numeric\s*:=\s*13\.475/);
    assert.match(migrationSource, /target_entity_kind\s*=\s*'decoration'/);
    assert.match(migrationSource, /effective_radius\s*>\s*visible_grass_boundary/);
    assert.match(migrationSource, /target_entity_kind\s*<>\s*'decoration'/);
    assert.match(migrationSource, /target_position_z\s*-\s*2\.2/);
    assert.match(migrationSource, /target_position_z\s*\+\s*8\.9/);
  });

  it('ships conditional entity position constraints for outer meadow decorations', () => {
    const migrationName = readdirSync(migrationsDirectory)
      .find((name) => name.endsWith('_fix_outer_grass_entity_position_constraints.sql'));
    assert.ok(migrationName, 'missing fix_outer_grass_entity_position_constraints migration');

    const migrationSource = readFileSync(new URL(migrationName, migrationsDirectory), 'utf8');
    assert.match(migrationSource, /drop constraint if exists child_world_entities_position_x_check/);
    assert.match(migrationSource, /drop constraint if exists child_world_entities_position_z_check/);
    assert.match(migrationSource, /entity_kind\s*=\s*'decoration'/);
    assert.match(migrationSource, /13\.475/);
    assert.match(migrationSource, /position_x\s+between\s+-13\.475\s+and\s+13\.475/);
    assert.match(migrationSource, /position_z\s+between\s+-13\.475\s+and\s+13\.475/);
    assert.match(migrationSource, /entity_kind\s*<>\s*'decoration'/);
    assert.match(migrationSource, /position_x\s+between\s+-5\s+and\s+5/);
    assert.match(migrationSource, /position_z\s+between\s+-5\s+and\s+5/);
  });
});
