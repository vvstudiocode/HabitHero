export type SafeAreaCutoutSide = 'left' | 'right' | 'none';

export interface SafeAreaInsets {
  left: number;
  right: number;
}

const MINIMUM_CUTOUT_SIDE_DIFFERENCE_PX = 24;

const normalizeInset = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function resolveSafeAreaCutoutSide(
  insets: SafeAreaInsets,
  minimumDifference = MINIMUM_CUTOUT_SIDE_DIFFERENCE_PX,
): SafeAreaCutoutSide {
  const left = normalizeInset(insets.left);
  const right = normalizeInset(insets.right);

  if (left - right >= minimumDifference) return 'left';
  if (right - left >= minimumDifference) return 'right';
  return 'none';
}

export function measureSafeAreaInsets(doc: Document): SafeAreaInsets {
  const probe = doc.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 0',
    'height: 0',
    'padding-left: env(safe-area-inset-left, 0px)',
    'padding-right: env(safe-area-inset-right, 0px)',
    'visibility: hidden',
    'pointer-events: none',
  ].join(';');

  (doc.body ?? doc.documentElement).appendChild(probe);
  const styles = doc.defaultView?.getComputedStyle(probe);
  const left = Number.parseFloat(styles?.paddingLeft ?? '0');
  const right = Number.parseFloat(styles?.paddingRight ?? '0');
  probe.remove();

  return { left, right };
}
