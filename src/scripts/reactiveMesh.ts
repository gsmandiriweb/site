// reactiveMesh.ts — the OGL hero shader (ADR-0007).
// A single full-screen quad with a fragment shader rendering the BRC mesh as a
// reactive surface: it ripples where the mouse moves, and the mesh lines catch
// a galvanized metallic sheen. Foreground reactive element in the hero — not
// the passive background that failed in ADR-0006.
//
// Discipline: lazy-init, pause offscreen/hidden, prefers-reduced-motion → no
// init (the hero stays static), no-WebGL → no init. The hero is fully usable
// without this; it's pure enhancement.
import { Renderer, Triangle, Program, Mesh } from "ogl";

const PALETTE = {
  paper: [0.95, 0.94, 0.9],
  paperDeep: [0.91, 0.88, 0.83],
  ink: [0.08, 0.13, 0.18],
  blueprint: [0.106, 0.227, 0.42],
  steel: [0.561, 0.639, 0.722],
  signal: [0.91, 0.333, 0.118],
};

export function initReactiveMesh(container: HTMLElement): (() => void) | null {
  // Capability check.
  const probe = document.createElement("canvas");
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    gl = probe.getContext("webgl2") || probe.getContext("webgl");
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return null; // static hero is the floor.

  const renderer = new Renderer({
    alpha: true,
    antialias: false,
    dpr: Math.min(window.devicePixelRatio, 1.5),
  });
  const canvas = renderer.gl.canvas as HTMLCanvasElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);

  const glCtx = renderer.gl;

  const program = new Program(glCtx, {
    vertex: /* glsl */ `
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `,
    fragment: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;       // 0..1
      uniform float uMouseStrength; // eases to 1 on move, decays to 0
      uniform vec3 uPaper;
      uniform vec3 uPaperDeep;
      uniform vec3 uInk;
      uniform vec3 uBlueprint;
      uniform vec3 uSteel;
      uniform vec3 uSignal;

      float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }

      // Distance to nearest mesh line (square cells), anti-aliased.
      float meshLine(vec2 uv, float cell, float halfW){
        vec2 g = abs(fract(uv * cell - 0.5) - 0.5) / cell;
        return min(g.x, g.y);
      }

      void main(){
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 p = vec2(uv.x * aspect, uv.y);

        // ---- Ground: warm paper, deepening slightly toward edges. ----
        float depth = smoothstep(0.0, 0.6, length(uv - 0.5) * 1.3);
        vec3 col = mix(uPaper, uPaperDeep, depth * 0.7);

        // ---- The raking light: a soft warm band that drifts slowly and
        //      brightens where the mouse is. This is the whole effect. ----
        // Auto-drift across the width.
        float lightX = fract(uTime * 0.05) * 2.0 - 0.5;
        // Mouse adds a second, stronger light that follows the cursor.
        float mouseLight = exp(-pow((p.x - uMouse.x * aspect) * 2.2, 2.0))
                         * exp(-pow((p.y - uMouse.y) * 2.2, 2.0))
                         * uMouseStrength;
        float driftLight = exp(-pow((p.x - lightX) * 1.4, 2.0)) * 0.5;
        float light = driftLight + mouseLight * 1.2;

        // Warm galvanized sheen where the light falls.
        vec3 sheen = uSignal * 0.25 + vec3(0.35, 0.33, 0.30);
        col += light * sheen;

        // ---- Faint mesh, revealed ONLY within the light band. ----
        // Invisible in shadow; the light "discovers" the mesh as it passes.
        float cell = 24.0;
        float halfW = 0.008;
        float d = meshLine(p, cell, halfW);
        float wire = 1.0 - smoothstep(0.0, halfW, d);
        // Mask the wire by the light so it only shows where lit.
        float wireReveal = wire * smoothstep(0.15, 0.6, light);
        col = mix(col, uSteel * 1.15 + sheen * 0.3, wireReveal * 0.5);

        // ---- Grain so it reads as material, not a flat fill. ----
        float grain = hash(p * 800.0 + uTime * 0.5) * 0.02;
        col += grain - 0.01;

        // ---- Vignette for focus. ----
        float vig = smoothstep(1.15, 0.4, length(uv - 0.5));
        col *= mix(0.85, 1.0, vig);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uMouse: { value: [0.5, 0.5] },
      uMouseStrength: { value: 0 },
      uPaper: { value: PALETTE.paper },
      uPaperDeep: { value: PALETTE.paperDeep },
      uInk: { value: PALETTE.ink },
      uBlueprint: { value: PALETTE.blueprint },
      uSteel: { value: PALETTE.steel },
      uSignal: { value: PALETTE.signal },
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

  // ---- Mouse interaction ----
  let targetMouse = [0.5, 0.5];
  let targetStrength = 0;
  let strengthDecayTimer: number | undefined;

  function onMove(e: PointerEvent) {
    const r = container.getBoundingClientRect();
    targetMouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    targetStrength = 1;
    window.clearTimeout(strengthDecayTimer);
    // After the mouse stops, let the strength decay.
    strengthDecayTimer = window.setTimeout(() => {
      targetStrength = 0;
    }, 200);
  }
  window.addEventListener("pointermove", onMove, { passive: true });

  // ---- Render loop with pause-when-offscreen / hidden ----
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
    // Ease mouse + strength for a liquid feel.
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
