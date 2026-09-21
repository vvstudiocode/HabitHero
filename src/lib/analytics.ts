import { createAnalyticsTracker } from './analytics-tracker';
import { getAnalyticsBrowserStorage } from './analytics-contract';
import type {
  AnalyticsContext,
  AnalyticsEventName,
  AnalyticsWorldView,
} from './analytics-contract';

export * from './analytics-contract';
export { createAnalyticsTracker } from './analytics-tracker';

const analyticsTracker = createAnalyticsTracker({
  storage: getAnalyticsBrowserStorage('localStorage'),
  sessionStorage: getAnalyticsBrowserStorage('sessionStorage'),
});

export function configureAnalytics(context: AnalyticsContext | null) {
  analyticsTracker.configure(context);
}

export function trackAnalyticsEvent(eventName: AnalyticsEventName, properties?: Record<string, unknown>) {
  analyticsTracker.track(eventName, properties);
}

export function trackAnalyticsScreen(screenName: string) {
  analyticsTracker.screen(screenName);
}

export function checkpointAnalyticsSession() {
  analyticsTracker.checkpoint();
}

export function setAnalyticsWorldView(view: AnalyticsWorldView | null) {
  analyticsTracker.setWorldView(view);
}

export function setAnalyticsWorldViewVisible(visible: boolean) {
  analyticsTracker.setWorldViewVisible(visible);
}

export function flushAnalyticsEvents() {
  return analyticsTracker.flush();
}
