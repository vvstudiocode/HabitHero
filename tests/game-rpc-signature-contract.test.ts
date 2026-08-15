import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { toWorldPlacementRpcArgs, toWorldTransformRpcArgs } from '../src/lib/data-access';

const rpcMigration = readFileSync(
  new URL('../supabase/migrations/20260810010603_game_economy_rpcs.sql', import.meta.url),
  'utf8',
);

function getRpcArgumentNames(functionName: string) {
  const match = rpcMigration.match(new RegExp(
    `create or replace function public\\.${functionName}\\(([\\s\\S]*?)\\)\\s*returns`,
    'i',
  ));
  assert.ok(match, `missing SQL signature for ${functionName}`);
  return match[1]
    .split(',')
    .map((argument) => argument.trim().match(/^([a-z_][a-z0-9_]*)/i)?.[1])
    .filter((argument): argument is string => Boolean(argument));
}

describe('game economy RPC argument contracts', () => {
  it('keeps transform data-access args exactly aligned with update_world_entity_transform', () => {
    const args = {
      ...toWorldTransformRpcArgs({
        inventoryItemId: 'inventory-1',
        entityId: 'entity-1',
        expectedRevision: 4,
        transform: { x: 1, y: 0, z: -1, rotationX: 0, rotationY: 1, rotationZ: 0, scale: 1.2 },
        behaviorMode: 'static' as const,
        roamingSlot: 2,
      }),
      target_child_profile_id: 'child-1',
    };

    assert.deepEqual(Object.keys(args).sort(), getRpcArgumentNames('update_world_entity_transform').sort());
    assert.equal('target_behavior_mode' in args, false);
    assert.equal('target_roaming_slot' in args, false);
  });

  it('keeps placement-only behavior and roaming args on place_world_entity', () => {
    const args = {
      ...toWorldPlacementRpcArgs({
        inventoryItemId: 'inventory-1',
        expectedRevision: 4,
        transform: { x: 1, y: 0, z: -1, rotationX: 0, rotationY: 1, rotationZ: 0, scale: 1.2 },
        behaviorMode: 'static' as const,
        roamingSlot: 2,
      }),
      target_child_profile_id: 'child-1',
    };

    assert.deepEqual(Object.keys(args).sort(), getRpcArgumentNames('place_world_entity').sort());
  });
});
