import { Home } from 'lucide-react';
import type { WorldLocation } from '../../world/world-location';

interface MyWorldDockProps {
  worldLocation: WorldLocation;
  returnLocation?: Exclude<WorldLocation, 'my-world'>;
  onEnterMyWorld: (location: WorldLocation) => void;
  transitioning?: boolean;
}

export function MyWorldDock({ worldLocation, returnLocation = 'sunrise-village', onEnterMyWorld, transitioning = false }: MyWorldDockProps) {
  const isInMyWorld = worldLocation === 'my-world';
  const returnLabel = returnLocation === 'forest-valley'
    ? '返回森語谷'
    : returnLocation === 'cloud-workshop'
      ? '返回雲工房'
      : returnLocation === 'tideglow-archipelago'
        ? '返回潮光群島'
        : returnLocation === 'star-sand-wasteland'
          ? '返回星砂荒原'
          : '返回晨光村';
  const label = isInMyWorld ? returnLabel : '進入我的世界';
  const nextLocation = isInMyWorld ? returnLocation : 'my-world';

  return (
    <button
      type="button"
      className="hh-my-world-dock z-30 inline-flex h-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-emerald-200 px-0 font-black text-emerald-800 shadow-lg backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      aria-label={label}
      title={label}
      aria-busy={transitioning}
      disabled={transitioning}
      onClick={() => onEnterMyWorld(nextLocation)}
    >
      <Home size={20} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
