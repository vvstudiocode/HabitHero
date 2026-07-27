import assert from 'node:assert/strict';
import test from 'node:test';
import { createDataRepository } from '../src/lib/data-access';

test('child wishlist cancellation deletes only the selected wishlist item', async () => {
  const calls: unknown[][] = [];
  const client = {
    from: (table: string) => {
      assert.equal(table, 'wishlist_items');
      return {
        delete: () => ({ eq: (column: string, value: string) => { calls.push(['delete', column, value]); return Promise.resolve({ data: null, error: null }); } }),
      };
    },
    rpc: () => Promise.reject(new Error('rpc should not be called')),
    functions: { invoke: () => Promise.reject(new Error('functions should not be called')) },
  };
  const repository = createDataRepository(client as never);
  await repository.deleteWishlist('wishlist-1');
  assert.deepEqual(calls, [['delete', 'id', 'wishlist-1']]);
});
