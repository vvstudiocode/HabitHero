export const BUTTERFLY_PALETTE = Object.freeze([
  0xf7c95f,
  0x79c3e6,
  0xf28f76,
  0xb19ae8,
  0xfff1bd,
]);

export const BUTTERFLY_TREE_CLEARANCE = 0.55;
export const BUTTERFLY_FLIGHT_SPREAD = 0.6;
const BUTTERFLY_MAX_DRIFT_RADIUS = 0.32;

function createRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function requirePositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

export function getButterflyFlightBounds({
  treeFootprintRadius = 0,
  clearance = BUTTERFLY_TREE_CLEARANCE,
  spread = BUTTERFLY_FLIGHT_SPREAD,
  maxRadius = undefined,
} = {}) {
  requirePositiveNumber(treeFootprintRadius, 'treeFootprintRadius');
  requirePositiveNumber(clearance, 'clearance');
  requirePositiveNumber(spread, 'spread');

  const resolvedMaxRadius = maxRadius
    ?? treeFootprintRadius + clearance + BUTTERFLY_MAX_DRIFT_RADIUS + spread;
  requirePositiveNumber(resolvedMaxRadius, 'maxRadius');
  const minRadius = resolvedMaxRadius - spread;
  if (minRadius <= 0) throw new Error('maxRadius must be greater than spread');
  return { minRadius, maxRadius: resolvedMaxRadius };
}

export function createButterflyLayout({
  count = 4,
  center = { x: 0, z: -0.55 },
  radius = 1.6,
  minRadius = undefined,
  minHeight = 1.25,
  maxHeight = 2.55,
  seed = 20260811,
} = {}) {
  requirePositiveInteger(count, 'count');
  requirePositiveNumber(radius, 'radius');
  const innerRadius = minRadius ?? radius * 0.72;
  requirePositiveNumber(innerRadius, 'minRadius');
  if (innerRadius > radius) throw new Error('minRadius must be less than or equal to radius');
  requirePositiveNumber(minHeight, 'minHeight');
  requirePositiveNumber(maxHeight, 'maxHeight');
  if (maxHeight <= minHeight) throw new Error('maxHeight must be greater than minHeight');
  if (!Number.isFinite(center.x) || !Number.isFinite(center.z)) throw new Error('center must contain finite x and z values');

  const random = createRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    // Keep the same number of butterflies, but place them around a stable
    // outer ring so the camera does not make a random disk look front-heavy.
    const angle = Math.PI * 0.25 + (index / count) * Math.PI * 2;
    const distance = innerRadius + random() * (radius - innerRadius);
    return {
      x: center.x + Math.cos(angle) * distance,
      y: minHeight + random() * (maxHeight - minHeight),
      z: center.z + Math.sin(angle) * distance,
      color: BUTTERFLY_PALETTE[index % BUTTERFLY_PALETTE.length],
      phase: random() * Math.PI * 2,
      speed: 0.42 + random() * 0.22,
      orbitRadius: 0.12 + random() * 0.2,
      orientation: angle + Math.PI * 0.5,
      wingSpan: 0.82 + random() * 0.26,
      flapRate: 7 + random() * 3,
    };
  });
}

function toCssColor(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function createButterflyTexture(THREE, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Texture();

  context.clearRect(0, 0, 96, 96);
  context.translate(48, 48);
  const baseColor = toCssColor(color);

  const drawWing = (direction) => {
    context.save();
    context.scale(direction, 1);
    const wingGradient = context.createRadialGradient(8, -14, 2, 12, -8, 40);
    wingGradient.addColorStop(0, '#fff8dc');
    wingGradient.addColorStop(0.18, baseColor);
    wingGradient.addColorStop(1, `${baseColor}dd`);
    context.fillStyle = wingGradient;
    context.beginPath();
    context.moveTo(0, 1);
    context.bezierCurveTo(4, -23, 27, -37, 38, -18);
    context.bezierCurveTo(45, -5, 34, 16, 5, 18);
    context.bezierCurveTo(12, 9, 8, 4, 0, 1);
    context.closePath();
    context.fill();

    context.fillStyle = 'rgba(255, 255, 255, 0.46)';
    context.beginPath();
    context.arc(24, -17, 4.2, 0, Math.PI * 2);
    context.arc(31, -7, 2.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  drawWing(-1);
  drawWing(1);
  context.strokeStyle = 'rgba(70, 48, 45, 0.92)';
  context.lineWidth = 3.2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(0, -12);
  context.lineTo(0, 20);
  context.moveTo(-2, -10);
  context.quadraticCurveTo(-14, -26, -20, -20);
  context.moveTo(2, -10);
  context.quadraticCurveTo(14, -26, 20, -20);
  context.stroke();
  context.fillStyle = '#443337';
  context.beginPath();
  context.ellipse(0, 3, 4.2, 16, 0, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createButterflyField(THREE, options = {}) {
  const layout = createButterflyLayout(options);
  const group = new THREE.Group();
  group.name = 'big-tree-butterflies';
  const textures = new Map();
  const butterflies = layout.map((butterfly) => {
    const root = new THREE.Group();
    root.position.set(butterfly.x, butterfly.y, butterfly.z);
    root.rotation.y = butterfly.orientation;

    let texture = textures.get(butterfly.color);
    if (!texture) {
      texture = createButterflyTexture(THREE, butterfly.color);
      textures.set(butterfly.color, texture);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      alphaTest: 0.02,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }));
    sprite.name = 'butterfly-winged-sprite';
    sprite.scale.set(butterfly.wingSpan * 0.28, butterfly.wingSpan * 0.23, 1);
    root.add(sprite);
    group.add(root);
    return { root, sprite, butterfly };
  });

  function update(time) {
    butterflies.forEach(({ root, sprite, butterfly }) => {
      const flightTime = time * butterfly.speed + butterfly.phase;
      const horizontalDrift = Math.sin(flightTime * 1.17) * butterfly.orbitRadius;
      root.position.x = butterfly.x + horizontalDrift;
      root.position.y = butterfly.y + Math.sin(flightTime * 1.83) * 0.1;
      root.position.z = butterfly.z + Math.cos(flightTime * 0.93) * butterfly.orbitRadius * 0.72;
      root.rotation.y = butterfly.orientation + Math.sin(flightTime * 0.8) * 0.32;
      root.rotation.z = Math.sin(flightTime * 0.72) * 0.12;

      const wingOpen = 0.5 + Math.abs(Math.sin(flightTime * butterfly.flapRate)) * 0.5;
      sprite.scale.x = butterfly.wingSpan * (0.11 + wingOpen * 0.19);
      sprite.scale.y = butterfly.wingSpan * 0.23;
      sprite.material.rotation = Math.sin(flightTime * 0.7) * 0.08;
    });
  }

  return { count: layout.length, layout, group, update };
}
