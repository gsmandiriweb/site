// materialLibraryShader.ts — the living sample-wall shader for POV 4 (wayfinder #12).
// A full-bleed OGL fragment shader rendering the Material Library's wall as a
// reactive perforated-steel surface: raking light drifts across it and follows
// the cursor, pegboard holes catch sheen, a galvanized spangle noise reads as
// real metal, and a scroll-driven parallax shifts the hole field so the wall
// feels deep as you move through it.
//
// Discipline (same as reactiveMesh/ADR-0007): lazy-init after first paint,
// pause offscreen/hidden, prefers-reduced-motion -> no init (static CSS wall
// is the floor), no-WebGL -> no init. The page is fully usable without this.
import { Renderer, Triangle, Program, Mesh } from "ogl";

const PALETTE = {
  board: [0.109, 0.114, 0.125], // #1c1f23 hardboard face
  boardDeep: [0.071, 0.078, 0.086], // #121418 recessed
  hole: [0.055, 0.059, 0.063], // #0e1014 pegboard hole
  steel: [0.843, 0.867, 0.89], // galvanized sheen
  rail: [0.788, 0.706, 0.541], // brass-ish rail light #c9b48a
};

export function initMaterialWall(container: HTMLElement): (() => void) | null {
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
      void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
    `,
    fragment: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;        // 0..1
      uniform float uMouseStrength;
      uniform float uScroll;      // 0..1 page scroll progress
      uniform vec3 uBoard;
      uniform vec3 uBoardDeep;
      uniform vec3 uHole;
      uniform vec3 uSteel;
      uniform vec3 uRail;

      float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }

      // Pegboard: distance to nearest hole center on a regular grid.
      float holeField(vec2 uv, float cell, float radius){
        vec2 g = fract(uv * cell) - 0.5;
        return 1.0 - smoothstep(radius - 0.002, radius + 0.002, length(g));
      }

      void main(){
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 p = vec2(uv.x * aspect, uv.y);

        // Scroll parallax: the hole field drifts down slightly as you scroll,
        // so the wall reads as deep, not flat.
        float scrollShift = uScroll * 0.06;
        vec2 holeUv = p + vec2(0.0, scrollShift);

        // ---- Ground: dark hardboard, deepening toward edges. ----
        float depth = smoothstep(0.0, 0.7, length(uv - 0.5) * 1.25);
        vec3 col = mix(uBoard, uBoardDeep, depth * 0.8);

        // ---- Galvanized spangle noise: a real metal texture, not a flat fill. ----
        float spangle = noise(holeUv * 18.0 + uTime * 0.01);
        spangle = smoothstep(0.35, 0.75, spangle);
        col = mix(col, col * 1.18 + uSteel * 0.04, spangle * 0.5);

        // ---- Pegboard holes: dark recesses that catch light at their rims. ----
        float cell = 26.0;
        float radius = 0.18;
        float hole = holeField(holeUv, cell, radius);
        // Hole interior: near-black recess.
        col = mix(col, uHole, hole * 0.85);
        // Hole rim: a thin steel highlight where light would catch the punched edge.
        float rim = smoothstep(radius - 0.01, radius, length(fract(holeUv * cell) - 0.5))
                  - smoothstep(radius, radius + 0.012, length(fract(holeUv * cell) - 0.5));
        col += rim * uSteel * 0.15;

        // ---- Raking light: the living part. A warm brass-toned light drifts
        //      across the wall and follows the cursor. This is what makes it
        //      feel like a real lit surface, not a flat texture. ----
        float lightX = fract(uTime * 0.04) * 2.0 - 0.5;
        float driftLight = exp(-pow((p.x - lightX) * 1.3, 2.0)) * 0.45;
        float mouseLight = exp(-pow((p.x - uMouse.x * aspect) * 2.0, 2.0))
                         * exp(-pow((p.y - uMouse.y) * 2.0, 2.0))
                         * uMouseStrength * 1.3;
        float light = driftLight + mouseLight;

        // The light warms the board and brightens hole rims (catching sheen).
        vec3 lightCol = uRail * 0.5 + vec3(0.30, 0.28, 0.25);
        col += light * lightCol * 0.5;
        col += rim * light * uSteel * 0.6;

        // ---- Grain: reads as material, not a flat fill. ----
        float grain = hash(p * 900.0 + uTime * 0.3) * 0.018;
        col += grain - 0.009;

        // ---- Vignette for focus. ----
        float vig = smoothstep(1.2, 0.35, length(uv - 0.5));
        col *= mix(0.78, 1.0, vig);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uMouse: { value: [0.5, 0.5] },
      uMouseStrength: { value: 0 },
      uScroll: { value: 0 },
      uBoard: { value: PALETTE.board },
      uBoardDeep: { value: PALETTE.boardDeep },
      uHole: { value: PALETTE.hole },
      uSteel: { value: PALETTE.steel },
      uRail: { value: PALETTE.rail },
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

  // Mouse + scroll.
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
  // Listen on window so the light follows the cursor across the whole viewport,
  // not just when over the canvas (the wall is the page ground).
  window.addEventListener("pointermove", onMove, { passive: true });

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    program.uniforms.uScroll.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Render loop with pause-when-offscreen / hidden.
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
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVis);
    geometry.remove();
    program.remove();
    const ext = renderer.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    canvas.remove();
  };
}
