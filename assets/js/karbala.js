// The Journey to Karbala: a narrated 3D story (three.js). Models and map data come from karbala-assets.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ─────────── helpers ───────────
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches;
function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();

// simplex noise
function makeNoise(seed) {
  const r = rng(seed), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function n2(x, y) {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, t0 = .5 - x0 * x0 - y0 * y0, t1 = .5 - x1 * x1 - y1 * y1, t2 = .5 - x2 * x2 - y2 * y2;
    if (t0 > 0) { const g = G[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    if (t1 > 0) { const g = G[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    if (t2 > 0) { const g = G[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
  function fbm(x, y, o = 4) { let a = 0, f = 1, amp = 1, s = 0; for (let i = 0; i < o; i++) { a += amp * n2(x * f, y * f); s += amp; f *= 2.03; amp *= .5; } return a / s; }
  return { n2, fbm };
}
const N = makeNoise(7);
function dunes(x, z, amp, sc) {
  const wx = x + 70 * N.fbm(x * .003, z * .003, 2), wz = z + 70 * N.fbm(z * .003 + 5.2, x * .003 - 1.3, 2);
  const r = 1 - Math.abs(N.n2(wx * sc, wz * sc * .55));
  const base = N.fbm(x * sc * .45, z * sc * .45, 3) * .5 + .5;
  return amp * (.6 * r * r * r + .4 * base);
}

// ─────────── renderer ───────────
const canvas = $('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  $('loadMsg').textContent = 'This prototype needs WebGL, which is turned off in this browser.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, .003);
const camera = new THREE.PerspectiveCamera(40, 1, .3, 6000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .75, .5, .86);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const PSCALE = { value: 500 };

let viewShift = 0;
function applyViewOffset() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (viewShift && w > 760) camera.setViewOffset(w, h, -w * .13 * viewShift, 0, w, h);
  else if (viewShift) camera.setViewOffset(w, h, 0, h * .2 * viewShift, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 58 : 40;
  applyViewOffset();
  PSCALE.value = h * renderer.getPixelRatio() * .5 / Math.tan(camera.fov * Math.PI / 360);
}
window.addEventListener('resize', resize);
resize();

// ─────────── procedural textures ───────────
function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
function normalTex(S, hf, k) {
  return canvasTex(S, S, g => {
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = hf((x + 1) % S, y) - hf((x - 1 + S) % S, y), dy = hf(x, (y + 1) % S) - hf(x, (y - 1 + S) % S);
      const nx = -dx * k, ny = -dy * k, l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
      img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false, repeat: [1, 1] });
}
const RIPPLE = normalTex(256, (x, y) => Math.sin((x + 7 * Math.sin(y / 256 * TAU * 2) + 3 * Math.sin(y / 256 * TAU * 5 + 1)) / 256 * TAU * 10), 1.3);
RIPPLE.repeat.set(170, 170);
const WATERN = normalTex(256, (x, y) => Math.sin(x / 256 * TAU * 6 + Math.sin(y / 256 * TAU * 3) * 2) * .5 + Math.sin(y / 256 * TAU * 9 + Math.sin(x / 256 * TAU * 4) * 1.5) * .5, 2.4);
WATERN.repeat.set(40, 5);

const TENT_TEX = canvasTex(256, 256, (g, w, h) => {
  const r = rng(3);
  g.fillStyle = '#211a15'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${70 + r() * 30},${52 + r() * 20},${40 + r() * 16},${.25 + r() * .3})`; g.fillRect(0, y, w, 1); }
  [[38, 7], [48, 2], [150, 9], [163, 2], [214, 3]].forEach(([y, hh]) => { g.fillStyle = 'rgba(214,196,164,.6)'; g.fillRect(0, y, w, hh); });
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${r() * .25})`; g.fillRect(r() * w, r() * h, 2, 1); }
}, { repeat: [2, 1] });
function rugTex(base, band, motif, seed) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = band; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    for (let y = 22; y < h - 18; y += 18) for (let x = 22; x < w - 18; x += 18) {
      g.fillStyle = (x + y) % 36 ? motif : band;
      g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.closePath(); g.fill();
    }
  });
}
const RUG_A = rugTex('#8e2a22', '#1f2a55', '#e3cf9c', 1), RUG_B = rugTex('#23305e', '#9b3024', '#e0c48a', 2), RUG_C = rugTex('#6b4a22', '#e0c48a', '#3a2412', 3);
function clothTex(base, gold) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = gold;
    for (const y of [10, 110]) g.fillRect(0, y, w, 8);
    for (let x = 8; x < w; x += 24) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 8, 52); g.lineTo(x, 64); g.lineTo(x - 8, 52); g.closePath(); g.fill(); }
    g.fillRect(0, 76, w, 3);
    for (let x = 20; x < w; x += 24) { g.beginPath(); g.arc(x, 92, 4, 0, TAU); g.fill(); }
  });
}
const CLOTH_GREEN = clothTex('#1f4d3a', '#d8b24c'), CLOTH_RED = clothTex('#6e1f24', '#d8b24c'), CLOTH_BLUE = clothTex('#1f2b55', '#d8b24c');
const BANNER_TEX = canvasTex(256, 170, (g, w, h) => {
  g.fillStyle = '#1d6a47'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e0bc55'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
  g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = 'rgba(224,188,85,.9)';
  for (let x = 30; x < w - 20; x += 22) { g.beginPath(); g.moveTo(x, h - 5); g.lineTo(x + 6, h + 8); g.lineTo(x - 6, h + 8); g.fill(); }
});
function moonTex(age) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = 96, ph = age / 29.53, k = Math.cos(ph * TAU);
    g.translate(128, 128); g.rotate(-.5); if (ph > .5) g.scale(-1, 1);
    const halo = g.createRadialGradient(0, 0, r * .8, 0, 0, r * 1.3);
    halo.addColorStop(0, 'rgba(200,210,255,.12)'); halo.addColorStop(1, 'rgba(200,210,255,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 1.3, 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,130,165,.14)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    const grd = g.createRadialGradient(-25, -25, 10, 0, 0, r);
    grd.addColorStop(0, '#fffbef'); grd.addColorStop(1, '#e6dcc4');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(0, 0, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0); g.fill();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(150,145,130,.32)';
    [[34, -22, 24], [-8, 32, 17], [48, 36, 12], [10, -48, 10]].forEach(([x, y, s]) => { g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); });
  });
}

// ─────────── sky, stars, moon, light ───────────
const skyU = {
  top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, glow: { value: 1 }, disk: { value: 1 },
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, horizon, bottom, sunColor, sunDir; uniform float glow, disk; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(horizon, bottom, clamp(-h * 6.0, 0.0, 1.0));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      col += sunColor * (pow(s, 5.0) * 0.3 + pow(s, 48.0) * 0.4) * glow;
      col += sunColor * smoothstep(0.99935, 0.9997, s) * 8.0 * disk;
      gl_FragColor = vec4(col, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), skyMat);
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

const starGeo = new THREE.BufferGeometry();
{
  const r = rng(11), a = [], sz = [];
  for (let i = 0; i < 3200; i++) { const th = r() * TAU, y = .02 + Math.pow(r(), .8) * .98, rr = Math.sqrt(1 - y * y); a.push(Math.cos(th) * rr * 2800, y * 2800, Math.sin(th) * rr * 2800); sz.push(Math.pow(r(), 3)); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  starGeo.setAttribute('aS', new THREE.Float32BufferAttribute(sz, 1));
}
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, uniforms: { uOpacity: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
  vertexShader: 'attribute float aS; varying float vS; uniform float uPR; void main(){ vS = aS; gl_PointSize = (1.2 + aS * 2.4) * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uOpacity; varying float vS; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(clamp(1.0 - d, 0.0, 1.0), 1.6); gl_FragColor = vec4(vec3(0.75 + 0.35 * vS), a * uOpacity * (0.45 + 0.55 * vS)); }',
});
const stars = new THREE.Points(starGeo, starMat);
stars.renderOrder = -9; stars.frustumCulled = false; scene.add(stars);

const moonMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.7, 1.7, 1.6) });
const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat);
moon.renderOrder = -8; moon.frustumCulled = false; scene.add(moon);
const moonTexCache = {};
let moonAlpha = 0;
function setMoon(age) { if (!moonTexCache[age]) moonTexCache[age] = moonTex(age); moonMat.map = moonTexCache[age]; moonMat.needsUpdate = true; }

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, .5);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2);
key.castShadow = true;
key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 600 });
key.shadow.bias = -.0004; key.shadow.normalBias = .05;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xffffff, 0);
scene.add(fill, fill.target);
const lightDir = new THREE.Vector3(0, 1, 0);

const ENV_DEF = {
  night: { top: '#070c20', horizon: '#26375f', bottom: '#0e121c', sun: '#aabdff', key: '#b3c4ff', keyI: 1.7, dir: [-.58, .24, -.66], hemiS: '#5068a8', hemiG: '#3a2c20', hemiI: 1.8, fillI: .7, fog: '#1b2644', fogD: .0032, stars: 1, moon: 27.6, exposure: 1.35, glow: .5, disk: 0, envI: .5, bloomT: .86, bloomS: .55 },
  golden: { top: '#4b80c4', horizon: '#f4d6aa', bottom: '#d9a76c', sun: '#ffdcae', key: '#ffdcb2', keyI: 3.1, dir: [.72, .42, .55], hemiS: '#bdd4ee', hemiG: '#d49d60', hemiI: .8, fillI: .35, fog: '#eed8b4', fogD: .0018, stars: 0, moon: 0, exposure: .9, glow: 1, disk: 1, envI: .7, bloomT: 2.2, bloomS: .22 },
  dusk: { top: '#1f2b5a', horizon: '#f69b66', bottom: '#6d4234', sun: '#ffa464', key: '#ffab6c', keyI: 2.3, dir: [-.72, .13, -.68], hemiS: '#6774ac', hemiG: '#80503a', hemiI: .9, fillI: .55, fog: '#b6806a', fogD: .0025, stars: .12, moon: 0, exposure: 1, glow: 1.3, disk: 1, envI: .6, bloomT: 1.15, bloomS: .5 },
  lastnight: { top: '#05070f', horizon: '#1b2546', bottom: '#0b0c13', sun: '#a3b5ff', key: '#aebfff', keyI: 1.4, dir: [.26, .2, -.94], hemiS: '#44578f', hemiG: '#2e2217', hemiI: 1.9, fillI: 1, fog: '#141c36', fogD: .0028, stars: 1, moon: 9.3, exposure: 1.3, glow: .45, disk: 0, envI: .45, bloomT: .86, bloomS: .6 },
};
const COLOR_KEYS = ['top', 'horizon', 'bottom', 'sun', 'key', 'hemiS', 'hemiG', 'fog'];
const ENV = {};
for (const [k, v] of Object.entries(ENV_DEF)) {
  const e = { ...v };
  COLOR_KEYS.forEach(c => { e[c] = new THREE.Color(v[c]); });
  e.dir = new THREE.Vector3(...v.dir).normalize();
  ENV[k] = e;
}
function applyEnv(a, b = null, t = 0) {
  const L = k => b ? lerp(a[k], b[k], t) : a[k];
  const C = (k, out) => b ? out.lerpColors(a[k], b[k], t) : out.copy(a[k]);
  C('top', skyU.top.value); C('horizon', skyU.horizon.value); C('bottom', skyU.bottom.value); C('sun', skyU.sunColor.value);
  if (b) lightDir.copy(a.dir).lerp(b.dir, t).normalize(); else lightDir.copy(a.dir);
  skyU.sunDir.value.copy(lightDir);
  skyU.glow.value = L('glow'); skyU.disk.value = L('disk');
  C('key', key.color); key.intensity = L('keyI');
  fill.color.copy(key.color).lerp(hemi.color, .5); fill.intensity = L('fillI');
  C('hemiS', hemi.color); C('hemiG', hemi.groundColor); hemi.intensity = L('hemiI');
  C('fog', scene.fog.color); scene.fog.density = L('fogD');
  starMat.uniforms.uOpacity.value = L('stars');
  renderer.toneMappingExposure = L('exposure');
  scene.environmentIntensity = L('envI');
  bloom.threshold = L('bloomT'); bloom.strength = L('bloomS');
  const ma = a.moon ? 1 : 0, mb = b ? (b.moon ? 1 : 0) : ma;
  moonAlpha = b ? lerp(ma, mb, t) : ma;
  const age = (b && b.moon) || a.moon;
  if (age) setMoon(age);
}
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
let envRT = null;
function refreshEnvMap() {
  const rt = pmrem.fromScene(envScene, .02, .1, 500);
  if (envRT) envRT.dispose();
  envRT = rt; scene.environment = rt.texture;
}

// ─────────── materials ───────────
const SAND = {
  light: new THREE.Color('#ebcb98'), mid: new THREE.Color('#d7ab70'), dark: new THREE.Color('#b58650'), gravel: new THREE.Color('#8f7153'),
  earth: new THREE.Color('#8d6c49'), green: new THREE.Color('#6c7442'), wet: new THREE.Color('#5a4731'), reed: new THREE.Color('#77773f'),
};
const M = {
  mud: new THREE.MeshStandardMaterial({ color: '#b58c5f', roughness: 1, flatShading: true }),
  mudDark: new THREE.MeshStandardMaterial({ color: '#8f6a45', roughness: 1, flatShading: true }),
  door: new THREE.MeshStandardMaterial({ color: '#2b1d12', roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#6a4a2c', roughness: .9 }),
  darkWood: new THREE.MeshStandardMaterial({ color: '#3f2a18', roughness: .9 }),
  leather: new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: .85 }),
  skin: new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: .7 }),
  rope: new THREE.MeshStandardMaterial({ color: '#b39b73', roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: '#8d8274', roughness: 1, flatShading: true }),
  gold: new THREE.MeshStandardMaterial({ color: '#d9b24a', metalness: 1, roughness: .32, emissive: '#3a2a08', emissiveIntensity: .15 }),
  metal: new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: .85, roughness: .32, flatShading: true }),
  water: new THREE.MeshStandardMaterial({ color: '#1b3a45', roughness: .06, metalness: .15, normalMap: WATERN, normalScale: new THREE.Vector2(.32, .32) }),
  bucketWater: new THREE.MeshStandardMaterial({ color: '#2a5566', roughness: .05, metalness: .2 }),
  tent: new THREE.MeshStandardMaterial({ map: TENT_TEX, roughness: 1, side: THREE.DoubleSide }),
  rugA: new THREE.MeshStandardMaterial({ map: RUG_A, roughness: 1 }),
  rugB: new THREE.MeshStandardMaterial({ map: RUG_B, roughness: 1 }),
  rugC: new THREE.MeshStandardMaterial({ map: RUG_C, roughness: 1 }),
  clothG: new THREE.MeshStandardMaterial({ map: CLOTH_GREEN, roughness: .85, side: THREE.DoubleSide }),
  clothR: new THREE.MeshStandardMaterial({ map: CLOTH_RED, roughness: .85, side: THREE.DoubleSide }),
  clothB: new THREE.MeshStandardMaterial({ map: CLOTH_BLUE, roughness: .85, side: THREE.DoubleSide }),
  window: new THREE.MeshStandardMaterial({ color: '#2a1a0c', emissive: '#ffae55', emissiveIntensity: 3.2 }),
  caravanLamp: new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb15a', emissiveIntensity: 7 }),
  campLamp: new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb15a', emissiveIntensity: 7 }),
  tentGlow: new THREE.MeshStandardMaterial({ color: '#2a1d12', emissive: '#ff9a48', emissiveIntensity: 1.4, side: THREE.DoubleSide }),
  lampFrame: new THREE.MeshStandardMaterial({ color: '#2d2620', metalness: .6, roughness: .5 }),
  enemyWall: new THREE.MeshStandardMaterial({ color: '#d6c8ab', roughness: 1, side: THREE.DoubleSide, flatShading: true }),
  enemyRoof: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }),
  reed: new THREE.MeshStandardMaterial({ color: '#6f7440', roughness: 1, flatShading: true }),
};
const BANNER_U = { uTime: { value: 0 } };
function wavingMaterial(params, amp = .16) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = BANNER_U.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float w = clamp(uv.x, 0.0, 1.0);
       transformed.z += sin(position.x * 2.6 - uTime * 3.2 + position.y * .8) * ${amp.toFixed(3)} * w + sin(position.x * 5.1 - uTime * 5.3) * ${(amp * .35).toFixed(3)} * w;
       transformed.y += sin(position.x * 2.0 - uTime * 2.6) * ${(amp * .25).toFixed(3)} * w;`);
  };
  return m;
}
M.banner = wavingMaterial({ map: BANNER_TEX, roughness: .8, side: THREE.DoubleSide }, .18);
M.pennant = wavingMaterial({ color: '#8b1d17', roughness: .8, side: THREE.DoubleSide }, .09);
M.enemyBanner = wavingMaterial({ color: '#2a1a18', roughness: .8, side: THREE.DoubleSide }, .15);
M.cloak = wavingMaterial({ color: '#3b1714', roughness: .9, side: THREE.DoubleSide }, .05);

// ─────────── particles ───────────
const PV = `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
  void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PF = `uniform vec3 uColor; uniform float uHard; varying float vA;
  void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(clamp(1.0 - d, 0.0, 1.0), uHard); gl_FragColor = vec4(uColor, a * vA); }`;
class Particles {
  constructor(max, color, { additive = false, hard = 1.6 } = {}) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max); this.life = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uColor: { value: new THREE.Color(color) }, uScale: PSCALE, uHard: { value: hard } }, vertexShader: PV, fragmentShader: PF,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
  }
  update(dt, drag = .6, lift = 0) {
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        const j = --this.n;
        if (i !== j) {
          this.pos.copyWithin(i * 3, j * 3, j * 3 + 3); this.vel.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j]; this.a0[i] = this.a0[j];
          i--;
        }
        continue;
      }
      const k = i * 3, f = Math.max(0, 1 - drag * dt);
      this.vel[k] *= f; this.vel[k + 1] = this.vel[k + 1] * f + lift * dt; this.vel[k + 2] *= f;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = this.age[i] / this.life[i];
      this.size[i] = lerp(this.s0[i], this.s1[i], t);
      this.alpha[i] = this.a0[i] * Math.min(1, t * 6) * (1 - t);
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true; this.geo.attributes.aAlpha.needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}
const DUST = new Particles(2600, '#b08a62', { hard: 1.15 });
const SPARKS = new Particles(500, new THREE.Color(5, 2, .5), { additive: true, hard: 2.2 });
const SPLASH = new Particles(400, new THREE.Color(1.6, 2, 2.4), { additive: true, hard: 2.4 });

// lamp points (fixed positions, per-point alpha)
class GlowPoints {
  constructor(positions, color, size) {
    const n = positions.length / 3;
    this.alpha = new Float32Array(n); this.size = new Float32Array(n).fill(size);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) }, uScale: PSCALE, uHard: { value: 2.6 } }, vertexShader: PV, fragmentShader: PF,
    }));
    this.points.frustumCulled = false;
  }
  commit() { this.geo.attributes.aAlpha.needsUpdate = true; }
}

// ─────────── model loading ───────────
const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
const gltfLoader = new GLTFLoader();
const parseGLB = s => new Promise((res, rej) => gltfLoader.parse(b64(s), '', res, rej));

function normalized(obj, height, { tintLeaves = false, stone = null } = {}) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const s = height / (box.max.y - box.min.y);
  const wrap = new THREE.Group();
  obj.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const inner = new THREE.Group(); inner.scale.setScalar(s); inner.add(obj); wrap.add(inner);
  wrap.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (o.material && 'metalness' in o.material) { o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = Math.max(o.material.roughness, .8); }
    // colours are baked into the vertices; soften the cartoon-bright palm greens towards a desert olive
    if (tintLeaves && o.geometry.attributes.color) {
      const C = o.geometry.attributes.color, olive = new THREE.Color('#5d7a34'), c = new THREE.Color();
      for (let i = 0; i < C.count; i++) {
        c.setRGB(C.getX(i), C.getY(i), C.getZ(i));
        if (c.g > c.r * 1.05 && c.g > c.b) { c.lerp(olive, .62); C.setXYZ(i, c.r, c.g, c.b); }
      }
    }
    // rocks: pull the bright orange towards a weathered sandstone that sits in the dunes
    if (stone) {
      const st = new THREE.Color(stone), c = new THREE.Color(), C = o.geometry.attributes.color;
      if (C) for (let i = 0; i < C.count; i++) { c.setRGB(C.getX(i), C.getY(i), C.getZ(i)).lerp(st, .72); C.setXYZ(i, c.r, c.g, c.b); }
      else if (o.material && o.material.color) o.material.color.lerp(st, .6);
    }
  });
  wrap.updateMatrixWorld(true);
  return wrap;
}
// rocks gather in small, half-buried outcrops on flat ground, never alone on a dune face
function flatSpots(hf, count, [x0, x1, z0, z1], avoid, r, minGap = 45) {
  const spots = [];
  for (let t = 0; spots.length < count && t < 6000; t++) {
    const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
    if (avoid(x, z)) continue;
    const slope = Math.hypot(hf(x + 3, z) - hf(x - 3, z), hf(x, z + 3) - hf(x, z - 3)) / 6;
    if (slope > .12 || spots.some(p => Math.hypot(p[0] - x, p[1] - z) < minGap)) continue;
    spots.push([x, z]);
  }
  return spots;
}
function outcrops(spots, hf, r) {
  const list = [];
  for (const [cx, cz] of spots) {
    const m = 4 + Math.floor(r() * 5), big = r() < .35;
    for (let i = 0; i < m; i++) {
      const a = r() * TAU, d = i ? 1 + r() * (big ? 5 : 3) : 0, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const sc = (i ? .35 + r() * .8 : 1.2 + r() * 1.1) * (big ? 1.5 : 1);
      list.push({ x, y: hf(x, z) - sc * .32, z, s: sc, ry: r() * TAU, rx: (r() - .5) * .5, rz: (r() - .5) * .5 });
    }
  }
  return list;
}
// dry desert scrub: a low tuft of thin blades, instanced
const TUFT_MAT = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
let TUFT_GEO = null;
function tufts(spots, hf, r, perSpot, extra = []) {
  if (!TUFT_GEO) {
    const parts = [];
    for (let i = 0; i < 9; i++) { const b = new THREE.ConeGeometry(.035, .5 + (i % 3) * .12, 3); b.translate(0, .25, 0); b.rotateZ(.35 + (i % 2) * .25); b.rotateY(i / 9 * TAU); parts.push(onlyAttrs(b, ['position', 'normal'])); }
    TUFT_GEO = mergeGeometries(parts); TUFT_GEO.computeVertexNormals();
  }
  const pts = [];
  for (const [cx, cz] of spots) for (let i = 0; i < perSpot; i++) { const a = r() * TAU, d = 3 + r() * 10; pts.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d]); }
  pts.push(...extra);
  const im = new THREE.InstancedMesh(TUFT_GEO, TUFT_MAT, pts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  pts.forEach(([x, z], i) => {
    const sc = .6 + r() * .9;
    m4.compose(tmpV.set(x, hf(x, z) - .05, z), q.setFromEuler(e.set(0, r() * TAU, 0)), tmpV2.set(sc, sc * (.7 + r() * .5), sc));
    im.setMatrixAt(i, m4); im.setColorAt(i, c.set(r() < .5 ? '#7d7550' : '#9c8a5c'));
  });
  im.castShadow = true; im.receiveShadow = true;
  return im;
}
function instanced(template, list) {
  const group = new THREE.Group();
  template.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  template.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
    list.forEach((it, i) => {
      q.setFromEuler(e.set(it.rx || 0, it.ry || 0, it.rz || 0));
      m.compose(p.set(it.x, it.y, it.z), q, it.sy ? sc.set(it.s, it.sy, it.s) : sc.setScalar(it.s)).multiply(o.matrixWorld);
      im.setMatrixAt(i, m);
    });
    im.castShadow = true; im.receiveShadow = true;
    group.add(im);
  });
  return group;
}

// camel: static low-poly model animated by deforming its legs
function prepCamel(gltf, H = 2.25) {
  let mesh = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone();
  for (const k of Object.keys(geo.attributes)) { const at = geo.attributes[k]; if (!at.isInterleavedBufferAttribute) continue; const arr = new Float32Array(at.count * at.itemSize); for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) arr[i * at.itemSize + c] = at.getComponent(i, c); geo.setAttribute(k, new THREE.BufferAttribute(arr, at.itemSize, at.normalized)); }
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  let bb = geo.boundingBox;
  const s = H / (bb.max.y - bb.min.y);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeBoundingBox(); bb = geo.boundingBox;
  const Lz = bb.max.z - bb.min.z, k = H / 2.25;
  const P = geo.attributes.position, n = P.count;
  const belly = .44 * H, knee = .24 * H;
  // 1. hooves: the vertices on the ground, split front/back (2-means on z) and left/right
  const low = [];
  for (let i = 0; i < n; i++) if (P.getY(i) < .08 * H) low.push(i);
  let c1 = Math.min(...low.map(i => P.getZ(i))), c2 = Math.max(...low.map(i => P.getZ(i)));
  for (let it = 0; it < 12; it++) {
    let a = 0, an = 0, b = 0, bn = 0;
    low.forEach(i => { const z = P.getZ(i); if (Math.abs(z - c1) < Math.abs(z - c2)) { a += z; an++; } else { b += z; bn++; } });
    c1 = a / an; c2 = b / bn;
  }
  const mid = (c1 + c2) / 2, hoof = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  low.forEach(i => { const x = P.getX(i), z = P.getZ(i), l = (z < mid ? 2 : 0) + (x < 0 ? 0 : 1); hoof[l][0] += x; hoof[l][1] += z; hoof[l][2]++; });
  // 2. follow each leg upward band by band to find its centre line up to the belly
  const cols = hoof.map(([sx, sz, cnt], l) => {
    let cx = sx / Math.max(cnt, 1), cz = sz / Math.max(cnt, 1);
    const side = l % 2 ? 1 : -1;
    const pts = [[0, cx, cz]];
    for (let y = .03 * H; y <= belly + .001; y += .035 * H) {
      let ax = 0, az = 0, m = 0;
      for (let i = 0; i < n; i++) {
        if (Math.abs(P.getY(i) - y) > .02 * H || P.getX(i) * side < .01 * k) continue;
        const dx = P.getX(i) - cx, dz = P.getZ(i) - cz;
        if (dx * dx + dz * dz < (.2 * k) ** 2) { ax += P.getX(i); az += P.getZ(i); m++; }
      }
      if (m) { cx = ax / m; cz = az / m; }
      pts.push([y, cx, cz]);
    }
    return pts;
  });
  const colAt = (l, y) => {
    const c = cols[l];
    if (y <= c[0][0]) return c[0];
    for (let j = 1; j < c.length; j++) if (y <= c[j][0]) { const t = (y - c[j - 1][0]) / (c[j][0] - c[j - 1][0]); return [y, lerp(c[j - 1][1], c[j][1], t), lerp(c[j - 1][2], c[j][2], t)]; }
    return c[c.length - 1];
  };
  // 3. smooth weights: every vertex blends between its two nearest legs by distance, so nothing can tear
  const la = new Int8Array(n).fill(-1), lb = new Int8Array(n).fill(-1), wa = new Float32Array(n), wb = new Float32Array(n);
  const wh = new Float32Array(n), wk = new Float32Array(n), wn = new Float32Array(n);
  // the foot pads are broad, the upper legs slim: the leg zone is wide at the ground and narrows with height
  const zoneR = y => lerp(.3, .13, smooth(0, .16 * H, y)) * k;
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (y < belly + .02 * H) {
      const side = x > .015 * k ? 1 : x < -.015 * k ? -1 : 0;
      const ws = [0, 1, 2, 3].map(l => { if ((l % 2 ? 1 : -1) !== side) return [l, 0]; const c = colAt(l, Math.min(y, belly)), r = zoneR(y); return [l, smooth(r + .07 * k, r, Math.hypot(x - c[1], z - c[2]))]; }).sort((p, q) => q[1] - p[1]);
      let A = ws[0][1], B = ws[1][1];
      const sum = A + B; if (sum > 1) { A /= sum; B /= sum; }
      if (A > 0) { la[i] = ws[0][0]; wa[i] = A; }
      if (B > 0) { lb[i] = ws[1][0]; wb[i] = B; }
      wh[i] = smooth(belly + .02 * H, belly - .09 * H, y);
      wk[i] = smooth(knee + .035 * H, knee - .035 * H, y);
    }
  }
  const hip = [0, 1, 2, 3].map(l => [belly, colAt(l, belly)[2]]);
  const kn = [0, 1, 2, 3].map(l => [knee, colAt(l, knee)[2]]);
  const front = Math.max(c1, c2), neckZ = front + .08 * Lz, back = Math.min(c1, c2);
  let humpY = 0, humpZ = 0;
  for (let i = 0; i < n; i++) {
    const y = P.getY(i), z = P.getZ(i);
    if (la[i] < 0 && y > belly * .9) wn[i] = smooth(neckZ, bb.max.z, z);
    if (z > back && z < neckZ && y > humpY) { humpY = y; humpZ = z; }
  }
  let nose = [0, 0];
  for (let i = 0; i < n; i++) if (P.getY(i) > .6 * H && P.getZ(i) > nose[1]) nose = [P.getY(i), P.getZ(i)];
  return { nose, geo, mat: mesh.material, H, legLen: belly, la, lb, wa, wb, wh, wk, wn, hip, knee: kn, neck: [.62 * H, neckZ], humpY, humpZ, len: Lz };
}

// ─────────── props ───────────
function makeLantern(mat, scale = 1) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, .04, 8), M.lampFrame); frame.position.y = -.14;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .22, 8), mat);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.11, .12, 8), M.lampFrame); cap.position.y = .17;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.04, .01, 4, 10), M.lampFrame); ring.position.y = .26;
  g.add(frame, glass, cap, ring);
  g.scale.setScalar(scale);
  return g;
}
let RIDER_CIVIL = [];
// ─────────── noor: a floating light that stands for a member of the Prophet's family ───────────
const NOOR_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,248,226,.6)'); gr.addColorStop(.55, 'rgba(255,236,190,.14)'); gr.addColorStop(1, 'rgba(255,226,170,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const NOOR_MOTES = new Particles(600, new THREE.Color(3, 2.7, 2), { additive: true, hard: 2.2 });
const NOOR_GEO = new THREE.SphereGeometry(1, 16, 12);
const NOOR_COL = new THREE.Color(9, 8.3, 6.6);
const NOORS = [], noorV = new THREE.Vector3(), NOOR_GAIN = { v: 1 };
class Noor {
  constructor(size = 1, light = 0) {
    this.group = new THREE.Group(); this.bob = new THREE.Group(); this.group.add(this.bob);
    this.core = new THREE.Mesh(NOOR_GEO, new THREE.MeshBasicMaterial({ color: NOOR_COL, fog: false, transparent: true }));
    this.core.scale.setScalar(.075 * size); this.bob.add(this.core);
    const sprite = (col, op, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: NOOR_TEX, color: col, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: op })); sp.scale.setScalar(s * size); this.bob.add(sp); return sp; };
    this.halo = sprite(new THREE.Color(2.6, 2.3, 1.8), 1, .75);
    this.aura = sprite(new THREE.Color(1, .82, .5), .5, 2.8);
    this.light = light ? new THREE.PointLight('#fff0cf', light, 9 * size, 1.6) : null;
    if (this.light) this.bob.add(this.light);
    this.size = size; this.light0 = light; this.level = 1; this.rise = 0; this.ph = Math.random() * TAU; this.acc = Math.random();
    NOORS.push(this);
  }
  setLevel(k) {
    this.level = k; this.bob.visible = k > .01;
    const g = NOOR_GAIN.v; this.core.material.opacity = Math.min(1, k); this.halo.material.opacity = k * g; this.aura.material.opacity = .5 * k * g;
    if (this.light) this.light.intensity = this.light0 * k;
  }
  update(t, dt) {
    const s = this.size;
    if (this.gain !== NOOR_GAIN.v) { this.gain = NOOR_GAIN.v; this.setLevel(this.level); }
    this.bob.position.y = .07 * s * Math.sin(t * 1.3 + this.ph) + this.rise;
    this.aura.scale.setScalar(2.8 * s * (1 + .07 * Math.sin(t * 2.1 + this.ph)));
    if (dt <= 0 || this.level < .3 || (this.acc += dt * 2.5) < 1) return;
    this.acc -= 1;
    for (let o = this.group; o; o = o.parent) if (!o.visible) return;
    this.bob.getWorldPosition(noorV);
    NOOR_MOTES.emit(noorV.x + (Math.random() - .5) * .35 * s, noorV.y - .05, noorV.z + (Math.random() - .5) * .35 * s, (Math.random() - .5) * .08, .25 + Math.random() * .2, (Math.random() - .5) * .08, 2.4, .07 * s, .02, .9);
  }
}
function decorateCamel(c, kind, idx) {
  const T = c.tpl;
  const top = new THREE.Group();
  top.position.set(0, T.humpY - .1, T.humpZ);
  c.body.add(top); c.top = top;
  if (kind === 'howdah') {
    const cloth = [M.clothG, M.clothR, M.clothB][idx % 3];
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, .2, 1.5), M.darkWood); base.position.y = .1;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.78, 20, 10, 0, TAU, 0, Math.PI / 2), cloth);
    dome.scale.set(1, 1.15, 1.18); dome.position.y = .2;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.8, .86, .5, 20, 1, true), cloth); skirt.position.y = -.02;
    const fin = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), M.gold); fin.position.y = 1.15;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(.04, .22, 8), M.gold); spike.position.y = 1.3;
    [base, dome, skirt, fin, spike].forEach(o => { o.castShadow = true; top.add(o); });
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU, tas = new THREE.Mesh(new THREE.ConeGeometry(.03, .14, 5), M.gold);
      tas.position.set(Math.cos(a) * .84, -.3, Math.sin(a) * .84); tas.rotation.x = Math.PI; top.add(tas);
    }
    c.noor = new Noor(.9); c.noor.group.position.set(0, 2.05, .05); top.add(c.noor.group);
  } else if (kind === 'rider') {
    const rug = [M.rugA, M.rugB, M.rugC][idx % 3];
    const drape = new THREE.CylinderGeometry(.5, .5, 1.05, 16, 1, true, -Math.PI / 2, Math.PI); drape.rotateX(-Math.PI / 2); drape.scale(1, .55, 1);
    const saddle = new THREE.Mesh(drape, rug); saddle.material = rug.clone(); saddle.material.side = THREE.DoubleSide; saddle.position.y = -.15; saddle.castShadow = true; top.add(saddle);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(.62, .1, .7), M.leather); seat.position.y = .12; top.add(seat);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.05, 10), [M.rugB, M.rugC, M.rugA][idx % 3]); roll.rotation.z = Math.PI / 2; roll.position.set(0, .1, -.5); roll.castShadow = true; top.add(roll);
    if (RIDER_CIVIL.length) {
      const rm = new THREE.Mesh(RIDER_CIVIL[idx % RIDER_CIVIL.length], VC_MAT); rm.position.set(0, .2, .06); rm.castShadow = true; top.add(rm); c.riderMesh = rm;
      if (RIDER_HANDS && T.nose) {
        const [hl, hr] = RIDER_HANDS.civil[0].map(h => h.clone().add(rm.position).add(top.position)), mid = hl.clone().lerp(hr, .5);
        const pts = [hl, mid.clone().add(new THREE.Vector3(0, -.05, 0)), hr, mid, new THREE.Vector3(0, T.nose[0] - .05, T.nose[1] - .1)];
        const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[1], pts[4]]), REINS_MAT); c.body.add(rope);
      }
    }
  } else if (kind === 'lead') {
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(.9, .22, 1.1), M.rugA); saddle.position.y = .08; top.add(saddle);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, 2.4, 6), M.darkWood); pole.position.set(.35, 1.1, .2); top.add(pole);
    const lan = makeLantern(M.caravanLamp, 1.25); lan.position.set(.35, 2.35, .2); top.add(lan);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(.9, .6, 12, 6), M.banner);
    flag.geometry.translate(.45, 0, 0); flag.position.set(.35, 2.0, .2); flag.rotation.y = Math.PI / 2; top.add(flag); c.flag = flag;
    c.lantern = lan;
  } else {
    const rug = [M.rugA, M.rugB, M.rugC][idx % 3];
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(.95, .2, 1.2), rug); saddle.position.y = .06; top.add(saddle);
    for (const sx of [-1, 1]) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(.38, .62, .9), [M.rugB, M.rugC, M.rugA][(idx + (sx > 0 ? 1 : 0)) % 3]);
      bag.position.set(sx * .62, -.3, 0); bag.rotation.z = sx * .12; bag.castShadow = true; top.add(bag);
    }
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 1.3, 10), rug); roll.rotation.z = Math.PI / 2; roll.position.set(0, .3, -.25); roll.castShadow = true; top.add(roll);
    const skin = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), M.skin); skin.scale.set(1, .75, 1.5); skin.position.set(.66, -.05, .55); top.add(skin);
  }
}
const VC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0 });
function colorize(g, color) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function onlyAttrs(g, keep) {
  for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  return g.index ? g.toNonIndexed() : g;
}
// rider: a rigged character posed in the saddle and baked to one mesh per colour variant,
// with two morph targets (leaning into a gallop with the lance lowered, and turning to look around)
const RIDER_VARIANTS = [
  { Green: '#5b2420', LightGreen: '#7a3a2e', turban: '#e6dccb' },
  { Green: '#2b3050', LightGreen: '#3d4468', turban: '#e6dccb' },
  { Green: '#6b5a3c', LightGreen: '#8a7552', turban: '#2a2a30' },
  { Green: '#2a2826', LightGreen: '#403c38', turban: '#d9c9a8' },
];
const RIDER_BASE = { Brown: '#4a3322', Brown2: '#5e4430', Grey: '#6d6f72', Black: '#1e1a18', Gold: '#a88a3e', Hair: '#1c1510', Eyebrows: '#1c1510' };
function prepRider(gltf) {
  const rr = gltf.scene; rr.updateMatrixWorld(true);
  const rb = {}; rr.traverse(o => { if (o.isBone) rb[o.name] = o; });
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion(), upd = () => rr.updateMatrixWorld(true);
  const setWorldQ = (bone, q) => { bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(q)); upd(); };
  const aim = (bone, child, dir) => { upd(); const cur = child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize(); setWorldQ(bone, Q().setFromUnitVectors(cur, dir.clone().normalize()).multiply(bone.getWorldQuaternion(Q()))); };
  const aimY = (bone, dir) => { upd(); const bq = bone.getWorldQuaternion(Q()); setWorldQ(bone, Q().setFromUnitVectors(V().set(0, 1, 0).applyQuaternion(bq), dir.clone().normalize()).multiply(bq)); };
  const turn = (bone, axis, ang) => { upd(); setWorldQ(bone, Q().setFromAxisAngle(axis, ang).multiply(bone.getWorldQuaternion(Q()))); };
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
  const saved = []; rr.traverse(o => { if (o.isBone) saved.push([o, o.position.clone(), o.quaternion.clone()]); });
  const restore = () => { saved.forEach(([b, p, q]) => { b.position.copy(p); b.quaternion.copy(q); }); upd(); };
  const SX = {}, shinLen = {}, footQ = {};
  for (const sd of ['L', 'R']) {
    SX[sd] = Math.sign(rb['UpperLeg' + sd].getWorldPosition(V()).x);
    shinLen[sd] = rb['LowerLeg' + sd].getWorldPosition(V()).distanceTo(rb['Foot' + sd].getWorldPosition(V()));
    footQ[sd] = rb['Foot' + sd].getWorldQuaternion(Q());
  }
  // the feet are IK controls (not children of the shins), so each is moved to the end of its posed shin
  const legs = () => {
    for (const sd of ['L', 'R']) {
      const sx = SX[sd];
      aim(rb['UpperLeg' + sd], rb['LowerLeg' + sd], V().set(sx * .22, -.62, .7));
      const shin = V().set(-sx * .07, -1, -.12).normalize();
      aimY(rb['LowerLeg' + sd], shin);
      const foot = rb['Foot' + sd];
      foot.position.copy(foot.parent.worldToLocal(rb['LowerLeg' + sd].getWorldPosition(V()).addScaledVector(shin, shinLen[sd])));
      upd();
      setWorldQ(foot, Q().setFromAxisAngle(AX, .25).multiply(footQ[sd]));
    }
  };
  const arms = lean => {
    const L = SX.L, R = SX.R;
    aim(rb.UpperArmL, rb.LowerArmL, V().set(L * .14, -.97 + lean * .35, .18 + lean * .55));
    aim(rb.LowerArmL, rb.WristL, V().set(-L * .38, -.78 + lean * .45, .5 + lean * .4));
    aim(rb.UpperArmR, rb.LowerArmR, V().set(R * .2, -.97 + lean * .4, .1 + lean * .6));
    aim(rb.LowerArmR, rb.WristR, V().set(R * .06, -.5 + lean * .3, .86));
  };
  const fingers = () => {
    for (const [sd, sign] of [['L', 1], ['R', -1]]) {
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) { const b = rb[f + k + sd]; if (b) b.rotateX(sign * 1.15); }
      for (let k = 2; k <= 3; k++) { const b = rb['Thumb' + k + sd]; if (b) b.rotateX(sign * .6); }
    }
    upd();
  };
  // both hands low in front, holding the reins
  const armsReins = lean => {
    for (const [sd, s] of [['L', SX.L], ['R', SX.R]]) {
      aim(rb['UpperArm' + sd], rb['LowerArm' + sd], V().set(s * .16, -.9 + lean * .3, .36 + lean * .4));
      aim(rb['LowerArm' + sd], rb['Wrist' + sd], V().set(-s * .3, -.42 + lean * .3, .86));
    }
  };
  let armsFn = arms;
  const POSES = {
    base: () => { legs(); armsFn(0); fingers(); },
    gallop: () => { legs(); turn(rb.Torso, AX, .2); turn(rb.Chest, AX, .1); turn(rb.Head, AX, -.24); armsFn(1); fingers(); if (armsFn === arms) turn(rb.WristR, AX, .95); },
    look: () => { legs(); turn(rb.Chest, AY, .2); turn(rb.Head, AY, .55); armsFn(0); fingers(); },
  };
  restore(); POSES.base();
  const hips = rb.Hips.getWorldPosition(V()), head = rb.Head.getWorldPosition(V()), wr = rb.WristR.getWorldPosition(V());
  const bodyMeshes = []; rr.traverse(o => { if (o.isMesh && !/Sword|Backpack/.test(o.name)) bodyMeshes.push(o); });
  // accessories follow the bone they are attached to in every pose
  const lanceDir = new THREE.Vector3(0, Math.cos(-.12), Math.sin(-.12)), lanceC = wr.clone().add(new THREE.Vector3(0, .9, .06));
  const accDefs = [
    [new THREE.TorusGeometry(.115, .05, 8, 18), head.clone().add(V().set(0, .22, -.01)), [Math.PI / 2, 0, 0], 'turban', 1, rb.Head],
    [new THREE.TorusGeometry(.105, .045, 8, 18), head.clone().add(V().set(0, .26, -.015)), [Math.PI / 2 - .25, 0, 0], 'turban', 1, rb.Head],
    [new THREE.SphereGeometry(.12, 14, 10, 0, TAU, 0, Math.PI / 2), head.clone().add(V().set(0, .22, -.01)), [0, 0, 0], 'turban', 1, rb.Head],
    [new THREE.BoxGeometry(.2, .32, .01), head.clone().add(V().set(0, .06, -.13)), [.15, 0, 0], 'turban', 1, rb.Head],
    [new THREE.CylinderGeometry(.018, .022, 3.3, 6), lanceC, [-.12, 0, 0], 'wood', 1, rb.WristR],
    [new THREE.ConeGeometry(.045, .3, 6), lanceC.clone().addScaledVector(lanceDir, 1.8), [-.12, 0, 0], 'steel', 1, rb.WristR],
    [new THREE.CylinderGeometry(.3, .3, .05, 18), hips.clone().add(V().set(.05, .45, -.19)), [Math.PI / 2, 0, 0], 'shield', .72, rb.Chest],
    [new THREE.SphereGeometry(.07, 8, 6), hips.clone().add(V().set(.05, .45, -.22)), [0, 0, 0], 'steel', 1, rb.Chest],
  ].map(([geo, pos, rot, key, scl, bone]) => {
    const m = new THREE.Matrix4().compose(pos, Q().setFromEuler(new THREE.Euler(...rot)), V().setScalar(scl));
    return { g: onlyAttrs(geo.applyMatrix4(m), ['position']).applyMatrix4(bone.matrixWorld.clone().invert()), key, bone };
  });
  const snapshot = () => ({
    body: bodyMeshes.map(o => {
      const g = o.geometry.clone(), P = g.attributes.position, v = V();
      for (let i = 0; i < P.count; i++) { if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(o.geometry.attributes.position, i); v.applyMatrix4(o.matrixWorld).sub(hips); P.setXYZ(i, v.x, v.y, v.z); }
      return onlyAttrs(g, ['position']);
    }),
    acc: accDefs.map(a => a.g.clone().applyMatrix4(a.bone.matrixWorld).translate(-hips.x, -hips.y, -hips.z)),
  });
  const handsNow = () => ['WristL', 'WristR'].map(n => rb[n].getWorldPosition(V()).sub(hips));
  const base = snapshot(), handsBase = handsNow();
  restore(); POSES.gallop(); const gallop = snapshot(), handsGal = handsNow();
  restore(); POSES.look(); const look = snapshot();
  armsFn = armsReins;
  restore(); POSES.base(); const baseC = snapshot(), handsBaseC = handsNow();
  restore(); POSES.gallop(); const gallopC = snapshot(), handsGalC = handsNow();
  restore(); POSES.look(); const lookC = snapshot();
  const mergePose = (P, colors) => mergeGeometries([
    ...P.body.map((g, i) => colors ? colorize(g.clone(), colors.body[i]) : g),
    ...P.acc.map((g, j) => colors ? colorize(g.clone(), colors.acc[j]) : g),
  ]);
  const fixed = { wood: new THREE.Color('#6a4a2c'), steel: new THREE.Color('#9aa0a8'), shield: new THREE.Color('#6b4a2c') };
  const build = (keep, base, gallop, look) => {
    const idx = accDefs.map((a, j) => j).filter(j => keep(accDefs[j].key));
    const merge = (P, colors) => mergeGeometries([
      ...P.body.map((g, i) => colors ? colorize(g.clone(), colors.body[i]) : g.clone()),
      ...idx.map(j => colors ? colorize(P.acc[j].clone(), colors.acc[j]) : P.acc[j].clone()),
    ]);
    const gp = merge(gallop).attributes.position, lp = merge(look).attributes.position;
    return RIDER_VARIANTS.map(vr => {
      const colors = {
        body: bodyMeshes.map(o => vr[o.material.name] ? new THREE.Color(vr[o.material.name]) : RIDER_BASE[o.material.name] ? new THREE.Color(RIDER_BASE[o.material.name]) : o.material.color.clone()),
        acc: accDefs.map(a => a.key === 'turban' ? new THREE.Color(vr.turban) : fixed[a.key]),
      };
      const g = merge(base, colors);
      g.computeVertexNormals();
      g.morphAttributes.position = [gp, lp];
      return g;
    });
  };
  return {
    soldier: build(() => true, base, gallop, look), civil: build(k => k === 'turban', baseC, gallopC, lookC),
    hands: { soldier: [handsBase, handsGal], civil: [handsBaseC, handsGalC] },
  };
}
// horse: the per-material skinned parts are merged into one vertex-coloured skinned mesh per coat colour.
// The blanket and saddle are copies of the horse's own back surface, pushed outward and skinned like the body,
// so they fit exactly and move with every stride.
const HORSE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: 0 });
const BLANKETS = { bay: '#7e2a22', black: '#23305e', grey: '#2f5a45', chestnut: '#23305e', white: '#7e2a22', dun: '#6b4a22' };
function prepHorse(gltf) {
  const root = gltf.scene; root.updateMatrixWorld(true);
  const parts = []; root.traverse(o => { if (o.isSkinnedMesh) parts.push(o); });
  const bone = n => { let b = null; root.traverse(o => { if (o.isBone && o.name === n) b = o; }); return b; };
  // (see the mouth search below: used to hang the reins)
  const head = bone('Head'), tail = bone('Tail1'), torso = bone('Torso'), back = bone('Back');
  root.updateMatrixWorld(true);
  let mouthLocal = null;
  root.traverse(o => {
    if (mouthLocal || !o.isSkinnedMesh) return;
    const hi = o.skeleton.bones.findIndex(b => b.name === 'Head'); if (hi < 0) return;
    const SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight, v = new THREE.Vector3(), hp = head.getWorldPosition(new THREE.Vector3());
    let best = -1, M = new THREE.Vector3();
    for (let i = 0; i < SI.count; i++) {
      let w = 0; for (let c = 0; c < 4; c++) if (SI.getComponent(i, c) === hi) w += SW.getComponent(i, c);
      if (w < .6) continue;
      o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld);
      const d = v.distanceTo(hp); if (d > best) { best = d; M.copy(v); }
    }
    if (best > 0) mouthLocal = head.worldToLocal(M.lerp(hp, .16));
  });
  const box = new THREE.Box3().setFromObject(root, true);
  const s = 2.05 / (box.max.y - box.min.y);
  const hp = head.getWorldPosition(new THREE.Vector3()), tp = tail.getWorldPosition(new THREE.Vector3()), tor = torso.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(hp.x - tp.x, 0, hp.z - tp.z).normalize(), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const frame = p => { const d = p.clone().sub(tor); return [d.dot(side) * s, d.y * s, d.dot(fwd) * s]; };
  const tack = { blanket: [], seat: [] }, v = new THREE.Vector3();
  let skinIdxType = null, skinWType = null, skinWNorm = false;
  for (const p of parts) {
    if (!/^Main/.test(p.material.name)) continue;
    const g = onlyAttrs(p.geometry.clone(), ['position', 'normal', 'skinIndex', 'skinWeight']);
    const P = g.attributes.position, Nn = g.attributes.normal, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = P.count;
    skinIdxType = SI.array.constructor; skinWType = SW.array.constructor; skinWNorm = SW.normalized;
    const tmp = new THREE.SkinnedMesh(g, p.material); tmp.bind(p.skeleton, p.bindMatrix.clone()); tmp.bindMatrixInverse.copy(p.bindMatrixInverse);
    const W = [];
    for (let i = 0; i < n; i++) { tmp.getVertexPosition(i, v); v.applyMatrix4(p.matrixWorld); W.push(frame(v)); }
    const keyOf = i => P.getX(i).toFixed(5) + ',' + P.getY(i).toFixed(5) + ',' + P.getZ(i).toFixed(5);
    const nsum = new Map();
    for (let i = 0; i < n; i++) { const k = keyOf(i), a = nsum.get(k) || [0, 0, 0]; a[0] += Nn.getX(i); a[1] += Nn.getY(i); a[2] += Nn.getZ(i); nsum.set(k, a); }
    // geometry units to metres, measured (the skeleton's bind pose carries its own scale)
    let metresPerUnit = 1;
    for (let i = 1, best = 0; i < n; i += 7) {
      const dg = Math.hypot(P.getX(i) - P.getX(0), P.getY(i) - P.getY(0), P.getZ(i) - P.getZ(0));
      if (dg > best) { best = dg; metresPerUnit = Math.hypot(W[i][0] - W[0][0], W[i][1] - W[0][1], W[i][2] - W[0][2]) / dg; }
    }
    const zones = [
      ['blanket', w => Math.abs(w[2]) < .3 && w[1] > -.2, .022],
      ['seat', w => Math.abs(w[2]) < .16 && w[1] > .02 && Math.abs(w[0]) < .2, .065],
    ];
    for (const [kind, test, off] of zones) {
      const e = { pos: [], nor: [], si: [], sw: [], rel: [] };
      for (let t = 0; t < n; t += 3) {
        if (!test(W[t]) || !test(W[t + 1]) || !test(W[t + 2])) continue;
        for (let k = 0; k < 3; k++) {
          const i = t + k, a = nsum.get(keyOf(i)), l = Math.hypot(a[0], a[1], a[2]) || 1, d = off / metresPerUnit;
          e.pos.push(P.getX(i) + a[0] / l * d, P.getY(i) + a[1] / l * d, P.getZ(i) + a[2] / l * d);
          e.nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i));
          for (let c = 0; c < 4; c++) { e.si.push(SI.array[i * 4 + c]); e.sw.push(SW.array[i * 4 + c]); }
          e.rel.push(W[i]);
        }
      }
      tack[kind].push(e);
    }
  }
  const tackGeo = (kind, colorFn) => {
    const list = tack[kind], g = new THREE.BufferGeometry(), all = f => list.flatMap(e => e[f]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(all('pos'), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(all('nor'), 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(new skinIdxType(all('si')), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(new skinWType(all('sw')), 4, skinWNorm));
    const rel = all('rel'), col = new Float32Array(rel.length * 3), c = new THREE.Color();
    rel.forEach((w, i) => { colorFn(w, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; });
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const gold = new THREE.Color('#d2ad52'), cream = new THREE.Color('#e3d6b8'), leather = new THREE.Color('#3b2618');
  const variants = {};
  for (const [name, pal] of Object.entries(HORSE_COLORS)) {
    const blanket = new THREE.Color(BLANKETS[name]);
    const body = parts.map(p => colorize(onlyAttrs(p.geometry.clone(), ['position', 'normal', 'skinIndex', 'skinWeight']), pal[p.material.name] ? new THREE.Color(pal[p.material.name]) : p.material.color.clone()));
    const bl = tackGeo('blanket', (w, c) => { const az = Math.abs(w[2]); c.copy(az > .25 || w[1] < -.15 ? gold : az > .17 && az < .2 ? cream : blanket); });
    const seat = tackGeo('seat', (w, c) => c.copy(leather));
    variants[name] = mergeGeometries([...body, bl, seat]);
  }
  const first = parts[0], merged = new THREE.SkinnedMesh(variants.bay, HORSE_MAT);
  merged.position.copy(first.position); merged.quaternion.copy(first.quaternion); merged.scale.copy(first.scale);
  first.parent.add(merged);
  merged.bind(first.skeleton, first.bindMatrix.clone());
  parts.forEach(p => p.parent.remove(p));
  root.updateMatrixWorld(true);
  const backP = back.getWorldPosition(new THREE.Vector3());
  const basePitch = Math.atan2((tor.y - backP.y), new THREE.Vector3(tor.x - backP.x, 0, tor.z - backP.z).length());
  return { mouthLocal, root, clips: gltf.animations, s, yaw: -Math.atan2(hp.x - tp.x, hp.z - tp.z), offY: -box.min.y * s, variants, basePitch };
}
function makeTent(w, d, h, big) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const poles = big ? [-w * .36, -w * .12, w * .12, w * .36] : [-w / 3, 0, w / 3];
  const rh = (x, z) => { let pk = 0; for (const px of poles) pk = Math.max(pk, Math.exp(-Math.pow((x - px) / (w * .085), 2))); const ez = 2 * z / d; return h * (.7 + .3 * pk) * (1 - .52 * ez * ez); };
  const roof = new THREE.PlaneGeometry(w, d, 36, 12); roof.rotateX(-Math.PI / 2);
  let P = roof.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, rh(P.getX(i), P.getZ(i)));
  roof.computeVertexNormals();
  const roofM = new THREE.Mesh(roof, M.tent); roofM.castShadow = true; roofM.receiveShadow = true; body.add(roofM);
  const wall = (len, seg, fn) => {
    const geo = new THREE.PlaneGeometry(len, 1, seg, 1); const Q = geo.attributes.position;
    for (let i = 0; i < Q.count; i++) { const u = Q.getX(i), top = Q.getY(i) > 0; const [x, y, z] = fn(u, top); Q.setXYZ(i, x, y, z); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.tent); m.castShadow = true; m.receiveShadow = true; body.add(m);
  };
  wall(w, 36, (u, top) => [u, top ? rh(u, -d / 2) : 0, -d / 2 - (top ? 0 : .25)]);
  for (const sx of [-1, 1]) wall(d, 12, (u, top) => [sx * (w / 2 + (top ? 0 : .25)), top ? rh(sx * w / 2, u) : 0, u]);
  for (const px of poles) {
    const ph = rh(px, 0), pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, ph, 6), M.wood);
    pole.position.set(px, ph / 2, 0); body.add(pole);
  }
  for (const fx of [-w / 2, -w / 6, w / 6, w / 2]) {
    const ph = rh(fx, d / 2), pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, ph, 6), M.wood);
    pole.position.set(fx, ph / 2, d / 2); body.add(pole);
  }
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w * .8, d * .75), big ? M.rugA : [M.rugB, M.rugC][Math.floor(w * 10) % 2]);
  rug.rotation.x = -Math.PI / 2; rug.position.y = .03; rug.receiveShadow = true; body.add(rug);
  const eh = rh(0, -d / 2);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * .92, eh * .92), M.tentGlow); glow.position.set(0, eh * .46, -d / 2 + .15); body.add(glow);
  const lan = makeLantern(M.campLamp, 1.2); lan.position.set(0, rh(0, d / 2) - .45, d / 2 + .05); body.add(lan);
  const ropeGeo = new THREE.CylinderGeometry(.012, .012, 1, 4);
  for (const fx of [-w / 2, w / 2]) for (const fz of [-d / 2, d / 2]) {
    const a = new THREE.Vector3(fx, rh(fx, fz), fz), b = new THREE.Vector3(fx * 1.25, 0, fz * 1.6);
    const r = new THREE.Mesh(ropeGeo, M.rope); r.position.copy(a).add(b).multiplyScalar(.5); r.scale.y = a.distanceTo(b);
    r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); body.add(r);
  }
  return { group: g, body };
}
function makeHouse(r) {
  const g = new THREE.Group();
  const w = 6 + r() * 7, d = 6 + r() * 6, h = 3.4 + r() * 2.6;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.mud); box.position.y = h / 2; box.castShadow = box.receiveShadow = true; g.add(box);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w + .3, .35, d + .3), M.mudDark); rim.position.y = h + .1; rim.castShadow = true; g.add(rim);
  if (r() < .5) { const up = new THREE.Mesh(new THREE.BoxGeometry(w * .45, 2.2, d * .45), M.mud); up.position.set(w * .2, h + 1.1, -d * .2); up.castShadow = true; g.add(up); }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2), M.door); door.position.set(r() * w * .5 - w * .25, 1, d / 2 + .02); g.add(door);
  const nw = 1 + Math.floor(r() * 3);
  for (let i = 0; i < nw; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(.55, .7), M.window);
    const side = r() < .6;
    if (side) win.position.set(-w / 2 + 1 + r() * (w - 2), h * .62, d / 2 + .03);
    else { win.position.set(w / 2 + .03, h * .62, -d / 2 + 1 + r() * (d - 2)); win.rotation.y = Math.PI / 2; }
    g.add(win);
  }
  return g;
}
function makeWell() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, .9, 14, 1, true), M.stone); ring.position.y = .45; ring.castShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.35, .14, 6, 16), M.stone); lip.rotation.x = Math.PI / 2; lip.position.y = .9;
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), M.bucketWater); water.rotation.x = -Math.PI / 2; water.position.y = .5;
  g.add(ring, lip, water);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 2.6, 6), M.wood); p.position.set(sx * 1.45, 1.3, 0); p.castShadow = true; g.add(p); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3.1, 6), M.wood); beam.rotation.z = Math.PI / 2; beam.position.y = 2.55; beam.castShadow = true; g.add(beam);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.4, 4), M.rope); rope.position.y = 1.85; g.add(rope);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(.2, .16, .3, 10), M.leather); bucket.position.y = 1.05; g.add(bucket);
  return g;
}
const BUCKET_GEO = new THREE.CylinderGeometry(.36, .29, .46, 14), BUCKET_WATER = new THREE.CircleGeometry(.32, 14);
function makeBucket() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(BUCKET_GEO, M.leather); b.position.y = .23; b.castShadow = true;
  const w = new THREE.Mesh(BUCKET_WATER, M.bucketWater); w.rotation.x = -Math.PI / 2; w.position.y = .42;
  g.add(b, w); return g;
}
const FLAME_GEO = new THREE.ConeGeometry(.3, 1.05, 7, 1, true); FLAME_GEO.translate(0, .52, 0);
const FLAME_OUT = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 1.9, .45), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
const FLAME_IN = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.5, 1.4), transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });

// ─────────── units ───────────
class CamelUnit {
  constructor(tpl, kind, idx) {
    this.tpl = tpl; this.idx = idx;
    this.geo = tpl.geo.clone();
    this.base = tpl.geo.attributes.position.array;
    this.arr = this.geo.attributes.position.array;
    this.mesh = new THREE.Mesh(this.geo, tpl.mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.body = new THREE.Group(); this.body.add(this.mesh);
    this.group = new THREE.Group(); this.group.add(this.body);
    this.phase = idx * 1.7; this.amp = 0; this.lantern = null;
    decorateCamel(this, kind, idx);
  }
  animate(speed, dt, time) {
    const A = .27;
    this.amp = lerp(this.amp, clamp(speed / 1.1, 0, 1), 1 - Math.exp(-dt * 5));
    this.phase += speed * dt / (this.tpl.legLen * A);
    const a = this.amp, T = this.tpl, O = this.base, P = this.arr;
    const aH = [], aK = [];
    for (let l = 0; l < 4; l++) {
      const ph = this.phase + (l % 2 ? Math.PI : 0) + (l >= 2 ? .3 : 0);
      aH[l] = A * a * Math.sin(ph); aK[l] = (l >= 2 ? .38 : .68) * a * Math.max(0, -Math.cos(ph));
    }
    const neck = .05 * a * Math.sin(this.phase * 2) + .035 * (1 - a) * Math.sin(time * .7 + this.idx * 2.1);
    const [ny, nz] = T.neck;
    // where leg l carries a point at (y, z): knee bend first, then the swing from the hip
    const legMove = (l, y, z, i) => {
      if (T.wk[i] > 0 && aK[l] > 0) {
        const ang = aK[l] * T.wk[i], c = Math.cos(ang), s = Math.sin(ang), ky = T.knee[l][0], kz = T.knee[l][1], dy = y - ky, dz = z - kz;
        y = ky + dy * c - dz * s; z = kz + dy * s + dz * c;
      }
      if (T.wh[i] > 0) {
        const ang = aH[l] * T.wh[i], c = Math.cos(ang), s = Math.sin(ang), hy = T.hip[l][0], hz = T.hip[l][1], dy = y - hy, dz = z - hz;
        y = hy + dy * c - dz * s; z = hz + dy * s + dz * c;
      }
      LM[0] = y; LM[1] = z;
    };
    const LM = [0, 0];
    for (let i = 0, n = T.la.length; i < n; i++) {
      const y0 = O[i * 3 + 1], z0 = O[i * 3 + 2];
      let y = y0, z = z0;
      if (T.la[i] >= 0) {
        legMove(T.la[i], y0, z0, i); y += (LM[0] - y0) * T.wa[i]; z += (LM[1] - z0) * T.wa[i];
        if (T.lb[i] >= 0) { legMove(T.lb[i], y0, z0, i); y += (LM[0] - y0) * T.wb[i]; z += (LM[1] - z0) * T.wb[i]; }
      } else if (T.wn[i] > 0) {
        const ang = neck * T.wn[i], c = Math.cos(ang), s = Math.sin(ang), dy = y - ny, dz = z - nz;
        y = ny + dy * c - dz * s; z = nz + dy * s + dz * c;
      }
      P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.body.position.y = .045 * a * Math.abs(Math.sin(this.phase));
    this.body.rotation.z = .03 * a * Math.sin(this.phase);
  }
}
const HORSE_COLORS = {
  bay: { Main: '#6b391c', Main_Light: '#8d5630', Main_Dark: '#3a1f10', Hair: '#17100b' },
  black: { Main: '#221b18', Main_Light: '#3b312b', Main_Dark: '#120e0c', Hair: '#0b0908' },
  grey: { Main: '#aaa498', Main_Light: '#cfc8ba', Main_Dark: '#7a746b', Hair: '#e9e3d6' },
  chestnut: { Main: '#8d4a21', Main_Light: '#ab6639', Main_Dark: '#5a2d13', Hair: '#c48b4f' },
  white: { Main: '#e2dccf', Main_Light: '#f1ece2', Main_Dark: '#bcb4a5', Hair: '#f4f0e7' },
  dun: { Main: '#8c6a45', Main_Light: '#a7875e', Main_Dark: '#5c4128', Hair: '#2a1d12' },
};
// clip speeds measured from hoof motion: Walk covers ~1.05 m/s and Gallop ~4.8 m/s at normal playback
const WALK_MS = 1.05, GALLOP_MS = 4.8, EAT_LOW = 2.8;
const REINS_MAT = new THREE.LineBasicMaterial({ color: '#2a1c12' }), REIN_V = new THREE.Vector3(), REIN_V2 = new THREE.Vector3(), REIN_V3 = new THREE.Vector3();
let RIDER_HANDS = null;
class HorseUnit {
  constructor(tpl, variant, rider, idx) {
    this.tpl = tpl;
    this.inst = SkeletonUtils.clone(tpl.root);
    this.inst.traverse(o => {
      if (o.isSkinnedMesh) { o.geometry = tpl.variants[variant]; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      if (o.isBone && o.name === 'Torso') this.torso = o;
      if (o.isBone && o.name === 'Back') this.back = o;
      if (o.isBone && o.name === 'Head') this.head = o;
    });
    this.inner = new THREE.Group(); this.inner.add(this.inst);
    this.inner.scale.setScalar(tpl.s); this.inner.rotation.y = tpl.yaw; this.inner.position.y = tpl.offY;
    this.group = new THREE.Group(); this.group.add(this.inner);
    this.mixer = new THREE.AnimationMixer(this.inst);
    this.actions = {};
    for (const n of ['Walk', 'Gallop', 'Idle', 'Eating', 'Idle_2']) {
      const c = THREE.AnimationClip.findByName(tpl.clips, n);
      if (c) this.actions[n] = this.mixer.clipAction(c);
    }
    this.cur = null; this.hold = null; this.speed = 0; this.gal = 0; this.look = 0;
    this.play('Idle', 0);
    this.mixer.update(idx * .37 % 2);
    const rg = rider === 'civil' ? tpl.civil : rider ? tpl.riders : null;
    this.rider = rg ? new THREE.Mesh(rg[idx % rg.length], VC_MAT) : null;
    if (this.rider) {
      this.rider.castShadow = true; this.rider.rotation.order = 'YXZ'; this.group.add(this.rider);
      // reins from the hands to both sides of the bit
      this.handSet = tpl.hands[rider === 'civil' ? 'civil' : 'soldier'];
      this.reins = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(15), 3)), REINS_MAT);
      this.reins.frustumCulled = false; this.group.add(this.reins);
    }
    this.idx = idx;
  }
  play(name, fade = .4) {
    const a = this.actions[name] || this.actions.Idle;
    if (this.cur === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.cur) this.cur.fadeOut(fade);
    this.cur = a;
  }
  setSpeed(v) {
    this.speed = v;
    if (v > 3.2) { this.play('Gallop'); this.cur.timeScale = clamp(v / GALLOP_MS, .75, 2); }
    else if (v > .3) { this.play('Walk'); this.cur.timeScale = clamp(v / WALK_MS, .5, 2.4); }
    else { this.play(this.hold || 'Idle'); this.cur.timeScale = 1; }
  }
  drink(on, t) {
    if (on) {
      const a = this.actions.Eating;
      if (this.cur !== a) this.play('Eating', .6);
      a.timeScale = 0;
      a.time = EAT_LOW + .18 * Math.sin(t * 1.7 + this.idx * 1.3);
    } else if (this.cur === this.actions.Eating) { this.cur.timeScale = 1; this.play('Idle', .6); }
  }
  update(dt) {
    this.mixer.update(dt);
    if (!this.rider && !this.noor) return;
    this.group.updateMatrixWorld(true);
    const tor = this.group.worldToLocal(this.torso.getWorldPosition(tmpV));
    // a family member's horse carries their light where the rider would sit
    if (this.noor) this.noor.group.position.set(tor.x, tor.y + 1.05, tor.z + .05);
    if (!this.rider) return;
    const bk = this.group.worldToLocal(this.back.getWorldPosition(tmpV2));
    this.rider.position.set(tor.x, tor.y + .25, tor.z + .05);
    // the rider rocks with the horse's back, leans into a gallop and looks around when standing
    const pitch = Math.atan2(tor.y - bk.y, Math.hypot(tor.x - bk.x, tor.z - bk.z)) - this.tpl.basePitch;
    const k = 1 - Math.exp(-dt * 3);
    this.gal = lerp(this.gal, this.speed > 4 ? 1 : 0, k);
    this.look = lerp(this.look, this.speed < .3 ? Math.sin(TIME * .21 + this.idx * 1.7) * .9 : 0, 1 - Math.exp(-dt * 1.2));
    this.rider.rotation.x = -pitch * .8;
    this.rider.rotation.z = .025 * Math.sin(TIME * 1.3 + this.idx) * (1 - this.gal);
    const mi = this.rider.morphTargetInfluences;
    mi[0] = this.gal; mi[1] = this.look;
    if (this.reins && this.tpl.mouthLocal) {
      this.rider.updateMatrix(); this.rider.updateMatrixWorld(true);
      const P = this.reins.geometry.attributes.position, [hb, hg] = this.handSet, two = this.handSet === this.tpl.hands.civil;
      const bit = this.head.localToWorld(REIN_V.copy(this.tpl.mouthLocal)); this.group.worldToLocal(bit);
      const hl = REIN_V2.copy(hb[0]).lerp(hg[0], this.gal).applyMatrix4(this.rider.matrix), hr = REIN_V3.copy(hb[1]).lerp(hg[1], this.gal).applyMatrix4(this.rider.matrix);
      const r = two ? hr : hl;
      P.setXYZ(0, bit.x - .07, bit.y, bit.z); P.setXYZ(1, hl.x, hl.y, hl.z); P.setXYZ(2, (hl.x + r.x) / 2, (hl.y + r.y) / 2 - .02, (hl.z + r.z) / 2); P.setXYZ(3, r.x, r.y, r.z); P.setXYZ(4, bit.x + .07, bit.y, bit.z);
      P.needsUpdate = true;
    }
  }
}

function setOnGround(g, x, z, heading, Hf) {
  const y = Hf(x, z), fx = Math.sin(heading), fz = Math.cos(heading);
  const pitch = Math.atan2(Hf(x - fx * 1.3, z - fz * 1.3) - Hf(x + fx * 1.3, z + fz * 1.3), 2.6);
  g.position.set(x, y, z);
  g.rotation.set(pitch, heading, 0, 'YXZ');
}

// ─────────── the massed vanguard: hundreds of lighter horsemen cresting the ridge ───────────
// Each coat colour is baked into a few static gallop poses plus a standing pose, drawn as instanced
// meshes and flipped like a flipbook, so ~300 riders cost about as much as a handful of detailed ones.
function bakeHorsePose(tpl, variant, clip, t) {
  const h = new HorseUnit(tpl, variant, false, 0);
  h.mixer.stopAllAction();
  const a = h.actions[clip]; a.reset().play(); a.time = t * a.getClip().duration;
  h.mixer.update(0);
  h.group.updateMatrixWorld(true);
  let mesh = null; h.inst.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
  const src = mesh.geometry, n = src.attributes.position.count, pos = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); h.group.worldToLocal(v); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(src.attributes.color.array), 3));
  g.computeVertexNormals();
  return { g, tor: h.group.worldToLocal(h.torso.getWorldPosition(new THREE.Vector3())) };
}
function simpleRider(tunic, turban) {
  const parts = [];
  const add = (geo, x, y, z, rx, col) => { geo.rotateX(rx); geo.translate(x, y, z); parts.push(colorize(onlyAttrs(geo, ['position', 'normal']), new THREE.Color(col))); };
  add(new THREE.CylinderGeometry(.19, .26, .7, 7), 0, .35, 0, .12, tunic);
  add(new THREE.CylinderGeometry(.07, .08, .6, 5), .24, -.18, .12, -.5, tunic);
  add(new THREE.CylinderGeometry(.07, .08, .6, 5), -.24, -.18, .12, -.5, tunic);
  add(new THREE.SphereGeometry(.12, 7, 5), 0, .8, .03, 0, '#7a5a3e');
  add(new THREE.SphereGeometry(.135, 7, 5, 0, TAU, 0, Math.PI / 2), 0, .84, .02, 0, turban);
  add(new THREE.CylinderGeometry(.018, .018, 3.2, 4), -.3, 1.25, .15, -.12, '#6a4a2c');
  add(new THREE.ConeGeometry(.04, .25, 4), -.3, 2.85, -.05, -.12, '#9aa0a8');
  return parts;
}
const MASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0 });
const MASS_POSES = [['Gallop', 0], ['Gallop', .25], ['Gallop', .5], ['Gallop', .75], ['Idle', .3]];
const MASS_COATS = [['bay', '#5b2420', '#e6dccb'], ['black', '#2b3050', '#e6dccb'], ['dun', '#6b5a3c', '#2a2a30'], ['chestnut', '#2a2826', '#d9c9a8']];
let MASS_GEOS = null;
function massGeos(tpl) {
  return MASS_GEOS || (MASS_GEOS = MASS_COATS.map(([coat, tunic, turban]) => MASS_POSES.map(([clip, t]) => {
    const { g, tor } = bakeHorsePose(tpl, coat, clip, t);
    return mergeGeometries([g, ...simpleRider(tunic, turban).map(p => p.translate(tor.x, tor.y + .25, tor.z + .05))]);
  })));
}
function buildMass(tpl, group) {
  const coats = MASS_COATS;
  const r = rng(314), items = [];
  for (let i = 0; i < 300; i++) {
    const left = r() < .5, fx = left ? -265 + r() * 205 : 65 + r() * 205, fz = -110 - r() * 40;
    items.push({ v: i % coats.length, fx, fz, sz: fz - 42 - r() * 14, delay: 3 + r() * 4, dur: 5 + r() * 1.5, ph: r(), yaw: (r() - .5) * .25 });
  }
  const perCoat = coats.map((_, v) => items.filter(it => it.v === v).length);
  const meshes = massGeos(tpl).map((poses, v) => poses.map(geo => {
    const im = new THREE.InstancedMesh(geo, MASS_MAT, perCoat[v]);
    im.count = 0; im.frustumCulled = false; im.receiveShadow = true;
    group.add(im);
    return im;
  }));
  return { items, meshes };
}
const massM4 = new THREE.Matrix4(), massQ = new THREE.Quaternion(), massE = new THREE.Euler(), massS = new THREE.Vector3(1, 1, 1);
function massUpdate(M, t, dt) {
  const counts = M.meshes.map(list => list.map(() => 0));
  for (const it of M.items) {
    const p = smooth(it.delay, it.delay + it.dur, t), moving = p > 0 && p < 1;
    const x = it.fx, z = lerp(it.sz, it.fz, p);
    const y = hSha(x, z) + (moving ? .05 * Math.abs(Math.sin(TIME * 9 + it.ph * 6)) : 0);
    const pose = moving ? Math.floor(((TIME * 3.2 + it.ph) % 1) * 4) : 4;
    massM4.compose(tmpV.set(x, y, z), massQ.setFromEuler(massE.set(0, it.yaw, 0)), massS);
    M.meshes[it.v][pose].setMatrixAt(counts[it.v][pose]++, massM4);
    if (moving && dt > 0 && Math.random() < dt * .35) DUST.emit(x, y + .5, z, (Math.random() - .5), 1.2, 1.5, 4 + Math.random() * 2, 3, 14 + Math.random() * 6, .4);
  }
  M.meshes.forEach((list, v) => list.forEach((im, p) => { im.count = counts[v][p]; im.instanceMatrix.needsUpdate = true; }));
}

// ─────────── world state ───────────
const SCENES = {};
let H = () => 0;
let curScene = null;
const caravan = { camels: [], horses: [], prevLead: null };
const army = [];
let TIME = 0;

// ─────────── scene: Medina (night) ───────────
const pathZMed = x => 3.5 * Math.sin(x * .021) - .05 * Math.max(0, x - 30);
function hMed(x, z) {
  let h = dunes(x, z, 11, .0062);
  const d = Math.hypot(x + 80, z * 1.1);
  h *= smooth(65, 180, d);
  if (x > -75) h *= .16 + .84 * smooth(9, 42, Math.abs(z - pathZMed(x)));
  return h + .35 * N.fbm(x * .03, z * .03, 2);
}
const pathSha = x => 4 * Math.sin(x * .012);
function hSha(x, z) {
  let h = dunes(x + 500, z + 300, 16, .0056);
  h *= .1 + .9 * smooth(14, 72, Math.abs(z - pathSha(x)));
  h += 17 * Math.exp(-Math.pow((z + 118) / 30, 2)) * (.78 + .22 * N.n2(x * .01, 3.3));
  h *= 1 - .75 * Math.exp(-Math.pow((z + 40) / 26, 2)) * smooth(150, 60, Math.abs(x - 5));
  return h + .3 * N.fbm(x * .03, z * .03, 2);
}
const zRiver = x => -232 + 16 * Math.sin(x * .0065) + 6 * Math.sin(x * .017 + 1);
function hKar(x, z) {
  let h = 1.4 * N.fbm(x * .008, z * .008, 3) + .35 * N.fbm(x * .04, z * .04, 2);
  const dr = z - zRiver(x);
  h -= 3.4 * Math.exp(-Math.pow(dr / 13, 2));
  h *= 1 - .7 * smooth(60, 10, Math.hypot(x, z - 0));
  return h;
}
function buildTerrain(hf, colf, size = 2200, seg = 280, ripple = .45) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), y = hf(x, z);
    P.setY(i, y); colf(x, z, y, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, normalMap: RIPPLE, normalScale: new THREE.Vector2(ripple, ripple) }));
  m.receiveShadow = true;
  return m;
}
function sandColor(x, z, y, c, amp) {
  c.copy(SAND.mid).lerp(SAND.light, clamp(y / amp, 0, 1) * .75);
  c.lerp(SAND.dark, clamp(.45 - N.fbm(x * .01, z * .01, 3), 0, 1) * .55);
  const g = N.fbm(x * .05 + 3, z * .05, 2);
  if (g > .32) c.lerp(SAND.gravel, (g - .32) * 1.1);
}

function buildMedina(T) {
  const group = new THREE.Group();
  group.add(buildTerrain(hMed, (x, z, y, c) => {
    sandColor(x, z, y, c, 11);
    const d = Math.hypot(x + 80, z * 1.1);
    c.lerp(SAND.earth, smooth(150, 70, d) * .7);
    const g = N.fbm(x * .04, z * .04 + 9, 3);
    if (d < 140 && g > .1) c.lerp(SAND.green, (g - .1) * 1.4 * smooth(140, 80, d));
  }, 2200, 280, .32));
  const r = rng(21);
  const houses = [];
  for (let i = 0; i < 22; i++) {
    const x = -175 + r() * 85, z = -70 + r() * 140;
    if (houses.some(h => Math.hypot(h[0] - x, h[1] - z) < 13)) continue;
    houses.push([x, z]);
    const h = makeHouse(r); h.position.set(x, hMed(x, z) - .2, z); h.rotation.y = Math.floor(r() * 4) * Math.PI / 2 + (r() - .5) * .2; group.add(h);
  }
  const palms = [];
  for (let i = 0; i < 400 && palms.length < 70; i++) {
    const a = r() * TAU, d = 20 + Math.sqrt(r()) * 110, x = -80 + Math.cos(a) * d, z = Math.sin(a) * d * .9;
    if (houses.some(h => Math.abs(h[0] - x) < 9 && Math.abs(h[1] - z) < 9)) continue;
    if (x > -60 && Math.abs(z - pathZMed(x)) < 8) continue;
    if (x > -30 && x < 30 && z > 4 && z < 24) continue;
    palms.push({ x, y: hMed(x, z) - .2, z, s: 8 + r() * 5, ry: r() * TAU, rz: (r() - .5) * .12 });
  }
  for (let i = 0; i < 8; i++) { const x = -50 + i * 9 + r() * 4, s = r() < .5 ? 1 : -1, z = pathZMed(x) + s * (10 + r() * 6); if (s > 0 && x > -30) continue; palms.push({ x, y: hMed(x, z) - .2, z, s: 8 + r() * 4, ry: r() * TAU }); }
  group.add(instanced(T.palmA, palms.filter((_, i) => i % 2 === 0)));
  group.add(instanced(T.palmB, palms.filter((_, i) => i % 2 === 1)));
  const medSpots = flatSpots(hMed, 6, [-20, 420, -220, 220], (x, z) => Math.abs(z - pathZMed(x)) < 14 || Math.hypot(x + 80, z * 1.1) < 150, r);
  const medRocks = outcrops(medSpots, hMed, r);
  group.add(instanced(T.rockA, medRocks.filter((_, i) => i % 2)));
  group.add(instanced(T.rockB, medRocks.filter((_, i) => !(i % 2))));
  group.add(tufts(medSpots, hMed, r, 7));
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 16 }, (_, i) => { const x = -75 + i * 20; return new THREE.Vector3(x, 0, pathZMed(x)); }));
  return { group, h: hMed, path };
}
function buildSharaf(T) {
  const group = new THREE.Group();
  group.add(buildTerrain(hSha, (x, z, y, c) => sandColor(x, z, y, c, 22)));
  const r = rng(33);
  const avoidSha = (x, z) => Math.abs(z - pathSha(x)) < 14 || (x > -80 && x < 90 && z > -210 && z < 5) || (x > 5 && x < 45 && z > 0 && z < 32);
  const shaSpots = flatSpots(hSha, 10, [-320, 320, -330, 140], avoidSha, r);
  const rocks = outcrops(shaSpots, hSha, r), big = [];
  const valley = [];
  for (let i = 0; i < 80; i++) { const x = -240 + r() * 300, z = pathSha(x) + (r() < .5 ? 1 : -1) * (15 + r() * 32); if (!avoidSha(x, z)) valley.push([x, z]); }
  for (let i = 0; i < 8; i++) { const a = r() * TAU, d = 260 + r() * 200, x = Math.cos(a) * d, z = Math.sin(a) * d; big.push({ x, y: hSha(x, z) - 1, z, s: 10 + r() * 16, ry: r() * TAU }); }
  group.add(instanced(T.rockA, rocks.filter((_, i) => i % 2)));
  group.add(instanced(T.rockB, rocks.filter((_, i) => !(i % 2))));
  group.add(instanced(T.rockC, big));
  group.add(tufts(shaSpots, hSha, r, 6, valley));
  // Sharaf was a watering station: a few palms and scrub around its wells
  const wellPalms = [];
  for (let i = 0; i < 14 && wellPalms.length < 7; i++) { const a = r() * TAU, d = 9 + r() * 12, x = 27 + Math.cos(a) * d, z = 16 + Math.sin(a) * d * .8; if (z < 9) continue; wellPalms.push({ x, y: hSha(x, z) - .2, z, s: 7 + r() * 4, ry: r() * TAU, rz: (r() - .5) * .12 }); }
  group.add(instanced(T.palmB, wellPalms));
  group.add(tufts([[27, 16]], hSha, r, 26));
  // weathered mesas along the far skyline
  const mesas = [];
  for (let i = 0; i < 12; i++) { const x = -700 + i * 125 + (r() - .5) * 60, z = -540 - r() * 160; mesas.push({ x, y: hSha(x, z) - 6, z, s: 70 + r() * 60, sy: 16 + r() * 14, ry: r() * TAU }); }
  group.add(instanced(T.rockC, mesas));
  [[22, 9], [31, 14], [24, 21]].forEach(([x, z]) => { const w = makeWell(); w.position.set(x, hSha(x, z), z); w.rotation.y = r() * TAU; group.add(w); });
  const buckets = [];
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 14 }, (_, i) => { const x = -230 + i * 22; return new THREE.Vector3(x, 0, pathSha(x)); }));
  return { group, h: hSha, path, buckets };
}
// the river: silty water, darker in the channel and lighter over the shallows, with a slow current of streaks
const RIVER_N = (() => {
  const r = rng(17), W = Array.from({ length: 16 }, () => [1 + Math.floor(r() * 7), Math.floor(r() * 9) - 4, r() * TAU, .4 + r() * .6]);
  const t = normalTex(256, (x, y) => W.reduce((a, [kx, ky, ph, amp]) => a + amp / Math.hypot(kx, ky) * Math.sin((kx * x + ky * y) / 256 * TAU + ph), 0), 2.4);
  t.repeat.set(90, 9); return t;
})();
const RIVER_FLOW = { value: new THREE.Vector2() };
const STREAK_TEX = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d'), r = rng(9);
  for (let i = 0; i < 90; i++) { const x = r() * 512, y = 6 + r() * 52, L = 30 + r() * 110; g.fillStyle = `rgba(255,255,255,${.08 + r() * .3})`; g.beginPath(); g.ellipse(x, y, L / 2, .6 + r() * 1.1, 0, 0, TAU); g.fill(); if (x + L / 2 > 512) { g.beginPath(); g.ellipse(x - 512, y, L / 2, 1, 0, 0, TAU); g.fill(); } }
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.3, 'rgba(0,0,0,1)'); gr.addColorStop(.7, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
})();
function buildRiver(group, zc, len = 1500) {
  const g = new THREE.PlaneGeometry(len, 160, 300, 40); g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(), deep = new THREE.Color('#15302a'), shallow = new THREE.Color('#687050'), band = new THREE.Color('#a39c80');
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), d = Math.abs(P.getZ(i) - 232 - zc(x)), sed = N.fbm(x * .008, 3.1, 2);
    c.copy(deep).lerp(shallow, smooth(2, 10, d)).lerp(band, smooth(7.5, 9.5, d) * (1 - smooth(10, 12.5, d)) * .55).multiplyScalar(1 + .14 * sed);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .26, metalness: 0, normalMap: RIVER_N, normalScale: new THREE.Vector2(.3, .3), envMapIntensity: .55 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFlow = RIVER_FLOW;
    sh.fragmentShader = 'uniform vec2 uFlow;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP_TANGENTSPACE
      vec3 n1 = texture2D( normalMap, vNormalMapUv + vec2( uFlow.x, 0.0 ) ).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D( normalMap, vNormalMapUv * 2.3 + vec2( uFlow.y, uFlow.y * 0.4 ) ).xyz * 2.0 - 1.0;
      vec3 mapN = normalize( vec3( n1.xy + n2.xy * 0.6, n1.z ) );
      mapN.xy *= normalScale;
      normal = normalize( tbn * mapN );
    #endif`);
  };
  const m = new THREE.Mesh(g, mat);
  m.position.set(0, -1.35, -232); m.receiveShadow = true; group.add(m);
  const n = Math.round(len / 5), pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) { const x = -len / 2 + i * 5, z = zc(x); pos.push(x, -1.31, z - 8, x, -1.31, z + 8); uv.push(x / 45, 0, x / 45, 1); if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx);
  group.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: STREAK_TEX, transparent: true, depthWrite: false, opacity: .16, color: '#dfe6da' })));
}
function buildKarbala(T) {
  const group = new THREE.Group();
  group.add(buildTerrain(hKar, (x, z, y, c) => {
    sandColor(x, z, y, c, 3);
    c.lerp(SAND.earth, .25);
    const dr = Math.abs(z - zRiver(x));
    c.lerp(SAND.wet, smooth(30, 8, dr) * .8);
    const g = N.fbm(x * .03, z * .03, 3);
    if (dr < 55 && g > 0) c.lerp(SAND.reed, smooth(55, 20, dr) * .7);
  }, 2200, 280, .14));
  buildRiver(group, zRiver);
  const r = rng(45);
  const palms = [], reeds = [];
  for (let i = 0; i < 110; i++) { const x = -600 + r() * 1200, z = zRiver(x) - 18 - r() * 70; palms.push({ x, y: hKar(x, z) - .2, z, s: 8 + r() * 6, ry: r() * TAU, rz: (r() - .5) * .15 }); }
  for (let i = 0; i < 24; i++) { const x = -500 + r() * 1000, z = zRiver(x) + 16 + r() * 18; palms.push({ x, y: hKar(x, z) - .2, z, s: 8 + r() * 5, ry: r() * TAU }); }
  group.add(instanced(T.palmA, palms.filter((_, i) => i % 2)));
  group.add(instanced(T.palmB, palms.filter((_, i) => !(i % 2))));
  const reedGeo = new THREE.ConeGeometry(.07, 1.8, 4); reedGeo.translate(0, .9, 0);
  const reedIM = new THREE.InstancedMesh(reedGeo, M.reed, 1400);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 1400; i++) {
    const x = -700 + r() * 1400, side = r() < .5 ? 1 : -1, z = zRiver(x) + side * (7 + r() * 9);
    q.setFromEuler(e.set((r() - .5) * .4, 0, (r() - .5) * .4));
    m4.compose(tmpV.set(x, hKar(x, z) - .1, z), q, tmpV2.setScalar(.6 + r() * .9)); reedIM.setMatrixAt(i, m4);
  }
  reedIM.castShadow = true; group.add(reedIM);

  // camp of Imam Hussain (AS)
  const camp = new THREE.Group(); group.add(camp);
  const tents = [];
  const angles = [200, 218, 236, 253, 270, 287, 304, 322, 340];
  angles.forEach((deg, i) => {
    const a = deg * Math.PI / 180, big = i === 4, R = big ? 24 : 27;
    const x = Math.cos(a) * R, z = 6 + Math.sin(a) * R * .85;
    const t = makeTent(big ? 11 : 7.5 + r() * 1.5, big ? 6 : 4.8, big ? 3.1 : 2.5, big);
    t.group.position.set(x, hKar(x, z), z); t.group.rotation.y = Math.atan2(-x, 6 - z);
    t.th = i / angles.length; camp.add(t.group); tents.push(t);
  });
  const alam = new THREE.Group(); alam.position.set(0, hKar(0, -34), -34); camp.add(alam);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, 9.5, 8), M.darkWood); pole.position.y = 4.75; pole.castShadow = true; alam.add(pole);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), M.gold); fin.position.y = 9.6; alam.add(fin);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.12, .5, 8), M.gold); tip.position.y = 10; alam.add(tip);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7, 26, 12), M.banner); flag.geometry.translate(1.3, 0, 0);
  flag.position.set(.08, 8.4, 0); flag.castShadow = true; alam.add(flag);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.6, .8, .5, 10), M.stone); base.position.y = .25; alam.add(base);
  const lampPos = [];
  const LR = rng(72);
  for (let i = 0; i < 72; i++) {
    let x, z;
    if (i < 45) { const a = (200 + LR() * 140) * Math.PI / 180, R = 17 + LR() * 6; x = Math.cos(a) * R; z = 6 + Math.sin(a) * R * .85; }
    else { const a = LR() * TAU, R = 4 + LR() * 12; x = Math.cos(a) * R; z = 2 + Math.sin(a) * R * .7; }
    lampPos.push(x, hKar(x, z) + .22, z);
  }
  const lamps = new GlowPoints(lampPos, new THREE.Color(2.4, 1.3, .45), .42);
  lamps.th = Array.from({ length: 72 }, () => LR());
  camp.add(lamps.points);
  const campLight = new THREE.PointLight('#ffae5c', 0, 70, 1.6); campLight.position.set(0, 5, -6); camp.add(campLight);

  // enemy camp
  const enemy = new THREE.Group(); group.add(enemy);
  const pos = [];
  for (let i = 0; i < 400 && pos.length < 80; i++) {
    const x = -280 + r() * 560, z = -195 + r() * 78;
    if (pos.some(p => Math.hypot(p[0] - x, p[1] - z) < 9)) continue;
    pos.push([x, z, r()]);
  }
  const wallG = new THREE.CylinderGeometry(2.3, 2.4, 1.9, 10, 1, true); wallG.translate(0, .95, 0);
  const roofG = new THREE.ConeGeometry(2.75, 2.4, 10); roofG.translate(0, 3.1, 0);
  const walls = new THREE.InstancedMesh(wallG, M.enemyWall, pos.length), roofs = new THREE.InstancedMesh(roofG, M.enemyRoof, pos.length);
  const rc = [new THREE.Color('#7e2a22'), new THREE.Color('#d8ccb1'), new THREE.Color('#3a2c26')];
  pos.forEach(([x, z, k], i) => {
    const s = .8 + k * .5;
    m4.compose(tmpV.set(x, hKar(x, z) - .1, z), q.identity(), tmpV2.setScalar(s));
    walls.setMatrixAt(i, m4); roofs.setMatrixAt(i, m4); roofs.setColorAt(i, rc[Math.floor(k * 3)]);
  });
  walls.castShadow = roofs.castShadow = true; walls.receiveShadow = roofs.receiveShadow = true;
  enemy.add(walls, roofs);
  for (let i = 0; i < 7; i++) {
    const [x, z] = pos[i * 9 % pos.length];
    const bp = new THREE.Group(); bp.position.set(x + 3.5, hKar(x + 3.5, z), z);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 8, 6), M.darkWood); p2.position.y = 4; bp.add(p2);
    const f2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4, 20, 8), M.enemyBanner); f2.geometry.translate(1.1, 0, 0); f2.position.y = 7; bp.add(f2);
    enemy.add(bp);
  }
  const fires = [];
  const fireSpots = [];
  for (let i = 0; i < 16; i++) { const x = -240 + i * 32 + r() * 10, z = -118 - r() * 60; fireSpots.push([x, z]); }
  fireSpots.forEach(([x, z], i) => {
    const f = new THREE.Group(); f.position.set(x, hKar(x, z), z);
    const pit = T.firepit.clone(); pit.scale.setScalar(1.7); f.add(pit);
    const fl = [];
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(FLAME_GEO, k ? FLAME_OUT : FLAME_IN); m.position.set((k - 1) * .22, .15, (k % 2) * .18); m.scale.setScalar(k ? 1 : .7); f.add(m); fl.push(m); }
    f.userData = { fl, seed: i * 1.7 };
    if (i % 4 === 1) { const L = new THREE.PointLight('#ff8a3a', 60, 45, 1.8); L.position.y = 1.6; f.add(L); f.userData.light = L; }
    enemy.add(f); fires.push(f);
  });
  const path = new THREE.CatmullRomCurve3([[240, 110], [190, 86], [140, 64], [95, 44], [58, 30], [30, 20], [14, 14]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return { group, h: hKar, path, tents, alam, flag, lamps, campLight, enemy, fires, camp };
}

// ─────────── shots ───────────
class Shot {
  constructor(pos, look, dur) {
    this.pc = new THREE.CatmullRomCurve3(pos.map(p => new THREE.Vector3(...p)));
    this.lc = new THREE.CatmullRomCurve3(look.map(p => new THREE.Vector3(...p)));
    this.dur = dur;
  }
  apply(t) {
    const u = ease(clamp(t / this.dur, 0, 1));
    this.pc.getPoint(u, camera.position);
    this.lc.getPoint(u, focus);
    camera.position.y += H(camera.position.x, camera.position.z);
    focus.y += H(focus.x, focus.z);
    const hx = REDUCE ? 0 : Math.sin(TIME * .6) * .06, hy = REDUCE ? 0 : Math.sin(TIME * .83 + 1) * .04;
    camera.position.x += hx; camera.position.y += hy;
    camera.lookAt(focus);
  }
}
const focus = new THREE.Vector3();

// ─────────── caravan & army control ───────────
const CAMEL_SPACING = 7.4;
function poseOnPath(g, path, s, lateral, Hf) {
  const L = path.getLength(), u = clamp(s / L, 0, 1);
  path.getPointAt(u, tmpV); path.getTangentAt(u, tmpV2);
  const heading = Math.atan2(tmpV2.x, tmpV2.z);
  setOnGround(g, tmpV.x + tmpV2.z * lateral, tmpV.z - tmpV2.x * lateral, heading, Hf);
}
// Chapter 7: the first camel carries Imam Zayn al-ʿAbidin instead of a howdah
function captiveOrder(on) { const c = caravan.camels[0]; if (c && c.alt) { c.top.visible = !on; c.alt.visible = on; } }
function resetCaravan() {
  caravan.prevLead = null;
  captiveOrder(false);
  const z0 = caravan.camels[2] && caravan.camels[2].noor; if (z0) { z0.group.scale.setScalar(1); z0.group.position.y = 2.05; }
  const h0 = caravan.horses[0] && caravan.horses[0].noor; if (h0) h0.group.visible = true;
  caravan.camels.forEach(c => { c.prevS = undefined; });
  caravan.horses.forEach(h => { h.prevS = undefined; });
}
// each animal keeps a loose, slowly drifting spacing and computes its own speed, so legs always match its own motion
function caravanUpdate(path, lead, dt, visible = 1) {
  lead = Math.min(lead, path.getLength());
  if (caravan.standard) caravan.standard.visible = curScene !== 'karbala' || caravan.standardOn;
  const leadV = caravan.prevLead === null || dt <= 0 ? 0 : Math.abs(lead - caravan.prevLead) / dt;
  caravan.prevLead = lead;
  caravan.wob = lerp(caravan.wob || 0, clamp(leadV / 1.4, 0, 1), 1 - Math.exp(-dt * 2));
  const w = caravan.wob;
  const place = (u, s, lat) => {
    const sp = u.prevS === undefined || dt <= 0 ? 0 : Math.abs(s - u.prevS) / dt;
    u.prevS = s;
    u.group.visible = visible > .01;
    poseOnPath(u.group, path, s, lat, H);
    return sp;
  };
  caravan.camels.forEach((c, i) => {
    const s = lead - 10 - i * CAMEL_SPACING + (i ? .8 * w * Math.sin(TIME * .31 + i * 1.9) : 0);
    c.animate(place(c, s, .35 * w * Math.sin(TIME * .21 + i * 2.3)), dt, TIME);
  });
  // horses: 0 Imam Hussain (white) and 1 al-ʿAbbas (the standard) ride at the head; 2 and 3 beside the camels
  caravan.horses.forEach((h, k) => {
    const s = k < 2 ? lead - (k ? 0 : 5.4) + .4 * w * Math.sin(TIME * .23 + k) : lead - 10 - ((k - 1) * 2 + 1) * CAMEL_SPACING + 1.2 + .7 * w * Math.sin(TIME * .27 + k * 2.7);
    const lat = k < 2 ? (k ? .3 : -1.4) + .2 * w * Math.sin(TIME * .17 + k) : (k % 2 ? -1 : 1) * (2.9 + .3 * Math.sin(TIME * .19 + k));
    h.setSpeed(place(h, s, lat));
    h.update(dt);
  });
}
function caravanLamps(on) {
  M.caravanLamp.emissiveIntensity = 3.4 * on;
  caravanLights.forEach(l => { l.intensity = 26 * on; });
}
let caravanLights = [];
function walkStop(t, s0, s1, v = 1.3, Td = 2.5) {
  const tau = (s1 - s0) / v + Td / 2 - t;
  return s1 - (tau >= Td ? v * (tau - Td / 2) : tau > 0 ? v * tau * tau / (2 * Td) : 0);
}
function travel(D, v, dd, t) {
  if (t <= 0) return { d: 0, v };
  const t1 = (D - dd) / v;
  if (t < t1) return { d: v * t, v };
  const T2 = 2 * dd / v, tt = t - t1;
  if (tt < T2) { const vv = v * (1 - tt / T2); return { d: D - dd + (v + vv) / 2 * tt, v: vv }; }
  return { d: D, v: 0 };
}
function armyShow(n) { army.forEach((a, i) => { a.group.visible = i < n; a.hold = null; a.patrol = null; if (a.rider) a.rider.visible = true; if (a.actions.Eating) a.actions.Eating.timeScale = 1; }); }

// ═══════════ Chapters 2 and 3: new light, people, places and scenes ═══════════

// ─────────── extra light settings ───────────
function addEnv(name, v) {
  const e = { ...v };
  COLOR_KEYS.forEach(c => { e[c] = new THREE.Color(v[c]); });
  e.dir = new THREE.Vector3(...v.dir).normalize();
  ENV[name] = e;
}
addEnv('afternoon', { top: '#5a8fce', horizon: '#f2d9b0', bottom: '#cfa06a', sun: '#ffe2b8', key: '#ffe4bd', keyI: 3, dir: [-.62, .48, .5], hemiS: '#c3d6ee', hemiG: '#c99a60', hemiI: .85, fillI: .35, fog: '#e9d6b6', fogD: .0015, stars: 0, moon: 0, exposure: .92, glow: 1, disk: 1, envI: .7, bloomT: 2.2, bloomS: .22 });
addEnv('evening', { top: '#2b3d78', horizon: '#f0a070', bottom: '#6a4636', sun: '#ffb070', key: '#ffb47a', keyI: 1.9, dir: [-.78, .13, .6], hemiS: '#6f7cb4', hemiG: '#7d5040', hemiI: .75, fillI: .6, fog: '#a57a70', fogD: .0022, stars: .2, moon: 0, exposure: 1.02, glow: 1.2, disk: 1, envI: .6, bloomT: .95, bloomS: .55 });
addEnv('dawn', { top: '#34497f', horizon: '#f5b69a', bottom: '#7a5a58', sun: '#ffc6a0', key: '#ffc8a4', keyI: 1.7, dir: [.2, .1, -.95], hemiS: '#8a93c2', hemiG: '#80605a', hemiI: .85, fillI: .6, fog: '#b89090', fogD: .0024, stars: .25, moon: 0, exposure: 1.05, glow: 1.2, disk: 1, envI: .6, bloomT: .95, bloomS: .5 });
addEnv('noon', { top: '#3b78c6', horizon: '#d6dde0', bottom: '#d8b07a', sun: '#fff4e0', key: '#fff2dc', keyI: 3.2, dir: [.3, .85, .4], hemiS: '#cfe0f2', hemiG: '#d6a86c', hemiI: .85, fillI: .3, fog: '#d9d2bf', fogD: .0008, stars: 0, moon: 0, exposure: .8, glow: .8, disk: 1, envI: .7, bloomT: 2.4, bloomS: .2 });

// ─────────── small geometry helpers ───────────
const fmt = n => n.toLocaleString('en-US');
const VC_FLAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0, flatShading: true });
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function part(geo, m, col) { geo.applyMatrix4(m); return colorize(onlyAttrs(geo, ['position', 'normal']), new THREE.Color(col)); }
function place(im, i, x, y, z, ry, sx, sy = sx, sz = sx, rx = 0, rz = 0) { im.setMatrixAt(i, M4(x, y, z, rx, ry, rz, sx, sy, sz)); }

// ─────────── people: a light robed figure with a baked walk cycle, for crowds ───────────
// pose 0..5 are walk frames, pose 6 is standing
function robedGeo(pose, look) {
  const parts = [], walking = pose < 6, sw = walking ? Math.sin(pose / 6 * TAU) : 0;
  for (const side of [-1, 1]) {
    const a = .42 * sw * side;
    const leg = new THREE.CylinderGeometry(.055, .045, .8, 5); leg.translate(0, -.4, 0);
    parts.push(part(leg, M4(side * .09, .8, 0, a), look.legs || '#6b5236'));
    const foot = new THREE.BoxGeometry(.09, .06, .2); foot.translate(0, -.8, .04);
    parts.push(part(foot, M4(side * .09, .8, 0, a), '#3a2a1c'));
    const arm = new THREE.CylinderGeometry(.055, .05, .56, 5); arm.translate(0, -.28, 0);
    parts.push(part(arm, M4(side * .22, 1.38, 0, -a * .8, 0, side * .08), look.robe));
    const hand = new THREE.SphereGeometry(.045, 5, 4); hand.translate(0, -.58, 0);
    parts.push(part(hand, M4(side * .22, 1.38, 0, -a * .8, 0, side * .08), look.skin));
  }
  parts.push(part(new THREE.CylinderGeometry(.16, .28, 1.05, 8), M4(0, .87, 0), look.robe));
  parts.push(part(new THREE.SphereGeometry(.2, 8, 5), M4(0, 1.33, 0, 0, 0, 0, 1.1, .55, .8), look.robe));
  if (look.belt) parts.push(part(new THREE.CylinderGeometry(.2, .2, .06, 8), M4(0, .98, 0), look.belt));
  parts.push(part(new THREE.SphereGeometry(.105, 8, 6), M4(0, 1.56, .01), look.skin));
  if (look.head === 'turban') {
    parts.push(part(new THREE.SphereGeometry(.12, 8, 5, 0, TAU, 0, Math.PI / 2), M4(0, 1.6, 0), look.cover));
    parts.push(part(new THREE.TorusGeometry(.105, .04, 5, 10), M4(0, 1.6, 0, Math.PI / 2), look.cover));
  } else if (look.head === 'shawl') {
    parts.push(part(new THREE.SphereGeometry(.13, 8, 6, 0, TAU, 0, Math.PI * .62), M4(0, 1.56, -.01), look.cover));
    parts.push(part(new THREE.BoxGeometry(.24, .34, .02), M4(0, 1.42, -.1, .12), look.cover));
  } else {
    parts.push(part(new THREE.SphereGeometry(.11, 8, 5, 0, TAU, 0, Math.PI / 2), M4(0, 1.575, -.005), '#1d1612'));
  }
  const g = mergeGeometries(parts); g.computeVertexNormals();
  return g;
}
class Crowd {
  constructor(group, looks, capacity) {
    this.meshes = looks.map(look => Array.from({ length: 7 }, (_, p) => {
      const im = new THREE.InstancedMesh(robedGeo(p, look), VC_FLAT, capacity);
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      group.add(im); return im;
    }));
    this.items = [];
    this.nLooks = looks.length;
  }
  add(item) { item.look = item.look ?? (this.items.length % this.nLooks); item.ph = item.ph ?? Math.random(); this.items.push(item); }
  // each item.at(t) returns [x, z, heading, speed]; hidden when it returns null
  update(t, Hf) {
    const counts = this.meshes.map(l => l.map(() => 0));
    for (const it of this.items) {
      const r = it.at(t); if (!r) continue;
      const [x, z, hd, sp] = r;
      const pose = sp > .15 ? Math.floor(((t * sp / 1.25 + it.ph) % 1 + 1) % 1 * 6) : 6;
      const s = it.scale || 1;
      place(this.meshes[it.look][pose], counts[it.look][pose]++, x, Hf(x, z), z, hd, s);
    }
    this.meshes.forEach((l, v) => l.forEach((im, p) => { im.count = counts[v][p]; im.instanceMatrix.needsUpdate = true; }));
  }
}
const LOOKS = {
  pilgrims: [
    { robe: '#f3f0e8', skin: '#8a6446', legs: '#8a6446', head: 'bare' },
    { robe: '#ece8de', skin: '#6e4c34', legs: '#6e4c34', head: 'bare' },
    { robe: '#f6f3ec', skin: '#a07656', legs: '#a07656', head: 'bare' },
  ],
  kufans: [
    { robe: '#d9cdb4', skin: '#8a6446', head: 'turban', cover: '#f0ebe0', belt: '#6b4a2c' },
    { robe: '#5d4a3a', skin: '#7a5a3e', head: 'turban', cover: '#2a2522' },
    { robe: '#3d4a66', skin: '#8a6446', head: 'turban', cover: '#e8e2d4', belt: '#8a6a3a' },
    { robe: '#8a6d4a', skin: '#6e4c34', head: 'shawl', cover: '#c9b99a' },
    { robe: '#2f2a28', skin: '#7a5a3e', head: 'shawl', cover: '#4a3f38' },
  ],
  guards: [{ robe: '#5a1d18', skin: '#7a5a3e', head: 'turban', cover: '#1f1a18', belt: '#9aa0a8' }],
};

// ─────────── letters: each courier's bundle hops from the saddle onto a heap that grows bottom-up ───────────
class Letters {
  constructor(group, at, deliveries, preload, seed) {
    const r = rng(seed);
    const scroll = mergeGeometries([
      part(new THREE.CylinderGeometry(.035, .035, .3, 6), M4(0, 0, 0, 0, 0, Math.PI / 2), '#efe2bf'),
      part(new THREE.CylinderGeometry(.038, .038, .04, 6), M4(0, 0, 0, 0, 0, Math.PI / 2), '#8e2a22'),
    ]);
    const total = preload + deliveries.reduce((a, d) => a + d.n, 0);
    this.pile = new THREE.InstancedMesh(scroll, VC_FLAT, total); this.pile.count = 0; this.pile.castShadow = this.pile.receiveShadow = true;
    this.im = new THREE.InstancedMesh(scroll, VC_FLAT, 40); this.im.count = 0; this.im.frustumCulled = false; this.im.castShadow = true;
    group.add(this.pile, this.im);
    this.spots = Array.from({ length: total }, (_, i) => {
      const h = Math.pow(i / total, 1.25) * .95, R = 1.35 * (1 - h / 1.1) * Math.sqrt(r()), a = r() * TAU;
      return [at[0] + Math.cos(a) * R, at[1] + .05 + h, at[2] + Math.sin(a) * R, r() * TAU, (r() - .5) * .5];
    });
    this.items = []; let k = preload;
    deliveries.forEach(d => { for (let j = 0; j < d.n; j++) this.items.push({ i: k++, t0: d.t + j * .09, from: [d.from[0] + (r() - .5) * .5, d.from[1], d.from[2] + (r() - .5) * .5], turn: (r() - .5) * 2 }); });
    this.preload = preload; this.total = total;
  }
  update(t) {
    let landed = this.preload, f = 0;
    for (const it of this.items) {
      const u = (t - it.t0) / .8;
      if (u >= 1) { landed++; continue; }
      if (u <= 0 || f >= 40) continue;
      const [sx, sy, sz] = it.from, [ex, ey, ez, ry, tilt] = this.spots[it.i], e = u * u * (3 - 2 * u);
      this.im.setMatrixAt(f++, M4(lerp(sx, ex, e), lerp(sy, ey, e) + Math.sin(Math.PI * u) * 1.1, lerp(sz, ez, e), 0, ry + it.turn * (1 - e), tilt * e, 1.6));
    }
    this.im.count = f; this.im.instanceMatrix.needsUpdate = true;
    for (let i = this.pile.count; i < landed; i++) { const [x, y, z, ry, tilt] = this.spots[i]; this.pile.setMatrixAt(i, M4(x, y, z, 0, ry, tilt, 1.6)); }
    if (landed !== this.pile.count) { this.pile.count = landed; this.pile.instanceMatrix.needsUpdate = true; }
    return landed / this.total;
  }
}
// a letter on a rod that unrolls downwards; the wrapped part curls around a small roll
function letterTexture() {
  const W = 512, Hh = 720;
  return canvasTex(W, Hh, (g) => {
    const draw = () => {
      const gr = g.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, '#efe1bd'); gr.addColorStop(1, '#e0cb99'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      const r = rng(4);
      for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(120,80,30,${r() * .05})`; g.beginPath(); g.arc(r() * W, r() * Hh, 10 + r() * 60, 0, TAU); g.fill(); }
      const eg = g.createRadialGradient(W / 2, Hh / 2, Hh * .3, W / 2, Hh / 2, Hh * .75); eg.addColorStop(0, 'rgba(90,60,20,0)'); eg.addColorStop(1, 'rgba(90,60,20,.38)'); g.fillStyle = eg; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#3a2716'; g.direction = 'rtl'; g.textAlign = 'center'; g.font = '36px Amiri, serif';
      g.fillText('بسم الله الرحمن الرحيم', W / 2, 78);
      g.font = '31px Amiri, serif'; g.textAlign = 'right';
      const words = 'أمّا بعد، فقد اخضرّ الجَناب، وأينعت الثمار، وطمّت الجِمام، فإذا شئتَ فأقبِلْ على جُندٍ لك مُجنَّد، والسلام عليك.'.split(' ');
      let line = '', y = 150;
      for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > W - 90 && line) { g.fillText(line, W - 45, y); line = w; y += 56; } else line = test; }
      g.fillText(line, W - 45, y);
      g.font = '24px Amiri, serif'; g.fillStyle = '#5a4128'; g.textAlign = 'center';
      g.fillText('شبث بن ربعي · حجار بن أبجر · عمرو بن الحجاج', W / 2, Hh - 70);
    };
    draw();
    if (document.fonts) document.fonts.load('31px Amiri').then(() => { draw(); if (LETTER_TEX) LETTER_TEX.needsUpdate = true; }).catch(() => {});
  });
}
let LETTER_TEX = null;
class Parchment {
  constructor(w = .66, h = .92) {
    this.h = h; this.r = .03;
    const geo = new THREE.PlaneGeometry(w, h, 1, 90); geo.translate(0, -h / 2, 0);
    this.base = geo.attributes.position.array.slice();
    LETTER_TEX = LETTER_TEX || letterTexture();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: LETTER_TEX, roughness: .85, side: THREE.DoubleSide }));
    this.mesh.castShadow = true;
    this.group = new THREE.Group(); this.group.add(this.mesh);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, w + .1, 8), M.darkWood); rod.rotation.z = Math.PI / 2; this.group.add(rod);
    for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(.024, 8, 6), M.gold); k.position.x = s * (w / 2 + .05); this.group.add(k); }
    this.roll = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, w + .004, 18), new THREE.MeshStandardMaterial({ color: '#e4d1a2', roughness: .9 }));
    this.roll.rotation.z = Math.PI / 2; this.group.add(this.roll);
    this.set(0);
  }
  set(k) {
    const L = Math.max(.001, k * this.h), P = this.mesh.geometry.attributes.position, B = this.base, r = this.r, rest = this.h - L;
    for (let i = 0; i < P.count; i++) {
      const x = B[i * 3], d = -B[i * 3 + 1];
      if (d <= L) P.setXYZ(i, x, -d, 0);
      else { const a = (d - L) / r; P.setXYZ(i, x, -L - r * Math.sin(a), r * (1 - Math.cos(a))); }
    }
    P.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
    const rr = r * .92 + rest * .012; this.roll.scale.set(rr, 1, rr); this.roll.position.set(0, -L, r);
    this.roll.visible = rest > .01;
  }
}
// a courier riding a route so as to arrive at c.arrive, slowing gently to a stop
function courierAt(c, t, dt, hf, v = 2.2, Td = 2.4) {
  const tau = c.arrive - t, d = tau >= Td ? v * (tau - Td / 2) : tau > 0 ? v * tau * tau / (2 * Td) : 0;
  const L = c.route.getLength(), s = clamp(L - d, 0, L);
  const sp = c._ps === undefined || dt <= 0 ? 0 : Math.abs(s - c._ps) / dt; c._ps = s;
  poseOnPath(c.group, c.route, s, 0, hf);
  return sp;
}

// ─────────── towns: instanced houses with lit windows ───────────
const TOWN_MAT = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
function buildTown(group, spots, hf, r, { palette = ['#b58c5f', '#a8805a', '#c29a6a', '#9c7650'], windows = true, tall = 1 } = {}) {
  const n = spots.length, box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0);
  const body = new THREE.InstancedMesh(box, TOWN_MAT, n), rim = new THREE.InstancedMesh(box, TOWN_MAT, n * 2), upper = new THREE.InstancedMesh(box, TOWN_MAT, n);
  const win = new THREE.InstancedMesh(new THREE.PlaneGeometry(.55, .7), M.window, n * 2);
  const c = new THREE.Color();
  let wi = 0, ui = 0, ri = 0;
  spots.forEach(([x, z, ry], i) => {
    const w = 5 + r() * 6, d = 5 + r() * 5, h = (3.2 + r() * 2.4) * tall, cs = Math.cos(ry), sn = Math.sin(ry);
    let lo = Infinity, hi = -Infinity;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const y = hf(x + cs * a * w / 2 + sn * b * d / 2, z - sn * a * w / 2 + cs * b * d / 2); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const y = lo - .6, top = hi + h, col = palette[Math.floor(r() * palette.length)];
    place(body, i, x, y, z, ry, w, top - y, d); body.setColorAt(i, c.set(col));
    place(rim, ri, x, top, z, ry, w + .3, .35, d + .3); rim.setColorAt(ri++, c.set('#7f6040'));
    if (r() < .35) {
      const uw = w * (.4 + r() * .2), ud = d * (.45 + r() * .2), ox = (r() - .5) * (w - uw), oz = (r() - .5) * (d - ud), px = x + cs * ox + sn * oz, pz = z - sn * ox + cs * oz;
      place(upper, ui, px, top, pz, ry, uw, 2.4, ud); upper.setColorAt(ui++, c.set(col));
      place(rim, ri, px, top + 2.4, pz, ry, uw + .25, .3, ud + .25); rim.setColorAt(ri++, c.set('#7f6040'));
    }
    if (windows) for (let k = 0; k < 2 && r() < .8; k++) {
      const off = (r() - .5) * (w - 1.5), fx = cs * off + sn * (d / 2 + .03), fz = -sn * off + cs * (d / 2 + .03);
      place(win, wi++, x + fx, top - h * .42, z + fz, ry, 1);
    }
  });
  win.count = wi; upper.count = ui; rim.count = ri;
  [body, rim, upper].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
  group.add(win);
  return { body, win };
}
function spotsAround(n, hf, r, test, { x0, x1, z0, z1, gap = 11, maxSlope = .35 }) {
  const out = [];
  for (let t = 0; out.length < n && t < n * 40; t++) {
    const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
    if (!test(x, z)) continue;
    const slope = Math.hypot(hf(x + 3, z) - hf(x - 3, z), hf(x, z + 3) - hf(x, z - 3)) / 6;
    if (slope > maxSlope || out.some(p => Math.abs(p[0] - x) < gap && Math.abs(p[1] - z) < gap)) continue;
    out.push([x, z, Math.floor(r() * 4) * Math.PI / 2 + (r() - .5) * .15]);
  }
  return out;
}

// ─────────── acacia trees for the Hejaz ───────────
let ACACIA_GEO = null;
function acaciaGeo() {
  if (ACACIA_GEO) return ACACIA_GEO;
  const p = [];
  p.push(part(new THREE.CylinderGeometry(.09, .14, 1.6, 6), M4(0, .8, 0, .1), '#4a3a2a'));
  p.push(part(new THREE.CylinderGeometry(.06, .09, 1.3, 5), M4(.35, 2, 0, 0, 0, -.6), '#4a3a2a'));
  p.push(part(new THREE.CylinderGeometry(.06, .09, 1.2, 5), M4(-.3, 2, .1, 0, 0, .55), '#4a3a2a'));
  p.push(part(new THREE.IcosahedronGeometry(1, 0), M4(.7, 2.75, 0, 0, 0, 0, 1.7, .38, 1.5), '#5f6b36'));
  p.push(part(new THREE.IcosahedronGeometry(1, 0), M4(-.6, 2.65, .2, 0, .8, 0, 1.4, .34, 1.3), '#66713b'));
  p.push(part(new THREE.IcosahedronGeometry(1, 0), M4(0, 2.95, -.3, 0, .3, 0, 1.2, .3, 1.2), '#58632f'));
  ACACIA_GEO = mergeGeometries(p); ACACIA_GEO.computeVertexNormals();
  return ACACIA_GEO;
}
function acacias(group, list) {
  const im = new THREE.InstancedMesh(acaciaGeo(), VC_FLAT, list.length);
  list.forEach((a, i) => place(im, i, a.x, a.y, a.z, a.ry, a.s));
  im.castShadow = true; im.receiveShadow = true; group.add(im);
}

// ─────────── camp dressing shared by several scenes ───────────
function campfire(group, x, y, z, T, seed, withLight = true) {
  const f = new THREE.Group(); f.position.set(x, y, z);
  const pit = T.firepit.clone(); pit.scale.setScalar(1.5); f.add(pit);
  const fl = [];
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(FLAME_GEO, k ? FLAME_OUT : FLAME_IN); m.position.set((k - 1) * .2, .12, (k % 2) * .16); m.scale.setScalar(k ? .9 : .6); f.add(m); fl.push(m); }
  f.userData = { fl, seed };
  if (withLight) { const L = new THREE.PointLight('#ff9a4a', 40, 28, 1.6); L.position.y = 1.4; f.add(L); f.userData.light = L; }
  group.add(f);
  return f;
}
function flickerFires(fires, dt, sparks = true) {
  fires.forEach(f => {
    const u = f.userData;
    u.fl.forEach((m, k) => { const n = N.n2(TIME * 5 + u.seed + k * 3, k); m.scale.y = (k ? .9 : .6) * (.8 + .35 * n); m.rotation.y += dt * (1 + k); });
    if (u.light) u.light.intensity = (u.base ?? 40) * (.85 + .25 * N.n2(TIME * 7, u.seed));
    if (sparks && dt > 0 && Math.random() < dt * 4) SPARKS.emit(f.position.x, f.position.y + 1, f.position.z, (Math.random() - .5) * .6, 1.5 + Math.random() * 1.5, (Math.random() - .5) * .6, 1.6, .22, .06, 1);
  });
}
function smallCamp(group, cx, cz, hf, heading, count = 3) {
  const tents = [];
  for (let i = 0; i < count; i++) {
    const a = heading + (i - (count - 1) / 2) * .5, R = 12;
    const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
    const t = makeTent(i === Math.floor(count / 2) ? 8.5 : 6.5, 4.4, 2.3, false);
    t.group.position.set(x, hf(x, z), z); t.group.rotation.y = Math.atan2(cx - x, cz - z);
    group.add(t.group); tents.push(t);
  }
  return tents;
}
const arcPath = (cx, cz, R, a0, a1, n = 12) => new THREE.CatmullRomCurve3(Array.from({ length: n }, (_, i) => { const a = lerp(a0, a1, i / (n - 1)); return new THREE.Vector3(cx + Math.sin(a) * R, 0, cz + Math.cos(a) * R); }));
function caravanShow(on) { caravan.camels.forEach(c => { c.group.visible = on; }); caravan.horses.forEach(h => { h.group.visible = on; }); }
// distance covered by a rider who sets off at t0, reaches speed v over ta seconds, and keeps going
const accelS = (T, t0, v, ta = 2) => { const u = T - t0; return u <= 0 ? 0 : u < ta ? v * u * u / (2 * ta) : v * (u - ta / 2); };
function rideOn(unit, path, s, dt, Hf) {
  const L = path.getLength(), u = clamp(s / L, 0, 1);
  const sp = unit._ps === undefined || dt <= 0 ? 0 : Math.abs(u * L - unit._ps) / dt; unit._ps = u * L;
  path.getPointAt(u, tmpV); path.getTangentAt(u, tmpV2);
  setOnGround(unit.group, tmpV.x, tmpV.z, Math.atan2(tmpV2.x, tmpV2.z), Hf);
  return sp;
}
// distance along a route of length L: speed up over ta seconds, ride at v, ease to a stop over td seconds
function cruise(t, t0, L, v, ta = 2, td = 3) {
  const u = t - t0; if (u <= 0) return 0;
  const tc = Math.max(0, (L - v * (ta + td) / 2) / v);
  if (u < ta) return v * u * u / (2 * ta);
  if (u < ta + tc) return v * ta / 2 + v * (u - ta);
  const w = Math.min(u - ta - tc, td);
  return Math.min(L, v * ta / 2 + v * tc + v * w - v * w * w / (2 * td));
}
// a single rider (horse or camel) moving along a polyline with eased timing
function rideAlong(unit, pts, t0, t1, t, dt, Hf, easeIt = true) {
  const u = clamp((t - t0) / (t1 - t0), 0, 1), k = .18, eIn = x => (x < k ? x * x / (2 * k) : x - k / 2) / (1 - k / 2);
  const e = easeIt === 'in' ? eIn(u) : easeIt === 'out' ? 1 - eIn(1 - u) : easeIt ? smooth(0, 1, u) : u;
  const curve = unit._curve || (unit._curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1]))));
  const L = curve.getLength(), s = e * L;
  const sp = unit._prev === undefined || dt <= 0 ? 0 : Math.abs(s - unit._prev) / dt;
  unit._prev = s;
  curve.getPointAt(clamp(s / L, 0, 1), tmpV); curve.getTangentAt(clamp(s / L, 0, 1), tmpV2);
  setOnGround(unit.group, tmpV.x, tmpV.z, Math.atan2(tmpV2.x, tmpV2.z), Hf);
  return sp;
}

// ─────────── Hejaz: the mountain road to Mecca ───────────
const pathZHej = x => 16 * Math.sin(x * .006);
function hHej(x, z) {
  const dz = Math.abs(z - pathZHej(x));
  const floor = 1.4 * N.fbm(x * .01, z * .01, 3);
  const mount = smooth(38, 170, dz) * (60 + 45 * N.fbm(x * .004 + 11, z * .004, 4));
  const ridge = Math.pow(1 - Math.abs(N.n2(x * .011 + 4, z * .011)), 2) * 24 * smooth(55, 210, dz);
  return floor + mount + ridge;
}
function buildHejaz(T) {
  const group = new THREE.Group();
  const basalt = new THREE.Color('#4f4239'), rust = new THREE.Color('#7a5638'), sand = new THREE.Color('#cfa36b');
  group.add(buildTerrain(hHej, (x, z, y, c) => {
    const slope = Math.hypot(hHej(x + 2, z) - hHej(x - 2, z), hHej(x, z + 2) - hHej(x, z - 2)) / 4;
    c.copy(sand).lerp(SAND.dark, clamp(.4 - N.fbm(x * .01, z * .01, 3), 0, 1) * .5);
    const rock = smooth(3, 14, y) * .6 + smooth(.25, .7, slope) * .6;
    c.lerp(basalt, clamp(rock, 0, 1)).lerp(rust, clamp(N.fbm(x * .02 + 5, z * .02, 3) * 1.4, 0, .45) * clamp(rock, 0, 1));
  }, 2200, 280, .25));
  const r = rng(77);
  const avoid = (x, z) => Math.abs(z - pathZHej(x)) < 12;
  const spots = flatSpots(hHej, 14, [-400, 500, -120, 120], avoid, r, 35);
  const rocks = outcrops(spots, hHej, r);
  group.add(instanced(T.rockA, rocks.filter((_, i) => i % 2)));
  group.add(instanced(T.rockB, rocks.filter((_, i) => !(i % 2))));
  const boulders = [];
  for (let i = 0; i < 40; i++) { const x = -500 + r() * 1000, side = r() < .5 ? 1 : -1, z = pathZHej(x) + side * (45 + r() * 90); const s = 5 + r() * 9; boulders.push({ x, y: hHej(x, z) - 1.5, z, s, sy: s * .42, ry: r() * TAU }); }
  group.add(instanced(T.rockC, boulders));
  const trees = [];
  for (let t = 0; trees.length < 46 && t < 600; t++) { const x = -420 + r() * 900, z = pathZHej(x) + (r() - .5) * 90; if (avoid(x, z) || hHej(x, z) > 6) continue; trees.push({ x, y: hHej(x, z) - .1, z, s: .9 + r() * .9, ry: r() * TAU }); }
  acacias(group, trees);
  group.add(tufts(spots, hHej, r, 8));
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 18 }, (_, i) => { const x = -300 + i * 40; return new THREE.Vector3(x, 0, pathZHej(x)); }));
  return { group, h: hHej, path };
}

// ─────────── Mecca: the valley, the Kaaba, the town and the camp ───────────
const MEC_CAMP = [-40, -140];
const mecNorth = s => [lerp(-40, -260, s), lerp(-70, -560, s)];
const mecEast = s => [lerp(40, 560, s), lerp(10, -90, s)];
function distSeg(x, z, a, b) { const vx = b[0] - a[0], vz = b[1] - a[1], t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz), 0, 1); return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t); }
function hMec(x, z) {
  const d = Math.hypot(x, z * .95);
  let h = 1.1 * N.fbm(x * .01, z * .01, 3);
  const road = Math.max(smooth(70, 12, distSeg(x, z, mecNorth(0), mecNorth(1))), smooth(70, 12, distSeg(x, z, mecEast(0), mecEast(1))));
  h += smooth(150, 400, d) * (80 + 55 * N.fbm(x * .005 + 3, z * .005, 4)) * (1 - .85 * road);
  h += smooth(60, 200, d) * 14 * (.5 + .5 * N.fbm(x * .02, z * .02, 3)) * (1 - road);
  h *= smooth(26, 60, d);
  return h;
}
function makeKaaba() {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: '#0e0d10', roughness: .85 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: .45, metalness: .6 });
  const stone = new THREE.MeshStandardMaterial({ color: '#d8d0c2', roughness: .9 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
  add(new THREE.BoxGeometry(11.8, .45, 12.8), stone, 0, .22, 0);
  add(new THREE.BoxGeometry(11, 9, 12), black, 0, 4.9, 0);
  add(new THREE.BoxGeometry(11.06, .75, 12.06), gold, 0, 7, 0);
  add(new THREE.BoxGeometry(1.8, 3.2, .12), gold, 2.4, 3.2, 6.02);
  return g;
}
function buildMecca(T) {
  const group = new THREE.Group();
  const rockCol = new THREE.Color('#6a5646'), dark = new THREE.Color('#4a3d33'), plaza = new THREE.Color('#cfc3ad');
  group.add(buildTerrain(hMec, (x, z, y, c) => {
    sandColor(x, z, y, c, 6);
    const d = Math.hypot(x, z * .95);
    c.lerp(rockCol, smooth(3, 22, y) * .9).lerp(dark, smooth(22, 90, y) * .6);
    c.lerp(plaza, smooth(34, 18, d) * .8);
  }, 2200, 280, .1));
  const kaaba = makeKaaba(); kaaba.rotation.y = .35; group.add(kaaba);
  const mwall = new THREE.MeshStandardMaterial({ color: '#c9b596', roughness: 1, flatShading: true });
  for (const [x0, z0, x1, z1] of [[-26, -30, -6, -30], [6, -30, 26, -30], [-26, 30, -6, 30], [6, 30, 26, 30], [-26, -30, -26, -6], [-26, 6, -26, 30], [26, -30, 26, -6], [26, 6, 26, 30]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), m = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.4, L), mwall);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, a = .35, rx = mx * Math.cos(a) + mz * Math.sin(a), rz = -mx * Math.sin(a) + mz * Math.cos(a);
    m.position.set(rx, hMec(rx, rz) + 1, rz); m.rotation.y = Math.atan2(x1 - x0, z1 - z0) + a; m.castShadow = m.receiveShadow = true; group.add(m);
  }
  const r = rng(90);
  const onRoad = (x, z) => distSeg(x, z, mecNorth(0), mecNorth(1)) < 16 || distSeg(x, z, mecEast(0), mecEast(1)) < 18;
  const houses = spotsAround(240, hMec, r, (x, z) => { const d = Math.hypot(x, z); return d > 46 && d < 240 && !onRoad(x, z) && Math.hypot(x - MEC_CAMP[0], z - MEC_CAMP[1]) > 36; }, { x0: -250, x1: 250, z0: -250, z1: 250, gap: 9, maxSlope: .3 });
  const town = buildTown(group, houses, hMec, r);
  const tents = smallCamp(group, MEC_CAMP[0], MEC_CAMP[1], hMec, Math.PI / 2, 3);
  const fires = [campfire(group, MEC_CAMP[0] + 1, hMec(MEC_CAMP[0] + 1, MEC_CAMP[1]), MEC_CAMP[1], T, 3)];
  const campPath = arcPath(MEC_CAMP[0], MEC_CAMP[1], 17, -3.35, -.1);
  const northPath = new THREE.CatmullRomCurve3(Array.from({ length: 14 }, (_, i) => { const p = mecNorth(i / 13); return new THREE.Vector3(p[0], 0, p[1]); }));
  // the caravan leaves by the north road: start in the camp, then out
  const [cx, cz] = MEC_CAMP;
  const leavePath = new THREE.CatmullRomCurve3([[cx - 6, cz + 30], [cx - 12, cz + 14], [cx - 18, cz], [cx - 26, cz - 16], ...Array.from({ length: 10 }, (_, i) => mecNorth(.22 + i * .08))].map(p => new THREE.Vector3(p[0], 0, p[1])));
  const crowd = new Crowd(group, LOOKS.pilgrims, 120);
  const pr = rng(12);
  for (let i = 0; i < 330; i++) {
    const s0 = pr(), lat = (pr() - .5) * 26, v = 1 + pr() * .4, L = 360;
    crowd.add({
      scale: .95 + pr() * .12,
      at: t => { if (!crowd.on) return null; const s = ((s0 * L + v * t) % L) / L, [x, z] = mecEast(s * .68), a = Math.atan2(520, -100); return [x + Math.cos(a) * lat * .2, z - Math.sin(a) * lat + (s < .08 ? (1 - s / .08) * 20 * Math.sin(i) : 0), a, v]; },
    });
  }
  crowd.on = false;
  // couriers come down the north road one after another and stop beside the heap of letters
  const couriers = [0, 1, 2, 3, 4].map(i => new CamelUnit(i % 2 ? T.camelTplA : T.camelTplB, 'rider', 20 + i));
  const heapAt = [MEC_CAMP[0] - 6, MEC_CAMP[1] - 28], stops = [[-51, -174], [-44, -176.5], [-38.5, -173], [-54, -180], [-47, -182]];
  couriers.forEach((c, k) => {
    const [sx, sz] = stops[k];
    c.route = new THREE.CatmullRomCurve3([mecNorth(.37), mecNorth(.28), [-76, -186], [-58, -176], [sx - 6, sz - 3], [sx, sz]].map(p => new THREE.Vector3(p[0], 0, p[1])));
    c.arrive = 2.5 + k * 2.4; c.from = [sx, hMec(sx, sz) + 2.45, sz];
    group.add(c.group);
  });
  const envoy = new HorseUnit(T.horse, 'grey', false, 7);
  envoy.noor = new Noor(1.1, 16); envoy.group.add(envoy.noor.group);
  const envoyLight = envoy.noor.light;
  const envoyPath = new THREE.CatmullRomCurve3([[MEC_CAMP[0] - 4, MEC_CAMP[1] + 2], [MEC_CAMP[0] - 16, MEC_CAMP[1] - 10], ...Array.from({ length: 9 }, (_, i) => mecNorth(.2 + i * .1))].map(p => new THREE.Vector3(p[0], 0, p[1])));
  group.add(envoy.group);
  const letters = new Letters(group, [heapAt[0], hMec(...heapAt), heapAt[1]], couriers.map(c => ({ t: c.arrive + .5, from: c.from, n: 22 })), 30, 5);
  // the letter that is read: it rises from the heap towards the camera and opens in front of the Imam's light
  const parch = new Parchment(), camEnd = [-43.41, -164.44], dx = camEnd[0] - heapAt[0], dz = camEnd[1] - heapAt[1], dl = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  parch.at = [heapAt[0] + dx / dl * 1.05, heapAt[1] + dz / dl * 1.05]; parch.yaw = yaw; parch.y0 = hMec(...parch.at);
  parch.group.rotation.set(-.08, yaw, 0, 'YXZ'); group.add(parch.group); parch.group.visible = false;
  const reader = new Noor(1.35, 7); reader.group.position.set(parch.at[0] - Math.cos(yaw) * .82 - Math.sin(yaw) * .3, parch.y0 + 2.0, parch.at[1] + Math.sin(yaw) * .82 - Math.cos(yaw) * .3); group.add(reader.group); reader.group.visible = false;
  return { group, h: hMec, path: campPath, northPath, leavePath, crowd, couriers, envoy, envoyLight, envoyPath, letters, parch, reader, fires, town, tents, kaaba };
}

// ─────────── open desert stations: Saffah, Zarud, Zubala ───────────
function makeDesert(seed, amp, pathFn) {
  const ox = seed * 137, oz = seed * 91;
  const hf = (x, z) => {
    let h = dunes(x + ox, z + oz, amp, .006);
    h *= .12 + .88 * smooth(14, 70, Math.abs(z - pathFn(x)));
    h *= 1 - .8 * smooth(55, 18, Math.hypot(x, z));
    return h + .3 * N.fbm(x * .03, z * .03, 2);
  };
  return hf;
}
const pathSaf = x => 5 * Math.sin(x * .01);
const hSaf = makeDesert(3, 12, pathSaf);
function buildSaffah(T) {
  const group = new THREE.Group();
  group.add(buildTerrain(hSaf, (x, z, y, c) => sandColor(x, z, y, c, 14), 2200, 280, .22));
  const r = rng(51);
  const spots = flatSpots(hSaf, 10, [-400, 400, -300, 300], (x, z) => Math.abs(z - pathSaf(x)) < 14, r, 40);
  const rocks = outcrops(spots, hSaf, r);
  group.add(instanced(T.rockA, rocks.filter((_, i) => i % 2)));
  group.add(instanced(T.rockB, rocks.filter((_, i) => !(i % 2))));
  group.add(tufts(spots, hSaf, r, 7));
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 16 }, (_, i) => { const x = -260 + i * 30; return new THREE.Vector3(x, 0, pathSaf(x)); }));
  const poet = new CamelUnit(T.camelTplA, 'rider', 30), mate = new CamelUnit(T.camelTplB, 'pack', 31);
  group.add(poet.group, mate.group);
  return { group, h: hSaf, path, poet, mate };
}
const pathZar = x => 4 * Math.sin(x * .012);
const hZar = makeDesert(7, 10, pathZar);
function buildZarud(T) {
  const group = new THREE.Group();
  group.add(buildTerrain(hZar, (x, z, y, c) => sandColor(x, z, y, c, 12), 2200, 280, .14));
  const r = rng(61);
  const tents = smallCamp(group, 0, 0, hZar, Math.PI, 3);
  const fires = [campfire(group, 0, hZar(0, 4), 4, T, 1)];
  const zc = [74, -36];
  const ztents = smallCamp(group, zc[0], zc[1], hZar, -2.2, 2);
  fires.push(campfire(group, zc[0] - 3, hZar(zc[0] - 3, zc[1] + 3), zc[1] + 3, T, 9));
  const spots = flatSpots(hZar, 8, [-400, 400, -300, 300], (x, z) => Math.hypot(x, z) < 60 || Math.hypot(x - zc[0], z - zc[1]) < 40, r, 40);
  group.add(tufts(spots, hZar, r, 7));
  const path = arcPath(0, 0, 19, 1.55, 4.5);
  const zuhayr = new CamelUnit(T.camelTplA, 'rider', 40);
  { const lan = makeLantern(M.caravanLamp, 1.2); lan.position.set(.62, .55, .45); zuhayr.body.children[1].add(lan); }
  group.add(zuhayr.group);
  const zLight = new THREE.PointLight('#ffb468', 18, 16, 1.6); zLight.position.set(0, 3, 0); zuhayr.group.add(zLight);
  const courier = new HorseUnit(T.horse, 'bay', 'civil', 3);
  group.add(courier.group);
  return { group, h: hZar, path, fires, zc, zuhayr, courier, tents };
}
const pathZub = x => 6 * Math.sin(x * .009);
const hZub = makeDesert(11, 9, pathZub);
function buildZubala(T) {
  const group = new THREE.Group();
  group.add(buildTerrain(hZub, (x, z, y, c) => { sandColor(x, z, y, c, 10); c.lerp(SAND.gravel, .18); }, 2200, 280, .16));
  const r = rng(71);
  const tents = smallCamp(group, 0, 0, hZub, Math.PI, 3);
  const fires = [campfire(group, 0, hZub(0, 4), 4, T, 2)];
  const spots = flatSpots(hZub, 10, [-400, 400, -300, 300], (x, z) => Math.hypot(x, z) < 50, r, 40);
  const rocks = outcrops(spots, hZub, r);
  group.add(instanced(T.rockA, rocks.filter((_, i) => i % 2)));
  group.add(instanced(T.rockB, rocks.filter((_, i) => !(i % 2))));
  group.add(tufts(spots, hZub, r, 9));
  const path = arcPath(0, 0, 19, 1.55, 4.5);
  // those who had joined on the road: they camp a little apart, then ride off in all directions
  const joiners = [];
  const kinds = ['h', 'c', 'h', 'h', 'c', 'h', 'c', 'h', 'h', 'c', 'h', 'h'];
  kinds.forEach((k, i) => {
    const u = k === 'h' ? new HorseUnit(T.horse, ['dun', 'bay', 'chestnut', 'black'][i % 4], 'civil', 10 + i) : new CamelUnit(i % 2 ? T.camelTplA : T.camelTplB, 'rider', 50 + i);
    const a0 = -1 + (i / (kinds.length - 1)) * 2, sx = Math.sin(a0) * 13 + (r() - .5) * 2, sz = 4 + Math.cos(a0) * 13 + (r() - .5) * 2;
    const dir = a0 * 1.75 + (r() - .5) * .3, far = k === 'h' ? 420 + r() * 80 : 110 + r() * 20;
    u.leave = { pts: [[sx, sz], [sx + Math.sin(dir) * 30, sz + Math.cos(dir) * 30], [sx + Math.sin(dir) * far, sz + Math.cos(dir) * far]], t0: 4.5 + i * .35 + r() * .6 };
    u.leave.t1 = u.leave.t0 + far / (k === 'h' ? 6.5 : 1.8);
    u.kind = k;
    group.add(u.group); joiners.push(u);
  });
  return { group, h: hZub, path, fires, joiners, tents };
}

// ─────────── Kufa: the city, its mosque, the governor's palace and the river ───────────
const riverXKuf = z => 300 + 24 * Math.sin(z * .004);
// the street the captives were led along, from the south to the governor's palace
const KUF_ROUTE = [[2, 260], [2, 120], [4, 60], [8, 20], [14, -20], [22, -46], [60, -48], [84, -56], [86, -76]];
function hKuf(x, z) {
  let h = .9 * N.fbm(x * .008, z * .008, 3) + .25 * N.fbm(x * .04, z * .04, 2);
  const dr = x - riverXKuf(z);
  h -= 3.6 * Math.exp(-Math.pow(dr / 16, 2));
  h *= 1 - .8 * smooth(260, 120, Math.hypot(x, z));
  return h;
}
function buildKufa(T) {
  const group = new THREE.Group();
  const street = new THREE.Color('#b99a70');
  group.add(buildTerrain(hKuf, (x, z, y, c) => {
    sandColor(x, z, y, c, 3); c.lerp(SAND.earth, .3);
    const dr = Math.abs(x - riverXKuf(z)); c.lerp(SAND.wet, smooth(34, 10, dr) * .8);
    if (dr < 60) c.lerp(SAND.reed, smooth(60, 22, dr) * .6);
    c.lerp(street, smooth(60, 30, Math.hypot(x, z - 10)) * .5);
  }, 2200, 280, .05));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 2200), M.water);
  water.rotation.x = -Math.PI / 2; water.position.set(300, -1.4, 0); group.add(water);
  const r = rng(33);
  const wall = new THREE.MeshStandardMaterial({ color: '#b3906a', roughness: 1, flatShading: true });
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  // the great mosque: a walled court with a roofed prayer hall on the qibla side
  const mq = [0, -110], S = 96;
  for (const [dx, dz, w, d] of [[0, -S / 2, S, 1.6], [0, S / 2, S, 1.6], [-S / 2, 0, 1.6, S], [S / 2, 0, 1.6, S]]) add(new THREE.BoxGeometry(w, 5, d), wall, mq[0] + dx, 2.5, mq[1] + dz);
  add(new THREE.BoxGeometry(S - 4, .6, 22), wall, mq[0], 6, mq[1] - S / 2 + 12);
  const cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(.35, .4, 5.6, 8), wall, 40);
  for (let i = 0; i < 40; i++) place(cols, i, mq[0] - S / 2 + 5 + (i % 10) * ((S - 10) / 9), 2.8, mq[1] - S / 2 + 5 + Math.floor(i / 10) * 6, 0, 1);
  cols.castShadow = true; group.add(cols);
  // the governor's palace (Dar al-Imara): a fortress with round towers beside the mosque
  const pc = [86, -110], P = 58;
  for (const [dx, dz, w, d] of [[0, -P / 2, P, 2.4], [0, P / 2, P, 2.4], [-P / 2, 0, 2.4, P], [P / 2, 0, 2.4, P]]) add(new THREE.BoxGeometry(w, 9, d), wall, pc[0] + dx, 4.5, pc[1] + dz);
  const towerG = new THREE.CylinderGeometry(2.6, 3, 11, 10);
  const towers = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [-1, 0], [1, 0]]) towers.push(add(towerG, wall, pc[0] + dx * P / 2, 5.5, pc[1] + dz * P / 2));
  add(new THREE.BoxGeometry(22, 12, 18), wall, pc[0], 6, pc[1]);
  const torches = [];
  for (const [dx, dz] of [[-6, P / 2 + 1.5], [6, P / 2 + 1.5], [-P / 2 - 1.5, 10], [P / 2 + 1.5, -10]]) {
    const tl = makeLantern(M.window, 1.4); tl.position.set(pc[0] + dx, 7, pc[1] + dz); group.add(tl); torches.push(tl);
  }
  const palaceLight = new THREE.PointLight('#ffa050', 50, 60, 1.6); palaceLight.position.set(pc[0], 9, pc[1] + P / 2 + 6); group.add(palaceLight);
  // houses in blocks around the centre
  const houses = spotsAround(220, hKuf, r, (x, z) => {
    if (Math.abs(x - mq[0]) < S / 2 + 10 && Math.abs(z - mq[1]) < S / 2 + 10) return false;
    if (Math.abs(x - pc[0]) < P / 2 + 12 && Math.abs(z - pc[1]) < P / 2 + 12) return false;
    if (Math.hypot(x - 10, z - 12) < 46) return false;
    if (KUF_ROUTE.some((p, i) => i && distSeg(x, z, KUF_ROUTE[i - 1], p) < 13)) return false;
    if (Math.abs(x % 42) < 5 || Math.abs(z % 46) < 5) return false;
    return x < riverXKuf(z) - 40 && Math.hypot(x, z) < 250;
  }, { x0: -250, x1: 260, z0: -250, z1: 250, gap: 9 });
  buildTown(group, houses, hKuf, r);
  const palms = [];
  for (let i = 0; i < 90; i++) { const z = -500 + r() * 1000, side = r() < .7 ? -1 : 1, x = riverXKuf(z) + side * (22 + r() * 40); palms.push({ x, y: hKuf(x, z) - .2, z, s: 8 + r() * 5, ry: r() * TAU, rz: (r() - .5) * .12 }); }
  group.add(instanced(T.palmA, palms.filter((_, i) => i % 2)));
  group.add(instanced(T.palmB, palms.filter((_, i) => !(i % 2))));
  // the people who had pledged to Muslim, gathered in the square, and his lamp among them
  const lampPos = [10, 16];
  const noor = new Noor(1.3, 30); noor.group.position.set(lampPos[0], hKuf(...lampPos) + 1.5, lampPos[1]); group.add(noor.group);
  const lamp = noor.group, lampPost = new THREE.Group(), lampLight = noor.light;
  const crowd = new Crowd(group, LOOKS.kufans, 60);
  const cr = rng(8);
  const lanes = [[-1, 0], [1, 0], [0, 1], [-.7, .7], [.7, .7], [-.7, -.4]];
  for (let i = 0; i < 110; i++) {
    const a = cr() * TAU, R = 5 + Math.sqrt(cr()) * 18, sx = lampPos[0] + Math.cos(a) * R, sz = lampPos[1] + Math.sin(a) * R * .8;
    const face = Math.atan2(lampPos[0] - sx, lampPos[1] - sz);
    const [lx, lz] = lanes[i % lanes.length], far = 90 + cr() * 90, ex = sx + lx * far + (cr() - .5) * 20, ez = sz + lz * far + (cr() - .5) * 20;
    const go = 2.5 + cr() * 6, v = 1.1 + cr() * .4, D = Math.hypot(ex - sx, ez - sz), hd = Math.atan2(ex - sx, ez - sz);
    crowd.add({ scale: .94 + cr() * .12, at: t => { const w = clamp(t - go, 0, D / v), tt = w * v / D; if (t < go) return [sx, sz, face, 0]; if (tt >= 1) return null; return [lerp(sx, ex, tt), lerp(sz, ez, tt), hd, v]; } });
  }
  const guards = new Crowd(group, LOOKS.guards, 12);
  for (let i = 0; i < 10; i++) { const x = pc[0] - 12 + (i % 5) * 6, z = pc[1] + P / 2 + 4 + Math.floor(i / 5) * 3; guards.add({ at: () => [x, z, 0, 0] }); }
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-400, 0, 400), new THREE.Vector3(-380, 0, 420)]);
  return { group, h: hKuf, path, crowd, guards, lamp, lampPost, lampLight, palaceLight, torches, lampPos, noor };
}

// ─────────── the story steps for Chapters 2 and 3 ───────────
const CH23_STEPS = [
  {
    scene: 'hejaz', env: 'afternoon', dur: 17, mapStop: 1, km: 450, chN: 2,
    ch: 'Chapter 2 · Refuge in Mecca', title: 'The road to Mecca', place: 'The Hejaz mountains', ar: 'الحجاز', date: 'Shaʿban 60 AH', stat: '~450 km from Medina to Mecca',
    shortY: 'The caravan wound south through the mountains of the Hejaz towards Mecca, about 450 km away.',
    shortF: 'Travelling south through the Hejaz, the caravan reached Mecca on 3 Shaʿban 60 AH.',
    young: "The caravan travelled about 450 km south to Mecca, the city of the Kaʿba. In the holy city, fighting was forbidden, and many people came to visit the Prophet's grandson.",
    full: 'The caravan reached Mecca on 3 Shaʿban and stayed for about four months. The sanctuary offered protection, and pilgrims and visitors came to meet Hussain (AS) and hear from him.',
    lead: T => 60 + 1.35 * T,
    shot: new Shot([[-204, 2.4, -6], [-210, 3, -2], [-196, 16, 28]], [[-246, 2.6, -18], [-236, 2.6, -16], [-226, 3, -16]], 17),
    enter(S) { armyShow(0); caravanLamps(0); resetCaravan(); },
    update(t, dt, S, T) { caravanUpdate(S.path, this.lead(T), dt); },
  },
  {
    scene: 'mecca', env: 'evening', dur: 21, mapStop: 1, km: 450, chN: 2,
    ch: 'Chapter 2 · Refuge in Mecca', title: 'Letters from Kufa', place: 'Mecca', ar: 'مكة المكرمة', date: 'Ramadan 60 AH',
    stat: () => `≈ ${fmt(Math.round((SCENES.mecca.lettersDone || 0) * 120) * 100)} letters`,
    narrExtra: () => [{ say: 'One of the letters read: "' + LETTER_KUFA.lines[0][1] + '"', sub: '', at: 17.8, gap: 700 }],
    shortY: 'People in Kufa sent letter after letter: "Please come and lead us!"',
    shortF: 'From Kufa came a flood of letters, reportedly around 12,000, urging Hussain (AS) to come.',
    young: 'Far away in Kufa, a city in Iraq, people wrote letter after letter saying, “Please come and lead us!” Thousands of letters arrived in Mecca.',
    full: 'From Kufa came a flood of letters, reportedly around 12,000, urging Hussain (AS) to come and lead them. Kufa had been the capital of his father, Imam ʿAli (AS), and many there resented Umayyad rule. One letter, signed by Shabath ibn Ribʿi, Hajjar ibn Abjar, ʿAmr ibn al-Hajjaj and others, promised “an army mustered for you”; the same men would later lead troops against him at Karbala.',
    reflect: 'If you promise to help someone, what makes that promise real?',
    note: 'The Kaʿba is drawn as it looks today. Its covering in 60 AH may have looked different.',
    shot: new Shot([[34, 9, 40], [-30, 10, -100], [-54, 6, -163], [-43.41, 1.95, -164.44]], [[-22, 6, -80], [-48, 5, -172], [-46, 1.6, -173], [-45.5, 1.5, -167.3]], 20),
    enter(S) { armyShow(0); caravanLamps(.8); resetCaravan(); S.crowd.on = false; S.crowd.update(0, hMec); S.envoy.group.visible = false; S.letters.im.visible = true; S.letters.pile.visible = true; S.couriers.forEach(c => { c.group.visible = true; c._ps = undefined; });
      S.parch.group.visible = true; S.parch.set(0); S.reader.group.visible = true; S.reader.setLevel(0); caravan.horses[0].noor.group.visible = false; },
    update(t, dt, S, T) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      S.lettersDone = S.letters.update(t);
      const lift = smooth(13.2, 14.8, t), P = S.parch;
      P.group.position.set(P.at[0], P.y0 + lerp(1.05, 1.95, lift), P.at[1]); P.group.scale.setScalar(lerp(.5, 1, lift)); P.set(smooth(14.8, 17.6, t));
      S.reader.setLevel(smooth(12.6, 14.2, t));
      sermonAt(LETTER_KUFA, T, 17.8, 99, true);
      S.couriers.forEach(c => c.animate(courierAt(c, t, dt, hMec, 1.8), dt, TIME));
      S.crowd.update(t, hMec);
      flickerFires(S.fires, dt);
    },
  },
  {
    scene: 'mecca', env: 'dawn', dur: 16, mapStop: 1, km: 450, chN: 2,
    ch: 'Chapter 2 · Refuge in Mecca', title: 'An envoy to Kufa', place: 'Mecca', ar: 'مسلم بن عقيل', date: 'Ramadan 60 AH', stat: '≈ 18,000 pledges would follow in Kufa',
    shortY: 'Imam Hussain sent his cousin Muslim ibn ʿAqil ahead to Kufa, to see if the people meant it.',
    shortF: 'Hussain (AS) sent his cousin Muslim ibn ʿAqil to Kufa to test the sincerity of its people.',
    young: 'Before going himself, Imam Hussain sent his cousin Muslim ibn ʿAqil to Kufa to find out whether the people really meant what they wrote. Thousands promised to support him.',
    full: "Hussain (AS) sent his cousin Muslim ibn ʿAqil to Kufa, by way of Medina, to test the people's sincerity. The welcome was overwhelming: some 18,000 people pledged their support, and Muslim wrote urging Hussain (AS) to come.",
    people: [['Muslim ibn ʿAqil', 'مسلم بن عقيل']],
    note: 'Muslim ibn ʿAqil belonged to the Prophet’s family, so he is shown as the light above his horse.',
    shot: new Shot([[-30, 4.5, -112], [-36, 5.5, -126], [-48, 9, -140]], [[-44, 2.4, -138], [-76, 3, -172], [-112, 6, -250]], 16),
    enter(S) { armyShow(0); caravanLamps(.8); resetCaravan(); S.crowd.on = false; S.crowd.update(0, hMec); S.couriers.forEach(c => { c.group.visible = false; }); S.envoy.group.visible = true; S.envoy._ps = undefined; S.letters.update(99); S.letters.im.visible = false; S.letters.pile.visible = true; S.parch.group.visible = false; S.reader.group.visible = false; },
    update(t, dt, S, T) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      const sp = rideOn(S.envoy, S.envoyPath, accelS(T, 1.5, 7, 2.5), dt, hMec);
      S.envoy.setSpeed(sp); S.envoy.update(dt);
      S.envoyLight.intensity = 16 * (1 - smooth(13, 16, t));
      flickerFires(S.fires, dt);
    },
  },
  {
    scene: 'mecca', env: 'noon', dur: 18, mapStop: 2, km: 459, chN: 2,
    ch: 'Chapter 2 · Refuge in Mecca', title: 'Leaving Mecca', place: 'Mecca → al-Tanʿim', ar: 'مكة المكرمة', date: '8 Dhu al-Hijja 60 AH', stat: 'Pilgrims head east to Mina; the caravan turns north',
    shortY: 'On the day pilgrims set out for Mina, Imam Hussain left Mecca to keep the holy city safe.',
    shortF: 'On 8 Dhu al-Hijja, as pilgrims set out for Mina, Hussain (AS) left Mecca and turned towards Iraq.',
    young: 'It was the season of Hajj, and pilgrims were heading to Mina. But Imam Hussain learned that men had been sent to kill him, even inside the holy city. To keep Mecca safe from bloodshed, he left and turned towards Iraq.',
    full: 'On 8 Dhu al-Hijja, the day pilgrims set out for Mina, Hussain (AS) left Mecca. He had learned of a plan to assassinate him inside the sanctuary and would not let its sanctity be broken by his blood. He completed an ʿUmra in place of the Hajj and set out for Iraq.',
    reflect: 'Why is the caravan going the opposite way from everyone else?',
    lead: T => 20 + 1.35 * T, followPath: 'leavePath',
    shot: new Shot([[-12, 14, 52], [-6, 22, 32], [-20, 26, -60]], [[80, 2, -10], [-30, 2, -100], [-70, 3, -170]], 18),
    enter(S) { armyShow(0); caravanLamps(0); resetCaravan(); S.crowd.on = true; S.envoy.group.visible = false; S.couriers.forEach(c => { c.group.visible = false; }); S.letters.im.visible = false; S.letters.pile.visible = false; S.parch.group.visible = false; S.reader.group.visible = false; },
    update(t, dt, S, T) { caravanUpdate(S.leavePath, this.lead(T), dt); S.crowd.update(T + 40, hMec); flickerFires(S.fires, dt, false); },
  },
  {
    scene: 'saffah', env: 'golden', dur: 18, mapStop: 3, km: 619, chN: 3,
    ch: 'Chapter 3 · The Road North', title: 'The poet al-Farazdaq', place: 'al-Saffah', ar: 'الصفاح', date: 'Dhu al-Hijja 60 AH', stat: '~619 km from Medina',
    shortY: 'A famous poet coming from Iraq said: "Their hearts are with you, but their swords are against you."',
    shortF: 'At al-Saffah the poet al-Farazdaq warned: the hearts of Iraq were with Hussain (AS), its swords with Banu Umayya.',
    young: 'On the road they met a famous poet, al-Farazdaq, who was coming from Iraq. Imam Hussain asked him about the people there.',
    full: 'At al-Saffah the caravan met the poet al-Farazdaq, travelling from Iraq. Hussain (AS) asked him what he had seen of the people there.',
    quote: { q: 'Their hearts are with you, but their swords are with Banu Umayya.', by: 'al-Farazdaq' },
    people: [['al-Farazdaq', 'الفرزدق']],
    shot: new Shot([[28, 3.4, 13], [58, 3.2, 26], [59, 3.5, 30]], [[100, 3, 6], [60, 2.4, 5], [60, 2.5, 5]], 18),
    enter(S) { armyShow(0); caravanLamps(0); resetCaravan(); S.poet._prev = undefined; S.mate._prev = undefined; },
    update(t, dt, S) {
      const lead = walkStop(t, 300, 314);
      caravanUpdate(S.path, lead, dt);
      const meet = [[98, pathSaf(98) + 3], [82, pathSaf(82) + 3.8], [66, pathSaf(66) + 4.4]];
      const sp = rideAlong(S.poet, meet, 0, 13, t, dt, hSaf, 'out'); S.poet.animate(sp, dt, TIME);
      const sp2 = rideAlong(S.mate, meet.map(p => [p[0] + 7.5, p[1] + 1.2]), 0, 13.4, t, dt, hSaf, 'out'); S.mate.animate(sp2, dt, TIME);
    },
  },
  {
    scene: 'kufa', env: 'night', envFrom: 'evening', envT: 12, dur: 26, mapStop: 3, mapCity: 'Kufa', km: null, mcKm: 'The caravan is still far away in the desert', chN: 3,
    ch: 'Chapter 3 · The Road North', title: 'Meanwhile, in Kufa', place: 'Kufa', ar: 'الكوفة', date: '9 Dhu al-Hijja 60 AH', stat: 'The caravan is still far away in the desert',
    shortY: 'In Kufa, a harsh new governor frightened the people. They left Muslim alone, and he was killed.',
    shortF: 'Under Ibn Ziyad’s threats Kufa abandoned Muslim ibn ʿAqil, who was killed on 9 Dhu al-Hijja.',
    young: 'In Kufa, everything had changed. A harsh new governor, Ibn Ziyad, frightened the people with threats. The people who had promised to help left Muslim all alone. Muslim was captured and killed.',
    full: 'The new governor, ʿUbaydullah ibn Ziyad, took control of Kufa with threats and bribes. The thousands who had pledged to Muslim melted away until he stood alone. He was captured and killed, with his host Hani ibn ʿUrwa, on 9 Dhu al-Hijja: one day after Hussain (AS) left Mecca.',
    people: [['ʿUbaydullah ibn Ziyad', 'عبيد الله بن زياد'], ['Hani ibn ʿUrwa', 'هانئ بن عروة', 'full']],
    note: 'The story has cut away from the caravan. Imam Hussain (AS) did not know yet. Muslim is shown as the light left alone in the square, wandering on foot; when he is killed, it rises.',
    shot: new Shot([[40, 16, 70], [22, 20, 78], [-24, 24, 84]], [[10, 2, 16], [10, 2, 12], [34, 3, -34]], 18),
    enter(S) { armyShow(0); caravanShow(false); S.lamp.visible = S.lampPost.visible = true; vis(S.lining, false); },
    update(t, dt, S, T) {
      caravanShow(false);
      S.crowd.update(T, hKuf); S.guards.update(t, hKuf);
      // left alone, Muslim walks on through the empty square; then his light rises
      const w = clamp((t - 10.5) * 1.15 / 11, 0, 1), [x0, z0] = S.lampPos, x = lerp(x0, 5, w), z = lerp(z0, 26, w);
      S.noor.group.position.set(x, hKuf(x, z) + 1.5, z);
      S.noor.rise = 7 * smooth(20.5, 26, t); S.noor.setLevel(1 - smooth(22, 26, t));
    },
  },
  {
    scene: 'zarud', env: 'night', dur: 18, mapStop: 6, km: 1244, chN: 3,
    ch: 'Chapter 3 · The Road North', title: 'The news arrives', place: 'Zarud · Thaʿlabiyya', ar: 'زرود · الثعلبية', date: 'Dhu al-Hijja 60 AH', stat: '~1,244 km from Medina',
    shortY: 'A rider brought sad news: Muslim had been killed. That night Zuhayr ibn al-Qayn joined the caravan.',
    shortF: 'News of Muslim and Hani’s deaths reached the caravan; Zuhayr ibn al-Qayn left his own camp to join Hussain (AS).',
    young: 'As the caravan crossed the desert, travellers brought sad news: Muslim had been killed. Imam Hussain said, “To God we belong, and to Him we return.” Around this time a man named Zuhayr ibn al-Qayn joined the caravan. He stayed loyal to the very end.',
    full: 'Near Zarud and Thaʿlabiyya, travellers from Kufa brought news of the deaths of Muslim and Hani. Hussain (AS) recited “Inna lillahi wa inna ilayhi rajiʿun.” Around this time Zuhayr ibn al-Qayn, who had been avoiding the caravan, was invited to meet Hussain (AS). He came back from the meeting changed, sent his wife home to her family, and joined him.',
    people: [['Zuhayr ibn al-Qayn', 'زهير بن القين']],
    note: 'Sources differ on exactly where each of these events took place.',
    shot: new Shot([[30, 5, 34], [8, 7, 40], [-14, 9.5, 42]], [[-18, 2, 6], [0, 1.5, 2], [14, 1.5, 3]], 18),
    enter(S) { armyShow(0); caravanLamps(1); resetCaravan(); S.courier._prev = undefined; S.zuhayr._prev = undefined; S.fires.forEach(f => { f.userData.base = 40; }); },
    update(t, dt, S) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      const ih = caravan.horses[0]; setOnGround(ih.group, -3.5, 6, -Math.PI / 2, hZar);
      const sp = rideAlong(S.courier, [[-95, 15], [-50, 10], [-15, 6.5], [-8.6, 6]], 0, 11.5, t, dt, hZar, 'out'); S.courier.setSpeed(sp); S.courier.update(dt);
      S.fires[0].userData.base = 40 - 18 * smooth(7, 10, t);
      const zs = rideAlong(S.zuhayr, [[30, 2], [20, 12], [4, 10]], 0, 17, t, dt, hZar, 'out'); S.zuhayr.animate(zs, dt, TIME);
      flickerFires(S.fires, dt);
    },
  },
  {
    scene: 'zubala', env: 'dusk', dur: 18, mapStop: 8, km: 1549, chN: 3,
    ch: 'Chapter 3 · The Road North', title: 'Free to leave', place: 'Shuquq · Zubala', ar: 'زبالة', date: 'Dhu al-Hijja 60 AH', stat: '~1,549 km from Medina',
    shortY: 'Imam Hussain told everyone the truth and let them go. Many left; his family and true companions stayed.',
    shortF: 'At Zubala Hussain (AS) released everyone from their pledge. Those who had joined for gain left; those from Medina stayed.',
    young: 'At Zubala, Imam Hussain told everyone the truth: Kufa had turned against them, and anyone who wanted to leave could go. Many people who had joined along the road left. His family and true companions stayed.',
    full: 'At Zubala word came that another messenger, ʿAbdullah ibn Yaqtur, had been killed. Hussain (AS) spoke openly: “Our supporters have abandoned us. Whoever of you wishes to leave may go; he owes us nothing.” Many who had joined on the road expecting an easy victory left. Those who had come with him from Medina stayed.',
    reflect: 'Why would Imam Hussain tell everyone the truth, knowing that people would leave?',
    shot: new Shot([[12, 10, -42], [5, 16, -48], [0, 26, -58]], [[0, 1, -2], [0, 1, 4], [0, 1, 20]], 18),
    enter(S) { armyShow(0); caravanLamps(.9); resetCaravan(); S.joiners.forEach(u => { u._prev = undefined; }); },
    update(t, dt, S, T) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      S.joiners.forEach(u => {
        const sp = rideAlong(u, u.leave.pts, u.leave.t0, u.leave.t1, T, dt, hZub, 'in');
        if (u.kind === 'h') { u.setSpeed(sp); u.update(dt); } else u.animate(sp, dt, TIME);
      });
      flickerFires(S.fires, dt);
    },
  },
];

// ═══════════ Chapters 1, 4, 5, 6 and 7: Damascus, the escort, the river, Ashura and the captives ═══════════

// ─────────── shared pieces ───────────
const SMOKE = new Particles(1100, '#3b3632', { hard: .8 });
const EMBER_GLOW = new Particles(300, new THREE.Color(1.7, .55, .14), { additive: true, hard: 1.2 });
const M_CHAR = new THREE.MeshStandardMaterial({ color: '#211a15', roughness: 1, side: THREE.DoubleSide });
const vis = (o, on) => { if (o) (o.group || o).visible = on; };
const subGroup = parent => { const g = new THREE.Group(); parent.add(g); return g; };
function crowdClear(c) { if (c) c.meshes.forEach(l => l.forEach(im => { im.count = 0; })); }
const LOOKS2 = {
  syrians: [
    { robe: '#7a3b2e', skin: '#9a7458', head: 'turban', cover: '#e8e0cc', belt: '#c9a24a' },
    { robe: '#2e4a5a', skin: '#8a6446', head: 'turban', cover: '#d9c9a8' },
    { robe: '#8a7a4a', skin: '#a07656', head: 'shawl', cover: '#5d4a3a' },
    { robe: '#4a3a5a', skin: '#8a6446', head: 'turban', cover: '#f0ebe0', belt: '#6b4a2c' },
    { robe: '#c9b99a', skin: '#7a5a3e', head: 'turban', cover: '#2a2522' },
  ],
  elders: [
    { robe: '#efeae0', skin: '#8a6446', head: 'turban', cover: '#ffffff' },
    { robe: '#8a7a60', skin: '#7a5a3e', head: 'turban', cover: '#e0d6c0', belt: '#6b4a2c' },
  ],
  soldiers: [
    { robe: '#5a1d18', skin: '#7a5a3e', head: 'turban', cover: '#1f1a18', belt: '#9aa0a8' },
    { robe: '#4a3a2e', skin: '#8a6446', head: 'turban', cover: '#2a2522', belt: '#9aa0a8' },
  ],
};
// people standing in two lines along a route, facing it
function liningCrowd(parent, looks, path, s0, s1, gap, hf, skip = () => false) {
  const L = path.getLength(), r = rng(Math.round(s0 * 7 + s1)), items = [];
  for (let s = s0; s < s1; s += gap) for (const side of [-1, 1]) {
    if (r() < .18) continue;
    const u = clamp((s + (r() - .5) * gap) / L, 0, 1), p = path.getPointAt(u), tg = path.getTangentAt(u);
    const lat = side * (6.2 + r() * 2.2), x = p.x + tg.z * lat, z = p.z - tg.x * lat;
    if (skip(x, z)) continue;
    const hd = Math.atan2(-tg.z * side, tg.x * side) + (r() - .5) * .6;
    items.push({ x, z, hd, sc: .94 + r() * .12 });
  }
  const c = new Crowd(subGroup(parent), looks, Math.ceil(items.length / looks.length) + 8);
  items.forEach(it => c.add({ scale: it.sc, at: () => [it.x, it.z, it.hd, 0] }));
  c.group = c.meshes[0][0].parent;
  c.update(0, hf);
  return c;
}
// baked, instanced horsemen standing in ranks (same bakes as the massed vanguard at Sharaf)
function standingCavalry(parent, spots, hf) {
  const g = subGroup(parent), geos = massGeos(TPL.horse);
  geos.forEach((poses, v) => {
    const mine = spots.filter(s => s[3] % geos.length === v);
    if (!mine.length) return;
    const im = new THREE.InstancedMesh(poses[4], MASS_MAT, mine.length);
    mine.forEach(([x, z, yaw], i) => place(im, i, x, hf(x, z), z, yaw, 1));
    im.castShadow = true; im.receiveShadow = true; g.add(im);
  });
  return g;
}
// the family's camels travelling as captives, soldiers riding on both sides
function processionUpdate(path, lead, dt, escorts = []) {
  caravanUpdate(path, lead + 10, dt);
  caravan.horses.forEach(h => { h.group.visible = false; });
  if (caravan.camels[0].flag) caravan.camels[0].flag.visible = false;
  escorts.forEach((a, i) => {
    const s = lead + 8 - Math.floor(i / 2) * 9.5 + .5 * Math.sin(TIME * .3 + i), lat = (i % 2 ? 1 : -1) * (3.4 + .3 * Math.sin(TIME * .2 + i));
    const sp = a._ps === undefined || dt <= 0 ? 0 : Math.abs(s - a._ps) / dt; a._ps = s;
    poseOnPath(a.group, path, s, lat, H); a.setSpeed(sp); a.update(dt);
  });
}
function escortsReady(n) { armyShow(n); army.forEach(a => { a._ps = undefined; }); return army.slice(0, n); }

// ─────────── trees of the Damascus orchards (the Ghouta) ───────────
let ORCH = null;
function orchardGeos() {
  if (ORCH) return ORCH;
  const tree = mergeGeometries([
    part(new THREE.CylinderGeometry(.12, .18, 2, 6), M4(0, 1, 0), '#4a3a2a'),
    part(new THREE.IcosahedronGeometry(1.5, 1), M4(0, 2.9, 0, 0, 0, 0, 1.25, .95, 1.25), '#4f6a33'),
    part(new THREE.IcosahedronGeometry(1, 1), M4(.8, 2.4, .5, 0, 0, 0, 1, .8, 1), '#5a7338'),
    part(new THREE.IcosahedronGeometry(1, 1), M4(-.7, 2.6, -.4, 0, 0, 0, 1, .85, 1), '#46602c'),
  ]);
  const poplar = mergeGeometries([
    part(new THREE.CylinderGeometry(.1, .15, 2, 5), M4(0, 1, 0), '#4a3a2a'),
    part(new THREE.ConeGeometry(1.1, 7.5, 7), M4(0, 5.2, 0), '#566b33'),
  ]);
  tree.computeVertexNormals(); poplar.computeVertexNormals();
  return ORCH = { tree, poplar };
}

// ─────────── Damascus: the walled city, the green-domed palace, orchards and Mount Qasiyun ───────────
function hDam(x, z) {
  let h = .7 * N.fbm(x * .008, z * .008, 3) + .2 * N.fbm(x * .04, z * .04, 2);
  h += smooth(-240, -520, z) * (80 + 70 * N.fbm(x * .004 + 7, z * .004, 4));
  return h * (1 - .85 * smooth(235, 160, Math.hypot(x, z * 1.2)));
}
const DAM_WALL = { x0: -150, x1: 150, z0: -115, z1: 90 };
const DAM_ROUTE = [[0, 420], [0, 300], [0, 200], [0, 120], [0, 60], [0, 4]];
function buildDamascus(T) {
  const group = new THREE.Group();
  const rock = new THREE.Color('#8a7a68'), road = new THREE.Color('#c9ab80'), street = new THREE.Color('#bfa27a');
  group.add(buildTerrain(hDam, (x, z, y, c) => {
    sandColor(x, z, y, c, 4); c.lerp(SAND.earth, .45);
    const d = Math.hypot(x, z * 1.2), orch = N.fbm(x * .012 + 3, z * .012, 3);
    if (orch > -.15) c.lerp(SAND.green, clamp((orch + .15) * 1.6, 0, .8) * smooth(175, 230, d) * (1 - smooth(-200, -320, z)));
    c.lerp(rock, smooth(4, 30, y) * .85);
    if (z > 80 && Math.abs(x) < 9) c.lerp(road, .65);
    if (d < 170) c.lerp(street, .35);
  }, 2200, 280, .06));
  const r = rng(404);
  const wallM = new THREE.MeshStandardMaterial({ color: '#c4ae8a', roughness: 1, flatShading: true });
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const { x0, x1, z0, z1 } = DAM_WALL;
  const segs = [[x0, z0, x1, z0], [x0, z0, x0, z1], [x1, z0, x1, z1], [x0, z1, -7, z1], [7, z1, x1, z1]];
  const towerG = new THREE.CylinderGeometry(3.3, 3.6, 12, 10);
  for (const [ax, az, bx, bz] of segs) {
    const L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    add(new THREE.BoxGeometry(2.4, 10.5, L), wallM, mx, hDam(mx, mz) + 4.2, mz, Math.atan2(bx - ax, bz - az));
    for (let k = 0, n = Math.max(1, Math.round(L / 38)); k <= n; k++) { const x = lerp(ax, bx, k / n), z = lerp(az, bz, k / n); add(towerG, wallM, x, hDam(x, z) + 5.2, z); }
  }
  // the south gate, with its torches
  const gateG = new THREE.CylinderGeometry(4.3, 4.6, 14, 12);
  [-10, 10].forEach(x => add(gateG, wallM, x, hDam(x, z1) + 6, z1));
  add(new THREE.BoxGeometry(16, 3.4, 3.2), wallM, 0, hDam(0, z1) + 9.6, z1);
  const gateLights = [];
  [-6.5, 6.5].forEach(x => { const l = makeLantern(M.window, 1.6); l.position.set(x, hDam(x, z1 + 2.6) + 5, z1 + 2.6); group.add(l); });
  { const L = new THREE.PointLight('#ffa050', 60, 40, 1.6); L.position.set(0, hDam(0, z1 + 7) + 6, z1 + 7); group.add(L); gateLights.push(L); }
  // al-Khadra, the green-domed palace of the Umayyads
  const pz = -50, palM = new THREE.MeshStandardMaterial({ color: '#d2bd98', roughness: .95, flatShading: true });
  for (const [ax, az, bx, bz] of [[-42, pz - 30, 42, pz - 30], [-42, pz - 30, -42, pz + 34], [42, pz - 30, 42, pz + 34], [-42, pz + 34, -5, pz + 34], [5, pz + 34, 42, pz + 34]]) {
    const L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    add(new THREE.BoxGeometry(1.6, 7, L), palM, mx, hDam(mx, mz) + 2.8, mz, Math.atan2(bx - ax, bz - az));
  }
  const hy = hDam(0, pz - 4);
  add(new THREE.BoxGeometry(36, 12, 24), palM, 0, hy + 5.5, pz - 4);
  [-27, 27].forEach(x => add(new THREE.BoxGeometry(17, 8, 16), palM, x, hy + 3.5, pz - 4));
  add(new THREE.CylinderGeometry(9.6, 9.8, 3.4, 24), palM, 0, hy + 13, pz - 4);
  const domeM = new THREE.MeshStandardMaterial({ color: '#3f7b58', roughness: .45, metalness: .25 });
  const dome = add(new THREE.SphereGeometry(9.7, 28, 14, 0, TAU, 0, Math.PI / 2), domeM, 0, hy + 14.6, pz - 4); dome.scale.y = 1.15;
  add(new THREE.SphereGeometry(.7, 12, 10), M.gold, 0, hy + 26.2, pz - 4);
  add(new THREE.ConeGeometry(.3, 1.6, 8), M.gold, 0, hy + 27.5, pz - 4);
  const pwin = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 2.2), M.window, 14);
  for (let i = 0; i < 14; i++) { const x = i < 8 ? -14 + i * 4 : (i < 11 ? -33 : 21) + ((i - (i < 11 ? 8 : 11)) * 6); place(pwin, i, x, hy + (i < 8 ? 6 : 4), pz - 4 + (i < 8 ? 12.05 : 8.05), 0, 1); }
  group.add(pwin);
  [-4.5, 4.5].forEach(x => { const l = makeLantern(M.window, 1.5); l.position.set(x, hDam(x, pz + 35.5) + 4, pz + 35.5); group.add(l); });
  { const L = new THREE.PointLight('#ffa050', 45, 34, 1.6); L.position.set(0, hy + 6, pz + 40); group.add(L); gateLights.push(L); }
  // houses inside the walls, clear of the palace and the two main streets
  const houses = spotsAround(210, hDam, r, (x, z) => {
    if (x < x0 + 8 || x > x1 - 8 || z < z0 + 8 || z > z1 - 8) return false;
    if (Math.abs(x) < 52 && z > pz - 40 && z < pz + 44) return false;
    if (Math.abs(x) < 11 && z > pz + 30) return false;
    return Math.abs(z - 35) > 7;
  }, { x0: x0, x1: x1, z0: z0, z1: z1, gap: 9, maxSlope: .3 });
  buildTown(group, houses, hDam, r, { palette: ['#c9b08a', '#bfa47c', '#d3bd98', '#b39870'] });
  // orchards and poplars outside the walls
  const G = orchardGeos(), trees = [], poplars = [];
  for (let i = 0; i < 4000 && trees.length + poplars.length < 900; i++) {
    const a = r() * TAU, d = 180 + Math.sqrt(r()) * 560, x = Math.cos(a) * d, z = Math.sin(a) * d * .9;
    if (z < -250 || (Math.abs(x) < 16 && z > 80)) continue;
    if (x > x0 - 14 && x < x1 + 14 && z > z0 - 14 && z < z1 + 14) continue;
    if (N.fbm(x * .012 + 3, z * .012, 3) < -.1) continue;
    (r() < .25 ? poplars : trees).push([x, z, r()]);
  }
  for (const [list, geo] of [[trees, G.tree], [poplars, G.poplar]]) {
    const im = new THREE.InstancedMesh(geo, VC_FLAT, list.length);
    list.forEach(([x, z, k], i) => place(im, i, x, hDam(x, z) - .1, z, k * TAU, .85 + k * .5));
    im.castShadow = true; im.receiveShadow = true; group.add(im);
  }
  const guards = new Crowd(subGroup(group), LOOKS.guards, 10);
  for (let i = 0; i < 6; i++) { const x = (i < 3 ? -1 : 1) * (6 + (i % 3) * 2.2), z = pz + 37 + (i % 3) * .6; guards.add({ at: () => [x, z, 0, 0] }); }
  guards.update(0, hDam);
  const procPath = new THREE.CatmullRomCurve3(DAM_ROUTE.map(p => new THREE.Vector3(p[0], 0, p[1])));
  const ridePath = new THREE.CatmullRomCurve3([[0, -8], [0, 40], [0, 90], [0, 200], [2, 500], [0, 1050]].map(p => new THREE.Vector3(p[0], 0, p[1])));
  return { group, h: hDam, path: procPath, procPath, ridePath, guards, gateLights };
}

// ─────────── the prayer: rows of men following the Imam, shown as a light ───────────
// Joint positions for standing (Q), bowing (R), prostrating (S) and sitting (J); frames in between are blended.
const PR_POSES = {
  Q: { hip: [0, .95, 0], neck: [0, 1.42, 0], head: [0, 1.56, .01], sh: [.2, 1.38, 0], el: [.24, 1.1, .02], ha: [.22, .84, .04], kn: [.09, .5, 0], an: [.09, .07, 0] },
  R: { hip: [0, .95, -.08], neck: [0, 1.04, .39], head: [0, 1.02, .53], sh: [.2, 1.0, .35], el: [.18, .77, .2], ha: [.12, .54, .06], kn: [.09, .5, -.02], an: [.09, .07, -.04] },
  S: { hip: [0, .48, -.12], neck: [0, .3, .36], head: [0, .16, .46], sh: [.2, .33, .32], el: [.3, .12, .34], ha: [.2, .03, .55], kn: [.12, .08, .1], an: [.1, .08, -.36] },
  J: { hip: [0, .3, -.2], neck: [0, .77, -.16], head: [0, .91, -.15], sh: [.2, .73, -.16], el: [.22, .5, -.04], ha: [.13, .33, .14], kn: [.12, .08, .22], an: [.1, .07, -.25] },
};
const PR_KEYS = [[0, 'Q'], [4, 'Q'], [5, 'R'], [7, 'R'], [8, 'Q'], [9, 'Q'], [10.4, 'S'], [12.2, 'S'], [13, 'J'], [14.2, 'J'], [15, 'S'], [16.8, 'S'], [18.2, 'Q'], [21.5, 'Q']];
let PR = null;
function prFrames() {
  if (PR) return PR;
  const list = [], idx = {}, trans = {};
  for (const k of 'QRSJ') { idx[k] = list.length; list.push(PR_POSES[k]); }
  const mix = (A, B, u) => Object.fromEntries(Object.keys(A).map(k => [k, A[k].map((v, i) => lerp(v, B[k][i], u))]));
  for (const [a, b] of [['Q', 'R'], ['Q', 'S'], ['S', 'J']]) {
    const seq = [idx[a]];
    for (let i = 1; i <= 3; i++) { seq.push(list.length); list.push(mix(PR_POSES[a], PR_POSES[b], i / 4)); }
    seq.push(idx[b]);
    trans[a + b] = seq; trans[b + a] = seq.slice().reverse();
  }
  return PR = { list, idx, trans };
}
function prFrameAt(t) {
  const K = PR_KEYS, L = K[K.length - 1][0], P = prFrames();
  if (t > L) t = K[1][0] + (t - K[1][0]) % (L - K[1][0]);
  t = Math.max(0, t);
  let k = 0; while (k < K.length - 2 && t >= K[k + 1][0]) k++;
  const [t0, A] = K[k], [t1, B] = K[k + 1];
  if (A === B) return P.idx[A];
  const seq = P.trans[A + B];
  return seq[Math.round(smooth(0, 1, (t - t0) / (t1 - t0)) * (seq.length - 1))];
}
function prayerGeo(J, look) {
  const parts = [], Y = new THREE.Vector3(0, 1, 0);
  const V = a => new THREE.Vector3(a[0], a[1], a[2]);
  const limb = (a, b, r0, r1, col) => {
    const A = V(a), d = V(b).sub(A), L = Math.max(d.length(), .01), g = new THREE.CylinderGeometry(r1, r0, L, 6);
    g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize())); g.translate(A.x, A.y, A.z);
    parts.push(colorize(onlyAttrs(g, ['position', 'normal']), new THREE.Color(col)));
  };
  const ball = (p, r, col, q = null, off = 0, sy = 1) => {
    const g = new THREE.SphereGeometry(r, 8, 6); g.scale(1, sy, 1); if (off) g.translate(0, off, 0); if (q) g.applyQuaternion(q); g.translate(p[0], p[1], p[2]);
    parts.push(colorize(onlyAttrs(g, ['position', 'normal']), new THREE.Color(col)));
  };
  const up = V(J.neck).sub(V(J.hip)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(Y, up);
  for (const s of [-1, 1]) {
    const m = p => [p[0] * s, p[1], p[2]], hipS = [.1 * s, J.hip[1], J.hip[2]];
    limb(hipS, m(J.kn), .12, .11, look.robe); limb(m(J.kn), m(J.an), .1, .08, look.robe);
    const foot = new THREE.BoxGeometry(.09, .06, .2); foot.translate(J.an[0] * s, .03, J.an[2] + (J.hip[1] - J.an[1] > .75 ? .05 : -.08));
    parts.push(colorize(onlyAttrs(foot, ['position', 'normal']), new THREE.Color('#3a2a1c')));
    limb(m(J.sh), m(J.el), .058, .052, look.robe); limb(m(J.el), m(J.ha), .052, .046, look.robe);
    ball(m(J.ha), .046, look.skin); ball(m(J.sh), .075, look.robe);
  }
  // a robe skirt while the legs are straight
  if (J.hip[1] - J.an[1] > .75) { const sk = new THREE.CylinderGeometry(.19, .27, J.hip[1] - .06, 8); sk.translate(0, (J.hip[1] - .06) / 2 + .06, J.hip[2] * .5); parts.push(colorize(onlyAttrs(sk, ['position', 'normal']), new THREE.Color(look.robe))); }
  else ball(J.hip, .2, look.robe, null, 0, .8);
  limb(J.hip, J.neck, .2, .16, look.robe);
  if (look.belt) { const b = new THREE.TorusGeometry(.19, .03, 4, 10); b.rotateX(Math.PI / 2); b.applyQuaternion(q); const p = V(J.hip).addScaledVector(up, .1); b.translate(p.x, p.y, p.z); parts.push(colorize(onlyAttrs(b, ['position', 'normal']), new THREE.Color(look.belt))); }
  ball(J.head, .105, look.skin);
  if (look.head === 'turban') {
    const cap = new THREE.SphereGeometry(.118, 8, 5, 0, TAU, 0, Math.PI / 2); cap.translate(0, .03, 0); cap.applyQuaternion(q); cap.translate(...J.head);
    parts.push(colorize(onlyAttrs(cap, ['position', 'normal']), new THREE.Color(look.cover)));
    const ring = new THREE.TorusGeometry(.105, .04, 5, 10); ring.rotateX(Math.PI / 2); ring.translate(0, .04, 0); ring.applyQuaternion(q); ring.translate(...J.head);
    parts.push(colorize(onlyAttrs(ring, ['position', 'normal']), new THREE.Color(look.cover)));
  } else {
    const cap = new THREE.SphereGeometry(.112, 8, 5, 0, TAU, 0, Math.PI / 2); cap.translate(0, .015, -.005); cap.applyQuaternion(q); cap.translate(...J.head);
    parts.push(colorize(onlyAttrs(cap, ['position', 'normal']), new THREE.Color(look.cover || '#1d1612')));
  }
  const g = mergeGeometries(parts); g.computeVertexNormals();
  return g;
}
class PrayerRows {
  // people: [{ x, z, hd, look, delay }]
  constructor(parent, looks, people) {
    this.group = subGroup(parent);
    const P = prFrames(), cap = looks.map((_, v) => people.filter(p => p.look === v).length);
    this.meshes = looks.map((look, v) => P.list.map(J => {
      const im = new THREE.InstancedMesh(prayerGeo(J, look), VC_FLAT, Math.max(1, cap[v]));
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; this.group.add(im); return im;
    }));
    this.people = people;
  }
  update(t, hf) {
    const counts = this.meshes.map(l => l.map(() => 0));
    for (const p of this.people) { const f = prFrameAt(t - p.delay); place(this.meshes[p.look][f], counts[p.look][f]++, p.x, hf(p.x, p.z), p.z, p.hd, 1); }
    this.meshes.forEach((l, v) => l.forEach((im, f) => { im.count = counts[v][f]; im.instanceMatrix.needsUpdate = true; }));
  }
}
function buildPrayer(S) {
  const g = subGroup(S.group), r = rng(17), x0 = 64, zc = pathSha(60), people = [];
  const looks = [LOOKS.kufans[0], LOOKS.kufans[2], LOOKS2.soldiers[0], LOOKS2.soldiers[1]];
  for (let row = 0; row < 7; row++) for (let k = 0; k < 12; k++) {
    const x = x0 - 1.6 - row * 1.35 + (r() - .5) * .12, z = zc + (k - 5.5) * .95 + (r() - .5) * .1;
    people.push({ x, z, hd: Math.PI / 2 + (r() - .5) * .05, look: row < 2 ? r() < .5 ? 0 : 1 : r() < .5 ? 2 : 3, delay: .15 + row * .07 + r() * .12 });
  }
  const rows = new PrayerRows(g, looks, people);
  const matC = [M.rugA, M.rugB, M.rugC];
  for (let row = 0; row < 7; row++) {
    const x = x0 - 1.6 - row * 1.35 + .25, mat = new THREE.Mesh(new THREE.BoxGeometry(1.1, .03, 11.8), matC[row % 3]);
    mat.position.set(x, hSha(x, zc) + .02, zc); mat.receiveShadow = true; g.add(mat);
  }
  const rug = new THREE.Mesh(new THREE.BoxGeometry(1.8, .03, 1.1), M.rugA); rug.position.set(x0 + 1.2, hSha(x0 + 1.2, zc) + .02, zc); g.add(rug);
  const imam = new Noor(1.3, 8); imam.group.position.set(x0 + 1.4, hSha(x0 + 1.4, zc), zc); g.add(imam.group);
  return { group: g, rows, imam, imamY: hSha(x0 + 1.4, zc) };
}

// ─────────── the road north, with Hurr's horsemen riding alongside ───────────
const pathEsc = x => 7 * Math.sin(x * .007);
const hEsc = makeDesert(17, 12, pathEsc);
function buildEscort(T) {
  const group = new THREE.Group();
  group.add(buildTerrain(hEsc, (x, z, y, c) => { sandColor(x, z, y, c, 12); c.lerp(SAND.gravel, .1); }, 2200, 280, .18));
  const r = rng(81);
  const spots = flatSpots(hEsc, 14, [-440, 440, -320, 320], (x, z) => Math.abs(z - pathEsc(x)) < 50, r, 40);
  const rocks = outcrops(spots, hEsc, r);
  group.add(instanced(T.rockA, rocks.filter((_, i) => i % 2)), instanced(T.rockB, rocks.filter((_, i) => !(i % 2))));
  group.add(tufts(spots, hEsc, r, 8));
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 22 }, (_, i) => { const x = -420 + i * 40; return new THREE.Vector3(x, 0, pathEsc(x)); }));
  return { group, h: hEsc, path };
}
function escortUpdate(path, lead, dt) {
  army.forEach((a, i) => {
    const s = lead + 6 - Math.floor(i / 2) * 3.4 + .6 * Math.sin(TIME * .23 + i * 1.7), lat = -24 - (i % 2) * 3 - .8 * Math.sin(TIME * .17 + i);
    const sp = a._ps === undefined || dt <= 0 ? 0 : Math.abs(s - a._ps) / dt; a._ps = s;
    poseOnPath(a.group, path, s, lat, H); a.setSpeed(sp); a.update(dt);
  });
}

// ─────────── Karbala: state shared by the later scenes ───────────
const M_ASH = new THREE.MeshStandardMaterial({ color: '#2a2521', roughness: 1, flatShading: true });
function ashHeap(t, seed) {
  let roof = null; t.body.traverse(o => { if (!roof && o.isMesh && (o.userData.mat0 || o.material) === M.tent) roof = o; });
  roof.geometry.computeBoundingBox();
  const b = roof.geometry.boundingBox, w = b.max.x - b.min.x, d = b.max.z - b.min.z, r = rng(seed), g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 16, 6, 0, TAU, 0, Math.PI / 2), P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = .75 + .45 * N.n2(P.getX(i) * 2.3 + seed, P.getZ(i) * 2.3); P.setXYZ(i, P.getX(i), P.getY(i) * k, P.getZ(i)); }
  geo.computeVertexNormals();
  const heap = new THREE.Mesh(geo, M_ASH); heap.scale.set(w * .5, .32, d * .55); heap.receiveShadow = true; g.add(heap);
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 1.6 + r() * 1.2, 5), M_CHAR); p.rotation.set(Math.PI / 2 - .1, r() * TAU, 0, 'YXZ'); p.position.set((r() - .5) * w * .6, .14, (r() - .5) * d * .5); g.add(p); }
  return g;
}
function burnTents(S, on) {
  S.tents.forEach((t, i) => {
    t.body.traverse(o => {
      if (!o.isMesh) return;
      const m0 = o.userData.mat0 || (o.userData.mat0 = o.material);
      if (m0 === M.wood) o.material = on ? M_CHAR : m0;
      else o.visible = !on;
    });
    if (on && !t.ash) { t.ash = ashHeap(t, i * 7 + 3); t.group.add(t.ash); }
    if (t.ash) t.ash.visible = on;
    t.body.scale.y = 1; t.body.rotation.z = 0;
  });
}
function karbalaReset(S) {
  caravan.standardOn = false;
  burnTents(S, false);
  S.tents.forEach(t => { t.group.visible = true; });
  S.alam.rotation.x = 0; S.alam.visible = true; S.camp.visible = true;
  ['ranks', 'riverLine', 'graves', 'huddle', 'zaynab', 'sajjadN', 'hurr', 'zul', 'lanterns', 'pilgrims', 'imamHorse'].forEach(k => vis(S[k], false));
  if (S.smolder) S.smolder.forEach(f => { f.visible = false; });
  S.campLight.color.set('#ffae5c');
}
function ensureRanks(S) {
  if (S.ranks) return;
  const r = rng(66), spots = [];
  for (let row = 0; row < 3; row++) for (let x = -230; x <= 230; x += 4.6) {
    if (row === 0 && Math.abs(x) < 46) continue;
    spots.push([x + (r() - .5) * 1.2 + (row % 2) * 2.3, -97 - row * 5 + (r() - .5) * 1.2, (r() - .5) * .25, Math.floor(r() * 4)]);
  }
  S.ranks = standingCavalry(S.group, spots, hKar);
}
function ranksFront() {
  // live horsemen in the middle of the front rank, so the line breathes
  army.forEach((a, i) => { if (i < 16) return; const k = i - 16, x = -42 + k * 3.65, z = -96.5 + (k % 2) * .8; setOnGround(a.group, x, z, (k % 5 - 2) * .04, H); a.hold = k % 3 ? 'Idle' : 'Idle_2'; a.play(a.hold, .01); });
}
function ensureRiverLine(S) {
  if (S.riverLine) return;
  const r = rng(71), spots = [];
  for (let x = -330; x <= 330; x += 5.2) spots.push([x + (r() - .5) * 1.5, zRiver(x) + 13 + (r() - .5) * 2, (r() - .5) * .3, Math.floor(r() * 4)]);
  S.riverLine = standingCavalry(S.group, spots, hKar);
}
// 72 floating lights in the camp, one for each of those who fell on Ashura
const ROLL = [
  { t: 3, en: 'al-Hurr ibn Yazid al-Riyahi', ar: 'الحر بن يزيد الرياحي', role: 'The commander who changed sides that morning' },
  { t: 5, en: 'Burayr ibn Khudayr', ar: 'برير بن خضير', role: 'A reciter and teacher of the Qurʾan from Kufa' },
  { t: 7, en: 'Wahb ibn ʿAbdullah al-Kalbi', ar: 'وهب بن عبد الله الكلبي', role: 'A young man who came with his mother and his wife' },
  { t: 9, en: 'Muslim ibn ʿAwsaja', ar: 'مسلم بن عوسجة', role: 'An old companion, loyal to his last breath' },
  { t: 11, en: 'Abu Thumama al-Saʾidi', ar: 'أبو ثمامة الصائدي', role: 'He reminded the Imam that it was time for the noon prayer' },
  { t: 12.8, en: 'Saʿid ibn ʿAbdullah al-Hanafi', ar: 'سعيد بن عبد الله الحنفي', role: 'He shielded the Imam with his body during the prayer' },
  { t: 14.6, en: 'Habib ibn Muzahir', ar: 'حبيب بن مظاهر', role: 'An elderly companion of the Prophet ﷺ and of Imam ʿAli' },
  { t: 16.4, en: 'Zuhayr ibn al-Qayn', ar: 'زهير بن القين', role: 'He had joined the caravan on the road' },
  { t: 18, en: 'Nafiʿ ibn Hilal', ar: 'نافع بن هلال', role: 'An archer who wrote his name on his arrows' },
  { t: 19.6, en: 'ʿAbis ibn Abi Shabib al-Shakiri', ar: 'عابس بن أبي شبيب الشاكري', role: 'A devoted Kufan who had come with Muslim’s letter' },
  { t: 21.2, en: 'Jawn', ar: 'جون مولى أبي ذر', role: 'An elderly African freedman of Abu Dharr al-Ghifari' },
  { t: 24, en: 'ʿAli al-Akbar ibn al-Hussain', ar: 'علي الأكبر بن الحسين', role: 'The Imam’s eldest son, who most resembled the Prophet ﷺ' },
  { t: 26.2, en: 'ʿAbdullah ibn Muslim ibn ʿAqil', ar: 'عبد الله بن مسلم بن عقيل', role: 'Son of Muslim ibn ʿAqil, the envoy to Kufa' },
  { t: 28.4, en: 'ʿAwn and Muhammad (AS)', ar: 'عون ومحمد', role: 'The sons of Sayyida Zaynab', n: 2 },
  { t: 30.6, en: 'al-Qasim ibn al-Hasan', ar: 'القاسم بن الحسن', role: 'Son of Imam al-Hasan, still a teenager' },
  { t: 33, en: 'al-ʿAbbas ibn ʿAli', ar: 'العباس بن علي', role: 'The standard-bearer, who went to the river for water for the children' },
  { t: 35.4, en: 'ʿAbdullah, the infant (AS)', ar: 'عبد الله الرضيع', role: 'The Imam’s baby son, also called ʿAli al-Asghar' },
  { t: 39.5, en: 'Imam al-Hussain ibn ʿAli', ar: 'الإمام الحسين بن علي', role: 'Grandson of the Prophet ﷺ. At the time of ʿAsr', imam: true },
];
const ROLL_ABBAS = ROLL.find(e => e.en.startsWith('al-ʿAbbas')).t;
class NoorField {
  constructor(parent, spots, hf) {
    this.group = subGroup(parent); this.n = spots.length;
    this.base = spots.map(([x, z, s]) => [x, hf(x, z) + (s > 1 ? 2.7 : 1.3), z, s]);
    this.cores = new THREE.InstancedMesh(NOOR_GEO, new THREE.MeshBasicMaterial({ color: NOOR_COL, fog: false }), this.n);
    this.cores.frustumCulled = false; this.group.add(this.cores);
    const pos = this.base.flatMap(b => [b[0], b[1], b[2]]);
    this.halo = new GlowPoints(pos, new THREE.Color(2.4, 2.15, 1.7), .8);
    this.aura = new GlowPoints(pos, new THREE.Color(1, .8, .5), 2.4);
    this.base.forEach((b, i) => { this.halo.size[i] = .8 * b[3]; this.aura.size[i] = 2.4 * b[3]; });
    this.group.add(this.aura.points, this.halo.points);
    this.light = new THREE.PointLight('#fff0cf', 0, 40, 1.4); this.light.position.set(0, hf(0, 0) + 3, 0); this.group.add(this.light);
    this.litCount = this.n;
  }
  // state(i) → [brightness, rise]
  set(state, dt = 0) {
    const P1 = this.halo.geo.attributes.position, P2 = this.aura.geo.attributes.position;
    let lit = 0;
    for (let i = 0; i < this.n; i++) {
      const [x, y0, z, s] = this.base[i], [k, rise] = state(i), y = y0 + rise + .08 * Math.sin(TIME * 1.3 + i * 1.7);
      if (rise === 0 && k > .5) lit++;
      this.cores.setMatrixAt(i, M4(x, y, z, 0, 0, 0, k > .02 ? .07 * s * Math.min(1.3, k) : 0));
      P1.setXYZ(i, x, y, z); P2.setXYZ(i, x, y, z);
      this.halo.alpha[i] = Math.min(1.4, k); this.aura.alpha[i] = .45 * Math.min(1, k);
      if (rise > 0 && k > .1 && dt > 0 && Math.random() < dt * 12) NOOR_MOTES.emit(x + (Math.random() - .5) * .3, y - .1, z + (Math.random() - .5) * .3, 0, .3, 0, 2, .06 * s, .02, .9);
    }
    this.cores.instanceMatrix.needsUpdate = P1.needsUpdate = P2.needsUpdate = true;
    this.halo.commit(); this.aura.commit();
    this.litCount = lit; this.light.intensity = 30 * lit / this.n;
  }
  posOf(i, t) { if (i < 0) return null; const [x, y0, z] = this.base[i], d = Math.max(0, t - SCENES.karbala.outT[i]); return labelV.set(x, y0 + 1.4 * d + .45 * d * d + .08 * Math.sin(TIME * 1.3 + i * 1.7), z); }
}
function ensureLanterns(S) {
  if (S.lanterns) return;
  const spots = [];
  for (let row = 0; row < 2; row++) for (let k = 0; k < 36; k++) {
    if (spots.length === 71) break;
    const a = (205 + (k + row * .5) * 130 / 35.5) * Math.PI / 180, R = row ? 16.6 : 13.8;
    spots.push([Math.cos(a) * R, 6 + Math.sin(a) * R * .85, row ? .75 : .7]);
  }
  spots.push([0, 3, 2.1]);
  S.lanterns = new NoorField(S.group, spots, hKar);
  // when each lantern goes out: the named at their moment, the others spread between them
  const r = rng(72), comp = [], fam = [];
  ROLL.forEach(e => { if (e.imam) return; for (let j = 0; j < (e.n || 1); j++) (e.t < 23 ? comp : fam).push(e.t + j * .35); });
  while (comp.length < 54) comp.push(3.6 + r() * 18);
  while (fam.length < 17) fam.push(24.6 + r() * 11.4);
  const times = [...comp, ...fam].sort((a, b) => a - b), order = Array.from({ length: 71 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  S.outT = new Array(72); order.forEach((li, k) => { S.outT[li] = times[k]; }); S.outT[71] = ROLL[ROLL.length - 1].t;
  S.hurrIdx = S.outT.indexOf(ROLL[0].t);
  // the family's lights are a little larger
  S.lanterns.base.forEach((b, i) => { if (i < 71 && S.outT[i] >= 23) b[3] = .85; S.lanterns.halo.size[i] = .8 * b[3]; S.lanterns.aura.size[i] = 2.4 * b[3]; });
}
// each light brightens for a moment, then rises and fades
function lanternsAt(S, t, dt = 0) {
  S.lanterns.set(i => { const d = t - S.outT[i]; if (d < -.8) return [1, 0]; if (d < 0) return [1 + .5 * smooth(-.8, 0, d), 0]; return [(1 - smooth(.3, 3.6, d)) * (1 + .5 * (1 - smooth(0, .8, d))), 1.4 * d + .45 * d * d]; }, dt);
}
function renderRoll(k) {
  const el = $('roll'), shown = ROLL.slice(Math.max(0, k - 4), k);
  el.innerHTML = '<div class="roll-h">They stood with Imam Hussain (AS)</div>' + shown.map((e, j) => `<div class="roll-i${j === shown.length - 1 ? ' new' : ''}${e.imam ? ' imam' : ''}"><div class="roll-n"><b>${esc(e.en)}</b><span class="ar" lang="ar" dir="rtl">${esc(e.ar)}</span></div><i>${esc(e.role)}</i></div>`).join('');
}
function hazeOfBattle(dt, rate = 5) {
  if (dt > 0 && Math.random() < dt * rate) { const x = -140 + Math.random() * 280, z = -86 + Math.random() * 50; DUST.emit(x, hKar(x, z) + .6, z, (Math.random() - .5) * 1.5, .4, (Math.random() - .5) * 1.5, 7, 10, 26, .22); }
}
function ensureGraves(S) {
  if (S.graves) return;
  const g = subGroup(S.group), r = rng(20);
  const mound = mergeGeometries([part(new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2), M4(0, 0, 0, 0, 0, 0, .75, .32, 1.6), '#6b5238')]);
  const spots = [];
  for (let i = 0; i < 70; i++) { const row = Math.floor(i / 10), k = i % 10; spots.push([-4 + k * 2.1 + (r() - .5) * .3 + (row % 2) * .8, -48 - row * 3.9 + (r() - .5) * .4]); }
  const im = new THREE.InstancedMesh(mound, VC_FLAT, spots.length);
  spots.forEach(([x, z], i) => place(im, i, x, hKar(x, z) - .05, z, Math.PI / 2 + (r() - .5) * .1, .9 + r() * .2));
  im.receiveShadow = im.castShadow = true; g.add(im);
  const big = new THREE.Mesh(mound, VC_FLAT); big.position.set(0, hKar(0, -40) - .05, -40); big.rotation.y = Math.PI / 2; big.scale.set(1.5, 1.6, 1.4); big.castShadow = true; g.add(big);
  const abbas = [-70, zRiver(-70) + 26];
  const ab = new THREE.Mesh(mound, VC_FLAT); ab.position.set(abbas[0], hKar(...abbas) - .05, abbas[1]); ab.rotation.y = Math.PI / 2; ab.scale.set(1.3, 1.4, 1.2); g.add(ab);
  const lamps = [];
  for (const [x, z, s] of [[0, -40, 1.4], [abbas[0], abbas[1], 1.2]]) { const n = new Noor(s, 14); n.group.position.set(x, hKar(x, z) + 1.9, z); g.add(n.group); lamps.push(n); }
  S.graveNoors = lamps;
  S.graves = g;
  const c = new Crowd(subGroup(S.group), LOOKS2.elders, 2);
  c.add({ look: 0, at: () => [-2.3, -38.6, Math.atan2(2.3, -1.4), 0] });
  c.add({ look: 1, at: () => [-3.6, -36.8, Math.atan2(3.6, -3.2), 0] });
  c.group = c.meshes[0][0].parent;
  S.pilgrims = c;
}

// ─────────── Kufa: the procession route through the city ───────────
function kufaProcession(S) {
  if (!S.procPath) S.procPath = new THREE.CatmullRomCurve3(KUF_ROUTE.map(p => new THREE.Vector3(p[0], 0, p[1])));
  if (!S.lining) S.lining = liningCrowd(S.group, LOOKS.kufans, S.procPath, 110, 250, 2.4, hKuf);
}
function damascusProcession(S) {
  if (!S.lining) S.lining = liningCrowd(S.group, LOOKS2.syrians, S.procPath, 190, 408, 2.5, hDam, (x, z) => z > DAM_WALL.z1 - 5 && z < DAM_WALL.z1 + 6);
}

// ─────────── the sermons of Sayyida Zaynab: shown line by line, Arabic above and English below ───────────
const SERMON_KUFA = { by: 'Sayyida Zaynab, to the people of Kufa', lines: [
  ['يا أهلَ الكوفة، يا أهلَ الخَتْلِ والغَدْر، أتَبكون؟ فلا رَقَأَتِ الدَّمعة', 'O people of Kufa, people of deceit and betrayal: do you weep? May your tears never dry.'],
  ['إنّما مَثَلُكم كمَثَلِ التي نَقَضَتْ غَزْلَها مِن بَعْدِ قُوّةٍ أنكاثاً', 'You are like the woman who unravels her yarn after she has spun it strong.'],
  ['فابكوا كثيراً، واضحكوا قليلاً', 'So weep much, and laugh little.'],
  ['أتدرونَ أيَّ كَبِدٍ لرسولِ اللهِ فَرَيْتُم؟', 'Do you know whose heart, so dear to the Messenger of God, you have torn apart?'],
] };
const SERMON_SHAM = { by: 'Sayyida Zaynab, in the court of Yazid', lines: [
  ['ثُمَّ كانَ عاقِبَةَ الذينَ أساءُوا السُّوأى أنْ كَذَّبوا بآياتِ الله', 'Then the end of those who did evil was the worst of ends, for they denied the signs of God.'],
  ['أظَنَنْتَ يا يزيدُ… أنَّ بنا على اللهِ هَواناً، وبكَ عليهِ كَرامة؟', 'Do you think, Yazid, that because we are led as captives we are lowly before God, and you are honoured by Him?'],
  ['فكِدْ كَيْدَك، واسْعَ سَعْيَك، وناصِبْ جُهْدَك', 'So plot your plots, strive your utmost, spare no effort:'],
  ['فوَاللهِ لا تَمْحو ذِكْرَنا، ولا تُميتُ وَحْيَنا', 'by God, you will never erase our remembrance, nor kill our revelation.'],
  ['وهل رأيُكَ إلّا فَنَد، وأيّامُكَ إلّا عَدَد، وجَمْعُكَ إلّا بَدَد؟', 'Is your judgement anything but folly, your days anything but numbered, your gathering anything but scattered?'],
] };
let SERMON_K = -1;
const LETTER_KUFA = { side: true, by: 'From one of the letters of Kufa', lines: [
  ['فقد اخضرّ الجَناب، وأينعت الثمار، وطمّت الجِمام، فإذا شئتَ فأقبِلْ على جُندٍ لك مُجنَّد', 'The land has turned green, the fruits are ripe and the wells are full. Come, if you wish, to an army mustered for you.'],
] };
function sermonAt(sm, t, t0 = 2.5, per = 6.4, timed = false) {
  // with the narrator on, each line appears as it is spoken
  const k = NARR.drive && !timed ? NARR.sermonK : clamp(Math.floor((t - t0) / per), -1, sm.lines.length - 1);
  if (k === SERMON_K) return;
  SERMON_K = k;
  const el = $('sermon'); el.hidden = false; el.classList.toggle('side', !!sm.side);
  el.innerHTML = `<div class="sermon-h">${esc(sm.by)}</div>` + (k < 0 ? '' : `<div class="sermon-l" key="${k}"><span class="ar" lang="ar" dir="rtl">${esc(sm.lines[k][0])}</span><p>“${esc(sm.lines[k][1])}”</p></div>`);
}
// Zaynab's light grows brighter and rises a little while she speaks
function zaynabSpeaks(t) { const n = caravan.camels[2].noor, k = smooth(1, 3, t); n.group.scale.setScalar(1 + .7 * k); n.group.position.y = 2.05 + .5 * k; }
// Yazid's court: an arcaded hall with a tiled floor, mosaics and shafts of evening light; the throne is left dark and empty
const HALL_Y = 300;
function hallTextures() {
  const floor = canvasTex(256, 256, (g, W) => {
    g.fillStyle = '#bfae8c'; g.fillRect(0, 0, W, W);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const cx = 64 + x * 128, cy = 64 + y * 128;
      g.fillStyle = (x + y) % 2 ? '#2f4a3c' : '#6b2a22';
      g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? 26 : 46; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill();
      g.strokeStyle = '#b8903e'; g.lineWidth = 3; g.stroke();
    }
    g.strokeStyle = 'rgba(120,96,60,.8)'; g.lineWidth = 4; g.strokeRect(0, 0, W, W);
    g.strokeStyle = 'rgba(184,144,62,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 128); g.lineTo(W, 128); g.moveTo(128, 0); g.lineTo(128, W); g.stroke();
  }, { repeat: [5, 10] });
  const band = canvasTex(512, 64, (g, W, Hh) => {
    g.fillStyle = '#23402f'; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= W; x += 4) g.lineTo(x, Hh / 2 + Math.sin(x / W * TAU * 4) * 16); g.stroke();
    g.fillStyle = '#d8b35a';
    for (let k = 0; k < 16; k++) { const x = (k + .5) * W / 16, y = Hh / 2 + Math.sin((x / W) * TAU * 4) * 16 + (k % 2 ? -12 : 12); g.beginPath(); g.ellipse(x, y, 7, 4, k, 0, TAU); g.fill(); }
    g.fillStyle = '#c9a24a'; g.fillRect(0, 0, W, 5); g.fillRect(0, Hh - 5, W, 5);
  }, { repeat: [6, 1] });
  const shaft = canvasTex(64, 256, (g, W, Hh) => {
    const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, 'rgba(255,215,150,.9)'); gr.addColorStop(1, 'rgba(255,215,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    const gx = g.createLinearGradient(0, 0, W, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.25, 'rgba(0,0,0,0)'); gx.addColorStop(.75, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, W, Hh);
  });
  return { floor, band, shaft };
}
function ensureHall(S) {
  if (S.hall) return;
  const g = subGroup(S.group), Y = HALL_Y, cz = 20, r = rng(29), T = hallTextures();
  const marble = new THREE.MeshStandardMaterial({ color: '#d6cab0', roughness: .38 }), stone = new THREE.MeshStandardMaterial({ color: '#6c5741', roughness: .95 });
  const panel = new THREE.MeshStandardMaterial({ color: '#a8977a', roughness: .5 }), wood = new THREE.MeshStandardMaterial({ color: '#34251a', roughness: .8 });
  const add = (geo, mat, x, y, z, ry = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, Y + y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
  const L = 46, W = 24;
  add(new THREE.BoxGeometry(W, .4, L), new THREE.MeshStandardMaterial({ map: T.floor, roughness: .32 }), 0, -.2, cz, 0, false);
  add(new THREE.BoxGeometry(3.4, .05, 36), M.rugA, 0, .03, cz + 4, 0, false);
  for (const x of [-W / 2 - .4, W / 2 + .4]) { add(new THREE.BoxGeometry(.8, 12, L), stone, x, 6, cz); add(new THREE.BoxGeometry(.1, 2.6, L - .4), panel, x - Math.sign(x) * .45, 1.3, cz); add(new THREE.BoxGeometry(.06, 1.1, L - .4), new THREE.MeshStandardMaterial({ map: T.band, roughness: .5, metalness: .2 }), x - Math.sign(x) * .44, 8.2, cz); }
  for (const z of [cz - L / 2 - .4, cz + L / 2 + .4]) add(new THREE.BoxGeometry(W + 1.6, 12, .8), stone, 0, 6, z);
  add(new THREE.BoxGeometry(W + 1.6, .6, L + 1.6), wood, 0, 12.2, cz);
  // arcades: columns carrying horseshoe arches, one row on each side of the nave
  const colG = new THREE.CylinderGeometry(.42, .5, 6.2, 14), capG = new THREE.BoxGeometry(1.1, .45, 1.1), archG = new THREE.TorusGeometry(2.95, .34, 8, 28, Math.PI * 1.18);
  archG.rotateZ(-Math.PI * .09);
  for (const x of [-6.2, 6.2]) {
    for (let k = 0; k < 7; k++) { const z = cz - 18 + k * 6; add(colG, marble, x, 3.1, z); add(capG, M.gold, x, 6.42, z); }
    for (let k = 0; k < 6; k++) { const a = add(archG, marble, x, 6.5, cz - 15 + k * 6, Math.PI / 2); a.castShadow = false; }
    add(new THREE.BoxGeometry(.7, 2.3, 36.8), stone, x, 10.5, cz - 3);
    add(new THREE.BoxGeometry(.12, 1, 36.8), new THREE.MeshStandardMaterial({ map: T.band, roughness: .5, metalness: .2 }), x - Math.sign(x) * .41, 10.2, cz - 3);
  }
  // high windows on the west wall with shafts of evening light
  const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.35, .8) }), shaftM = new THREE.MeshBasicMaterial({ map: T.shaft, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let k = 0; k < 5; k++) {
    const z = cz - 14 + k * 7;
    add(new THREE.PlaneGeometry(1.2, 2.2), winM, W / 2 - .02, 9.3, z, -Math.PI / 2, false);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 13), shaftM); sh.position.set(W / 2 - 4.6, Y + 4.4, z - 1.2); sh.rotation.set(0, -Math.PI / 2, .56); g.add(sh);
  }
  // the far end: steps up to a dais before a dark curtain (Yazid and his throne are not shown)
  for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(12 - k * 2, .32, 6 - k * 1.2), marble, 0, .16 + k * .32, cz - 19.6 + k * .5);
  add(new THREE.PlaneGeometry(W - 1, 10), new THREE.MeshStandardMaterial({ color: '#2a0f0e', roughness: .9, side: THREE.DoubleSide }), 0, 5.4, cz - L / 2 + .1, 0, false);
  // hanging lamp rings along the nave
  S.hallLamp = new THREE.MeshStandardMaterial({ color: '#2a1a0c', emissive: '#ffae55', emissiveIntensity: 2.6 });
  for (const z of [cz - 12, cz - 3, cz + 6, cz + 15]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.9, .04, 6, 24), M.gold); ring.rotation.x = Math.PI / 2; ring.position.set(0, Y + 7.8, z); g.add(ring);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, c = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), S.hallLamp); c.position.set(Math.cos(a) * .9, Y + 7.9, z + Math.sin(a) * .9); g.add(c); }
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 4, 4), M.lampFrame); ch.position.set(0, Y + 9.9, z); g.add(ch);
  }
  S.hallLights = [[cz - 8, 20], [cz + 10, 20]].map(([z, i]) => { const Lt = new THREE.PointLight('#ffb468', i, 30, 1.5); Lt.position.set(0, Y + 7.2, z); g.add(Lt); return Lt; });
  // the court: onlookers in the side aisles, guards by the dais
  const hf = () => Y, court = new Crowd(subGroup(g), [...LOOKS2.syrians, ...LOOKS.guards], 12);
  for (let k = 0; k < 36; k++) { const side = k % 2 ? 1 : -1, z = cz - 14 + (k >> 1) * 1.75 + (r() - .5) * .6, x = side * (8 + r() * 2.2); court.add({ look: Math.floor(r() * 5), scale: .95 + r() * .1, at: () => [x, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0] }); }
  for (let k = 0; k < 4; k++) { const x = (k < 2 ? -1 : 1) * (3.8 + (k % 2) * 1.5); court.add({ look: 5, at: () => [x, cz - 16.2, 0, 0] }); }
  court.update(0, hf);
  // the captives: Imam Zayn al-ʿAbidin at the front, Sayyida Zaynab just behind him, the women and children behind them
  const zb = new Noor(1.2, 3); zb.group.position.set(0, Y + 1.7, cz - .4); g.add(zb.group);
  const zn = new Noor(1.3, 6); zn.group.position.set(1.9, Y + 1.7, cz + 1.4); g.add(zn.group);
  for (let k = 0; k < 8; k++) { const n = new Noor(.42 + r() * .12, 0), x = -3 + (k % 4) * 2 + (r() - .5) * .6, z = cz + 5 + Math.floor(k / 4) * 1.8 + (r() - .5) * .5; n.group.position.set(x, Y + 1 + r() * .4, z); g.add(n.group); }
  S.hallZ = { zn, zb };
  // a ring of light spreads across the floor as each line is spoken
  S.hallRing = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  S.hallRing.rotation.x = -Math.PI / 2; S.hallRing.position.set(1.9, Y + .06, cz + 1.4); g.add(S.hallRing); S.hallRing.t = 9;
  S.hall = g;
}
// ─────────── the steps ───────────
const CH1_STEPS = [
  {
    scene: 'damascus', env: 'night', dur: 18, mapStop: 0, mapCity: 'Damascus', km: null, mcKm: 'Capital of the Umayyad rulers', chN: 1,
    ch: 'Chapter 1 · The Refusal', title: 'Orders from Damascus', place: 'Damascus', ar: 'دمشق', date: 'Rajab 60 AH', stat: 'More than 1,000 km to Medina',
    shortY: 'The ruler Muʿawiya died and his son Yazid took power. Yazid sent orders to Medina: make Hussain obey me.',
    shortF: 'On Muʿawiya’s death Yazid seized the caliphate and ordered Medina’s governor to take Hussain’s pledge at once.',
    young: 'In the year 60 AH, the ruler Muʿawiya died, and his son Yazid took his place. Yazid openly broke the rules of Islam, yet he wanted everyone to promise to obey him. He sent a rider with a letter to his governor in Medina: “Make Hussain promise loyalty to me, and give him no time to think.”',
    full: 'Muʿawiya died in Rajab 60 AH and his son Yazid succeeded him, against the terms of the peace Muʿawiya had made with Imam al-Hasan (AS). Yazid wrote at once to al-Walid ibn ʿUtba, governor of Medina, ordering him to take the oath of allegiance from Hussain (AS), ʿAbdullah ibn ʿUmar and ʿAbdullah ibn al-Zubayr, forcefully and without delay. Some reports add that he ordered Hussain killed if he refused.',
    people: [['Yazid ibn Muʿawiya', 'يزيد بن معاوية'], ['al-Walid ibn ʿUtba', 'الوليد بن عتبة', 'full']],
    reflect: 'What would you do if someone powerful demanded that you support something wrong?',
    note: 'Yazid is not shown. The green-domed palace of the Umayyads, known as al-Khadra, stands for his court.',
    ride: T => accelS(T, 2, 8),
    shot: {
      dur: 18,
      apply(t) {
        // waits in the street inside the gate, then follows him out through the gate opening
        const p = SCENES.damascus.messenger.group.position, a = ease(clamp(t / 7, 0, 1)), b = smooth(58, 90, p.z);
        const cz = lerp(76, p.z - 13, b), cx = p.x + lerp(6, 3.2, b) + 4.5 * smooth(100, 125, cz);
        camera.position.x = lerp(60, cx, a); camera.position.z = lerp(150, cz, a);
        camera.position.y = hDam(camera.position.x, camera.position.z) + lerp(58, 3.3, a);
        focus.set(lerp(0, p.x, a), lerp(12, p.y + 1.8, a), lerp(-48, p.z + 6 * b, a));
        camera.lookAt(focus);
      },
    },
    enter(S) {
      armyShow(0); caravanShow(false); vis(S.lining, false); vis(S.hall, false);
      if (!S.messenger) { S.messenger = new HorseUnit(TPL.horse, 'black', 'civil', 2); S.group.add(S.messenger.group); }
      S.messenger.group.visible = true; S.messenger._ps = undefined;
    },
    update(t, dt, S, T) {
      caravanShow(false);
      const sp = rideOn(S.messenger, S.ridePath, this.ride(T), dt, hDam);
      S.messenger.setSpeed(sp); S.messenger.update(dt);
      if (sp > 3 && dt > 0 && Math.random() < dt * 8) { const p = S.messenger.group.position; DUST.emit(p.x + (Math.random() - .5), p.y + .3, p.z - 1, (Math.random() - .5), .8, -1.5, 2.5, 1.5, 6, .35); }
    },
  },
];
const CH4_STEPS = [
  {
    scene: 'sharaf', env: 'noon', dur: 20, mapStop: 10, km: 1809, chN: 4,
    ch: 'Chapter 4 · Meeting Hurr', title: 'Praying together', place: 'Sharaf', ar: 'شراف', date: 'End of Dhu al-Hijja 60 AH', stat: 'Two armies, one prayer',
    shortY: 'At prayer time, Hurr and his soldiers chose to pray behind Imam Hussain.',
    shortF: 'At the noon prayer Hurr declined to lead his own men; both groups prayed behind Hussain (AS).',
    young: 'When it was time for the noon prayer, Imam Hussain asked Hurr: “Will you lead your own men in prayer?” Hurr said, “No, we will pray behind you.” So the caravan and the army that had come to stop it prayed together, in the same rows.',
    full: 'When the time of the noon prayer came, Hussain (AS) had the adhan called and asked Hurr whether he would lead his own men. Hurr replied that they would pray behind Hussain. Afterwards Hussain (AS) addressed them and produced saddlebags full of the letters Kufa had sent. Hurr answered that he was not one of those who had written.',
    reflect: 'The soldiers prayed behind Imam Hussain, yet still obeyed orders against him. Why might that be?',
    note: 'Imam Hussain (AS) leads the prayer, shown as the light in front of the rows.',
    shot: new Shot([[57, 2.4, 17], [70, 2.8, 13], [76.5, 2.6, 5]], [[60, 1, 2.6], [60, 1, 2.6], [59, 1.1, 2.4]], 20),
    enter(S) {
      armyShow(40); caravanLamps(.5); resetCaravan();
      army.forEach((a, i) => { const f = SHA_FORM[i]; setOnGround(a.group, f.ex, f.ez, 0, H); a.hold = i % 3 ? 'Idle' : 'Idle_2'; a.play(a.hold, .01); if (a.rider) a.rider.visible = false; });
      if (!S.prayer) S.prayer = buildPrayer(S);
      vis(S.prayer, true);
    },
    update(t, dt, S, T) {
      caravanUpdate(S.path, 225, dt);
      army.forEach(a => { a.setSpeed(0); a.update(dt); });
      massUpdate(S.mass, 100, dt);
      S.prayer.rows.update(T, hSha);
      S.prayer.imam.group.position.y = S.prayer.imamY + prFrames().list[prFrameAt(T)].head[1] + .12;
    },
  },
  {
    scene: 'escort', env: 'evening', dur: 18, mapStop: 12, km: 1864, chN: 4,
    ch: 'Chapter 4 · Meeting Hurr', title: 'Escorted north', place: 'al-Baydha → Qasr Bani Muqatil', ar: 'البيضة · قصر بني مقاتل', date: 'End of Dhu al-Hijja 60 AH', stat: '~1,864 km from Medina',
    shortY: 'Hurr would not let the caravan go home, so his soldiers rode beside it, day after day.',
    shortF: 'Barred from both Kufa and Medina, the caravan moved north-west with Hurr’s horsemen riding alongside.',
    young: 'Hurr had orders not to let Imam Hussain go, so the two groups travelled side by side for days, the soldiers watching the caravan. Imam Hussain’s son ʿAli al-Akbar asked his father, “Are we not on the side of truth?” “Yes,” said the Imam. “Then we are not afraid,” said ʿAli al-Akbar.',
    full: 'Hurr would neither let Hussain (AS) return to Medina nor take him into Kufa, so they agreed on a road that led to neither, and the caravan moved north-west with Hurr’s horsemen alongside. At al-Baydha Hussain (AS) addressed Hurr’s men, reminding them of the Prophet’s words about those who stay silent before a tyrant. Near Qasr Bani Muqatil he woke from a short rest reciting “To God we belong and to Him we return”. His son ʿAli al-Akbar asked, “Are we not in the right?” When he answered yes, ʿAli al-Akbar said: “Then we do not mind if we die in the right.”',
    quote: { q: 'Are we not in the right? … Then we do not mind if we die in the right.', by: 'ʿAli al-Akbar, son of Imam Hussain (AS)' },
    people: [['ʿAli al-Akbar ibn al-Hussain', 'علي الأكبر بن الحسين'], ['al-Hurr ibn Yazid al-Riyahi', 'الحر بن يزيد الرياحي', 'full']],
    lead: T => 170 + 1.3 * T,
    shot: new Shot([[-222, 3.6, 18], [-238, 8, 36], [-280, 20, 52]], [[-262, 2.2, -12], [-258, 2, -14], [-232, 3, -16]], 18),
    enter(S) { armyShow(40); caravanLamps(.35); resetCaravan(); army.forEach(a => { a._ps = undefined; if (a.rider) a.rider.visible = true; }); },
    update(t, dt, S, T) { caravanUpdate(S.path, this.lead(T), dt); escortUpdate(S.path, this.lead(T), dt); },
  },
];
const CH5_STEPS = [
  {
    scene: 'karbala', env: 'noon', dur: 18, mapStop: 13, km: 1894, chN: 5,
    ch: 'Chapter 5 · Karbala', title: 'The river is closed', place: 'Karbala', ar: 'كربلاء', date: '7 Muharram 61 AH', stat: 'Three days without water',
    shortY: 'Thousands of soldiers arrived, and they blocked the river so the camp could not get water.',
    shortF: 'ʿUmar ibn Saʿd’s army grew into the thousands; from 7 Muharram its horsemen held the riverbank.',
    young: 'More and more soldiers arrived, until thousands surrounded the small camp. On 7 Muharram, horsemen lined the riverbank so no one from Imam Hussain’s camp could reach the water. In the burning heat, even the children had nothing to drink.',
    full: 'ʿUmar ibn Saʿd arrived with 4,000 men, and reinforcements swelled his army to many thousands; reports range as high as 30,000. On 7 Muharram Ibn Ziyad ordered the water cut off, and 500 horsemen under ʿAmr ibn al-Hajjaj took the banks of the Euphrates. For three days the camp, children included, went without water. On the 9th the army advanced, and Hussain (AS) asked for one more night, to spend in prayer.',
    people: [['ʿUmar ibn Saʿd', 'عمر بن سعد'], ['ʿAmr ibn al-Hajjaj', 'عمرو بن الحجاج', 'full']],
    reflect: 'Think of the last time you were really thirsty. Now imagine three days in the desert heat.',
    shot: new Shot([[-30, 6, -196], [8, 9, -193], [2, 22, -176]], [[-5, 1.5, -222], [4, 1.5, -224], [0, 1, -228]], 18),
    enter(S) {
      karbalaReset(S); armyShow(12); caravanLamps(0); resetCaravan();
      S.enemy.visible = true; ensureRiverLine(S); vis(S.riverLine, true);
      const r = rng(8); army.forEach((a, i) => { if (i < 12) { a.patrol = { x0: -160 + i * 28, ph: r() * TAU }; a.hold = null; } });
      campLamps(S, 0);
    },
    update(t, dt, S) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      army.forEach((a, i) => {
        if (i >= 12) return;
        const w = .1, x = a.patrol.x0 + 18 * Math.sin(TIME * w + a.patrol.ph), vx = 18 * w * Math.cos(TIME * w + a.patrol.ph);
        setOnGround(a.group, x, zRiver(x) + 21, vx > 0 ? Math.PI / 2 : -Math.PI / 2, H); a.setSpeed(Math.abs(vx)); a.update(dt);
      });
    },
  },
];
const CH67_STEPS = [
  {
    scene: 'karbala', env: 'dawn', dur: 24, mapStop: 13, km: 1894, chN: 6,
    ch: 'Chapter 6 · Ashura', title: 'Hurr’s choice', place: 'Karbala', ar: 'يوم عاشوراء', date: '10 Muharram 61 AH', stat: 'The morning of Ashura',
    shortY: 'On the morning of Ashura, Hurr left the enemy army and rode to Imam Hussain to ask forgiveness.',
    shortF: 'At dawn on Ashura, al-Hurr turned away from ʿUmar ibn Saʿd’s ranks and came over to Hussain (AS).',
    young: 'On the morning of Ashura, the enemy army lined up. Hurr sat on his horse, trembling. He had stopped Imam Hussain on the road, and now he saw where it had led. He rode slowly out of the line towards Imam Hussain’s camp. Imam Hussain rode out to meet him, and Hurr asked, “Can someone like me be forgiven?” Imam Hussain forgave him and welcomed him into the camp.',
    full: 'At dawn on 10 Muharram the army of ʿUmar ibn Saʿd drew up in its ranks. al-Hurr ibn Yazid, trembling, edged his horse away from them and rode to Hussain’s camp, asking whether his repentance could be accepted. Hussain (AS) rode out to him and welcomed him. Hurr was among the first of the companions to fall that day.',
    quote: { q: 'You are al-Hurr, free, as your mother named you: free in this world and in the Hereafter.', by: 'Imam Hussain (AS), to Hurr' },
    people: [['al-Hurr ibn Yazid al-Riyahi', 'الحر بن يزيد الرياحي']],
    reflect: 'Is it ever too late to change your mind and do what is right?',
    shot: new Shot([[-11, 2.8, -22.5], [-11, 2.5, -30], [-8, 2.3, -40]], [[18, 2.5, -84], [12, 2, -58], [6.4, 1.9, -38]], 24),
    enter(S) {
      karbalaReset(S); armyShow(40); caravanLamps(0); resetCaravan();
      S.enemy.visible = true; ensureRanks(S); vis(S.ranks, true);
      army.forEach((a, i) => { if (i < 16) a.group.visible = false; }); ranksFront();
      if (!S.hurr) { S.hurr = new HorseUnit(TPL.horse, 'chestnut', true, 5); S.group.add(S.hurr.group); }
      vis(S.hurr, true); S.hurr._ps = undefined; S.hurrBack = false;
      ensureLanterns(S); vis(S.lanterns, true);
      if (!S.imamHorse) {
        // Imam Hussain rides out on his white horse, his light above the saddle
        S.imamHorse = new HorseUnit(TPL.horse, 'white', false, 0); S.imamHorse.noor = new Noor(1.25, 8); S.imamHorse.group.add(S.imamHorse.noor.group); S.group.add(S.imamHorse.group);
        const C = pts => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1])));
        S.meet = { imamOut: C([[-5, -22], [0, -27.5], [5.5, -35]]), imamBack: C([[5.5, -35], [2.5, -29], [-1.5, -23]]), hurrIn: C([[18, -86], [15, -68], [10, -52], [7.6, -41.5]]), hurrBack: C([[7.6, -41.5], [6, -33], [3, -26.5]]) };
      }
      vis(S.imamHorse, true); S.imamHorse._ps = undefined;
      campLamps(S, .25);
    },
    update(t, dt, S, T) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      caravan.horses.forEach(h => { h.group.visible = false; });
      army.forEach((a, i) => { if (i >= 16) { a.setSpeed(0); a.update(dt); } });
      S.lanterns.set(i => [i === S.hurrIdx ? smooth(18, 19.5, t) : i === 71 ? 0 : 1, 0], dt);
      // Hurr rides out of the ranks and reins in; Imam Hussain rides out to meet him; after a pause they ride back to the camp together
      const MT = S.meet, back = T >= 22.5;
      if (back && !S.hurrBack) { S.hurrBack = true; S.hurr._ps = undefined; S.imamHorse._ps = undefined; }
      const hs = back ? rideOn(S.hurr, MT.hurrBack, Math.min(accelS(T, 22.5, 1.1), MT.hurrBack.getLength()), dt, hKar) : rideOn(S.hurr, MT.hurrIn, cruise(t, 1.5, MT.hurrIn.getLength(), 3.3), dt, hKar);
      S.hurr.setSpeed(hs); S.hurr.update(dt);
      const is = back ? rideOn(S.imamHorse, MT.imamBack, Math.min(accelS(T, 22.5, 1.1), MT.imamBack.getLength()), dt, hKar) : rideOn(S.imamHorse, MT.imamOut, cruise(t, 5, MT.imamOut.getLength(), 1.3), dt, hKar);
      S.imamHorse.setSpeed(is); S.imamHorse.update(dt);
    },
  },
  {
    scene: 'karbala', env: 'dusk', envFrom: 'noon', envT: 44, dur: 46, mapStop: 13, km: 1894, chN: 6,
    narrRoll: true, narrQuoteLast: true, envClock: S => S.rollT || 0,
    // the narrator reads the names; each light rises as its name is spoken
    narrExtra: (young, S, seen) => ROLL.filter(e => e.t >= (S.rollT || 0) - .5).map(e => ({ say: spokenSeq([young ? e.en + '.' : `${e.en}. ${e.role}.`], seen)[0], sub: '', gap: e.imam ? 1600 : 900, hook: () => { NARR.rollTarget = e.t + 1.4; } })),
    ch: 'Chapter 6 · Ashura', title: 'The roll of honour', place: 'Karbala', ar: 'يوم عاشوراء', date: '10 Muharram 61 AH',
    stat: () => { const n = SCENES.karbala && SCENES.karbala.lanterns ? SCENES.karbala.lanterns.litCount : 72; return n ? `${n} of 72 lights remain` : 'All 72 lights have risen'; },
    shortY: 'One by one, Imam Hussain’s companions and family gave their lives. Each light stands for one of them.',
    shortF: 'Through the day the companions, then the men of the Prophet’s family, fell one by one. Each light is one of the 72.',
    young: 'On the day of Ashura, Imam Hussain’s companions and family stood by him, one by one, until the end. Each light here stands for one of them, and when each one fell, their light rose up. The names you see are some of the best known. By the afternoon, all 72 lights had risen.',
    full: 'Through 10 Muharram the companions went out one by one, and after them the men of the Prophet’s family. At noon Hussain (AS) led the prayer in the open while Saʿid ibn ʿAbdullah al-Hanafi shielded him with his own body. al-ʿAbbas fell by the river, trying to bring water for the children. By the time of ʿAsr, Hussain (AS) stood alone.',
    reflect: 'Choose one of these names. What would you like to find out about them?',
    quote: { q: 'Do not think of those killed in the way of God as dead. Rather, they are alive with their Lord.', by: 'Qurʾan 3:169' },
    note: 'There is no battle here. Each light stands for one person and rises when they fall. Only some of the names are shown, and accounts differ on the exact order.',
    shot: new Shot([[0, 6.5, 32], [9, 4.6, 22], [-5, 4.2, 19]], [[0, 1, -10], [0, 1, -8], [0, 1.4, -12]], 46),
    enter(S) {
      karbalaReset(S); armyShow(40); caravanLamps(0); resetCaravan();
      S.enemy.visible = true; ensureRanks(S); vis(S.ranks, true);
      army.forEach((a, i) => { if (i < 16) a.group.visible = false; }); ranksFront();
      ensureLanterns(S); vis(S.lanterns, true); lanternsAt(S, 0);
      campLamps(S, 0);
      $('roll').hidden = false; S.rollK = -1; S.rollT = 0; renderRoll(0);
    },
    update(t, dt, S) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      army.forEach((a, i) => { if (i >= 16) { a.setSpeed(0); a.update(dt); } });
      caravan.horses.forEach(h => { h.group.visible = false; });
      // the roll's own clock: step time, or held back to keep pace with the narrator
      const tr = S.rollT = NARR.drive ? Math.min((S.rollT || 0) + dt, NARR.rollTarget) : t;
      lanternsAt(S, tr, dt);
      const k = ROLL.filter(e => tr >= e.t).length;
      if (k !== S.rollK) { if (k > S.rollK && S.rollK >= 0) sndWhoosh(); S.rollK = k; renderRoll(k); }
      S.alam.rotation.x = .9 * smooth(ROLL_ABBAS, ROLL_ABBAS + 2.5, tr);
      hazeOfBattle(dt, 4 * (1 - smooth(38, 42, tr)));
    },
  },
  {
    scene: 'karbala', env: 'dusk', dur: 18, mapStop: 13, km: 1894, chN: 6,
    ch: 'Chapter 6 · Ashura', title: 'The horse comes home', place: 'Karbala', ar: 'يوم عاشوراء', date: '10 Muharram 61 AH, ʿAsr', stat: 'The afternoon of Ashura',
    shortY: 'In the afternoon, Imam Hussain’s horse came back to the tents alone. Everyone knew what it meant.',
    shortF: 'At ʿAsr Hussain (AS) was killed, thirsty, on the plain. His horse returned to the tents without its rider.',
    young: 'In the afternoon, Imam Hussain’s horse came back to the tents without him. The women and children understood: Imam Hussain had been killed, far from the water, on the day of Ashura. He was 57 years old.',
    full: 'At the time of ʿAsr on 10 Muharram 61 AH, Hussain (AS), grandson of the Prophet ﷺ, was killed, thirsty, on the plain of Karbala, having refused to the last to give his hand to Yazid. His horse, remembered as Dhu al-Janah, returned to the tents without its rider, and the women knew what had happened.',
    quote: { q: 'I see death as nothing but happiness, and life with oppressors as nothing but misery.', by: 'Imam Hussain (AS), on the road to Karbala' },
    note: 'The riderless horse, Zuljanah, is how this moment is remembered in Muharram processions to this day.',
    shot: new Shot([[26, 2.4, -34], [20, 2.1, -37], [14, 1.9, -39]], [[8, 1.8, -62], [6, 1.6, -52], [4, 1.3, -43]], 18),
    enter(S) {
      karbalaReset(S); armyShow(40); caravanLamps(0); resetCaravan();
      S.enemy.visible = true; ensureRanks(S); vis(S.ranks, true);
      army.forEach((a, i) => { if (i < 16) a.group.visible = false; }); ranksFront();
      ensureLanterns(S); vis(S.lanterns, false);
      S.alam.rotation.x = .9; campLamps(S, 0);
      if (!S.zul) { S.zul = new HorseUnit(TPL.horse, 'white', false, 9); S.group.add(S.zul.group); }
      vis(S.zul, true); S.zul._prev = undefined; S.zul._curve = null; S.zul.drink(false, 0);
    },
    update(t, dt, S) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      army.forEach((a, i) => { if (i >= 16) { a.setSpeed(0); a.update(dt); } });
      caravan.horses.forEach(h => { h.group.visible = false; });
      const sp = rideAlong(S.zul, [[17, -72], [12, -58], [7, -47], [4.5, -42.5]], 1, 15.5, t, dt, hKar);
      if (t > 15.8) S.zul.drink(true, TIME * .3); else S.zul.setSpeed(sp);
      S.zul.update(dt);
      hazeOfBattle(dt, 1.5);
    },
  },
  {
    scene: 'karbala', env: 'lastnight', dur: 18, mapStop: 13, km: 1894, chN: 7,
    ch: "Chapter 7 · The Captives' Journey", title: 'The night of the strangers', place: 'Karbala', ar: 'ليلة الحادي عشر', date: 'Evening of 10 Muharram 61 AH', stat: 'The women and children, alone',
    shortY: 'That night the tents were burned. Sayyida Zaynab stayed awake, watching over the children.',
    shortF: 'The camp was plundered and burned; Sayyida Zaynab kept watch over the women, the children and the ailing Imam.',
    young: 'That evening the soldiers set the tents on fire. Now the women and children were alone in the dark. Sayyida Zaynab, Imam Hussain’s sister, stayed awake all night, walking around the children to keep them safe and caring for Imam Hussain’s son ʿAli, who was very ill.',
    full: 'On the evening of Ashura the camp was plundered and the tents set alight. The surviving women and children, with the gravely ill ʿAli ibn al-Hussain, Imam Zayn al-ʿAbidin, spent the night in the open. Sayyida Zaynab kept watch over them until dawn; it is said that from exhaustion she offered her night prayer sitting down. The night is remembered as Sham-e Ghariban, the evening of the strangers.',
    people: [['Sayyida Zaynab bint ʿAli', 'زينب بنت علي'], ['Imam ʿAli Zayn al-ʿAbidin', 'علي زين العابدين']],
    note: 'Zaynab is shown as the light that keeps circling the small lights of the children; the low light among them is the ailing Imam Zayn al-ʿAbidin.',
    shot: new Shot([[-26, 7, 28], [-10, 4.4, 17], [3, 3.2, 12]], [[0, 1.4, 0], [-2, 1, 2], [-2, .9, 3]], 18),
    enter(S) {
      karbalaReset(S); armyShow(0); caravanLamps(0); caravanShow(false);
      S.enemy.visible = true; burnTents(S, true); S.alam.visible = false; campLamps(S, 0);
      if (!S.huddle) {
        const pts = [], r = rng(11);
        for (let i = 0; i < 16; i++) { const a = r() * TAU, d = .8 + r() * 2.2, x = -2 + Math.cos(a) * d, z = 3 + Math.sin(a) * d * .8; pts.push(x, hKar(x, z) + .5 + r() * .3, z); }
        S.huddle = new GlowPoints(pts, new THREE.Color(2.4, 2.15, 1.7), .42); S.group.add(S.huddle.points); S.huddle.group = S.huddle.points; S.huddle.alpha.fill(.8); S.huddle.commit();
        S.zaynab = subGroup(S.group); const zn = new Noor(1, 5); zn.group.position.y = 1.5; S.zaynab.add(zn.group);
        S.sajjadN = new Noor(.85, 2); S.sajjadN.group.position.set(-2, hKar(-2, 3) + .55, 3); S.group.add(S.sajjadN.group);
      }
      vis(S.huddle, true); vis(S.zaynab, true); vis(S.sajjadN, true);
      if (!S.smolder) S.smolder = [1, 4, 7].map((ti, k) => { const p = S.tents[ti].group.position, f = new THREE.Group(); f.position.set(p.x + .6, p.y + .15, p.z); const fl = [0, 1].map(j => { const m = new THREE.Mesh(FLAME_GEO, j ? FLAME_OUT : FLAME_IN); m.position.x = (j - .5) * .4; m.scale.setScalar(j ? .5 : .35); f.add(m); return m; }); f.userData.fl = fl; S.group.add(f); return f; });
      S.smolder.forEach(f => { f.visible = true; }); S.campLight.color.set('#ff8a3a');
    },
    update(t, dt, S) {
      caravanShow(false);
      const a = TIME * .16, x = -2 + Math.cos(a) * 4.4, z = 3 + Math.sin(a) * 3.6;
      S.zaynab.position.set(x, hKar(x, z) + .02 * Math.abs(Math.sin(TIME * 3)), z);
      for (let i = 0; i < S.huddle.alpha.length; i++) S.huddle.alpha[i] = .65 + .2 * Math.sin(TIME * 1.3 + i * 1.7);
      S.huddle.commit();
      if (dt > 0) S.tents.forEach((tn, i) => {
        const p = tn.group.position, R = Math.random;
        for (let k = 0; k < 2; k++) if (R() < dt * 3) SMOKE.emit(p.x + (R() - .5) * 4, p.y + .6 + R() * .6, p.z + (R() - .5) * 2.5, .7 + (R() - .5) * .5, 1.1 + R() * .8, (R() - .5) * .35, 9 + R() * 3, 1 + R() * .6, 5 + R() * 3, .45 + R() * .15);
        if (R() < dt * 5) EMBER_GLOW.emit(p.x + (R() - .5) * 3.5, p.y + .35, p.z + (R() - .5) * 2, 0, .15, 0, 1 + R() * .6, 2.2, 3.2, .3);
        if (R() < dt * 2) SPARKS.emit(p.x + (R() - .5) * 3, p.y + .4, p.z + (R() - .5) * 2, (R() - .5) * .5 + .3, 1.4 + R() * 1.6, (R() - .5) * .5, 2, .16, .05, .9);
      });
      S.smolder.forEach((f, k) => { f.userData.fl.forEach((m, j) => { m.scale.y = (j ? .5 : .35) * (.75 + .4 * N.n2(TIME * 6 + k * 3 + j, j)); }); });
      S.campLight.intensity = 22 * (.8 + .3 * N.n2(TIME * 5, 1.7));
    },
  },
  {
    scene: 'kufa', env: 'afternoon', dur: 20, mapStop: 14, km: null, mcKm: 'About 80 km from Karbala', chN: 7,
    ch: "Chapter 7 · The Captives' Journey", title: 'Captives in Kufa', place: 'Kufa', ar: 'الكوفة', date: '12 Muharram 61 AH', stat: 'The city that had invited Imam Hussain',
    shortY: 'The women and children were taken as captives to Kufa. Sayyida Zaynab answered the governor bravely.',
    shortF: 'The captives were paraded through Kufa. Before Ibn Ziyad, Sayyida Zaynab said: “I saw nothing but beauty.”',
    young: 'The soldiers took the women and children as captives to Kufa, the same city that had once invited Imam Hussain. People lined the streets, and some of them cried. The governor mocked Sayyida Zaynab, but she answered bravely: “I saw nothing but beauty.”',
    full: 'On 12 Muharram the captives, the women and children of the Prophet’s family and the ailing Imam Zayn al-ʿAbidin, were brought into Kufa, the city whose letters had invited Hussain (AS). In the streets Sayyida Zaynab rebuked the weeping Kufans for their broken promises. In his palace Ibn Ziyad taunted her, asking how she saw what God had done to her brother. She replied: “I saw nothing but beauty.”',
    quote: { q: 'I saw nothing but beauty.', by: 'Sayyida Zaynab, in the palace of Ibn Ziyad' },
    people: [['Sayyida Zaynab bint ʿAli', 'زينب بنت علي'], ['Imam ʿAli Zayn al-ʿAbidin', 'علي زين العابدين'], ['ʿUbaydullah ibn Ziyad', 'عبيد الله بن زياد', 'full']],
    note: 'Imam Zayn al-ʿAbidin leads, shown as the light above the first camel; the women and children are shown as the curtained howdahs. The sources say the captives were in fact carried on bare camels.',
    lead: T => 190 + 1.3 * T, followPath: 'procPath',
    shot: new Shot([[11, 4.4, 28], [18, 7, 16], [28, 12, -4]], [[2, 2, 110], [4, 2, 72], [6, 2, 52]], 20),
    enter(S) {
      armyShow(0); caravanLamps(0); resetCaravan(); captiveOrder(true);
      kufaProcession(S); vis(S.lining, true); crowdClear(S.crowd);
      S.lamp.visible = S.lampPost.visible = false; S.lampLight.intensity = 0;
      S.escorts = escortsReady(12);
    },
    update(t, dt, S, T) {
      processionUpdate(S.procPath, this.lead(T), dt, S.escorts);
      S.guards.update(t, hKuf);
    },
  },
  {
    scene: 'kufa', env: 'evening', dur: 30, mapStop: 14, km: null, mcKm: 'About 80 km from Karbala', chN: 7,
    ch: "Chapter 7 · The Captives' Journey", title: 'Zaynab speaks in Kufa', narrExtra: (y, S, seen) => sermonItems(SERMON_KUFA, 'Sayyida Zaynab (SA) said:', seen), place: 'Kufa', ar: 'خطبة زينب في الكوفة', date: '12 Muharram 61 AH', stat: 'The city that had broken its promise',
    shortY: 'In the streets of Kufa, Sayyida Zaynab silenced the crowd and told them the truth about what they had done.',
    shortF: 'Sayyida Zaynab silenced the crowds of Kufa with a sermon that recalled the eloquence of her father, ʿAli.',
    young: 'The people of Kufa crowded the streets, and many were crying. Sayyida Zaynab raised her hand, the crowd fell silent, and she spoke. She reminded them that they had invited Imam Hussain and then left him alone. People said she spoke just like her father, Imam ʿAli.',
    full: 'As the captives were led through Kufa, crowds gathered and many wept. Sayyida Zaynab signalled for silence and addressed them; those who heard her said it was as if ʿAli himself were speaking. She rebuked the Kufans for inviting Hussain (AS) and then abandoning him, and told them their tears could not wash away what they had done.',
    people: [['Sayyida Zaynab bint ʿAli', 'زينب بنت علي']],
    note: 'Excerpts from the sermon as preserved in the sources; translations vary. Imam Zayn al-ʿAbidin leads on the first camel; Zaynab is the light that brightens above the howdah behind him.',
    shot: new Shot([[28, 3.2, 30], [22, 2.8, 24], [17, 2.5, 19]], [[9, 2.6, 8], [9, 2.8, 8], [9, 3, 9]], 30),
    enter(S) {
      armyShow(0); caravanLamps(.4); resetCaravan(); captiveOrder(true);
      kufaProcession(S); vis(S.lining, true); crowdClear(S.crowd);
      S.lamp.visible = S.lampPost.visible = false; S.lampLight.intensity = 0;
      S.escorts = escortsReady(12);
    },
    update(t, dt, S, T) {
      processionUpdate(S.procPath, 264.8, dt, S.escorts);
      S.guards.update(t, hKuf);
      zaynabSpeaks(T); sermonAt(SERMON_KUFA, T);
    },
  },
  {
    scene: 'damascus', env: 'afternoon', dur: 20, mapStop: 21, km: null, mcKm: 'A long march north through Iraq and Syria', chN: 7,
    ch: "Chapter 7 · The Captives' Journey", title: 'Arriving in Damascus', place: 'Damascus', ar: 'دمشق', date: '1 Safar 61 AH', stat: 'The capital of Yazid',
    shortY: 'After a long march north, the captives were brought into Damascus, to Yazid’s palace.',
    shortF: 'After a long march through Iraq and Syria, the captives were led through Damascus to Yazid’s palace.',
    young: 'Then the captives were taken all the way to Damascus, far to the north, where Yazid lived. It was a very long journey. Yazid wanted to show off, and crowds lined the streets to watch the captives arrive at his palace.',
    full: 'After a long march through Iraq and Syria, the captives were brought into Damascus around 1 Safar 61 AH. Some reports describe the city decorated as if for a celebration, and many in the crowds did not know who the captives were. They were led to the palace of Yazid.',
    note: 'The route of the captives on the map follows a commonly told path through Mosul and Aleppo; the sources differ on the exact way.',
    people: [['Sayyida Zaynab bint ʿAli', 'زينب بنت علي'], ['Imam ʿAli Zayn al-ʿAbidin', 'علي زين العابدين'], ['Yazid ibn Muʿawiya', 'يزيد بن معاوية', 'full']],
    
    lead: T => 300 + 1.3 * T, followPath: 'procPath',
    shot: new Shot([[24, 5, 176], [17, 7, 158], [11, 13, 146]], [[0, 5, 70], [0, 6, 50], [0, 11, -30]], 20),
    enter(S) {
      armyShow(0); caravanLamps(0); resetCaravan(); captiveOrder(true); vis(S.messenger, false); vis(S.hall, false);
      damascusProcession(S); vis(S.lining, true);
      S.escorts = escortsReady(12);
    },
    update(t, dt, S, T) { processionUpdate(S.procPath, this.lead(T), dt, S.escorts); },
  },
  {
    scene: 'damascus', env: 'evening', dur: 37, mapStop: 21, km: null, mcKm: 'The palace of Yazid', chN: 7,
    ch: "Chapter 7 · The Captives' Journey", title: 'Zaynab in Yazid’s court', narrExtra: (y, S, seen) => sermonItems(SERMON_SHAM, 'Standing before Yazid, Sayyida Zaynab (SA) said:', seen), place: 'Damascus · the court of Yazid', ar: 'خطبة زينب في الشام', date: 'Safar 61 AH', stat: 'The court’s triumph turns to shame',
    shortY: 'In Yazid’s own palace, Sayyida Zaynab stood up and spoke the truth: “You will never erase our memory.”',
    shortF: 'Before Yazid and his court, Sayyida Zaynab delivered the sermon that turned his triumph into shame.',
    young: 'Yazid sat on his throne, surrounded by his court, and thought he had won. But Sayyida Zaynab stood up in front of everyone and spoke without fear. She told Yazid that he could never erase the memory of her family or their message. Her words, and those of Imam Zayn al-ʿAbidin, helped people understand what had really happened at Karbala.',
    full: 'In his court Yazid mocked the captives and celebrated his victory. Sayyida Zaynab rose and answered him, opening with a verse of the Qurʾan (30:10) and declaring that his power was fleeting and his crime would be remembered forever. Imam Zayn al-ʿAbidin later spoke in the mosque of Damascus, telling the people who the captives really were. Their words turned the court’s triumph into shame, and the story of Karbala began to spread.',
    people: [['Sayyida Zaynab bint ʿAli', 'زينب بنت علي'], ['Imam ʿAli Zayn al-ʿAbidin', 'علي زين العابدين'], ['Yazid ibn Muʿawiya', 'يزيد بن معاوية', 'full']],
    reflect: 'How can words be stronger than an army?',
    note: 'Excerpts from the sermon as preserved in the sources; translations vary. Yazid is not shown. Imam Zayn al-ʿAbidin stands at the front of the captives, with Zaynab just behind him; her light grows as she speaks.',
    indoor: true,
    shot: new Shot([[0, 302.8, 43], [2.8, 302.6, 36], [4.4, 302.5, 31]], [[0, 302.6, 4], [.4, 302.1, 12], [1, 301.9, 16]], 37),
    enter(S) { armyShow(0); caravanShow(false); vis(S.messenger, false); vis(S.lining, false); ensureHall(S); vis(S.hall, true); },
    update(t, dt, S, T) {
      caravanShow(false);
      const k0 = SERMON_K; sermonAt(SERMON_SHAM, T); if (SERMON_K !== k0 && SERMON_K >= 0) S.hallRing.t = 0;
      S.hallRing.t += dt; const u = S.hallRing.t / 3.2; S.hallRing.scale.setScalar(1 + u * 13); S.hallRing.material.opacity = .45 * Math.max(0, 1 - u);
      // the court's lamps dim while her light grows
      const k = smooth(3, 32, T); S.hallLamp.emissiveIntensity = lerp(2.6, 1, k); S.hallLights.forEach(L => { L.intensity = lerp(20, 8, k); });
      const zn = S.hallZ.zn; zn.group.scale.setScalar(1 + .3 * k + .06 * Math.sin(TIME * 2)); zn.light.intensity = lerp(6, 13, k);
    },
  },
  {
    scene: 'karbala', env: 'dawn', dur: 20, mapStop: 23, km: null, mcKm: 'Back at Karbala, forty days after Ashura', chN: 7,
    ch: "Chapter 7 · The Captives' Journey", title: 'The fortieth day', place: 'Karbala', ar: 'الأربعين', date: '20 Safar 61 AH', stat: 'Millions walk to Karbala every Arbaeen',
    shortY: 'Forty days after Ashura, the first pilgrim came to Imam Hussain’s grave. Millions still come every year.',
    shortF: 'On 20 Safar Jabir ibn ʿAbdullah al-Ansari visited the grave: the first Arbaeen. Today millions walk to Karbala.',
    young: 'Forty days after Ashura, an old companion of the Prophet named Jabir, who could no longer see, came to Karbala to visit Imam Hussain’s grave. He was the first pilgrim. Today, millions of people walk to Karbala every year on this day, called Arbaeen, “the fortieth”.',
    full: 'On 20 Safar 61 AH, forty days after Ashura, Jabir ibn ʿAbdullah al-Ansari, an elderly companion of the Prophet ﷺ who had lost his sight, reached Karbala with ʿAtiyya al-ʿAwfi and visited the grave of Hussain (AS): the first pilgrim of Arbaeen. Many reports say the family, returning from Damascus, came to Karbala that same day before going on to Medina. Today Arbaeen draws millions of pilgrims on foot.',
    people: [['Jabir ibn ʿAbdullah al-Ansari', 'جابر بن عبد الله الأنصاري'], ['ʿAtiyya al-ʿAwfi', 'عطية العوفي', 'full']],
    reflect: 'Why do you think millions still walk to Karbala today?',
    note: 'Historians differ on whether the family reached Karbala on this first Arbaeen or a year later. The two floating lights mark the graves of Imam Hussain (AS) and, by the river, al-ʿAbbas.',
    lead: T => 205 + 1.6 * T,
    shot: new Shot([[-7, 2.2, -33], [-10, 3.5, -46], [-12, 6, -58]], [[-1, 1.3, -39.5], [4, 1.5, -30], [24, 2, 6]], 20),
    enter(S) {
      karbalaReset(S); armyShow(0); caravanLamps(.5); resetCaravan(); captiveOrder(true);
      S.enemy.visible = false; S.camp.visible = false; S.alam.visible = false; campLamps(S, 0);
      ensureGraves(S); vis(S.graves, true); vis(S.pilgrims, true); S.pilgrims.update(0, hKar);
    },
    update(t, dt, S, T) { processionUpdate(S.path, this.lead(T), dt); },
  },
];

// ─────────── story steps ───────────
const SHA_FORM = [];
{
  const r = rng(99);
  for (let i = 0; i < 40; i++) {
    const row = Math.floor(i / 8), col = i % 8;
    const ex = -13 + col * 3.9 + (row % 2) * 1.9 + (r() - .5) * .8, ez = -31 - row * 4.3 + (r() - .5) * .8;
    const sx = ex * 1.25 + (r() - .5) * 8, sz = -150 - row * 4.5 - r() * 6;
    SHA_FORM.push({ sx, sz, ex, ez, delay: 2.2 + row * .4 + r() * .4, v: 8.6 + r() * 1 });
  }
}
const STEPS = [
  ...CH1_STEPS,
  {
    scene: 'medina', env: 'night', dur: 17, mapStop: 0, km: 0,
    ch: 'Chapter 1 · The Refusal', title: 'Leaving by night', place: 'Medina', ar: 'المدينة المنورة', date: '28 Rajab 60 AH', stat: 'The journey begins',
    young: "Imam Hussain would not promise to obey an unjust ruler. So one night he said goodbye at his grandfather's grave, gathered his family, and quietly set off from Medina.",
    full: "Rather than pledge allegiance to Yazid, Hussain (AS) left Medina by night on 28 Rajab, after bidding farewell at the grave of the Prophet ﷺ. With him went his household, among them his sister Zaynab, his brother al-ʿAbbas and his son ʿAli (later Imam Zayn al-ʿAbidin), and a small group of companions.",
    quote: { q: 'A man like me does not pledge allegiance to a man like him.', by: 'Imam Hussain (AS), to the governor of Medina' },
    people: [['Zaynab bint ʿAli', 'زينب بنت علي'], ['al-ʿAbbas ibn ʿAli', 'العباس بن علي'], ['ʿAli ibn al-Hussain', 'علي بن الحسين', 'full']],
    note: 'The family of the Prophet ﷺ is never shown as figures. Each floating light (noor) stands for one of them: al-ʿAbbas leading with the standard, Imam Hussain (AS) on the white horse behind him, and the women and children in the curtained howdahs.',
    shot: new Shot([[-15, 1.7, 8.5], [-6, 2, 9.5], [4, 2.6, 12], [14, 4.2, 17]], [[-36, 2.3, -1], [-22, 2.2, -.5], [-12, 2.4, -1], [-6, 2.8, -3]], 17),
    enter(S) { armyShow(0); caravanLamps(1); resetCaravan(); },
    lead: T => 46 + 1.35 * T,
    update(t, dt, S, T) { caravanUpdate(S.path, this.lead(T), dt); },
  },
  ...CH23_STEPS,
  {
    scene: 'sharaf', env: 'golden', dur: 20, mapStop: 10, km: 1809,
    ch: 'Chapter 4 · Meeting Hurr', title: 'A thousand horsemen', place: 'Sharaf', ar: 'شراف', date: 'End of Dhu al-Hijja 60 AH', stat: '~1,809 km from Medina',
    young: 'Suddenly a cloud of dust rose over the dunes. It was an army of 1,000 horsemen, sent to stop Imam Hussain. Their leader was a man named Hurr.',
    full: "Near Sharaf, about 1,000 horsemen appeared: the vanguard of Ibn Ziyad's forces under al-Hurr ibn Yazid al-Riyahi. Their orders were to stop Hussain (AS) from turning back and to bring him to Kufa.",
    people: [['al-Hurr ibn Yazid al-Riyahi', 'الحر بن يزيد الرياحي']],
    shot: new Shot([[-12, 2.2, 12], [-4, 2.8, 15], [-8, 4.5, 21], [-24, 9, 36], [-34, 12, 50]], [[-26, 1.8, 0], [2, 5, -60], [6, 4, -70], [5, 3, -45], [2, 5, -62]], 20),
    enter(S) {
      armyShow(40); caravanLamps(0); resetCaravan(); vis(S.prayer, false);
      army.forEach((a, i) => { a.hold = null; });
    },
    update(t, dt, S) {
      const lead = walkStop(t, 208, 225);
      caravanUpdate(S.path, lead, dt);
      army.forEach((a, i) => {
        const f = SHA_FORM[i], D = Math.hypot(f.ex - f.sx, f.ez - f.sz);
        const m = travel(D, f.v, 16, t - f.delay);
        const ux = (f.ex - f.sx) / D, uz = (f.ez - f.sz) / D;
        const x = f.sx + ux * m.d, z = f.sz + uz * m.d;
        const moving = m.v > .2;
        const heading = moving ? Math.atan2(ux, uz) : lerpAngle(Math.atan2(ux, uz), 0, smooth(0, 2.5, t - f.delay - (D + 16) / f.v));
        setOnGround(a.group, x, z, heading, H);
        a.setSpeed(t < f.delay ? f.v : m.v); a.update(dt);
        if (m.v > 3.5 && t > f.delay && dt > 0) {
          for (let k = 0; k < 2; k++) if (Math.random() < dt * 16) DUST.emit(x + (Math.random() - .5) * 1.8, H(x, z) + .4, z + (Math.random() - .5) * 1.8, -ux * 2.5 + (Math.random() - .5) * 2.4, 1 + Math.random() * 1.4, -uz * 2.5 + (Math.random() - .5) * 2.4, 3.5 + Math.random() * 2, 2.2, 10 + Math.random() * 5, .55);
        }
      });
      massUpdate(S.mass, t, dt);
    },
  },
  {
    scene: 'sharaf', env: 'golden', dur: 14, mapStop: 10, km: 1809,
    ch: 'Chapter 4 · Meeting Hurr', title: 'Water for the thirsty', place: 'Sharaf', ar: 'شراف', date: 'End of Dhu al-Hijja 60 AH', stat: '~1,809 km from Medina',
    young: "Hurr's soldiers and their horses were exhausted and very thirsty. Imam Hussain told his companions to give water to all of them, even the horses, although this army had come to stop him.",
    full: "Hurr's men and horses arrived parched in the midday heat. Hussain (AS), who had ordered extra water drawn at Sharaf that morning, told his companions to water them all, men and horses alike. Days later at Karbala, the army Hurr served would cut Hussain's camp off from the river.",
    reflect: 'Why would Imam Hussain give water to an army sent to stop him?',
    shot: new Shot([[24, 2.4, -13], [8, 2.2, -16], [-14, 2.8, -14]], [[9, 1.3, -31], [2, 1.2, -32], [-4, 1.3, -30]], 14),
    enter(S) {
      armyShow(40); caravanLamps(0); resetCaravan();
      army.forEach((a, i) => { const f = SHA_FORM[i]; setOnGround(a.group, f.ex, f.ez, 0, H); a.hold = i < 8 ? null : (i % 3 ? 'Idle' : 'Idle_2'); a.play(a.hold || 'Idle', .01); });
      S.buckets.forEach(b => b.visible = true); vis(S.prayer, false);
    },
    update(t, dt, S) {
      caravanUpdate(S.path, 225, dt);
      army.forEach((a, i) => {
        if (i < 8) a.drink(t > 1.2 + (i % 4) * .5, TIME); else a.setSpeed(0);
        a.update(dt);
      });
      massUpdate(S.mass, 100, dt);
      if (dt > 0 && Math.random() < dt * 10) {
        const b = S.buckets[Math.floor(Math.random() * S.buckets.length)];
        for (let k = 0; k < 3; k++) SPLASH.emit(b.position.x + (Math.random() - .5) * .3, b.position.y + .45, b.position.z + (Math.random() - .5) * .3, (Math.random() - .5) * .6, 1 + Math.random() * .8, (Math.random() - .5) * .6, .7, .25, .08, .9);
      }
    },
  },
  ...CH4_STEPS,
  {
    scene: 'karbala', env: 'dusk', dur: 19, mapStop: 13, km: 1894,
    ch: 'Chapter 5 · Karbala', title: 'The land of Karbala', place: 'Karbala', ar: 'كربلاء', date: '2 Muharram 61 AH', stat: '~1,894 km from Medina',
    young: 'On 2 Muharram the caravan stopped. Imam Hussain asked, “What is this land called?” They told him: “Karbala.” He knew this was the place. The tents were set up on the plain near the river.',
    full: 'On 2 Muharram 61 AH the caravan halted on a plain west of the Euphrates. Hussain (AS) asked its name and was told Karbala. He said it was a land of karb (anguish) and balāʾ (trial): here their mounts would kneel, and here their blood would be shed. The tents were pitched.',
    note: 'The river here is a stand-in for the ʿAlqami canal, a branch of the Euphrates. Its exact course in 61 AH is not known.',
    shot: new Shot([[118, 3.2, 70], [84, 4.2, 58], [52, 7, 58], [-6, 15, 66]], [[70, 2.4, 36], [34, 2.6, 18], [6, 3, 0], [0, 4, -22]], 19),
    enter(S) {
      karbalaReset(S); armyShow(16); caravanLamps(.6); resetCaravan();
      army.forEach((a, i) => { if (i >= 16) return; const x = 70 + (i % 4) * 4.2 + (Math.floor(i / 4) % 2) * 2, z = -58 - Math.floor(i / 4) * 4.4; setOnGround(a.group, x, z, -Math.PI / 2 - .3, H); a.hold = i % 3 ? 'Idle' : 'Idle_2'; });
      S.enemy.visible = false;
      S.tents.forEach(t => { t.body.scale.set(1, .02, 1); t.group.visible = false; });
      S.alam.rotation.x = -Math.PI / 2 + .12;
    },
    update(t, dt, S) {
      const L = S.path.getLength(), lead = walkStop(t, L - 22, L);
      caravanUpdate(S.path, lead, dt);
      army.forEach((a, i) => { if (i < 16) { a.setSpeed(0); a.update(dt); } });
      S.tents.forEach(tn => { const k = clamp((t - 7 - tn.th * 6) / 1.6, 0, 1); tn.group.visible = k > 0; tn.body.scale.y = Math.max(.02, easeOutBack(k)); });
      caravan.standardOn = t < 13;
      S.alam.rotation.x = lerp(-Math.PI / 2 + .12, 0, easeOutBack(clamp((t - 13) / 2.4, 0, 1)));
      campLamps(S, smooth(14.5, 18, t));
    },
  },
  ...CH5_STEPS,
  {
    scene: 'karbala', env: 'lastnight', envFrom: 'dusk', envT: 4.5, dur: 21, mapStop: 13, km: 1894,
    ch: 'Chapter 5 · Karbala', title: 'The last night', place: 'Karbala', ar: 'ليلة عاشوراء', date: 'Eve of 10 Muharram 61 AH',
    stat: t => t > 15.5 ? '72 companions stayed' : 'Night before Ashura',
    young: 'On the last night, Imam Hussain told his companions: “They only want me. You are free to go. Leave in the dark and no one will see you.” The lamps were put out. When they were lit again, not one person had left.',
    full: 'On the eve of Ashura, Hussain (AS) gathered his companions, thanked them, and released them from their pledge: the enemy wanted only him. He had the lamps put out so that anyone could slip away unseen. None did. They spent the night in prayer and reciting the Qurʾan; it is said their voices hummed through the camp like bees.',
    reflect: 'What does loyalty mean to you?',
    note: 'The moon is nine days old, as it would have been on this night. The 72 small lamps around the camp stand for the companions.',
    shot: new Shot([[-58, 7, 48], [-30, 5.5, 44], [8, 6, 46], [40, 9, 40]], [[0, 3, -20], [0, 3, -24], [0, 3.5, -30], [0, 4, -34]], 21),
    enter(S) {
      karbalaReset(S); armyShow(40); caravanLamps(0); resetCaravan();
      S.enemy.visible = true;
      S.tents.forEach(t => { t.group.visible = true; t.body.scale.set(1, 1, 1); });
      S.alam.rotation.x = 0;
      const r = rng(5);
      army.forEach((a, i) => {
        if (i < 14) { a.patrol = { x0: -150 + i * 23, ph: r() * TAU }; a.hold = null; }
        else { a.patrol = null; const k = i - 14, x = -200 + k * 16 + r() * 6, z = -110 - r() * 70; setOnGround(a.group, x, z, r() * TAU, H); a.hold = ['Idle', 'Idle_2', 'Eating'][k % 3]; }
      });
    },
    update(t, dt, S) {
      caravanUpdate(S.path, S.path.getLength(), dt);
      army.forEach((a, i) => {
        if (a.patrol) {
          const w = .09, x = a.patrol.x0 + 22 * Math.sin(TIME * w + a.patrol.ph), vx = 22 * w * Math.cos(TIME * w + a.patrol.ph);
          const z = zRiver(x) + 21;
          setOnGround(a.group, x, z, vx > 0 ? Math.PI / 2 : -Math.PI / 2, H);
          a.setSpeed(Math.abs(vx));
        } else a.setSpeed(0);
        a.update(dt);
      });
      const out = 1 - smooth(5.5, 7.2, t);
      const relight = smooth(10.5, 14.5, t);
      if (t < 10.5) campLamps(S, out); else campLamps(S, relight, relight);
    },
  },
  ...CH67_STEPS,
];
const SHORT = {
  'Leaving by night': ['Imam Hussain would not obey an unjust ruler, so he left Medina by night with his family.', 'Refusing to pledge allegiance to Yazid, Hussain (AS) left Medina by night on 28 Rajab 60 AH.'],
  'A thousand horsemen': ['A cloud of dust over the dunes: 1,000 horsemen, sent to stop Imam Hussain.', 'Near Sharaf, 1,000 horsemen under al-Hurr ibn Yazid al-Riyahi barred the caravan\'s way.'],
  'Water for the thirsty': ['The soldiers were thirsty, so Imam Hussain gave water to all of them, even their horses.', 'Hussain (AS) had his companions water the parched men and horses of the army sent to stop him.'],
  'The land of Karbala': ['On 2 Muharram the caravan stopped at a place called Karbala, and the tents went up.', 'On 2 Muharram 61 AH the caravan halted at Karbala, "a land of anguish and trial", and pitched its tents.'],
  'The last night': ['On the last night the lamps were put out so anyone could leave. No one left.', 'On the eve of Ashura, Hussain (AS) released his companions and had the lamps put out. None of them left.'],
};
const CDUR = {
  'Orders from Damascus': 15, 'Leaving by night': 14, 'The road to Mecca': 13, 'Letters from Kufa': 19, 'An envoy to Kufa': 11, 'Leaving Mecca': 13,
  'The poet al-Farazdaq': 15, 'Meanwhile, in Kufa': 24, 'The news arrives': 16.5, 'Free to leave': 13, 'A thousand horsemen': 16, 'Water for the thirsty': 12,
  'Praying together': 17, 'Escorted north': 13, 'The land of Karbala': 17, 'The river is closed': 13, 'The last night': 18, 'Hurr’s choice': 20,
  'The roll of honour': 43, 'The horse comes home': 17, 'The night of the strangers': 13, 'Captives in Kufa': 14, 'Zaynab speaks in Kufa': 29,
  'Arriving in Damascus': 14, 'Zaynab in Yazid’s court': 35.5, 'The fortieth day': 16,
};
// per-scene sound, on top of the defaults from the time of day, the place, the caravan and the horsemen
const SFX = {
  'Orders from Damascus': (t, S) => ({ crowd: 0, gallop: S.messenger && S.messenger.speed > 3 ? .3 : 0 }),
  'Letters from Kufa': t => ({ crowd: .22, fire: .35, hoof: t < 13 ? 2.2 : 0 }),
  'An envoy to Kufa': (t, S) => ({ crowd: .1, fire: .25, gallop: S.envoy.speed > 3 ? .25 : 0, hoof: S.envoy.speed > .3 && S.envoy.speed <= 3 ? 2 : 0 }),
  'Leaving Mecca': () => ({ crowd: .7 }),
  'The poet al-Farazdaq': (t, S, P) => ({ hoof: P.hoof + (t < 12 ? 1.5 : 0) }),
  'Meanwhile, in Kufa': t => ({ crowd: .75 * (1 - smooth(3, 14, t)) + .02 }),
  'The news arrives': t => ({ fire: .5, gallop: t < 9.5 ? .28 : 0, hoof: t > 9 && t < 11.5 ? 3 : t > 1 && t < 17 ? 1.2 : 0 }),
  'Free to leave': t => ({ fire: .45, gallop: .35 * smooth(4.5, 7, t), hoof: 3 * smooth(4.5, 7, t) }),
  'A thousand horsemen': (t, S, P) => ({ gallop: Math.max(P.gallop, t > 3 && t < 12 ? .85 : 0) }),
  'Water for the thirsty': () => ({ water: .16, hoof: 1.2 }),
  'Praying together': () => ({ hoof: 0 }),
  'Escorted north': (t, S, P) => ({ hoof: P.hoof + 4 }),
  'The river is closed': () => ({ water: .75, hoof: 2.4 }),
  'The last night': t => ({ hum: .6 * smooth(11, 15, t), fire: .25 }),
  'Hurr’s choice': (t, S) => ({ crowd: .12, hoof: (S.hurr && S.hurr.speed > .3 ? 2 : 0) + (S.imamHorse && S.imamHorse.speed > .3 ? 1.2 : 0) }),
  'The roll of honour': () => ({ crowd: .08, water: .1 }),
  'The horse comes home': (t, S) => ({ hoof: S.zul && S.zul.speed > .3 ? 1.5 : 0, water: .08 }),
  'The night of the strangers': () => ({ fire: .85 }),
  'Captives in Kufa': (t, S, P) => ({ crowd: .6, hoof: P.hoof + 3 }),
  'Zaynab speaks in Kufa': t => ({ crowd: .65 * (1 - smooth(1.2, 3, t)) + .03, hoof: 0 }),
  'Arriving in Damascus': (t, S, P) => ({ crowd: .75, hoof: P.hoof + 3 }),
  'Zaynab in Yazid’s court': t => ({ crowd: .35 * (1 - smooth(1.5, 3.5, t)) + .02 }),
  'The fortieth day': () => ({ water: .28 }),
};
const HUSSAIN_L = { text: 'Imam Hussain', ar: 'الإمام الحسين', at: () => caravan.horses[0].noor.bob };
const ABBAS_L = { text: 'al-ʿAbbas, the standard-bearer', ar: 'العباس', at: () => caravan.horses[1].noor.bob };
const ZAYNAB_L = { text: 'Sayyida Zaynab', ar: 'السيدة زينب', at: () => caravan.camels[2].noor.bob };
const SAJJAD_L = { text: 'Imam Zayn al-ʿAbidin', ar: 'الإمام زين العابدين', at: () => caravan.camels[0].altNoor.bob };
const HURR_L = u => ({ text: 'al-Hurr ibn Yazid al-Riyahi', ar: 'الحر الرياحي', at: u, dy: 3.9, max: 70 });
const LABELS = {
  'Leaving by night': [HUSSAIN_L, ABBAS_L, ZAYNAB_L],
  'The road to Mecca': [HUSSAIN_L, ABBAS_L],
  'An envoy to Kufa': [{ text: 'Muslim ibn ʿAqil', ar: 'مسلم بن عقيل', at: S => S.envoy.noor.bob, max: 160 }],
  'Leaving Mecca': [{ ...HUSSAIN_L, max: 160 }],
  'The poet al-Farazdaq': [{ text: 'al-Farazdaq, the poet', ar: 'الفرزدق', at: S => S.poet.group, dy: 3.7 }, HUSSAIN_L],
  'Meanwhile, in Kufa': [{ text: 'Muslim ibn ʿAqil', ar: 'مسلم بن عقيل', at: S => S.noor.bob, max: 160 }],
  'The news arrives': [{ text: 'Zuhayr ibn al-Qayn', ar: 'زهير بن القين', at: S => S.zuhayr.group, dy: 3.1, from: 4 }, HUSSAIN_L],
  'Free to leave': [HUSSAIN_L],
  'A thousand horsemen': [HURR_L(() => army[3].group), HUSSAIN_L, ABBAS_L],
  'Water for the thirsty': [HURR_L(() => army[3].group), HUSSAIN_L],
  'Praying together': [{ text: 'Imam Hussain', ar: 'الإمام الحسين', at: S => S.prayer.imam.bob }],
  'Escorted north': [HUSSAIN_L, ABBAS_L, { text: 'ʿAli al-Akbar', ar: 'علي الأكبر', at: () => caravan.horses[2].noor.bob }, HURR_L(() => army[0].group)],
  'The land of Karbala': [HUSSAIN_L, ABBAS_L],
  'Hurr’s choice': [{ ...HURR_L(S => S.hurr.group), max: 130 }, { text: 'Imam Hussain', ar: 'الإمام الحسين', at: S => S.imamHorse.noor.bob, from: 5 }],
  'The horse comes home': [{ text: 'Zuljanah, the horse of Imam Hussain', ar: 'ذو الجناح', at: S => S.zul.group, dy: 2.6 }],
  'The night of the strangers': [{ text: 'Sayyida Zaynab', ar: 'السيدة زينب', at: S => S.zaynab.children[0].children[0] }, { text: 'Imam Zayn al-ʿAbidin, who was very ill', ar: 'الإمام زين العابدين', at: S => S.sajjadN.bob, dy: .4 }],
  'Captives in Kufa': [ZAYNAB_L, SAJJAD_L],
  'Zaynab speaks in Kufa': [SAJJAD_L, ZAYNAB_L],
  'Arriving in Damascus': [ZAYNAB_L, SAJJAD_L],
  'Letters from Kufa': [{ text: 'Imam Hussain', ar: 'الإمام الحسين', at: S => S.reader && S.reader.bob, from: 13 }],
  'Zaynab in Yazid’s court': [{ text: 'Imam Zayn al-ʿAbidin', ar: 'الإمام زين العابدين', at: S => S.hallZ.zb.bob, dy: .95 }, { text: 'Sayyida Zaynab', ar: 'السيدة زينب', at: S => S.hallZ.zn.bob, dy: .45 }],
  'The fortieth day': [
    { text: 'Jabir ibn ʿAbdullah al-Ansari, the first pilgrim', ar: 'جابر بن عبد الله الأنصاري', at: () => labelV.set(-2.3, hKar(-2.3, -38.6) + 1.75, -38.6), dy: .8, to: 11 },
    { text: 'ʿAtiyya al-ʿAwfi, who guided him', ar: 'عطية العوفي', at: () => labelV.set(-3.6, hKar(-3.6, -36.8) + 1.75, -36.8), dy: .2, to: 11 },
    { text: 'Imam Hussain', ar: 'الإمام الحسين', at: S => S.graveNoors[0].bob, from: 9 },
    { text: 'al-ʿAbbas', ar: 'العباس', at: S => S.graveNoors[1].bob, max: 400, from: 9 },
    { ...SAJJAD_L, from: 12, max: 170 },
  ],
  // the names of the fallen follow their lights as they rise
  'The roll of honour': ROLL.map(e => ({ text: e.en, at: (S, t) => { const tt = S.rollT ?? t; return (tt > e.t - 1.2 && tt < e.t + 3.2 && S.lanterns) ? S.lanterns.posOf(S.outT.indexOf(e.t), tt) : null; }, dy: .45, max: 120 })),
};
// (AS) after the Imams and the men of the Prophet's family, (SA) after Sayyida Zaynab; nothing is added where one is already present
const HON_L = '(?<![\\w\\u02BF-])', HON_R = '(?![\\w\\u02BF])(?!\\s*\\((?:AS|SA)\\))';
const HON = [
  ['Imam al-Hussain ibn ʿAli', 'AS'], ['Imam ʿAli Zayn al-ʿAbidin', 'AS'], ['Imam Zayn al-ʿAbidin', 'AS'], ['ʿAli ibn al-Hussain', 'AS'],
  ['ʿAli al-Akbar ibn al-Hussain', 'AS'], ['ʿAli al-Akbar(?! ibn)', 'AS'], ['ʿAli al-Asghar', 'AS'],
  ['al-ʿAbbas ibn ʿAli', 'AS'], ['al-ʿAbbas(?! ibn)', 'AS'], ['al-Qasim ibn al-Hasan', 'AS'], ['Imam al-Hasan', 'AS'],
  ['Muslim ibn ʿAqil', 'AS'], ['(?<!ibn )Muslim(?! ibn)', 'AS'],
  ['(?:Sayyida )?Zaynab bint ʿAli', 'SA', m => m.startsWith('Sayyida') ? m : 'Sayyida ' + m],
  ['(?:Sayyida )?Zaynab(?! bint)', 'SA', m => m.startsWith('Sayyida') ? m : 'Sayyida ' + m],
  ['Imam ʿAli(?! Zayn)', 'AS'], ['(?<=father,? )ʿAli', 'AS'], ['ʿAli(?= himself)', 'AS'],
  ['ʿAwn and Muhammad', 'AS', null, 'them'], ['ʿAbdullah, the infant', 'AS'],
  ['Hussain', 'AS'],
].map(([n, h, f, who]) => [new RegExp(HON_L + n + HON_R, 'g'), h, f, who]);
function honor(s) { if (typeof s !== 'string') return s; for (const [re, h, f] of HON) s = s.replace(re, m => (f ? f(m) : m) + ` (${h})`); return s; }
STEPS.forEach(st => {
  if (!st.shortY && SHORT[st.title]) { st.shortY = SHORT[st.title][0]; st.shortF = SHORT[st.title][1]; }
  st.chN = st.chN || +(/Chapter (\d)/.exec(st.ch) || [0, 1])[1];
  if (LABELS[st.title]) st.labels = LABELS[st.title];
  if (CDUR[st.title]) st.cdur = CDUR[st.title];
  if (SFX[st.title]) st.sfx = SFX[st.title];
  ['title', 'young', 'full', 'shortY', 'shortF', 'note', 'reflect', 'stat'].forEach(k => { st[k] = honor(st[k]); });
  if (st.quote) st.quote.by = honor(st.quote.by);
  if (st.people) st.people = st.people.map(p => [honor(p[0]), ...p.slice(1)]);
});
ROLL.forEach(e => { e.en = honor(e.en); e.role = honor(e.role); });
[SERMON_KUFA, SERMON_SHAM].forEach(sm => { sm.by = honor(sm.by); });
function lerpAngle(a, b, t) { const d = ((b - a + Math.PI * 3) % TAU) - Math.PI; return a + d * t; }
function campLamps(S, level, wave = null) {
  M.campLamp.emissiveIntensity = 7 * level;
  M.tentGlow.emissiveIntensity = 1.6 * level;
  S.campLight.intensity = 90 * level;
  const L = S.lamps;
  for (let i = 0; i < L.alpha.length; i++) L.alpha[i] = wave === null ? level : smooth(L.th[i] - .06, L.th[i] + .06, wave * 1.12);
  L.commit();
}

// ─────────── maps ───────────
const SVGNS = 'http://www.w3.org/2000/svg';
const ROUTE_PTS = MAP.route;
const segLens = ROUTE_PTS.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE_PTS[i][0], p[1] - ROUTE_PTS[i][1]));
const cumLen = [0]; segLens.forEach(l => cumLen.push(cumLen[cumLen.length - 1] + l));
const ROUTE_TOTAL = cumLen[cumLen.length - 1];
const KARBALA_STOP = 13, R1 = cumLen[KARBALA_STOP], R2 = ROUTE_TOTAL - R1;
const FULL_BOX = [-6, -6, 412, 432];
const LABEL_POS = { Damascus: [-8, 4, 'end'], Medina: [8, 4, 'start'], Mecca: [8, 4, 'start'], Kufa: [7, 10, 'start'], Karbala: [-7, -4, 'end'], Sharaf: [-7, 5, 'end'] };
function buildMapSvg(svg, big) {
  const pts1 = ROUTE_PTS.slice(0, KARBALA_STOP + 1).map(p => p.join(',')).join(' '), pts2 = ROUTE_PTS.slice(KARBALA_STOP).map(p => p.join(',')).join(' ');
  const cities = big ? Object.entries(MAP.cities).map(([n, [x, y]]) => {
    const [dx, dy, anchor] = LABEL_POS[n];
    return `<g class="city${n === 'Sharaf' ? ' zoom-only' : ''}" data-x="${x}" data-y="${y}"><circle cx="${x}" cy="${y}" r="3.2" fill="#f3e9cf"/><text data-dx="${dx}" data-dy="${dy}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-weight="600" fill="#f3e9cf">${n.toUpperCase()}</text></g>`;
  }).join('') : '';
  svg.innerHTML = `<rect x="-3000" y="-3000" width="6400" height="6400" fill="#0a131d"/>
    <path d="${MAP.land}" fill="#2b2319" stroke="rgba(212,175,55,.5)" data-sw="${big ? 1 : 1.6}"/>
    <path d="${MAP.rivers}" fill="none" stroke="#5a97be" data-sw="${big ? 1.5 : 2.4}" stroke-linecap="round"/>
    <polyline points="${pts1}" fill="none" stroke="rgba(212,175,55,.4)" data-sw="${big ? 1.8 : 3}" data-dash="3 6"/>
    <polyline class="route" points="${pts1}" fill="none" stroke="#ecc95c" data-sw="${big ? 3.2 : 5}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${R1}" stroke-dashoffset="${R1}"/>
    <polyline class="route2" points="${pts2}" fill="none" stroke="#c9574a" data-sw="${big ? 3 : 4.6}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${R2}" stroke-dashoffset="${R2}"/>
    ${cities}
    <g class="here"><circle r="${big ? 11 : 14}" fill="rgba(236,201,92,.25)"/><circle r="${big ? 5.5 : 8}" fill="#f3e9cf" stroke="#d4af37" stroke-width="2.5"/></g>`;
  svg._len = 0;
  mapDraw(svg, FULL_BOX, 0);
}
function routePointAt(len) {
  for (let i = 1; i < cumLen.length; i++) {
    if (len <= cumLen[i]) { const f = (len - cumLen[i - 1]) / (segLens[i - 1] || 1), a = ROUTE_PTS[i - 1], b = ROUTE_PTS[i]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; }
  }
  return ROUTE_PTS[ROUTE_PTS.length - 1];
}
// one frame of the map: camera box, route drawn up to 'len', marker at the route's end.
// Line widths and labels are rescaled so they keep their on-screen size when the map zooms.
function mapDraw(svg, box, len, here = null) {
  svg._box = box; svg._len = len;
  svg.setAttribute('viewBox', box.join(' '));
  const k = box[2] / 412;
  svg.querySelectorAll('[data-sw]').forEach(el => el.setAttribute('stroke-width', el.dataset.sw * k));
  svg.querySelectorAll('[data-dash]').forEach(el => el.setAttribute('stroke-dasharray', el.dataset.dash.split(' ').map(v => v * k).join(' ')));
  svg.querySelectorAll('.city').forEach(g => {
    const x = +g.dataset.x, y = +g.dataset.y, c = g.querySelector('circle'), t = g.querySelector('text');
    c.setAttribute('r', 3.2 * k);
    t.setAttribute('font-size', 12 * k); t.setAttribute('letter-spacing', 1.2 * k);
    t.setAttribute('x', x + t.dataset.dx * k); t.setAttribute('y', y + t.dataset.dy * k);
    g.style.display = g.classList.contains('zoom-only') && k > .5 ? 'none' : '';
  });
  svg.querySelector('.route').setAttribute('stroke-dashoffset', R1 - Math.min(len, R1));
  svg.querySelector('.route2').setAttribute('stroke-dashoffset', R2 - clamp(len - R1, 0, R2));
  const [hx, hy] = here || (svg._city ? MAP.cities[svg._city] : routePointAt(len));
  svg.querySelector('.here').setAttribute('transform', `translate(${hx} ${hy}) scale(${k})`);
}
// frame both ends of a leg of the journey; short legs zoom in so the movement is visible
function boxFor(a, b) {
  if (Math.max(a, b) <= 1) return FULL_BOX;
  const pts = ROUTE_PTS.slice(Math.min(a, b), Math.max(a, b) + 1);
  if (Math.max(a, b) >= 10) pts.push(MAP.cities.Kufa);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let w = Math.max(x1 - x0 + 70, 110), h = Math.max(y1 - y0 + 70, 110);
  const ar = 412 / 432;
  if (w / h > ar) h = w / ar; else w = h * ar;
  if (w >= 330) return FULL_BOX;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}
function mapTween(svg, fromStop, toStop, toBox, ms, fromCity = null, toCity = null) {
  const fromBox = svg._box || FULL_BOX, l0 = cumLen[fromStop], l1 = cumLen[toStop];
  const pa = fromCity ? MAP.cities[fromCity] : null, pb = toCity ? MAP.cities[toCity] : null, a = pa || routePointAt(l0), b = pb || routePointAt(l1);
  const hereAt = e => pa || pb ? [lerp(a[0], b[0], e), lerp(a[1], b[1], e)] : null;
  cancelAnimationFrame(svg._raf);
  if (!ms) { mapDraw(svg, toBox, l1, pb); return; }
  const t0 = performance.now();
  const step = now => {
    const u = clamp((now - t0) / ms, 0, 1);
    const zb = ease(clamp(u / .45, 0, 1)), rl = ease(clamp((u - .2) / .8, 0, 1));
    mapDraw(svg, fromBox.map((v, i) => lerp(v, toBox[i], zb)), lerp(l0, l1, rl), hereAt(rl));
    if (u < 1) svg._raf = requestAnimationFrame(step);
  };
  svg._raf = requestAnimationFrame(step);
}
function setMapProgress(svg, stop) { mapTween(svg, stop, stop, svg._box || FULL_BOX, 0); }
buildMapSvg($('bigSvg'), true);
buildMapSvg($('miniSvg'), false);
let mapStopShown = 0, mapCityShown = null;

// ─────────── UI & flow ───────────
let mode = 'full', stepIdx = -1, stepT = 0, playing = false, busy = false, stepDone = false, autoplay = true, autoTimer = null, phase = 'loading';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SCENE_NAMES = { medina: 'Medina', sharaf: 'Sharaf', karbala: 'Karbala' };
const CHAPTER_NAMES = ['The Refusal', 'Refuge in Mecca', 'The Road North', 'Meeting Hurr', 'Karbala', 'Ashura', "The Captives' Journey"];
function buildTimeline() {
  $('timeline').innerHTML = CHAPTER_NAMES.map((name, ci) => {
    const steps = STEPS.map((st, i) => [st, i]).filter(([st]) => st.chN === ci + 1);
    const bar = steps.length ? steps.map(([st, i]) => `<button type="button" data-step="${i}" aria-label="${esc(st.title)}"></button>`).join('') : '<span class="lock"></span>';
    return `<div class="tl-ch${steps.length ? '' : ' locked'}" data-ch="${ci + 1}" style="flex:${Math.max(steps.length, 1)} 1 0"><div class="tl-name">${ci + 1} · ${esc(name)}${steps.length ? '' : ' · coming'}</div><div class="tl-bar">${bar}</div></div>`;
  }).join('');
  $('timeline').addEventListener('click', e => { const b = e.target.closest('button[data-step]'); if (b) { showOutro(false); goTo(+b.dataset.step); } });
}
// ─────────── name labels above key people ───────────
const labelV = new THREE.Vector3();
let LABEL_ELS = [];
const LABEL_ORDER = new Map();
function buildLabels(s) {
  const box = $('labels'); box.innerHTML = '';
  LABEL_ORDER.clear();
  LABEL_ELS = (s.labels || []).map((l, k) => {
    const el = document.createElement('div'); el.className = 'lbl';
    el.innerHTML = `<b>${esc(honor(l.text))}</b>` + (l.ar ? `<span class="ar" lang="ar" dir="rtl">${esc(l.ar)}</span>` : '');
    box.appendChild(el); return { l, el, on: false, k };
  });
}
function updateLabels(s, S, t) {
  const W = canvas.clientWidth, Hh = canvas.clientHeight, show = phase === 'story' && !outroOn && !busy, placed = [];
  for (const L of LABEL_ELS) {
    let o = L.l.at(S, t), on = show && !!o && t >= (L.l.from ?? 1) && t <= (L.l.to ?? 1e9);
    if (on && o.isObject3D) { for (let p = o; p; p = p.parent) if (!p.visible) { on = false; break; } if (on) o.getWorldPosition(labelV); }
    else if (on) labelV.copy(o);
    if (on) {
      labelV.y += L.l.dy ?? .55;
      const d = labelV.distanceTo(camera.position); labelV.project(camera);
      on = labelV.z < 1 && Math.abs(labelV.x) < 1.02 && Math.abs(labelV.y) < 1.02 && d < (L.l.max ?? 95);
      if (on) { const w = L.w || (L.w = L.el.offsetWidth || 160); placed.push({ L, w, x: clamp((labelV.x + 1) / 2 * W, w / 2 + 6, W - w / 2 - 6), y: (1 - labelV.y) / 2 * Hh }); }
    }
    if (on !== L.on) { L.on = on; L.el.classList.toggle('on', on); }
  }
  // labels that would overlap are stacked; the order is decided when they first meet and kept, so they never swap back and forth
  const apartX = (a, b) => Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 6;
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j], key = a.L.k + '|' + b.L.k;
    if (!apartX(a, b) && Math.abs(a.y - b.y) < 27) { if (!LABEL_ORDER.has(key)) LABEL_ORDER.set(key, a.y <= b.y); }
    else if (apartX(a, b) || Math.abs(a.y - b.y) > 34) LABEL_ORDER.delete(key);
  }
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j], r = LABEL_ORDER.get(a.L.k + '|' + b.L.k);
    if (r === undefined || apartX(a, b)) continue;
    const [u, l] = r ? [a, b] : [b, a];
    if (u.y > l.y - 27) u.y = l.y - 27;
  }
  for (const p of placed) p.L.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
}
// the card is a short caption by default; details open on request, or it folds away to a pill
let cardState = 'compact', outroOn = false, viewShiftTarget = .7;
function setCardState(st) {
  cardState = st;
  const card = $('card');
  card.classList.toggle('expanded', st === 'expanded');
  $('moreBtn').setAttribute('aria-expanded', String(st === 'expanded'));
  $('moreLbl').textContent = st === 'expanded' ? 'Show less' : 'Read more';
  const inStory = phase === 'story' && !outroOn;
  card.hidden = !inStory || st !== 'expanded';
  $('caption').hidden = $('ctrl').hidden = !inStory || st !== 'compact';
  $('storyPill').hidden = !inStory || st !== 'hidden';
  viewShiftTarget = st === 'expanded' ? 1 : 0;
  if (autoplay && stepDone) scheduleAuto();
}
$('moreBtn').onclick = () => setCardState(cardState === 'expanded' ? 'compact' : 'expanded');
$('hideBtn').onclick = () => { setCardState('hidden'); $('showBtn').focus(); };
$('showBtn').onclick = () => { setCardState('compact'); $('moreBtn').focus(); };
$('pillNext').onclick = () => next();
$('capMore').onclick = () => { setCardState('expanded'); $('moreBtn').focus(); };
$('capBack').onclick = () => back();
$('capNext').onclick = () => next();
function renderCard() {
  const s = STEPS[stepIdx];
  $('chapterLabel').textContent = s.ch;
  $('dateLabel').textContent = s.date;
  $('placeEn').textContent = s.place;
  $('placeAr').textContent = s.ar;
  $('beatTitle').textContent = s.title;
  $('narr').textContent = mode === 'young' ? s.young : s.full;
  $('shortText').textContent = mode === 'young' ? s.shortY : s.shortF;
  $('capTitle').textContent = s.title; $('capText').textContent = NARR.on ? '' : mode === 'young' ? s.shortY : s.shortF;
  $('capBack').disabled = stepIdx === 0;
  $('capNext').textContent = stepIdx === STEPS.length - 1 ? 'Finish →' : 'Continue →'; $('capNext').classList.toggle('ready', stepDone);
  $('pillTitle').textContent = s.title;
  const q = $('quote');
  if (s.quote) { q.innerHTML = `<span class="q">${esc(s.quote.q)}</span><span class="quote-by">${esc(s.quote.by)}</span>`; q.hidden = false; } else q.hidden = true;
  $('people').innerHTML = (s.people || []).filter(p => p[2] !== 'full' || mode === 'full').map(p => `<span class="person">${esc(p[0])}<span class="ar" lang="ar" dir="rtl">${esc(p[1])}</span></span>`).join('');
  $('reflect').hidden = !s.reflect; $('reflectText').textContent = s.reflect || '';
  $('note').hidden = !s.note; $('note').textContent = s.note || '';
  $('backBtn').disabled = stepIdx === 0;
  $('nextBtn').textContent = $('pillNext').textContent = stepIdx === STEPS.length - 1 ? 'Finish →' : 'Continue →';
  $('nextBtn').classList.toggle('ready', stepDone); $('pillNext').classList.toggle('ready', stepDone);
  document.querySelectorAll('.tl-bar button').forEach(b => { const i = +b.dataset.step; b.classList.toggle('active', i === stepIdx); b.classList.toggle('done', i < stepIdx); });
  document.querySelectorAll('.tl-ch').forEach(el => el.classList.toggle('current', +el.dataset.ch === s.chN));
}
let lastStat = '';
function updateStat() {
  const s = STEPS[stepIdx]; if (!s) return;
  const v = typeof s.stat === 'function' ? s.stat(stepT) : s.stat;
  if (v !== lastStat) { $('statLabel').textContent = v; lastStat = v; }
}
let TPL = null;
const SCENE_BUILDERS = {
  medina: () => ({ ...buildMedina(TPL), arName: 'المدينة المنورة' }),
  hejaz: () => ({ ...buildHejaz(TPL), arName: 'الحجاز' }),
  mecca: () => ({ ...buildMecca(TPL), arName: 'مكة المكرمة' }),
  saffah: () => ({ ...buildSaffah(TPL), arName: 'الصفاح' }),
  kufa: () => ({ ...buildKufa(TPL), arName: 'الكوفة' }),
  zarud: () => ({ ...buildZarud(TPL), arName: 'زرود' }),
  zubala: () => ({ ...buildZubala(TPL), arName: 'زبالة' }),
  sharaf: () => {
    const S = { ...buildSharaf(TPL), arName: 'شراف' };
    S.buckets = SHA_FORM.slice(0, 8).map(f => { const b = makeBucket(); b.position.set(f.ex, hSha(f.ex, f.ez + 1.18), f.ez + 1.18); b.visible = false; S.group.add(b); return b; });
    S.mass = buildMass(TPL.horse, S.group);
    return S;
  },
  karbala: () => ({ ...buildKarbala(TPL), arName: 'كربلاء' }),
  damascus: () => ({ ...buildDamascus(TPL), arName: 'دمشق' }),
  escort: () => ({ ...buildEscort(TPL), arName: 'البيضة' }),
};
function ensureScene(name) {
  if (!SCENES[name]) { SCENES[name] = SCENE_BUILDERS[name](); scene.add(SCENES[name].group); }
  return SCENES[name];
}
function enterScene(name) {
  ensureScene(name);
  for (const k in SCENES) SCENES[k].group.visible = k === name;
  H = SCENES[name].h; curScene = name;
  DUST.clear(); SPARKS.clear(); SPLASH.clear(); SMOKE.clear(); EMBER_GLOW.clear(); NOOR_MOTES.clear();
}
function setupStep(i) {
  const s = STEPS[i], S = SCENES[s.scene];
  stepIdx = i; stepT = 0; stepDone = false; $('roll').hidden = true; $('sermon').hidden = true; SERMON_K = -1; buildLabels(STEPS[i]);
  $('miniSvg')._city = $('bigSvg')._city = s.mapCity || null;
  if (S.buckets) S.buckets.forEach(b => b.visible = false);
  s.enter(S);
  if (s.envFrom) applyEnv(ENV[s.envFrom]); else applyEnv(ENV[s.env]);
  refreshEnvMap();
  s.update(0, 0, S, 0);
  s.shot.apply(0);
}
const UI_DIM = ['card', 'storyPill', 'caption', 'ctrl'];
function fillMapcard(s) {
  $('mcCh').textContent = s.ch; $('mcPlace').textContent = s.place; $('mcAr').textContent = (SCENE_AR[s.scene] || '');
  $('mcDate').textContent = s.date; $('mcKm').textContent = s.km ? `About ${s.km.toLocaleString('en-US')} km from Medina` : (s.mcKm || 'Where the journey begins');
}
const SCENE_AR = { medina: 'المدينة المنورة', hejaz: 'الحجاز', mecca: 'مكة المكرمة', saffah: 'الصفاح', kufa: 'الكوفة', zarud: 'زرود', zubala: 'زبالة', sharaf: 'شراف', escort: 'البيضة', karbala: 'كربلاء', damascus: 'دمشق' };
function startStory() { phase = 'story'; setCardState(cardState); viewShift = viewShiftTarget; applyViewOffset(); $('intro').hidden = true; $('stamp').hidden = false; $('timeline').hidden = false; $('minimap').hidden = false; document.body.classList.add('cine'); }
async function goTo(i) {
  if (busy || i < 0 || i >= STEPS.length) return;
  busy = true; clearTimeout(autoTimer);
  const s = STEPS[i], first = phase !== 'story', newScene = s.scene !== curScene || first;
  UI_DIM.forEach(id => $(id).classList.add('dim'));
  narrStop();
  const show = () => { if (newScene) enterScene(s.scene); setupStep(i); renderCard(); $('miniSvg')._city = $('bigSvg')._city = s.mapCity || null; setMapProgress($('miniSvg'), s.mapStop, false); narrStart(s); };
  if (newScene && !REDUCE) {
    const fromCity = first ? (s.mapCity || null) : mapCityShown;
    fillMapcard(s); $('bigSvg')._city = fromCity; setMapProgress($('bigSvg'), mapStopShown);
    $('mapcard').classList.add('on'); SND.duck = .45; await wait(first ? 950 : 700);
    playing = false;
    if (first) startStory();
    show();
    $('bigSvg')._city = s.mapCity || null;
    mapTween($('bigSvg'), mapStopShown, s.mapStop, s.mapCity ? FULL_BOX : boxFor(mapStopShown, s.mapStop), 2600, fromCity, s.mapCity || null);
    mapStopShown = s.mapStop; mapCityShown = s.mapCity || null;
    await wait(2750);
    $('mapcard').classList.remove('on'); SND.duck = 1;
    playing = true;
    await wait(300);
  } else {
    $('fade').classList.add('soft', 'on'); playing = false;
    await wait(REDUCE ? 50 : 380);
    if (first) startStory();
    show();
    $('fade').classList.remove('on'); playing = true;
    await wait(REDUCE ? 0 : 420); $('fade').classList.remove('soft');
  }
  busy = false;
  UI_DIM.forEach(id => $(id).classList.remove('dim'));
}
function onStepDone() {
  stepDone = true;
  $('nextBtn').classList.add('ready'); $('pillNext').classList.add('ready'); $('capNext').classList.add('ready');
  if (autoplay) scheduleAuto();
}
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (NARR.on) { autoTimer = setTimeout(() => { if (autoplay && stepDone && !busy) next(); }, 1500); return; }
  const s = STEPS[stepIdx];
  const shown = cardState === 'expanded' ? (mode === 'young' ? s.young : s.full) : cardState === 'compact' ? (mode === 'young' ? s.shortY : s.shortF) : '';
  const words = shown ? shown.split(/\s+/).length : 0;
  autoTimer = setTimeout(() => { if (autoplay && stepDone && !busy) next(); }, Math.max(2500, words * 280 - 4000));
}
function next() { if (stepIdx >= STEPS.length - 1) showOutro(true); else goTo(stepIdx + 1); }
function back() { if (stepIdx > 0) goTo(stepIdx - 1); }
function showOutro(on) {
  const o = $('outro'); o.classList.toggle('gone', !on); o.setAttribute('aria-hidden', String(!on));
  outroOn = on; setCardState(cardState); if (on) { clearTimeout(autoTimer); narrStop(); $('replayBtn').focus(); }
}
function setMode(m) {
  mode = m;

  if (stepIdx >= 0) renderCard();
  if (phase === 'story' && stepIdx >= 0 && NARR.on && !busy) narrStart(STEPS[stepIdx], false);
}
$('beginBtn').onclick = () => { $('intro').classList.add('gone'); goTo(0); };
$('nextBtn').onclick = next; $('backBtn').onclick = back;
$('replayBtn').onclick = () => { showOutro(false); mapStopShown = 0; mapCityShown = STEPS[0].mapCity || null; NARR.lastCh = 0; mapDraw($('bigSvg'), FULL_BOX, 0); goTo(0); };
$('lastBtn').onclick = () => { showOutro(false); goTo(STEPS.length - 1); };
$('autoBtn').onclick = () => { autoplay = !autoplay; $('autoBtn').setAttribute('aria-pressed', autoplay); if (autoplay && stepDone) scheduleAuto(); else clearTimeout(autoTimer); };
document.addEventListener('keydown', e => {
  if (phase !== 'story' || e.altKey || e.ctrlKey || e.metaKey || !$('outro').classList.contains('gone')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); setCardState(cardState === 'hidden' ? 'compact' : 'hidden'); }
});
// ─────────── sound: natural soundscapes built from filtered noise, mixed per scene (no music) ───────────
const SND = { on: false, duck: 1, last: {}, nh: 0, nc: 0 };
function sndInit() {
  const ac = SND.ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = SND.master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const buf = (sec, fill) => { const b = ac.createBuffer(1, Math.round(ac.sampleRate * sec), ac.sampleRate); fill(b.getChannelData(0), ac.sampleRate); return b; };
  const white = buf(4, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
  const brown = buf(6, d => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.2; } });
  const pink = buf(5, d => { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .11; } });
  const loop = b => { const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.start(0, Math.random() * b.duration); return s; };
  const filt = (type, f, Q = .7) => { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = Q; return x; };
  const gain = v => { const g = ac.createGain(); g.gain.value = v; return g; };
  const lfo = (f, depth, target, type = 'sine') => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const g = gain(depth); o.connect(g); g.connect(target); o.start(); };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const bus = () => { const g = gain(0); g.connect(master); return g; };
  const L = SND.L = {};
  { const am = gain(1); lfo(.08, .35, am.gain); L.wind = chain(loop(brown), filt('lowpass', 480), am, bus()); }
  { const src = loop(pink), a = filt('bandpass', 520, .9), b = filt('bandpass', 1300, 2), mix = gain(1), am = gain(.8); lfo(.31, .22, am.gain); lfo(.83, .12, am.gain);
    src.connect(a); a.connect(mix); src.connect(b); chain(b, gain(.45), mix); L.crowd = chain(mix, am, bus()); }
  { const am = gain(.8); lfo(.19, .3, am.gain); L.hum = chain(loop(pink), filt('bandpass', 260, .9), am, bus()); }
  { const src = loop(white), sp = gain(.25); lfo(4.3, .18, sp.gain); lfo(6.7, .12, sp.gain); const out = bus();
    chain(src, filt('bandpass', 820, .5), out); chain(src, filt('highpass', 2600), sp, out); L.water = out; }
  L.fire = chain(loop(brown), filt('lowpass', 260), bus());
  L.gallop = chain(loop(brown), filt('lowpass', 140), bus());
  L.hoof = gain(1); L.hoof.connect(master); L.crackle = gain(1); L.crackle.connect(master); L.fx = gain(1); L.fx.connect(master);
  SND.thud = buf(.14, (d, sr) => { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * .02)); });
  SND.click = buf(.03, (d, sr) => { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * .003)); });
  SND.white = white; SND.filt = filt; SND.gain = gain;
}
const SND_MUL = { wind: 1, crowd: .7, hum: .8, water: .45, fire: .55, gallop: .9 };
function sndHit(b, at, dest, f, v, type = 'lowpass') { const ac = SND.ac, s = ac.createBufferSource(); s.buffer = b; const x = SND.filt(type, f), g = SND.gain(v); s.connect(x); x.connect(g); g.connect(dest); s.start(at); }
function sndWhoosh() {
  if (!SND.on) return;
  const ac = SND.ac, at = ac.currentTime, s = ac.createBufferSource(); s.buffer = SND.white;
  const bp = SND.filt('bandpass', 300, 1.2), g = SND.gain(0);
  bp.frequency.setValueAtTime(260, at); bp.frequency.exponentialRampToValueAtTime(2400, at + 1.6);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.16, at + .7); g.gain.linearRampToValueAtTime(0, at + 2);
  s.connect(bp); bp.connect(g); g.connect(SND.L.fx); s.start(at); s.stop(at + 2.1);
}
function soundMood(s, S, t) {
  // the wind is the same everywhere, as in the original; the rest depends on what is happening in the scene
  const P = { wind: .217, crowd: 0, hum: 0, water: 0, fire: 0, hoof: 0, gallop: 0 };
  if (s.scene === 'karbala') P.water = .2;
  if (s.scene === 'kufa' || s.scene === 'damascus') P.crowd = .3;
  if (s.scene === 'mecca') P.crowd = .2;
  const c0 = caravan.camels[0];
  if (c0 && c0.group.visible) P.hoof += 5 * (caravan.wob || 0);
  let gal = 0, walk = 0;
  army.forEach(a => { if (!a.group.visible) return; if (a.speed > 3.2) gal++; else if (a.speed > .3) walk++; });
  P.gallop = Math.min(1, gal / 14); P.hoof += walk * .45;
  if (s.sfx) Object.assign(P, s.sfx(t, S, P));
  P.hoof = Math.min(P.hoof, 12);
  return P;
}
function sndUpdate() {
  if (!SND.on || !SND.ac) return;
  const ac = SND.ac, now = ac.currentTime, s = STEPS[stepIdx];
  const P = phase === 'story' && s ? soundMood(s, SCENES[s.scene], Math.min(stepT, s.dur)) : { wind: .217 };
  for (const k in SND_MUL) {
    const v = (P[k] || 0) * SND_MUL[k] * (k === 'gallop' ? 1 : 1);
    if (Math.abs(v - (SND.last[k] ?? -1)) > .002) { SND.L[k].gain.setTargetAtTime(v, now, .8); SND.last[k] = v; }
  }
  const mv = .6 * SND.duck * (NARR.speaking ? .4 : 1);
  if (Math.abs(mv - (SND.last.master ?? -1)) > .002) { SND.master.gain.setTargetAtTime(mv, now, .5); SND.last.master = mv; }
  const ahead = now + .15, rate = (P.hoof || 0) + 30 * (P.gallop || 0);
  if (SND.nh < now) SND.nh = now;
  while (rate > .05 && SND.nh < ahead) { sndHit(SND.thud, SND.nh, SND.L.hoof, 260 + Math.random() * 220, (.18 + Math.random() * .22) * (P.gallop > .2 ? 1.3 : 1)); SND.nh += (.4 + Math.random() * 1.2) / rate; }
  if (SND.nc < now) SND.nc = now;
  const cr = 12 * (P.fire || 0);
  while (cr > .1 && SND.nc < ahead) { sndHit(SND.click, SND.nc, SND.L.crackle, 1800 + Math.random() * 2500, .05 + Math.random() * .2, 'highpass'); SND.nc += (.2 + Math.random() * 1.6) / cr; }
}
$('soundBtn').onclick = () => {
  try {
    if (!SND.ac) sndInit();
    SND.on = !SND.on; SND.ac.resume();
    if (!SND.on) { SND.master.gain.setTargetAtTime(0, SND.ac.currentTime, .4); SND.last.master = 0; }
    $('soundBtn').setAttribute('aria-pressed', SND.on);
  } catch (err) { $('soundBtn').disabled = true; }
};

// ─────────── narration: the story read aloud by the browser's own voices, natural (neural) ones where available ───────────
const HAS_TTS = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
const NARR = { on: false, userSet: false, voice: null, run: 0, busy: false, speaking: false, drive: false, sermonK: -1, rollTarget: Infinity, lastCh: 0, timer: 0, guard: 0 };
const ANDROID = /Android/i.test(navigator.userAgent);
function voiceScore(v) {
  if (!v || !/^en([-_]|$)/i.test(v.lang)) return -1;
  const n = v.name; let s = 0;
  if (/natural|neural/i.test(n)) s += 60;
  if (/premium/i.test(n)) s += 55; else if (/enhanced/i.test(n)) s += 45;
  if (/google/i.test(n)) s += 25;
  if (ANDROID) s += 20;
  if (/(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Princess|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)/i.test(n)) s -= 200;
  if (/^en[-_]US/i.test(v.lang)) s += 4;
  if (/\bBrian\b/.test(n)) s += 30;
  if (/Multilingual/i.test(n)) s -= 3;
  if (/(Ryan|Andrew|Brian|Guy|Christopher|Eric|Thomas|Oliver|Daniel|Arthur|Davis|Roger|Steffan|\bMale\b)/i.test(n)) s += 6;
  if (v.localService === false) s += 2;
  return s;
}
function voiceLabel(v) {
  return v.name.replace(/^Microsoft\s+/, '').replace(/\s+Online\s+\(Natural\)/i, '')
    .replace(/\s*-\s*English\s*\((.+)\)/, (m, r) => ` (${r.replace('United Kingdom', 'UK').replace('United States', 'US')})`).replace(/\bEnglish\s+/, '');
}
function fillVoices() {
  if (!HAS_TTS) return;
  const vs = speechSynthesis.getVoices().filter(v => voiceScore(v) > -1).sort((a, b) => voiceScore(b) - voiceScore(a)).slice(0, 12);
  if (!vs.length) return;
  const sel = $('voiceSel'), keep = NARR.voice && vs.find(v => v.name === NARR.voice.name);
  sel.innerHTML = vs.map((v, i) => `<option value="${i}">${esc(voiceLabel(v))}</option>`).join('');
  sel._vs = vs; NARR.voice = keep || vs[0]; sel.value = String(vs.indexOf(NARR.voice));
  ['narrRow', 'narrBtn', 'narrLabel', 'pronBtn'].forEach(id => { $(id).hidden = false; });
  $('narrHint').hidden = voiceScore(NARR.voice) >= 20;
  // the default is chosen before the story starts; voices that arrive later never restart a scene
  if (!NARR.userSet && phase !== 'story') setNarr(true, false);
}
function setNarr(on, user = true) {
  NARR.on = !!(on && NARR.voice); if (user) NARR.userSet = true;
  ['narrBtn', 'narrIntroBtn'].forEach(id => $(id).setAttribute('aria-pressed', String(NARR.on)));
  $('narrState').textContent = NARR.on ? 'On' : 'Off';
  if (phase === 'story' && stepIdx >= 0 && !busy) { if (NARR.on) { $('capText').textContent = ''; narrStart(STEPS[stepIdx], false); } else { narrStop(); subtitle(null); } }
}
function narrUnavailable() { narrStop(); setNarr(false, false); $('narrBtn').title = 'Narration could not start in this browser'; }
// names spelled for an English voice, and a spoken blessing at each person's first mention in a scene
// Each name: spellings to try, the first is the default; a 'gb' entry overrides it for British voices.
const NAME_SAY = [
  { id: 'yazid', label: 'Yazid', re: /\bYazid\b/g, opts: ['Yah-zeed', 'Yazeed', 'Ya-zeed', 'Yuzeed'], us: 'Ya-zeed', gb: "Yah-zeed" },
  { id: 'muawiya', label: 'Muʿawiya', re: /Muʿawiya/g, opts: ['Muawiya', 'Mooahwiya', "Mu'aawiya", 'Moo-ah-wiya'], gb: "Mu'aawiya" },
  { id: 'hussain', label: 'Hussain', re: /\bHussain\b/g, opts: ['Hussain', 'Husayn', 'Hoosain'] },
  { id: 'zaynab', label: 'Zaynab', re: /\bZaynab\b/g, opts: ['Zaynab', 'Zainab', 'Zay-nab'] },
  { id: 'sayyida', label: 'Sayyida', re: /\bSayyida\b/g, opts: ['Sayyida', 'Sayyeda', 'Sai-yida'], us: 'Sayyeda', gb: "Sai-yida" },
  { id: 'abbas', label: 'al-ʿAbbas', re: /al-ʿAbbas/g, opts: ['al-Abbas', 'al-Abbaas', 'al-Ab-bas', 'Abbas'], us: 'Abbas', gb: "al-Abbaas" },
  { id: 'abidin', label: 'Zayn al-ʿAbidin', re: /Zayn al-ʿAbidin/g, opts: ['Zayn al-Aabideen', 'Zain ul Abideen', 'Zayn al-Abideen'] },
  { id: 'akbar', label: 'ʿAli al-Akbar', re: /ʿAli al-Akbar/g, opts: ['Ali al-Akbar', 'Ali Akbar', 'Aalee al-Akbar'], us: 'Ali Akbar' },
  { id: 'qasim', label: 'al-Qasim', re: /al-Qasim/g, opts: ['al-Qasim', 'al-Qaasim', 'al-Qah-sim'], gb: "al-Qah-sim" },
  { id: 'aqil', label: 'Muslim ibn ʿAqil', re: /ʿAqil/g, opts: ['Aqeel', 'Akeel', 'A-qeel'] },
  { id: 'ziyad', label: 'Ibn Ziyad', re: /\bZiyad\b/g, opts: ['Ziyad', 'Ziyaad', 'Zi-yahd'], us: 'Ziyaad', gb: "Zi-yahd" },
  { id: 'ubaydullah', label: 'ʿUbaydullah', re: /ʿUbaydullah/g, opts: ['Ubaydullah', 'Obaidullah', 'Ubay-dullah'], gb: "Obaidullah" },
  { id: 'hurr', label: 'al-Hurr', re: /\bHurr\b/g, opts: ['Hurr', 'Hur', 'Hoor'], gb: "Hoor" },
  { id: 'zuhayr', label: 'Zuhayr', re: /Zuhayr/g, opts: ['Zuhayr', 'Zuhair', 'Zu-hair'], gb: "Zu-hair" },
  { id: 'qayn', label: 'ibn al-Qayn', re: /\bal-Qayn\b/g, opts: ['al-Qayn', 'al-Qain', 'al-Kain'] },
  { id: 'farazdaq', label: 'al-Farazdaq', re: /Farazdaq/g, opts: ['Farazdaq', 'Farazdak', 'Fa-raz-daq'] },
  { id: 'jabir', label: 'Jabir', re: /\bJabir\b/g, opts: ['Jabir', 'Jaabir', 'Jah-bir'], gb: "Jah-bir" },
  { id: 'kufa', label: 'Kufa', re: /\bKufa\b/g, opts: ['Kufa', 'Koofa', 'Koo-fa'] },
  { id: 'karbala', label: 'Karbala', re: /\bKarbala\b/g, opts: ['Karbala', 'Kar-ba-la', 'Karbalaa'], us: 'Karbalaa', gb: "Karbalaa" },
  { id: 'ashura', label: 'Ashura', re: /\bAshura\b/g, opts: ['Ashura', 'Aashoora', 'A-shoo-ra'], us: 'Aashoora', gb: "Aashoora" },
  { id: 'muharram', label: 'Muharram', re: /\bMuharram\b/g, opts: ['Muharram', 'Mu-har-ram', 'Moharram', 'Mu-har-rum'], us: 'Mu-har-rum', gb: "Mu-har-ram" },
  { id: 'arbaeen', label: 'Arbaeen', re: /\bArbaeen\b/g, opts: ['Arbaeen', 'Arba-een', 'Ar-ba-een'], us: 'Arba-een' },
  { id: 'zuljanah', label: 'Zuljanah', re: /\bZuljanah\b|Dhu al-Janah/g, opts: ['Zuljanah', 'Zul-jana', 'Zul-ja-nah'], us: 'Zul-ja-nah', gb: "Zul-jana" },
  { id: 'said', label: 'Saʿid (not "said")', re: /\bSaʿid\b/g, opts: ['Saeed', 'Sa-eed', 'Saaeed'] },
  { id: 'saad', label: 'Saʿd (not "sad")', re: /\bSaʿd\b/g, opts: ['Saad', 'Sa-ad', 'Sahd'] },
  { id: 'zarud', label: 'Zarud', re: /\bZarud\b/g, opts: ['Zarud', 'Zarood', 'Za-rood'], us: 'Za-rood' },
  { id: 'zubala', label: 'Zubala', re: /\bZubala\b/g, opts: ['Zubala', 'Zubaala', 'Zu-bah-la'], gb: "Zu-bah-la" },
  { id: 'thalabiyya', label: 'Thaʿlabiyya', re: /Thaʿlabiyya/g, opts: ['Thalabiyya', 'Tha-la-biyya', 'Thaalabiyya'], gb: "Thaalabiyya" },
];
const PRON_KEY = 'karbala-pronunciation';
let PRON_OVR = { us: {}, gb: {} };
try { const j = JSON.parse(localStorage.getItem(PRON_KEY) || 'null'); if (j) PRON_OVR = { us: j.us || {}, gb: j.gb || {} }; } catch (e) {}
const voiceLoc = () => /^en[-_]GB/i.test((NARR.voice && NARR.voice.lang) || '') ? 'gb' : 'us';
const pronOf = n => PRON_OVR[voiceLoc()][n.id] || n[voiceLoc()] || n.opts[0];
const SAY_FIX = [
  [/ﷺ/g, ', peace be upon him and his family,'], [/Inna lillahi wa inna ilayhi rajiʿun/g, 'To God we belong, and to Him we return'],
  [/Qurʾan/g, 'Quran'], [/Kaʿba/g, 'Kaaba'], [/([.!?])\s*…\s*/g, '$1 '], [/\s*…\s*/g, '. '], 
  [/Dhu al-Hijja/g, 'Dhul Hijja'], [/Shaʿban/g, 'Shaabaan'], [/Sham-e Ghariban/g, 'Shaam-e Ghareebaan'],
  [/\bAH\b/g, 'A H'], [/[ʿʾ]/g, ''], [/ā/g, 'aa'], [/ī/g, 'ee'], [/ū/g, 'oo'], [/[“”]/g, '"'], [/[‘’]/g, "'"],
];
function spokenSeq(parts, seen) {
  return parts.map(s => {
    s = s.replace(/\s*\((?:AS|SA)\)/g, '');
    HON.forEach(([re, h, f, who], idx) => {
      s = s.replace(re, (m, ...a) => {
        const off = a[a.length - 2], str = a[a.length - 1], before = str.slice(0, off);
        const inQuote = (before.match(/“/g) || []).length > (before.match(/”/g) || []).length || (before.match(/"/g) || []).length % 2 === 1;
        if (seen.has(idx) || inQuote || /^['’]s\b/.test(str.slice(off + m.length))) return m;
        seen.add(idx); return m + `, peace be upon ${who || (h === 'SA' ? 'her' : 'him')},`;
      });
    });
    for (const n of NAME_SAY) s = s.replace(n.re, pronOf(n));
    for (const [re, r] of SAY_FIX) s = s.replace(re, r);
    return s.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/(, peace be upon him,) (Imam [^,.;:]{1,30}), peace be upon him,/g, '$1 $2,')
      .replace(/,\s*([.!?;:)])/g, '$1').replace(/\s+/g, ' ').trim();
  });
}
function sentences(s) {
  const out = [];
  const parts = [];
  for (const p of s.split(/(?<=[.!?]["”’']?)\s+(?=["“‘']?(?:[A-Z0-9ʿ]|al-))/)) {
    const prev = parts[parts.length - 1], open = prev !== undefined && ((prev.match(/“/g) || []).length > (prev.match(/”/g) || []).length || (prev.match(/"/g) || []).length % 2 === 1);
    if (open) parts[parts.length - 1] += ' ' + p; else parts.push(p);
  }
  for (const p of parts) {
    let rest = p;
    while (rest.length > 230) { const cut = rest.slice(0, 230).search(/[;:,][^;:,]*$/); if (cut < 60) break; out.push(rest.slice(0, cut + 1)); rest = rest.slice(cut + 1).trim(); }
    out.push(rest);
  }
  return out.filter(Boolean);
}
function quoteLine(qt) {
  const by = qt.by, i = by.indexOf(', '), who = i < 0 ? by : by.slice(0, i), ctx = i < 0 ? '' : by.slice(i + 2);
  if (/^Qurʾan/.test(by)) return `As the Qurʾan says: “${qt.q}”`;
  return (/^(son|daughter|sister|brother|grandson) of/.test(ctx) ? `${who}, ${ctx}, said` : ctx ? `${who} said, ${ctx}` : `${who} said`) + `: “${qt.q}”`;
}
function sermonItems(sm, lead, seen) {
  return [{ say: spokenSeq([lead], seen)[0], sub: '', gap: 400 }, ...sm.lines.map((l, k) => ({ say: spokenSeq([l[1]], seen)[0], sub: '', gap: 650, hook: () => { NARR.sermonK = k; } }))];
}
function narrItems(s, announce) {
  const young = mode === 'young', seen = new Set(), items = [];
  if (announce && s.chN !== NARR.lastCh) items.push({ say: `Chapter ${s.chN}. ${CHAPTER_NAMES[s.chN - 1]}.`, sub: '', gap: 700 });
  NARR.lastCh = s.chN;
  const main = sentences(young ? s.young : s.full), said = spokenSeq(main, seen);
  main.forEach((m, k) => items.push({ say: said[k], sub: m, gap: k === main.length - 1 ? 650 : 280, at: k ? undefined : .4 }));
  const norm = x => x.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(), mainN = norm(young ? s.young : s.full);
  const told = s.quote && s.quote.q.split('…').some(part => norm(part).length > 12 && mainN.includes(norm(part)));
  const quote = s.quote && !told ? { say: spokenSeq([quoteLine(s.quote)], seen)[0], sub: `“${s.quote.q}”`, gap: 700 } : null;
  if (quote && !s.narrQuoteLast) items.push(quote);
  if (s.narrExtra) items.push(...s.narrExtra(young, SCENES[s.scene] || {}, seen));
  if (quote && s.narrQuoteLast) items.push(quote);
  if (s.reflect) items.push({ say: (/^Think/.test(s.reflect) ? '' : 'Think about it. ') + spokenSeq([s.reflect], seen)[0], sub: s.reflect, gap: 400, only: () => cardState === 'expanded' });
  return items;
}
function subtitle(txt) {
  const s = STEPS[stepIdx], el = $('capText'); if (!s) return;
  if (txt === null) { el.textContent = mode === 'young' ? s.shortY : s.shortF; el.classList.remove('long'); return; }
  el.textContent = txt; el.classList.toggle('long', txt.length > 170);
}
function narrStop() {
  NARR.run++; clearTimeout(NARR.timer); clearTimeout(NARR.guard);
  if (HAS_TTS) try { speechSynthesis.cancel(); } catch (e) {}
  NARR.busy = NARR.speaking = NARR.drive = false; NARR.rollTarget = Infinity;
}
function narrStart(s, announce = true) {
  narrStop();
  if (!NARR.on || !NARR.voice || !HAS_TTS) return;
  const run = NARR.run, items = narrItems(s, announce);
  NARR.busy = NARR.drive = true; NARR.sermonK = -1;
  NARR.rollTarget = s.narrRoll ? Math.max(2.5, SCENES[s.scene].rollT || 0) : Infinity;
  let k = 0;
  const next = () => {
    if (run !== NARR.run) return;
    if (k >= items.length) { NARR.busy = NARR.speaking = false; if (s.narrRoll) NARR.rollTarget = 1e9; return; }
    const it = items[k];
    if (it.only && !it.only()) { k++; next(); return; }
    if (it.at !== undefined && stepT < it.at) { NARR.timer = setTimeout(next, 150); return; }
    k++;
    const u = new SpeechSynthesisUtterance(it.say);
    u.voice = NARR.voice; u.lang = NARR.voice.lang; u.rate = mode === 'young' ? .93 : .97; u.pitch = 1;
    let done = false;
    const fin = () => { if (done || run !== NARR.run) return; done = true; clearTimeout(NARR.guard); NARR.speaking = false; NARR.timer = setTimeout(next, it.gap ?? 280); };
    u.onend = fin;
    u.onerror = e => { if (run !== NARR.run) return; if (e && e.error === 'not-allowed') narrUnavailable(); else fin(); };
    if (it.sub !== undefined) subtitle(it.sub);
    if (it.hook) it.hook();
    NARR.speaking = true;
    // a browser that never reports the end of a sentence must not stall the story
    NARR.guard = setTimeout(fin, 4000 + it.say.length * 120);
    speechSynthesis.speak(u);
  };
  next();
}
if (HAS_TTS) {
  fillVoices();
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', fillVoices); else speechSynthesis.onvoiceschanged = fillVoices;
  setTimeout(fillVoices, 700); setTimeout(fillVoices, 2500);
}
$('narrBtn').onclick = () => setNarr(!NARR.on);
$('narrIntroBtn').onclick = () => setNarr(!NARR.on);
$('voiceTry').onclick = () => {
  if (!HAS_TTS || !NARR.voice) return;
  narrStop();
  const u = new SpeechSynthesisUtterance(spokenSeq(['Imam Hussain (AS), al-ʿAbbas (AS) and Sayyida Zaynab (SA) travelled from Medina to Karbala, while Yazid ruled from Damascus and Ibn Ziyad from Kufa.'], new Set())[0]);
  u.voice = NARR.voice; u.lang = NARR.voice.lang; u.rate = .95;
  speechSynthesis.speak(u);
};
function sayName(txt) {
  if (!HAS_TTS || !NARR.voice) return;
  narrStop(); try { speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(txt); u.voice = NARR.voice; u.lang = NARR.voice.lang; u.rate = .92;
  speechSynthesis.speak(u);
}
function renderPron() {
  const loc = voiceLoc();
  $('pronVoice').textContent = (NARR.voice ? voiceLabel(NARR.voice) : '') + (loc === 'gb' ? ' · British spellings' : ' · American spellings');
  $('pronList').innerHTML = NAME_SAY.map((n, i) => {
    const cur = pronOf(n), opts = n.opts.includes(cur) ? n.opts : [...n.opts, cur];
    return `<div class="pron-row"><div class="pron-name">${esc(n.label)}</div><div class="pron-opts">${opts.map(o => `<button type="button" class="pron-opt" data-i="${i}" data-o="${esc(o)}" aria-pressed="${o === cur}">▶ ${esc(o)}</button>`).join('')}<input class="pron-own" data-i="${i}" placeholder="own spelling ↵" aria-label="Your own spelling for ${esc(n.label)}"></div></div>`;
  }).join('');
  const diff = { us: {}, gb: {} };
  for (const loc2 of ['us', 'gb']) for (const n of NAME_SAY) { const v = PRON_OVR[loc2][n.id]; if (v && v !== (n[loc2] || n.opts[0])) diff[loc2][n.id] = v; }
  $('pronOut').value = JSON.stringify(diff);
}
function pickPron(i, o) {
  const n = NAME_SAY[i]; if (!n || !o) return;
  PRON_OVR[voiceLoc()][n.id] = o;
  try { localStorage.setItem(PRON_KEY, JSON.stringify(PRON_OVR)); } catch (e) {}
  sayName(`The name is ${o}.`);
  renderPron();
}
$('pronBtn').onclick = () => { renderPron(); $('pron').hidden = false; $('pronClose').focus(); };
$('pronClose').onclick = () => { $('pron').hidden = true; $('pronBtn').focus(); };
$('pron').addEventListener('keydown', e => { if (e.key === 'Escape') $('pronClose').onclick(); });
$('pronList').addEventListener('click', e => { const b = e.target.closest('.pron-opt'); if (b) pickPron(+b.dataset.i, b.dataset.o); });
$('pronList').addEventListener('keydown', e => { const f = e.target.closest('.pron-own'); if (f && e.key === 'Enter') { e.preventDefault(); pickPron(+f.dataset.i, f.value.trim()); } });
$('pronCopy').onclick = () => {
  const t = $('pronOut'), done = m => { $('pronCopied').textContent = m; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(() => done('Copied. Paste it into the chat.'), () => { t.select(); done('Select the text below and copy it.'); });
  else { t.select(); done('Select the text below and copy it.'); }
};
$('voiceSel').onchange = () => { const v = $('voiceSel')._vs[+$('voiceSel').value]; if (v) { NARR.voice = v; $('narrHint').hidden = voiceScore(v) >= 20; } };

// ─────────── main loop ───────────
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), .05);
  TIME += dt;
  BANNER_U.uTime.value = TIME;
  if (Math.abs(viewShift - viewShiftTarget) > .002) { viewShift = lerp(viewShift, viewShiftTarget, 1 - Math.exp(-dt * 3)); applyViewOffset(); }
  if (phase === 'intro') {
    const S = SCENES.medina;
    caravanUpdate(S.path, 46, dt);
    const a = Math.sin(TIME * .07);
    camera.position.set(4 + a * 7, 0, 19 - a * 2);
    camera.position.y = H(camera.position.x, camera.position.z) + 3.6 + a * .5;
    focus.set(-30, 0, -3); focus.y = H(focus.x, focus.z) + 2.4; camera.lookAt(focus);
  } else if (phase === 'story' && stepIdx >= 0) {
    const s = STEPS[stepIdx], S = SCENES[s.scene];
    const adt = playing ? dt : 0;
    if (playing) stepT += dt;
    const t = Math.min(stepT, s.dur);
    if (s.envFrom) {
      const k = smooth(0, s.envT, s.envClock ? s.envClock(S) : t);
      applyEnv(ENV[s.envFrom], ENV[s.env], k);
      if (k >= 1 && !s._envDone) { refreshEnvMap(); s._envDone = true; }
      if (k < 1) s._envDone = false;
    }
    s.update(t, adt, S, stepT);
    updateLabels(s, S, stepT);
    if (!playing) army.forEach(a => a.group.visible && a.mixer.update(0));
    s.shot.apply(t);
    if (s.lead && stepT > s.dur) {
      const FP = s.followPath ? S[s.followPath] : S.path, L = FP.getLength();
      const p0 = FP.getPointAt(clamp(s.lead(s.dur) / L, 0, 1)), p1 = FP.getPointAt(clamp(s.lead(stepT) / L, 0, 1));
      const hc = H(camera.position.x, camera.position.z), hf = H(focus.x, focus.z);
      camera.position.x += p1.x - p0.x; camera.position.z += p1.z - p0.z;
      focus.x += p1.x - p0.x; focus.z += p1.z - p0.z;
      camera.position.y += H(camera.position.x, camera.position.z) - hc;
      focus.y += H(focus.x, focus.z) - hf;
      camera.lookAt(focus);
    }
    // listening, a scene is done when its key moment has played and the narrator has finished
    const need = NARR.on ? (s.cdur || s.dur) : cardState === 'expanded' ? s.dur : (s.cdur || s.dur);
    if (playing && stepT >= need && !NARR.busy && !stepDone) onStepDone();
    updateStat();
  }
  M.water.normalMap.offset.x = TIME * .012; M.water.normalMap.offset.y = TIME * .004;
  RIVER_FLOW.value.set(TIME * .018, -TIME * .011); STREAK_TEX.offset.x = TIME * .022;
  if (curScene === 'karbala') {
    const S = SCENES.karbala;
    if (S.enemy.visible) S.fires.forEach(f => {
      const u = f.userData;
      u.fl.forEach((m, k) => { const n = N.n2(TIME * 5 + u.seed + k * 3, k); m.scale.y = (k ? 1 : .7) * (.8 + .35 * n); m.rotation.y += dt * (1 + k); });
      if (u.light) u.light.intensity = 55 + 20 * N.n2(TIME * 7, u.seed);
      if (Math.random() < dt * 5) SPARKS.emit(f.position.x, f.position.y + 1, f.position.z, (Math.random() - .5) * .6, 1.5 + Math.random() * 1.5, (Math.random() - .5) * .6, 1.6, .22, .06, 1);
    });
  }
  // sky, moon, shadows follow the camera
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  moon.position.copy(camera.position).addScaledVector(skyU.sunDir.value, 2600);
  moon.lookAt(camera.position); moon.scale.setScalar(165); moonMat.opacity = moonAlpha;
  fill.position.copy(camera.position).add(tmpV3.set(0, 6, 0)); fill.target.position.copy(focus);
  key.target.position.copy(focus);
  key.position.copy(focus).addScaledVector(lightDir, 250);
  sndUpdate();
  DUST.update(dt, .5, .15); SPARKS.update(dt, .3, .2); SPLASH.update(dt, .2, -7); SMOKE.update(dt, .25, .18); EMBER_GLOW.update(dt, .5, 0); NOOR_MOTES.update(dt, .2, .06);
  NOOR_GAIN.v = Math.round(clamp(.26 / bloom.strength, .45, 1) * 20) / 20;
  for (const n of NOORS) n.update(TIME, dt);
  composer.render(dt);
  requestAnimationFrame(frame);
}

// ─────────── boot ───────────
(async () => {
  try {
    const [horse, camelA, camelB, palmA, palmB, rockA, rockB, rockC, firepit, rider] = await Promise.all(
      ['horse', 'camelA', 'camelB', 'palmA', 'palmB', 'rockA', 'rockB', 'rockC', 'firepit', 'rider'].map(k => parseGLB(MODELS[k])));
    const T = {
      palmA: normalized(palmA.scene, 1, { tintLeaves: true }), palmB: normalized(palmB.scene, 1, { tintLeaves: true }),
      rockA: normalized(rockA.scene, 1, { stone: '#9b7a57' }), rockB: normalized(rockB.scene, 1, { stone: '#9b7a57' }), rockC: normalized(rockC.scene, 1, { stone: '#a8865f' }),
      firepit: normalized(firepit.scene, .45),
    };
    const horseTpl = prepHorse(horse);
    { const rs = prepRider(rider); horseTpl.riders = rs.soldier; horseTpl.civil = rs.civil; horseTpl.hands = rs.hands; RIDER_HANDS = rs.hands; }
    const camelTplA = prepCamel(camelA), camelTplB = prepCamel(camelB);
    camelTplA.mat = camelTplA.mat.clone(); camelTplA.mat.color.setScalar(1.12);
    camelTplB.mat = camelTplB.mat.clone(); camelTplB.mat.color.setScalar(.8);

    TPL = T; T.horse = horseTpl; T.camelTplA = camelTplA; T.camelTplB = camelTplB;
    RIDER_CIVIL = horseTpl.civil;
    ['howdah', 'pack', 'howdah', 'pack', 'howdah', 'pack', 'pack'].forEach((kind, i) => {
      const c = new CamelUnit(i % 3 === 1 ? camelTplB : camelTplA, kind, i);
      caravan.camels.push(c); scene.add(c.group);
    });
    { // in Chapter 7 the first camel carries Imam Zayn al-ʿAbidin's light on a plain saddle, ahead of the howdahs
      const c = caravan.camels[0], alt = new THREE.Group(); alt.position.copy(c.top.position); c.body.add(alt);
      const drape = new THREE.CylinderGeometry(.5, .5, 1.05, 16, 1, true, -Math.PI / 2, Math.PI); drape.rotateX(-Math.PI / 2); drape.scale(1, .55, 1);
      const cloth = new THREE.Mesh(drape, M.rugB.clone()); cloth.material.side = THREE.DoubleSide; cloth.position.y = -.15; cloth.castShadow = true; alt.add(cloth);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(.62, .1, .7), M.leather); seat.position.y = .12; alt.add(seat);
      c.altNoor = new Noor(1.1); c.altNoor.group.position.set(0, 1.25, .05); alt.add(c.altNoor.group);
      c.alt = alt; alt.visible = false;
    }
    ['white', 'chestnut', 'grey', 'black'].forEach((v, k) => { const h = new HorseUnit(horseTpl, v, false, k); h.noor = new Noor(k ? .9 : 1.25); h.group.add(h.noor.group); caravan.horses.push(h); scene.add(h.group); });
    { // the standard of al-ʿAbbas, carried at the head of the caravan
      const st = new THREE.Group(); st.position.x = .34;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 4.3, 6), M.darkWood); pole.position.y = 1.1; pole.castShadow = true;
      const fin = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), M.gold); fin.position.y = 3.3;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.06, .3, 8), M.gold); tip.position.y = 3.55;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .85, 16, 8), M.banner); flag.geometry.translate(.65, 0, 0); flag.position.y = 2.75; flag.rotation.y = Math.PI / 2; flag.castShadow = true;
      st.add(pole, fin, tip, flag); caravan.horses[1].noor.group.add(st); caravan.standard = st; caravan.standardOn = true;
    }
    { const L = new THREE.PointLight('#ffb468', 0, 34, 1.25); L.position.set(0, 4.6, 0); caravan.camels[3].group.add(L); caravanLights.push(L); }
    const armyColors = ['bay', 'black', 'dun', 'bay', 'chestnut', 'black'];
    for (let i = 0; i < 40; i++) { const a = new HorseUnit(horseTpl, armyColors[i % armyColors.length], true, i); a.group.visible = false; army.push(a); scene.add(a.group); }

    buildTimeline();
    enterScene('medina');
    applyEnv(ENV.night); refreshEnvMap();
    phase = 'intro';
    $('loading').hidden = true;
    $('beginBtn').disabled = false;
    requestAnimationFrame(frame);
    const m = /^#step-(\d+)(?:-t(\d+))?$/.exec(location.hash);
    if (m && m[2] !== undefined) {
      $('intro').hidden = true; phase = 'story';
      const cs = /card=(\w+)/.exec(location.search); setCardState(cs ? cs[1] : 'compact'); viewShift = viewShiftTarget; applyViewOffset();
      ['stamp', 'timeline', 'minimap'].forEach(id => { $(id).hidden = false; });
      document.body.classList.add('cine');
      const i = clamp(+m[1], 1, STEPS.length) - 1;
      enterScene(STEPS[i].scene); setupStep(i); renderCard(); setMapProgress($('miniSvg'), STEPS[i].mapStop, false);
      stepT = +m[2]; playing = true;
    } else if (m) { $('intro').classList.add('gone'); goTo(clamp(+m[1], 1, STEPS.length) - 1); }
  } catch (err) {
    console.error(String(err && err.stack).split(/\n/).slice(0, 8).join(' <- '));
    $('loadMsg').textContent = 'The scenes could not be loaded in this browser.';
  }
})();
