import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldBlockAppForDataLoad } from '../src/store';

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
});
