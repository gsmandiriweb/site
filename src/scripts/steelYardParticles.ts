// steelYardParticles.ts — the foreground dust/particle layer for POV 1's hero
// (wayfinder #11). A second OGL canvas rendering drifting dust motes suspended
// in the air BETWEEN the visitor and the back photo — real volumetric depth.
// The motes drift, catch the light beams (brightest where the cursor light is),
// and parallax with the cursor (closer motes move more, like real near-field
// particles when you turn your head).
//
// Discipline: lazy-init, no-WebGL/reduced-motion -> no init, pause offscreen/
// hidden, ~30fps, cleanup on dispose.
import { Renderer, Triangle, Program, Mesh } from "ogl";

const PALETTE = {
  beam: [0.788, 0.706, 0.541], // warm warehouse light
  steel: [0.843, 0.867, 0.89], // galvanized sheen
};

export function initSteelYardParticles(container: HTMLElement): (() => void) | null {
  const probe = document.createElement("canvas");
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    gl = probe.getContext("webgl2") || probe.getContext("webgl");
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return null;

  const renderer = new Renderer({
    alpha: true,
    antialias: true,
    dpr: Math.min(window.devicePixelRatio, 1.5),
  });
  const canvas = renderer.gl.canvas as HTMLCanvasElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);

  const glCtx = renderer.gl;

  // A particle field rendered as a single textured quad: the fragment shader
  // synthesizes many soft motes procedurally (cheaper than point sprites, and
  // the soft additive blending reads as real suspended dust).
  const program = new Program(glCtx, {
    vertex: /* glsl */ `
      attribute vec2 position;
      varying vec2 vUv;
      void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
    `,
    fragment: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;        // 0..1
      uniform float uMouseStrength;
      uniform vec3 uBeam;
      uniform vec3 uSteel;

      float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }

      // A soft circular mote at a given cell of a grid, with per-cell random
      // position/size/depth. Returns (brightness, depth) where depth drives
      // parallax (0=far, 1=near).
      vec2 mote(vec2 uv, float cell, float seed){
        vec2 g = floor(uv * cell);
        vec2 f = fract(uv * cell);
        // per-cell random center
        vec2 c = vec2(hash(g + seed), hash(g + seed + 17.3));
        float d = length(f - c);
        float size = 0.04 + hash(g + seed + 5.0) * 0.06;
        float bright = smoothstep(size, 0.0, d);
        float depth = hash(g + seed + 31.0);
        return vec2(bright, depth);
      }

      void main(){
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 p = vec2(uv.x * aspect, uv.y);

        // Cursor parallax: near motes (high depth) shift more with the cursor.
        vec2 parallax = (uMouse - 0.5) * 0.06;

        // Three layers of motes at different scales/depths for volumetric feel.
        vec2 uv1 = uv + parallax * 0.3;
        vec2 uv2 = uv + parallax * 0.6;
        vec2 uv3 = uv + parallax * 1.0;

        vec2 m1 = mote(uv1, 8.0, 1.0);
        vec2 m2 = mote(uv2, 14.0, 2.0);
        vec2 m3 = mote(uv3, 22.0, 3.0);

        // Slow drift so the air feels alive.
        float drift = uTime * 0.02;
        m1.x *= 0.8 + 0.2 * sin(drift + uv1.y * 6.0);
        m2.x *= 0.8 + 0.2 * sin(drift * 1.3 + uv2.y * 8.0);
        m3.x *= 0.8 + 0.2 * sin(drift * 1.7 + uv3.y * 10.0);

        float bright = m1.x * 0.5 + m2.x * 0.35 + m3.x * 0.25;

        // Motes are brightest in the light beams (you see dust in a light beam).
        float beamX = fract(uTime * 0.03) * 2.0 - 0.5;
        float beam = exp(-pow((p.x - beamX) * 1.2, 2.0)) * 0.5;
        float mouseBeam = exp(-pow((p.x - uMouse.x * aspect) * 1.6, 2.0))
                        * exp(-pow((p.y - uMouse.y) * 1.4, 2.0))
                        * uMouseStrength * 0.8;
        float light = beam + mouseBeam;

        // Motes warm toward the beam color where lit; cool steel where not.
        vec3 moteCol = mix(uSteel * 0.6, uBeam, clamp(light * 1.5, 0.0, 1.0));
        vec3 col = moteCol * bright * (0.25 + light * 1.4);

        // Fade motes toward the edges so the frame stays clean.
        float edge = smoothstep(1.1, 0.5, length(uv - 0.5));
        col *= mix(0.4, 1.0, edge);

        gl_FragColor = vec4(col, bright * (0.3 + light * 0.7) * edge);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uMouse: { value: [0.5, 0.5] },
      uMouseStrength: { value: 0 },
      uBeam: { value: PALETTE.beam },
      uSteel: { value: PALETTE.steel },
    },
  });

  const geometry = new Triangle(glCtx);
  const mesh = new Mesh(glCtx, { geometry, program });

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [w, h];
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let targetMouse = [0.5, 0.5];
  let targetStrength = 0;
  let strengthDecayTimer: number | undefined;

  function onMove(e: PointerEvent) {
    const r = container.getBoundingClientRect();
    targetMouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    targetStrength = 1;
    window.clearTimeout(strengthDecayTimer);
    strengthDecayTimer = window.setTimeout(() => {
      targetStrength = 0;
    }, 220);
  }
  window.addEventListener("pointermove", onMove, { passive: true });

  let raf = 0;
  let visible = true;
  let last = 0;

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible && !raf) loop();
      else if (!visible) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { threshold: 0 },
  );
  io.observe(container);

  function onVis() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (visible && !raf) loop();
  }
  document.addEventListener("visibilitychange", onVis);

  function loop(t = 0) {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return; // ~30fps
    last = t;
    program.uniforms.uTime.value = t * 0.001;
    const m = program.uniforms.uMouse.value as number[];
    m[0] += (targetMouse[0] - m[0]) * 0.08;
    m[1] += (targetMouse[1] - m[1]) * 0.08;
    const s = program.uniforms.uMouseStrength.value as number;
    program.uniforms.uMouseStrength.value = s + (targetStrength - s) * 0.06;
    renderer.render({ scene: mesh });
  }
  loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", onVis);
    geometry.remove();
    program.remove();
    const ext = renderer.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    canvas.remove();
  };
}
