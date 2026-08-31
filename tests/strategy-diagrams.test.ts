import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const strategyRoot = path.join(root, 'docs', 'strategy');

function readStrategyFile(relativePath: string): string {
  const filePath = path.join(strategyRoot, relativePath);
  assert.equal(fs.existsSync(filePath), true, `Missing strategy file: ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('strategy workspace contains the three diagram formats', () => {
  const mindmap = readStrategyFile('01-product-mindmap.md');
  const architecture = readStrategyFile('02-product-architecture.md');
  const vip = readStrategyFile('03-vip-system.md');
  const roadmap = readStrategyFile('04-future-roadmap.md');

  assert.match(mindmap, /^# HabitHero/m);
  assert.match(mindmap, /^## 為什麼做/m);
  assert.match(architecture, /```mermaid\s+flowchart/m);
  assert.match(vip, /```mermaid\s+flowchart/m);
  assert.match(vip, /\| 功能 \|/m);
  assert.match(roadmap, /```mermaid\s+flowchart/m);
});

test('Excalidraw starter file is a valid open-format document', () => {
  const filePath = path.join(strategyRoot, 'drafts', 'habithero-brainstorm.excalidraw');
  assert.equal(fs.existsSync(filePath), true, 'Missing Excalidraw starter file');
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    type?: string;
    version?: number;
    elements?: unknown[];
  };

  assert.equal(document.type, 'excalidraw');
  assert.equal(document.version, 2);
  assert.ok(Array.isArray(document.elements));
  assert.ok(document.elements.length > 0);
});
