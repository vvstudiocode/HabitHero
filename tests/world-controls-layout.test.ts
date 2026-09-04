import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('landscape world controls place the action cluster to the right of chat', () => {
  const controls = read('../src/styles/world-controls.css');
  const overlays = read('../src/styles/overlays.css');

  assert.match(controls, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-joystick--fixed\s*\{[\s\S]*?left:\s*calc\(var\(--hh-character-content-left,\s*12px\) \+ \(var\(--hh-adventure-board-width\) \/ 2\)\);/);
  assert.match(controls, /\.hh-dashboard-screen--child\[data-landscape-cutout-side="left"\]\s+\.hh-world-joystick--fixed\s*\{[\s\S]*?left:\s*calc\(env\(safe-area-inset-left,\s*0px\) \+ var\(--hh-character-content-left,\s*12px\) \+ \(var\(--hh-adventure-board-width\) \/ 2\)\);/);
  assert.match(controls, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-action-control\s*\{[\s\S]*?left:\s*calc\(50% \+ var\(--hh-world-chat-landscape-half-width\) \+ var\(--hh-world-control-gap\)\);/);
  assert.match(controls, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-clean-mode-control\s*\{[\s\S]*?left:\s*calc\(50% \+ var\(--hh-world-chat-landscape-half-width\) \+ var\(--hh-world-control-gap\) \+ var\(--hh-world-control-size\) \+ var\(--hh-world-control-gap\)\);/);
  assert.match(overlays, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-social-dock-group\s*\{[\s\S]*?left:\s*calc\(50% \+ var\(--hh-world-chat-landscape-half-width\) \+ var\(--hh-world-control-size\) \* 2 \+ var\(--hh-world-control-gap\) \* 3\);/);
  assert.match(overlays, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-social-dock-group\s*\{[\s\S]*?flex-direction:\s*row-reverse/);
  assert.match(overlays, /@media \(max-width:\s*760px\)\s+and\s+\(orientation:\s*portrait\)[\s\S]*?\.hh-world-social-dock-group\s*\{[\s\S]*?right:\s*calc\(50% \+ var\(--hh-world-control-anchor-offset\)\);[\s\S]*?left:\s*auto;/);
  assert.match(overlays, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-chat-dock\s*\{[\s\S]*?width:\s*min\(var\(--hh-world-chat-landscape-width\),\s*calc\(100vw - var\(--hh-world-landscape-controls-reserved-width\)\)\);/);
  assert.match(overlays, /@media \(max-width:\s*760px\)\s+and\s+\(orientation:\s*portrait\)/);
  assert.match(controls, /\.hh-world-joystick--fixed\s*\{[\s\S]*?top:\s*calc\(100%\s*-\s*max\(18px,\s*calc\(env\(safe-area-inset-bottom/);
});
