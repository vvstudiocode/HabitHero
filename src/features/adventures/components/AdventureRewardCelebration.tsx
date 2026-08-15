import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ScrollText, Sparkles, Star } from 'lucide-react';
import type { AdventureRewardBundle } from '../adventure-reward-notice';

type AdventureRewardCelebrationMode = 'submitted' | 'approved';

interface AdventureRewardCelebrationProps {
  mode: AdventureRewardCelebrationMode;
  taskName?: string;
  pendingStars?: number;
  bundle?: AdventureRewardBundle;
  onDismiss: () => void;
}

interface CelebrationParticleLayout {
  x: number;
  y: number;
  delay: number;
  tone: 'gold' | 'pink' | 'mint' | 'blue';
}

const particleLayout: CelebrationParticleLayout[] = [
  { x: -142, y: -88, delay: 40, tone: 'gold' },
  { x: -104, y: -138, delay: 120, tone: 'mint' },
  { x: -42, y: -162, delay: 220, tone: 'pink' },
  { x: 36, y: -150, delay: 80, tone: 'blue' },
  { x: 104, y: -124, delay: 180, tone: 'gold' },
  { x: 146, y: -72, delay: 280, tone: 'mint' },
  { x: -156, y: 2, delay: 160, tone: 'pink' },
  { x: 158, y: 8, delay: 60, tone: 'blue' },
  { x: -116, y: 58, delay: 240, tone: 'gold' },
  { x: 118, y: 56, delay: 200, tone: 'mint' },
];

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', update);
    else mediaQuery.addListener(update);
    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') mediaQuery.removeEventListener('change', update);
      else mediaQuery.removeListener(update);
    };
  }, []);

  return reducedMotion;
}

function createStarTexture(THREE: typeof import('three')) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 64;
  textureCanvas.height = 64;
  const context = textureCanvas.getContext('2d');
  if (!context) return null;

  const center = 32;
  const glow = context.createRadialGradient(center, center, 2, center, center, 30);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.35, 'rgba(255, 235, 155, .95)');
  glow.addColorStop(1, 'rgba(255, 235, 155, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);

  context.save();
  context.translate(center, center);
  context.rotate(Math.PI / 4);
  context.beginPath();
  context.moveTo(0, -23);
  context.lineTo(6, -6);
  context.lineTo(23, 0);
  context.lineTo(6, 6);
  context.lineTo(0, 23);
  context.lineTo(-6, 6);
  context.lineTo(-23, 0);
  context.lineTo(-6, -6);
  context.closePath();
  context.fillStyle = 'rgba(255, 249, 210, .96)';
  context.shadowColor = 'rgba(255, 206, 93, .85)';
  context.shadowBlur = 9;
  context.fill();
  context.restore();

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function CelebrationCanvas({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) return undefined;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const THREE = await import('three');
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
        camera.position.z = 10;

        const texture = createStarTexture(THREE);
        if (!texture) {
          renderer.dispose();
          return;
        }

        const particleCount = 30;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const velocities = Array.from({ length: particleCount }, () => ({
          x: (Math.random() - 0.5) * 120,
          y: 55 + Math.random() * 125,
          z: 0,
        }));
        const palette = [
          new THREE.Color('#f7c957'),
          new THREE.Color('#f1a7bd'),
          new THREE.Color('#9bd5bd'),
          new THREE.Color('#a7c8ef'),
        ];

        for (let index = 0; index < particleCount; index += 1) {
          const offset = index * 3;
          positions[offset] = (Math.random() - 0.5) * 300;
          positions[offset + 1] = -20 + Math.random() * 170;
          positions[offset + 2] = 0;
          const color = palette[index % palette.length];
          colors[offset] = color.r;
          colors[offset + 1] = color.g;
          colors[offset + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
          size: 18,
          sizeAttenuation: false,
          map: texture,
          transparent: true,
          depthWrite: false,
          vertexColors: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        });
        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        const resize = () => {
          const width = Math.max(1, window.innerWidth);
          const height = Math.max(1, window.innerHeight);
          renderer.setSize(width, height, false);
          camera.left = -width / 2;
          camera.right = width / 2;
          camera.top = height / 2;
          camera.bottom = -height / 2;
          camera.updateProjectionMatrix();
        };
        resize();
        window.addEventListener('resize', resize);

        const startedAt = performance.now();
        let lastFrame = startedAt;
        let frame = 0;
        const animate = (now: number) => {
          const elapsed = now - startedAt;
          const progress = elapsed / 1250;
          if (progress >= 1 || disposed) return;
          const delta = Math.min(32, Math.max(0, now - lastFrame)) / 1000;
          lastFrame = now;
          const positionsAttribute = geometry.getAttribute('position');
          for (let index = 0; index < particleCount; index += 1) {
            const offset = index * 3;
            const velocity = velocities[index];
            positionsAttribute.array[offset] = Number(positionsAttribute.array[offset]) + velocity.x * delta;
            positionsAttribute.array[offset + 1] = Number(positionsAttribute.array[offset + 1]) + velocity.y * delta;
            velocity.y -= 165 * delta;
          }
          positionsAttribute.needsUpdate = true;
          particles.rotation.z = Math.sin(progress * Math.PI) * 0.08;
          material.opacity = 0.92 * (progress < 0.58 ? 1 : 1 - ((progress - 0.58) / 0.42));
          renderer.render(scene, camera);
          frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);

        cleanup = () => {
          cancelAnimationFrame(frame);
          window.removeEventListener('resize', resize);
          geometry.dispose();
          material.dispose();
          texture.dispose();
          renderer.dispose();
        };
      } catch {
        // The CSS sparkles remain as a graceful fallback if WebGL is unavailable.
      }
    };

    void setup();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="hh-adventure-reward-canvas" aria-hidden="true" />;
}

export function AdventureRewardCelebration({
  mode,
  taskName,
  pendingStars = 0,
  bundle,
  onDismiss,
}: AdventureRewardCelebrationProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const isApproved = mode === 'approved' && Boolean(bundle);
  const rewardStars = isApproved ? bundle!.totalStars : Math.max(0, pendingStars);
  const rewardScrolls = isApproved ? bundle!.totalScrolls : 0;
  const events = isApproved ? bundle!.events : [];

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buttonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onDismiss]);

  const title = isApproved ? '獎勵到手啦！' : '冒險完成！';
  const eyebrow = isApproved ? '小夥伴帶來好消息' : '小夥伴幫你記好了';
  const description = isApproved
    ? events.length === 1
      ? `爸媽幫你確認了「${events[0].taskName}」`
      : `爸媽幫你確認了 ${events.length} 個冒險`
    : taskName
      ? `你做得很棒，「${taskName}」的完成紀錄已經送給爸媽確認囉。`
      : '你做得很棒，完成紀錄已經送給爸媽確認囉。';

  return (
    <div className="hh-adventure-reward-overlay" role="dialog" aria-modal="true" aria-labelledby="hh-adventure-reward-title">
      <div className="hh-adventure-reward-backdrop" aria-hidden="true" />
      <div className="hh-adventure-reward-particle-layer" aria-hidden="true">
        {!reducedMotion && <CelebrationCanvas reducedMotion={reducedMotion} />}
        {particleLayout.map((particle, index) => (
          <span
            key={`${particle.tone}-${index}`}
            className={`hh-adventure-reward-sparkle is-${particle.tone}`}
            style={{
              '--hh-reward-sparkle-x': `${particle.x}px`,
              '--hh-reward-sparkle-y': `${particle.y}px`,
              '--hh-reward-sparkle-delay': `${particle.delay}ms`,
            } as CSSProperties}
          />
        ))}
      </div>

      <section className={`hh-adventure-reward-card${isApproved ? ' is-approved' : ' is-submitted'}`}>
        <div className="hh-adventure-reward-badge" aria-hidden="true">
          <Sparkles size={22} strokeWidth={2.5} />
          <Star className="hh-adventure-reward-badge-star" size={42} strokeWidth={1.8} />
        </div>
        <p className="hh-adventure-reward-eyebrow">{eyebrow}</p>
        <h2 id="hh-adventure-reward-title">{title}</h2>
        <p className="hh-adventure-reward-description">{description}</p>

        {isApproved && events.length > 1 && (
          <ul className="hh-adventure-reward-event-list" aria-label="已核准的冒險">
            {events.slice(0, 3).map((event) => <li key={event.taskId}>{event.taskName}</li>)}
            {events.length > 3 && <li>還有 {events.length - 3} 個冒險</li>}
          </ul>
        )}

        <div className="hh-adventure-reward-totals" aria-label="本次獲得的獎勵">
          {rewardStars > 0 && (
            <div className="hh-adventure-reward-total is-star">
              <Star size={24} fill="currentColor" aria-hidden="true" />
              <strong>+{rewardStars}</strong>
              <span>{isApproved ? '星星' : '星星待確認'}</span>
            </div>
          )}
          {rewardScrolls > 0 && (
            <div className="hh-adventure-reward-total is-scroll">
              <ScrollText size={24} aria-hidden="true" />
              <strong>+{rewardScrolls}</strong>
              <span>任務捲</span>
            </div>
          )}
        </div>

        <button ref={buttonRef} type="button" className="hh-adventure-reward-action" onClick={onDismiss}>
          {isApproved ? '繼續冒險' : '回到世界'}
        </button>
      </section>
    </div>
  );
}
