export function WorldPreparingScreen({ detail = '讀取草地與大樹模型…' }: { detail?: string }) {
  return (
    <main className="hh-world-preparing-screen" role="status" aria-live="polite">
      <div className="hh-world-preparing-card">
        <span className="hh-world-preparing-mark" aria-hidden="true" />
        <strong>正在準備冒險地圖</strong>
        <p>{detail}</p>
        <div className="hh-world-preparing-progress" aria-hidden="true"><span /></div>
      </div>
    </main>
  );
}
