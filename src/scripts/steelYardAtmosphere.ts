// steelYardAtmosphere.ts — the living yard atmosphere shader for POV 1 (wayfinder #11).
// A full-bleed OGL fragment shader rendering the AIR of BSM's steel yard: drifting
// volumetric light beams, dust/particulate motes suspended in the space, and a
// sense of depth — so the full-bleed yard photos read as a place you're moving
// through, not flat pictures. The shader is the atmosphere; the photos are the
// stock. Together they're immersion.
//
// Discipline: lazy-init after first
// paint, pause offscreen/hidden, prefers-reduced-motion -> no init (static
// gradient is the floor), no-WebGL -> no init. The page is fully usable without.
import { Renderer, Triangle, Program, Mesh } from "ogl";

const PALETTES = {
  dark: {
    air: [0.063, 0.071, 0.082], // #101216 deep yard air
    airDeep: [0.039, 0.045, 0.055], // #0a0b0e
    beam: [0.788, 0.706, 0.541], // warm warehouse light #c9b48a
    steel: [0.561, 0.639, 0.722], // galvanized sheen
  },
  light: {
    // The same warehouse atmosphere translated onto the site's warm drafting
    // paper. Beams are softened in the shader so additive light does not wash
    // out the light page or compete with the product photograph.
    air: [0.94, 0.92, 0.86],
    airDeep: [0.82, 0.79, 0.72],
    beam: [0.56, 0.42, 0.22],
    steel: [0.25, 0.35, 0.46],
  },
} as const;

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

function themePalette(): Palette {
  return document.documentElement.dataset.theme === "light" ? PALETTES.light : PALETTES.dark;
}

export function initSteelYardAtmosphere(container: HTMLElement): (() => void) | null {
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
      uniform vec3 uAir;
      uniform vec3 uAirDeep;
      uniform vec3 uBeam;
      uniform vec3 uSteel;
      uniform float uLightMode;  // 0 for dark yard, 1 for light drafting paper

      float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      // Fractal noise for soft, organic light falloff.
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      void main(){
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 p = vec2(uv.x * aspect, uv.y);

        // ---- Deep yard air, darkening toward the top (the ceiling of the yard). ----
        float vert = smoothstep(0.0, 1.0, uv.y);
        vec3 col = mix(uAirDeep, uAir, vert * 0.7 + 0.3);

        // ---- Volumetric light beams: soft shafts of warm warehouse light
        //      drifting across the space. Two auto-drifting + one that follows
        //      the cursor. This is the "air you move through". ----
        float beam1 = exp(-pow((p.x - fract(uTime * 0.03) * 2.0 + 0.3) * 1.1, 2.0)) * 0.5;
        float beam2 = exp(-pow((p.x - fract(uTime * 0.02 + 0.5) * 2.0 - 0.2) * 1.3, 2.0)) * 0.4;
        // Cursor beam: a shaft of light where the visitor "is".
        float beamMouse = exp(-pow((p.x - uMouse.x * aspect) * 1.6, 2.0))
                        * exp(-pow((p.y - uMouse.y) * 1.4, 2.0))
                        * uMouseStrength * 0.7;
        float light = beam1 + beam2 + beamMouse;

        // Beams brighten toward the top (light comes from above, like warehouse
        // skylights) and fade toward the floor.
        light *= mix(0.4, 1.2, vert);
        // Keep the light expressive in dark mode, but restrained over warm paper.
        col += light * uBeam * mix(0.35, 0.12, uLightMode);

        // ---- Dust / particulate motes suspended in the air. Slow, organic drift. ----
        // Layered fbm so the motes cluster and thin like real dust in a light beam.
        vec2 dustUv = p * vec2(3.0, 2.0) + vec2(uTime * 0.015, uTime * 0.008);
        float dust = fbm(dustUv);
        // Motes are brightest where the light is (you see dust in a light beam).
        float motes = smoothstep(0.45, 0.85, dust) * (0.3 + light * 1.5);
        col += motes * uBeam * mix(0.12, 0.04, uLightMode);

        // ---- Scroll depth: as you scroll, the air subtly shifts (parallax of
        //      the space), reinforcing moving through the yard. ----
        col = mix(col, col * mix(1.08, 1.02, uLightMode), smoothstep(0.0, 0.3, uScroll) * 0.3);

        // ---- Grain: reads as a real photographed space, not a flat fill. ----
        float grain = hash(p * 700.0 + uTime * 0.4) * 0.02;
        col += grain - 0.01;

        // ---- Vignette: focus toward center, darker edges (the yard recedes). ----
        float vig = smoothstep(1.25, 0.4, length(uv - 0.5));
        col *= mix(mix(0.7, 0.9, uLightMode), 1.0, vig);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uMouse: { value: [0.5, 0.5] },
      uMouseStrength: { value: 0 },
      uScroll: { value: 0 },
      uAir: { value: PALETTES.dark.air },
      uAirDeep: { value: PALETTES.dark.airDeep },
      uBeam: { value: PALETTES.dark.beam },
      uSteel: { value: PALETTES.dark.steel },
      uLightMode: { value: 0 },
    },
  });

  const geometry = new Triangle(glCtx);
  const mesh = new Mesh(glCtx, { geometry, program });

  const applyTheme = () => {
    const light = document.documentElement.dataset.theme === "light";
    const palette = themePalette();
    program.uniforms.uAir.value = [...palette.air];
    program.uniforms.uAirDeep.value = [...palette.airDeep];
    program.uniforms.uBeam.value = [...palette.beam];
    program.uniforms.uSteel.value = [...palette.steel];
    program.uniforms.uLightMode.value = light ? 1 : 0;
  };
  applyTheme();
  const themeObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.attributeName === "data-theme")) applyTheme();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

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

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    program.uniforms.uScroll.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
    themeObserver.disconnect();
    geometry.remove();
    program.remove();
    const ext = renderer.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    canvas.remove();
  };
}
