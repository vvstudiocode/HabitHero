import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const characterStyles = read('../src/styles/character.css');

const PORTRAIT_VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 375, height: 709 },
] as const;

function extractBlockAt(source: string, openingBraceIndex: number) {
  let depth = 0;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] !== '}') continue;

    depth -= 1;
    if (depth === 0) {
      return {
        body: source.slice(openingBraceIndex + 1, index),
        end: index,
      };
    }
  }

  throw new Error(`Unclosed CSS block at index ${openingBraceIndex}`);
}

function extractBlocks(source: string, marker: string) {
  const blocks: string[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const markerStart = source.indexOf(marker, cursor);
    if (markerStart === -1) break;

    const openingBraceIndex = markerStart + marker.length - 1;
    const block = extractBlockAt(source, openingBraceIndex);
    blocks.push(block.body);
    cursor = block.end + 1;
  }

  return blocks;
}

function extractRule(source: string, selector: string) {
  const marker = `${selector} {`;
  const selectorStart = source.indexOf(marker);
  if (selectorStart === -1) throw new Error(`Missing CSS rule: ${selector}`);

  return extractBlockAt(source, selectorStart + marker.length - 1).body;
}

function declaration(rule: string, property: string) {
  const propertyPattern = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)\\s*${propertyPattern}\\s*:\\s*([^;]+);`).exec(rule);
  if (!match) throw new Error(`Missing ${property} declaration`);

  return match[1].trim();
}

function px(value: string, label: string) {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  if (!match) throw new Error(`Expected ${label} to be a px value, got: ${value}`);

  return Number(match[1]);
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function readPortraitLayoutContract() {
  const statsSelector = '.hh-character-stats[data-stat-count="3"]';
  const mobileStatsMedia = extractBlocks(characterStyles, '@media (max-width: 760px) {')
    .find((block) => block.includes(`${statsSelector} {`));
  if (!mobileStatsMedia) throw new Error(`Missing mobile CSS block for ${statsSelector}`);

  const statsRule = extractRule(mobileStatsMedia, statsSelector);
  const statsCardRule = extractRule(mobileStatsMedia, `${statsSelector}>div`);
  const dashboardDefaultsRule = extractRule(characterStyles, '.hh-dashboard-screen');
  const statsWidth = normalize(declaration(statsRule, 'width'));
  const widthContract = /^calc\(100vw - var\(--hh-character-content-left\) - (\d+)px\)$/.exec(statsWidth);
  if (!widthContract) throw new Error(`Unexpected mobile stats width contract: ${statsWidth}`);

  const reservedWidth = Number(widthContract[1]);
  const maxWidth = normalize(declaration(statsRule, 'max-width'));
  assert.equal(
    maxWidth,
    `calc(100vw - var(--hh-character-content-left) - ${reservedWidth}px)`,
    'the max-width must preserve the same right-side reservation as width',
  );

  const dashboardRule = extractRule(mobileStatsMedia, '.hh-dashboard-screen');
  const actionRule = extractRule(characterStyles, '.hh-character-hero-panel>.hh-character-dashboard-actions');
  const iconButtonRule = extractRule(characterStyles, '.hh-character-icon-button');

  return {
    contentLeft: px(declaration(dashboardRule, '--hh-character-content-left'), 'mobile content left'),
    topOffset: px(declaration(dashboardDefaultsRule, '--hh-character-top-offset'), 'dashboard top offset'),
    reservedRightSpace: reservedWidth,
    actionRightInset: px(declaration(actionRule, 'right'), 'dashboard action right inset'),
    actionButtonSize: px(declaration(iconButtonRule, 'min-width'), 'icon button width'),
    actionButtonMinHeight: px(declaration(iconButtonRule, 'min-height'), 'icon button height'),
    statsCardHeight: px(declaration(statsCardRule, 'height'), 'stats card height'),
  };
}

test('portrait three-stat layout stays clear of the dashboard action at both supported viewports', async (t) => {
  const contract = readPortraitLayoutContract();

  assert.equal(contract.contentLeft, 12);
  assert.equal(contract.topOffset, 44);
  assert.equal(contract.reservedRightSpace, 64);
  assert.equal(contract.actionRightInset, 16);
  assert.equal(contract.actionButtonSize, 44);
  assert.equal(contract.actionButtonMinHeight, 44);
  assert.equal(contract.statsCardHeight, 40);

  const minimumGap = contract.reservedRightSpace - contract.actionRightInset - contract.actionButtonSize;
  assert.equal(minimumGap, 4);

  for (const viewport of PORTRAIT_VIEWPORTS) {
    await t.test(`${viewport.width}x${viewport.height}`, () => {
      assert.ok(viewport.height > viewport.width, 'the regression cases must remain portrait viewports');

    const availableStatsWidth = viewport.width - contract.contentLeft - contract.reservedRightSpace;
    const effectiveStatsWidth = availableStatsWidth;
    const statsRight = contract.contentLeft + effectiveStatsWidth;
    const actionLeft = viewport.width - contract.actionRightInset - contract.actionButtonSize;

      assert.equal(availableStatsWidth, 299);
      assert.equal(effectiveStatsWidth, 299);
      assert.ok(
        statsRight + minimumGap <= actionLeft,
        `stats right edge ${statsRight}px must leave at least ${minimumGap}px before the action at ${actionLeft}px`,
      );
    });
  }
});
