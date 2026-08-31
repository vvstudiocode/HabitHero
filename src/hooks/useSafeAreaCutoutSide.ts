import { useEffect, useState } from 'react';
import {
  measureSafeAreaInsets,
  resolveSafeAreaCutoutSide,
  type SafeAreaCutoutSide,
} from '../lib/safe-area-cutout';

function readCutoutSide(): SafeAreaCutoutSide {
  if (typeof document === 'undefined' || !document.body) return 'none';
  return resolveSafeAreaCutoutSide(measureSafeAreaInsets(document));
}

export function useSafeAreaCutoutSide(): SafeAreaCutoutSide {
  const [cutoutSide, setCutoutSide] = useState<SafeAreaCutoutSide>(readCutoutSide);

  useEffect(() => {
    let frame = 0;
    const update = () => setCutoutSide(readCutoutSide());
    const handleViewportChange = () => {
      update();
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    const orientationQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: landscape)')
      : null;
    orientationQuery?.addEventListener?.('change', handleViewportChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      orientationQuery?.removeEventListener?.('change', handleViewportChange);
    };
  }, []);

  return cutoutSide;
}
