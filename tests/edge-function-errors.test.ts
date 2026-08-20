import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDataRepository } from '../src/lib/data-access';

describe('edge function error messages', () => {
  it('prefers a JSON error field from the Edge Function response context', async () => {
    const repository = createDataRepository(createChildAccountClient({
      context: new Response(JSON.stringify({ error: 'child account already exists', message: 'ignored message' }), {
        headers: { 'content-type': 'application/json' },
      }),
    }) as never);

    await assert.rejects(
      () => repository.insertChild('family-1', 'Mina', 'mina', 'secret123'),
      /child account already exists/,
    );
  });

  it('uses a JSON message field when the Edge Function response has no error field', async () => {
    const repository = createDataRepository(createChildAccountClient({
      context: new Response(JSON.stringify({ message: 'password is too weak' }), {
        headers: { 'content-type': 'application/json' },
      }),
    }) as never);

    await assert.rejects(
      () => repository.updateChildPassword('family-1', 'child-1', '123'),
      /password is too weak/,
    );
  });

  it('falls back to the SDK Error message when the response context is not valid JSON', async () => {
    const repository = createDataRepository(createChildAccountClient(Object.assign(
      new Error('FunctionsHttpError: invalid json response'),
      { context: new Response('not-json') },
    )) as never);

    await assert.rejects(
      () => repository.deleteChild('family-1', 'child-1'),
      /FunctionsHttpError: invalid json response/,
    );
  });

  it('uses the generic Edge Function fallback for unknown thrown values', async () => {
    const repository = createDataRepository(createChildAccountClient({ context: 'missing response' }) as never);

    await assert.rejects(
      () => repository.insertChild('family-1', 'Mina', 'mina', 'secret123'),
      /Edge Function 執行失敗，請重試。/,
    );
  });
});

function createChildAccountClient(error: unknown) {
  return {
    functions: {
      invoke: async () => ({ data: null, error }),
    },
    from: () => {
      throw new Error('from() should not be called');
    },
    rpc: () => Promise.reject(new Error('rpc() should not be called')),
  };
}
