import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_PAGE_SIZE,
  MAX_MESSAGE_CHARS,
  MIN_MESSAGE_CHARS,
  validateChatMessageText,
} from '../src/features/world-chat/limits';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

async function readChatMigration() {
  const names = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
    .filter((name) => name.endsWith('_friend_world_chat.sql'))
    .sort();
  assert.equal(names.length, 1, 'world chat must have exactly one dedicated migration');
  return read(`supabase/migrations/${names[0]}`);
}

describe('world chat contracts', () => {
  it('keeps the product limits explicit and validates plain unicode text', () => {
    assert.equal(MIN_MESSAGE_CHARS, 1);
    assert.equal(MAX_MESSAGE_CHARS, 120);
    assert.equal(MAX_CHAT_PAGE_SIZE, 50);
    assert.equal(MAX_CHAT_HISTORY, 200);
    assert.equal(validateChatMessageText('  你好 🌟  ').ok, true);
    assert.equal(validateChatMessageText('   ').ok, false);
    assert.equal(validateChatMessageText('a\nmessage').ok, false);
    assert.equal(validateChatMessageText('visit https://example.com').ok, false);
    assert.equal(validateChatMessageText('child@example.com').ok, false);
    assert.equal(validateChatMessageText('請打 0912-345-678').ok, false);
    assert.equal(validateChatMessageText('a'.repeat(121)).ok, false);
  });

  it('creates RLS-protected chat tables and server-authoritative RPCs', async () => {
    const schema = await readChatMigration();
    for (const table of [
      'friend_world_messages',
      'friend_world_message_reads',
      'friend_world_message_reports',
    ]) {
      assert.match(schema, new RegExp(`create table public\\.${table}`));
      assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(schema, new RegExp(`revoke all on table public\\.${table}`));
    }
    assert.match(schema, /create or replace function public\.send_friend_world_message\(/);
    assert.match(schema, /auth\.uid\(\)/);
    assert.match(schema, /security definer/);
    assert.match(schema, /set search_path = pg_catalog, public/);
    assert.match(schema, /created_at timestamptz not null default/);
    assert.match(schema, /sender_child_profile_id/);
    assert.doesNotMatch(schema, /target_sender_child_profile_id/);
    assert.match(schema, /child_friendships/);
    assert.match(schema, /child_friend_blocks/);
    assert.match(schema, /10 seconds|10s|interval '10 seconds'/i);
    assert.match(schema, /30|one minute|1 minute|interval '1 minute'/i);
    assert.match(schema, /grant execute on function public\.send_friend_world_message/);
    assert.match(schema, /revoke all on function public\.send_friend_world_message/);
  });

  it('keeps repository and UI within the world-chat boundary', async () => {
    const repository = await read('src/lib/social-data/world-chat-repository.ts');
    const service = await read('src/features/world-chat/chat-service.ts');
    const hook = await read('src/features/world-chat/hooks/use-world-chat.ts');
    const sheet = await read('src/features/world-chat/components/WorldChatSheet.tsx');
    const bubble = await read('src/features/world-chat/components/AvatarChatBubble.tsx');

    assert.match(repository, /friend_world_messages/);
    assert.match(repository, /friend_world_message_reads/);
    assert.match(repository, /friend_world_message_reports/);
    assert.match(service, /send_friend_world_message/);
    assert.match(service, /validateChatMessageText/);
    assert.match(hook, /MAX_CHAT_HISTORY|MAX_CHAT_PAGE_SIZE/);
    assert.match(hook, /postgres_changes|chat_created_v1/);
    for (const source of [sheet, bubble]) {
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
    }
    assert.match(sheet, /aria-label/);
    assert.match(sheet, /檢舉/);
    assert.match(sheet, /返回/);
    assert.match(sheet, /關閉/);
    assert.match(bubble, /4000|BUBBLE_DURATION_MS/);
    assert.match(bubble, /line-clamp-2/);
  });
});
