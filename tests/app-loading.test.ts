import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldMarkInitialLoadDone } from '../src/lib/app-provider-lifecycle';
import { shouldBlockAppForDataLoad, shouldRefreshAppDataOnResume } from '../src/store';

const storeSource = readFileSync(new URL('../src/store.tsx', import.meta.url), 'utf8');

describe('app data loading gate', () => {
  it('keeps the app on the loading screen after login until family data is ready', () => {
    assert.equal(shouldBlockAppForDataLoad({
      sessionLoading: false,
      dataLoading: false,
      hasSession: true,
      dataReady: false,
    }), true);
  });

  it('does not block dashboard rendering after the family data is ready', () => {
    assert.equal(shouldBlockAppForDataLoad({
      sessionLoading: false,
      dataLoading: false,
      hasSession: true,
      dataReady: true,
    }), false);
  });

  it('does not block during background refresh when data is already ready', () => {
    // This is the key fix: realtime/reconnect refreshes should not
    // replace the dashboard with a loading screen.
    assert.equal(shouldBlockAppForDataLoad({
      sessionLoading: false,
      dataLoading: true,
      hasSession: true,
      dataReady: true,
    }), false);
  });

  it('blocks during first load when dataLoading and dataReady are both false', () => {
    assert.equal(shouldBlockAppForDataLoad({
      sessionLoading: false,
      dataLoading: true,
      hasSession: true,
      dataReady: false,
    }), true);
  });

  it('refreshes when a live app returns to the foreground with network access', () => {
    assert.equal(shouldRefreshAppDataOnResume({ visibilityState: 'visible', isOnline: true }), true);
  });

  it('does not refresh hidden or offline documents until the browser can sync', () => {
    assert.equal(shouldRefreshAppDataOnResume({ visibilityState: 'hidden', isOnline: true }), false);
    assert.equal(shouldRefreshAppDataOnResume({ visibilityState: 'visible', isOnline: false }), false);
  });

  it('keeps the first-load lifecycle pending while auth is still checking', () => {
    assert.equal(shouldMarkInitialLoadDone({
      initialLoadDone: false,
      sessionLoading: true,
      hasSession: false,
      dataReady: false,
      hasDataError: false,
    }), false);
  });

  it('marks first-load lifecycle done when auth settles without a session', () => {
    assert.equal(shouldMarkInitialLoadDone({
      initialLoadDone: false,
      sessionLoading: false,
      hasSession: false,
      dataReady: false,
      hasDataError: false,
    }), true);
  });

  it('marks first-load lifecycle done when session data settles by success or error', () => {
    assert.equal(shouldMarkInitialLoadDone({
      initialLoadDone: false,
      sessionLoading: false,
      hasSession: true,
      dataReady: true,
      hasDataError: false,
    }), true);
    assert.equal(shouldMarkInitialLoadDone({
      initialLoadDone: false,
      sessionLoading: false,
      hasSession: true,
      dataReady: false,
      hasDataError: true,
    }), true);
  });

  it('does not re-mark first-load lifecycle after it has already completed', () => {
    assert.equal(shouldMarkInitialLoadDone({
      initialLoadDone: true,
      sessionLoading: false,
      hasSession: true,
      dataReady: true,
      hasDataError: false,
    }), false);
  });

  it('keeps realtime recovery and foreground polling wired to the shared retry path', () => {
    assert.match(storeSource, /onReconnect:[\s\S]*?void retry\(\)/);
    assert.match(storeSource, /addEventListener\('focus'/);
    assert.match(storeSource, /addEventListener\('pageshow'/);
    assert.match(storeSource, /addEventListener\('visibilitychange'/);
    assert.match(storeSource, /setInterval\(/);
  });
});
