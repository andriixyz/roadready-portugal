// The road-trip game's 3D scene, drawn with plain WebGL so the app stays dependency-free.
// Each question is a toll gate with one lane per answer; the car stops, takes a lane and is let
// through or bounced off the barrier. The simulation at the top is pure and checked in Node;
// createTripScene() needs a browser and returns null when WebGL is unavailable.

export const LANE_WIDTH = 3.4;
export const STOP_GAP = 7.5;
export const BUMP_GAP = 3.3;
export const GATE_AHEAD = 46;
const SEGMENT = 12;
const ROAD_HALF = 7.8;

export const laneX = (index, count) => (index - (count - 1) / 2) * LANE_WIDTH;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const createSceneState = () => ({
  d: 0, v: 0, x: 0, yaw: 0, time: 0, shake: 0, braking: false, attract: true,
  gates: [], queue: [], q: null, signs: [],
});

// A question exists as soon as it is asked; its gate is built once the road ahead is free.
export function sceneQuestion(state, count) {
  const q = { count, aim: null, pick: null, correct: null, detour: false };
  state.q = q;
  // Only the newest question waits for a gate: a player answering faster than the car can drive
  // skips the gates in between instead of leaving the scene further and further behind.
  state.queue = [q];
  state.attract = false;
  return q;
}

// Advance the car by dt seconds. `still` (reduced motion) parks the car between gates.
export function stepScene(state, dt, still = false) {
  state.time += dt;
  let gate = state.gates.find((item) => !item.cleared);
  if (!gate && state.queue.length) {
    const last = state.gates.at(-1);
    const q = state.queue.shift();
    gate = { d: Math.max(state.d + GATE_AHEAD, last ? last.d + 30 : 0), q, open: Array(q.count).fill(0), cleared: false, bumped: false };
    state.gates.push(gate);
  }
  let targetX = 0;
  let stopAt = Infinity;
  if (gate) {
    const { q } = gate;
    const decided = q.pick !== null;
    // Only the study-key lane ever opens: at once after a right pick, or when the player drives on.
    const passLane = decided && (q.detour || q.pick === q.correct) ? q.correct : null;
    const lane = decided ? (passLane ?? q.pick) : q.aim;
    targetX = lane === null ? 0 : laneX(lane, q.count);
    for (let i = 0; i < q.count; i++) gate.open[i] += clamp((i === passLane ? 1 : 0) - gate.open[i], -dt * 2.5, dt * 2.5);
    const aligned = Math.abs(state.x - targetX) < .45;
    if (!(passLane !== null && aligned && gate.open[passLane] > .75)) stopAt = gate.d - (decided && passLane === null ? BUMP_GAP : STOP_GAP);
    if (decided && passLane === null && !gate.bumped && aligned && state.d >= stopAt - .1) {
      gate.bumped = true;
      state.shake = 1;
    }
    if (state.d > gate.d + 5) gate.cleared = true;
  }
  const cruise = still && !gate ? 0 : state.queue.length ? 28 : gate || state.attract ? 17 : 9;
  const remaining = stopAt - state.d;
  const allowed = stopAt === Infinity ? cruise : remaining <= 0 ? 0 : Math.min(cruise, Math.sqrt(20 * remaining));
  const before = state.v;
  state.v = remaining <= 0 ? 0 : state.v + clamp(allowed - state.v, -30 * dt, (state.queue.length ? 20 : 8) * dt);
  state.braking = state.v < before - .01 || (state.v < .05 && Boolean(gate));
  const next = state.d + state.v * dt;
  state.d = stopAt !== Infinity && state.d <= stopAt && next > stopAt ? stopAt : next;
  const dx = targetX - state.x;
  state.x += dx * Math.min(1, dt * 5);
  state.yaw = clamp(-dx * .06, -.3, .3);
  state.shake = Math.max(0, state.shake - dt * 2.2);
  state.gates = state.gates.filter((item) => item.d > state.d - 40);
  state.signs = state.signs.filter((item) => item.d > state.d - 20);
  return state;
}

// Deterministic roadside objects for one stretch of road, so the scenery never needs storing.
const hash = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
export function sceneryAt(segment) {
  const items = [];
  for (const side of [-1, 1]) {
    const roll = hash(segment * 2 + (side > 0 ? 1 : 0));
    const kind = roll < .3 ? "tree" : roll < .44 ? "house" : roll < .56 ? "bush" : roll < .66 ? "pine" : roll < .74 ? "lamp" : null;
    if (kind) items.push({ kind, side, offset: kind === "lamp" ? 1.4 : 4 + hash(segment * 7 + side) * 11, tone: hash(segment * 13 + side * 3), size: .8 + hash(segment * 17 + side) * .6 });
  }
  return items;
}

// Column-major 4x4 matrices.
export function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
  }
  return out;
}
export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
}
export function lookAt(eye, target) {
  const normalise = (v) => { const length = Math.hypot(...v) || 1; return v.map((value) => value / length); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const back = normalise([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const right = normalise(cross([0, 1, 0], back));
  const up = cross(back, right);
  return [right[0], up[0], back[0], 0, right[1], up[1], back[1], 0, right[2], up[2], back[2], 0, -dot(right, eye), -dot(up, eye), -dot(back, eye), 1];
}
// Translate * rotateY * rotateZ * scale.
export function transform(x, y, z, sx = 1, sy = 1, sz = 1, rotY = 0, rotZ = 0) {
  const c = Math.cos(rotY), s = Math.sin(rotY), cz = Math.cos(rotZ), sn = Math.sin(rotZ);
  return [c * cz * sx, sn * sx, -s * cz * sx, 0, -c * sn * sy, cz * sy, s * sn * sy, 0, s * sz, 0, c * sz, 0, x, y, z, 1];
}

// Interleaved position, normal and texture coordinate (8 floats per vertex).
function mesh(triangles) {
  const data = [];
  for (const [a, b, c, uvs] of triangles) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n) || 1;
    [a, b, c].forEach((point, index) => data.push(...point, n[0] / length, n[1] / length, n[2] / length, ...(uvs ? uvs[index] : [0, 0])));
  }
  return data;
}
const quad = (a, b, c, d) => [[a, b, c, [[0, 0], [1, 0], [1, 1]]], [a, c, d, [[0, 0], [1, 1], [0, 1]]]];
const L = -.5, R = .5;
// Unit box standing on the ground plane, and a four-sided pyramid of the same footprint.
export const BOX = mesh([
  ...quad([L, 0, R], [R, 0, R], [R, 1, R], [L, 1, R]), ...quad([R, 0, L], [L, 0, L], [L, 1, L], [R, 1, L]),
  ...quad([R, 0, R], [R, 0, L], [R, 1, L], [R, 1, R]), ...quad([L, 0, L], [L, 0, R], [L, 1, R], [L, 1, L]),
  ...quad([L, 1, R], [R, 1, R], [R, 1, L], [L, 1, L]), ...quad([L, 0, L], [R, 0, L], [R, 0, R], [L, 0, R]),
]);
export const PYRAMID = mesh([
  [[L, 0, R], [R, 0, R], [0, 1, 0]], [[R, 0, R], [R, 0, L], [0, 1, 0]],
  [[R, 0, L], [L, 0, L], [0, 1, 0]], [[L, 0, L], [L, 0, R], [0, 1, 0]],
]);

const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
const PALETTES = {
  light: { sky: rgb("#a9d3ee"), ground: rgb("#8aa35c"), road: rgb("#45484c"), shoulder: rgb("#b9ad8c"), line: rgb("#f1efe6"), ambient: .62, sun: .55, glow: .35 },
  dark: { sky: rgb("#121b2a"), ground: rgb("#1d2b21"), road: rgb("#1a1c1f"), shoulder: rgb("#3b3a33"), line: rgb("#9a998f"), ambient: .46, sun: .3, glow: 1 },
};
const COLOR = Object.fromEntries(Object.entries({
  trunk: "#6b4a2f", leaf: "#3f7d4a", leaf2: "#5a8f3c", pine: "#2f6146", bush: "#6f9a4a", wall: "#f3ede0", wall2: "#e9d9b8", roof: "#c4603a",
  metal: "#5b6166", lamp: "#ffe9a8", hill: "#7d9a7a", hill2: "#6c8a72", car: "#e2622f", cabin: "#22303a", tyre: "#15171a", tail: "#ff3b2f", head: "#fff6c9",
  pillar: "#c9c5b8", beam: "#30363b", arm: "#d8402f", sign: "#2c5fb3", aim: "#e0a21a", right: "#2f9e5b", wrong: "#c8402f", dim: "#56657a", aimed: "#6a6650",
}).map(([name, hex]) => [name, rgb(hex)]));

const VERTEX = `attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUv;
uniform mat4 uViewProj; uniform mat4 uModel;
varying vec3 vNormal; varying float vDepth; varying vec2 vUv;
void main() { vec4 world = uModel * vec4(aPos, 1.0); vNormal = mat3(uModel) * aNormal; vUv = aUv; gl_Position = uViewProj * world; vDepth = gl_Position.w; }`;
const FRAGMENT = `precision mediump float;
uniform vec3 uColor; uniform vec3 uFog; uniform vec3 uSun; uniform vec2 uLight; uniform float uEmissive; uniform float uUseTex; uniform sampler2D uTex;
varying vec3 vNormal; varying float vDepth; varying vec2 vUv;
void main() {
  vec3 base = uColor;
  if (uUseTex > 0.5) { vec4 texel = texture2D(uTex, vUv); base = mix(uColor, texel.rgb, texel.a); }
  float diffuse = max(dot(normalize(vNormal), uSun), 0.0);
  vec3 lit = base * mix(uLight.x + uLight.y * diffuse, 1.0, uEmissive);
  gl_FragColor = vec4(mix(lit, uFog, clamp((vDepth - 70.0) / 190.0, 0.0, 1.0)), 1.0);
}`;

export function createTripScene(canvas) {
  let gl = null;
  try { gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "low-power" }); } catch { /* No WebGL. */ }
  if (!gl) return null;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const uniform = Object.fromEntries(["uViewProj", "uModel", "uColor", "uFog", "uSun", "uLight", "uEmissive", "uUseTex"].map((name) => [name, gl.getUniformLocation(program, name)]));
  const attribute = Object.fromEntries(["aPos", "aNormal", "aUv"].map((name) => [name, gl.getAttribLocation(program, name)]));
  const upload = (data) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 8 };
  };
  const box = upload(BOX), pyramid = upload(PYRAMID);
  Object.values(attribute).forEach((location) => gl.enableVertexAttribArray(location));
  gl.enable(gl.DEPTH_TEST);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const state = createSceneState();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const textures = new Map();
  let bound = null, frame = 0, lastTime = 0, lost = false, viewProj = null;
  canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); lost = true; });

  // White text on a transparent texture; the sign's own colour shows through behind it.
  function label(text, wide) {
    const key = `${wide ? "w" : "n"}:${text}`;
    if (textures.has(key)) return textures.get(key);
    const source = document.createElement("canvas");
    source.width = wide ? 512 : 160;
    source.height = 128;
    const context = source.getContext("2d");
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    let size = wide ? 78 : 108;
    do { context.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; size -= 4; }
    while (wide && size > 28 && context.measureText(text).width > 470);
    context.fillText(text, source.width / 2, 68);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.set(key, texture);
    return texture;
  }

  function draw(shape, color, model, emissive = 0, texture = null) {
    if (bound !== shape) {
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
      gl.vertexAttribPointer(attribute.aPos, 3, gl.FLOAT, false, 32, 0);
      gl.vertexAttribPointer(attribute.aNormal, 3, gl.FLOAT, false, 32, 12);
      gl.vertexAttribPointer(attribute.aUv, 2, gl.FLOAT, false, 32, 24);
      bound = shape;
    }
    gl.uniformMatrix4fv(uniform.uModel, false, model);
    gl.uniform3fv(uniform.uColor, color);
    gl.uniform1f(uniform.uEmissive, emissive);
    gl.uniform1f(uniform.uUseTex, texture ? 1 : 0);
    if (texture) gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawArrays(gl.TRIANGLES, 0, shape.count);
  }
  const cube = (color, x, y, z, sx, sy, sz, emissive = 0, texture = null, rotY = 0) => draw(box, color, transform(x, y, z, sx, sy, sz, rotY), emissive, texture);
  const cone = (color, x, y, z, sx, sy, sz) => draw(pyramid, color, transform(x, y, z, sx, sy, sz));

  function drawScenery(palette, z) {
    const first = Math.floor(state.d / SEGMENT) - 1;
    for (let segment = first; segment < first + 22; segment++) {
      const at = -segment * SEGMENT;
      const nearGate = state.gates.some((gate) => -at > gate.d - 44 && -at < gate.d + 6);
      if (!nearGate) cube(palette.line, 0, .02, at, .16, .02, 5);
      for (const item of sceneryAt(segment)) {
        const x = item.side * (ROAD_HALF + item.offset), s = item.size;
        if (item.kind === "tree") {
          cube(COLOR.trunk, x, 0, at, .4, 1.5 * s, .4);
          cone(item.tone < .5 ? COLOR.leaf : COLOR.leaf2, x, 1.2 * s, at, 2.8 * s, 3.4 * s, 2.8 * s);
        } else if (item.kind === "pine") {
          cube(COLOR.trunk, x, 0, at, .3, 1 * s, .3);
          cone(COLOR.pine, x, .8 * s, at, 1.9 * s, 5.2 * s, 1.9 * s);
        } else if (item.kind === "bush") {
          cube(COLOR.bush, x, 0, at, 1.6 * s, .9 * s, 1.4 * s);
        } else if (item.kind === "house") {
          const far = x + item.side * 4;
          cube(item.tone < .5 ? COLOR.wall : COLOR.wall2, far, 0, at, 5.2, 3, 5.4);
          cone(COLOR.roof, far, 3, at, 6, 1.9, 6.2);
          cube(COLOR.lamp, far - item.side * 2.62, 1.2, at + 1.2, .06, 1, 1, palette.glow);
        } else {
          cube(COLOR.metal, x, 0, at, .16, 5.2, .16);
          cube(COLOR.metal, x - item.side * .7, 5.1, at, 1.5, .12, .16);
          cube(COLOR.lamp, x - item.side * 1.3, 4.95, at, .5, .14, .3, palette.glow);
        }
      }
    }
    // Far hills ride along with the car and fade into the fog.
    for (let index = 0; index < 6; index++) {
      const side = index % 2 ? 1 : -1;
      cone(index % 3 ? COLOR.hill : COLOR.hill2, side * (70 + index * 22), 0, z - 185 - index * 9, 90 + index * 14, 22 + (index % 3) * 9, 60);
    }
  }

  function drawGate(gate) {
    const { q } = gate;
    const z = -gate.d, width = q.count * LANE_WIDTH;
    for (let edge = 0; edge <= q.count; edge++) {
      const x = (edge - q.count / 2) * LANE_WIDTH;
      cube(COLOR.pillar, x, 0, z, .5, 3.5, .8);
      cube(PALETTES.light.line, x, .02, z + 20, .14, .02, 40);
    }
    cube(COLOR.beam, 0, 3.5, z, width + .6, .5, 1);
    for (let lane = 0; lane < q.count; lane++) {
      const x = laneX(lane, q.count);
      const decided = q.pick !== null;
      const color = decided ? (lane === q.correct ? COLOR.right : lane === q.pick ? COLOR.wrong : COLOR.dim) : lane === q.aim ? COLOR.aim : COLOR.sign;
      cube(color, x, 4.1, z + .1, 2.3, 1.85, .18, .55, label(String(lane + 1), false));
      if (!decided && lane === q.aim) cube(COLOR.aimed, x, .015, z + 9, LANE_WIDTH - .4, .02, 18);
      const arm = multiply(transform(x - LANE_WIDTH / 2 + .3, 1.05, z + .55, 1, 1, 1, 0, gate.open[lane] * 1.35), transform((LANE_WIDTH - .7) / 2, -.07, 0, LANE_WIDTH - .7, .14, .14));
      draw(box, COLOR.arm, arm, .2);
    }
  }

  function drawCar(palette, z) {
    const cos = Math.cos(state.yaw), sin = Math.sin(state.yaw);
    const bob = Math.sin(state.time * 17) * .012 * Math.min(1, state.v / 6);
    const part = (color, ox, oy, oz, sx, sy, sz, emissive = 0) => draw(box, color,
      transform(state.x + ox * cos + oz * sin, oy + bob, z - ox * sin + oz * cos, sx, sy, sz, state.yaw), emissive);
    part(COLOR.car, 0, .35, 0, 1.9, .6, 4.2);
    part(COLOR.cabin, 0, .95, .25, 1.62, .55, 2.1);
    part(COLOR.car, 0, 1.5, .25, 1.66, .08, 2.16);
    for (const ox of [-.95, .95]) for (const oz of [-1.35, 1.35]) part(COLOR.tyre, ox, 0, oz, .3, .72, .72);
    for (const ox of [-.62, .62]) {
      part(COLOR.tail, ox, .62, 2.11, .46, .17, .06, state.braking ? 1 : .35);
      part(COLOR.head, ox, .55, -2.11, .4, .16, .06, palette.glow);
    }
  }

  function render() {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * scale)), height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const palette = PALETTES[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
    const z = -state.d;
    const shake = state.shake * .35;
    const eye = [state.x * .5 + Math.sin(state.time * 70) * shake, 4.7 + Math.cos(state.time * 55) * shake * .6, z + 11];
    viewProj = multiply(perspective(50 * Math.PI / 180, width / height, .5, 400), lookAt(eye, [state.x * .5, 2.7, z - 12]));
    gl.viewport(0, 0, width, height);
    gl.clearColor(...palette.sky, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    bound = null;
    gl.uniformMatrix4fv(uniform.uViewProj, false, viewProj);
    gl.uniform3fv(uniform.uFog, palette.sky);
    gl.uniform3fv(uniform.uSun, [.37, .82, .43]);
    gl.uniform2f(uniform.uLight, palette.ambient, palette.sun);
    cube(palette.ground, 0, -.12, z - 150, 700, .1, 420);
    cube(palette.shoulder, 0, -.03, z - 150, ROAD_HALF * 2 + 2.4, .04, 420);
    cube(palette.road, 0, 0, z - 150, ROAD_HALF * 2, .02, 420);
    for (const side of [-1, 1]) cube(palette.line, side * (ROAD_HALF - .35), .02, z - 150, .16, .02, 420);
    drawScenery(palette, z);
    state.gates.forEach(drawGate);
    for (const sign of state.signs) {
      const x = ROAD_HALF + 4.2;
      for (const post of [-2.4, 2.4]) cube(COLOR.metal, x + post, 0, -sign.d, .18, 2.4, .18);
      cube(COLOR.sign, x, 2.2, -sign.d, 6.4, 1.7, .2, .5, label(sign.text, true));
    }
    drawCar(palette, z);
  }

  function tick(time) {
    frame = 0;
    if (lost || !canvas.isConnected) return;
    stepScene(state, Math.min(.05, (time - lastTime) / 1000 || .016));
    lastTime = time;
    render();
    frame = requestAnimationFrame(tick);
  }
  // With reduced motion the scene jumps to where it would come to rest and draws a single frame.
  function wake() {
    if (lost || !canvas.isConnected) return;
    if (reducedMotion?.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      for (let step = 0; step < 600; step++) stepScene(state, 1 / 30, true);
      state.shake = 0;
      render();
    } else if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  return {
    wake,
    isLost: () => lost,
    question(count) { sceneQuestion(state, count); wake(); },
    aim(index) { if (state.q && state.q.pick === null) state.q.aim = index; wake(); },
    resolve(pick, correct) { if (state.q) Object.assign(state.q, { pick, correct }); wake(); },
    driveOn() { if (state.q) state.q.detour = true; wake(); },
    announce(text) { state.signs.push({ d: state.d + 40, text }); wake(); },
    reset(attract = false) { Object.assign(state, createSceneState(), { attract }); wake(); },
    // Which lane a tap at this horizontal fraction of the canvas points at.
    laneAt(fraction) {
      const q = state.q;
      if (!q) return null;
      const gate = state.gates.find((item) => item.q === q);
      if (!gate || !viewProj) return clamp(Math.floor(fraction * q.count), 0, q.count - 1);
      let best = 0, distance = Infinity;
      for (let lane = 0; lane < q.count; lane++) {
        const x = laneX(lane, q.count), w = viewProj[3] * x + viewProj[7] * 1 + viewProj[11] * -gate.d + viewProj[15];
        const screen = ((viewProj[0] * x + viewProj[4] * 1 + viewProj[8] * -gate.d + viewProj[12]) / w + 1) / 2;
        if (Math.abs(screen - fraction) < distance) { distance = Math.abs(screen - fraction); best = lane; }
      }
      return best;
    },
  };
}
