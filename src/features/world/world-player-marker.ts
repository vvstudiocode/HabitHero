import type { Object3D } from 'three';

type ThreeNamespace = typeof import('three');

export function createPlayerGroundShadowMaterial(THREE: ThreeNamespace) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec2 vShadowUv;
      void main() {
        vShadowUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vShadowUv;
      void main() {
        float distanceFromCenter = length(vShadowUv - vec2(0.5)) * 2.0;
        float alpha = smoothstep(1.0, 0.12, distanceFromCenter) * 0.28;
        gl_FragColor = vec4(0.02, 0.09, 0.06, alpha);
      }
    `,
  });
}

export function createPlayerGroundMarker(THREE: ThreeNamespace): Object3D {
  const marker = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), createPlayerGroundShadowMaterial(THREE));
  marker.name = 'player-ground-shadow';
  marker.rotation.x = -Math.PI / 2;
  marker.scale.set(1.2, 0.74, 1);
  marker.position.y = 0.006;
  return marker;
}
