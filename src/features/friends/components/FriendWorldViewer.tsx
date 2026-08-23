import type { FriendWorldSnapshot } from '../friend-world-snapshot';

interface FriendWorldViewerProps {
  snapshot: FriendWorldSnapshot;
  onReturn: () => void;
}

export function FriendWorldViewer({ snapshot, onReturn }: FriendWorldViewerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-4" aria-label={`參觀${snapshot.displayName}的世界`}>
      <div className="pointer-events-auto rounded-2xl bg-white/95 px-4 py-3 shadow-lg"><strong className="block text-indigo-950">{snapshot.displayName} 的世界</strong><span className="text-xs font-bold text-slate-500">離線也能參觀 · 世界版本 {snapshot.revision}</span></div>
      <button type="button" className="pointer-events-auto min-h-12 rounded-2xl bg-white px-4 font-black text-indigo-700 shadow-lg" aria-label="回到我的世界" onClick={onReturn}>回到我的世界</button>
    </div>
  );
}
