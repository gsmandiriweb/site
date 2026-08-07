// steelYardHeroShader.ts — a quiet raking-light field for the Steel Yard hero.
// The real BRC product plate remains the evidence. This shader only adds a slow,
// material-like atmosphere behind it: no particles, cursor choreography, or
// product-shaped illusion. CSS is the visual floor when WebGL is unavailable.
import { Renderer, Triangle, Program, Mesh } from "ogl";

const PALETTES = {
  dark: {
    deep: [0.045, 0.051, 0.061],
    air: [0.085, 0.094, 0.108],
    steel: [0.34, 0.38, 0.42],
    beam: [0.46, 0.4, 0.3],
  },
  light: {
    // Warm drafting paper and galvanized blue-steel light. The shader remains
    // atmospheric, but now belongs to the same light world as the page.
    deep: [0.82, 0.79, 0.72],
    air: [0.94, 0.92, 0.86],
    steel: [0.25, 0.35, 0.46],
    beam: [0.56, 0.42, 0.22],
  },
} as const;

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

function themePalette(): Palette {
  return document.documentElement.dataset.theme === "light" ? PALETTES.light : PALETTES.dark;
}

export function initSteelYardHeroShader(container: HTMLElement): (() => void) | null {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  const probe = document.createElement("canvas");
  let supported = false;
  try {
    supported = Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    supported = false;
  }
  if (!supported || !container.clientWidth || !container.clientHeight) return null;

  const renderer = new Renderer({
    alpha: true,
    antialias: false,
    dpr: Math.min(window.devicePixelRatio, 1.35),
  });
  const canvas = renderer.gl.canvas as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const gl = renderer.gl;
  const program = new Program(gl, {
    vertex: /* glsl */ `
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `,
    fragment: /* glsl */ `
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uDeep;
      uniform vec3 uAir;
      uniform vec3 uSteel;
      uniform vec3 uBeam;

      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = vec2(uv.x * aspect, uv.y);

        // Deep steel air: darker at the edges, with a quiet lift near the plate.
        float focus = 1.0 - smoothstep(0.15, 0.9, distance(uv, vec2(0.76, 0.52)));
        float vertical = smoothstep(0.0, 1.0, uv.y);
        vec3 color = mix(uDeep, uAir, vertical * 0.42 + focus * 0.18);

        // One slow diagonal warehouse reflection and a softer secondary echo.
        // The movement is deliberately almost imperceptible: atmosphere, not a
        // spectacle competing with the product photograph.
        float drift = uTime * 0.018;
        float band = exp(-pow((p.x - p.y * 0.34 - drift - 0.55) * 2.6, 2.0));
        float echo = exp(-pow((p.x + p.y * 0.18 + drift * 0.55 - 1.32) * 3.4, 2.0));
        float light = band * 0.32 + echo * 0.10;
        color += light * (uBeam * 0.65 + uSteel * 0.24);

        // Sub-pixel grain gives the field a steel-air texture without drawing a
        // visible pattern over the typography or the BRC plate.
        float grain = (hash(p * 180.0 + uTime * 0.03) - 0.5) * 0.012;
        color += grain;

        float vignette = smoothstep(1.08, 0.28, distance(uv, vec2(0.5)));
        color *= mix(0.78, 1.0, vignette);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uDeep: { value: PALETTES.dark.deep },
      uAir: { value: PALETTES.dark.air },
      uSteel: { value: PALETTES.dark.steel },
      uBeam: { value: PALETTES.dark.beam },
    },
  });

  const geometry = new Triangle(gl);
  const mesh = new Mesh(gl, { geometry, program });

  const applyTheme = () => {
    const palette = themePalette();
    program.uniforms.uDeep.value = [...palette.deep];
    program.uniforms.uAir.value = [...palette.air];
    program.uniforms.uSteel.value = [...palette.steel];
    program.uniforms.uBeam.value = [...palette.beam];
  };
  applyTheme();
  const themeObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.attributeName === "data-theme")) applyTheme();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    program.uniforms.uResolution.value = [width, height];
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let raf = 0;
  let visible = true;
  let lastFrame = 0;
  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible && !raf) render();
      if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { threshold: 0 },
  );
  intersectionObserver.observe(container);

  const onVisibilityChange = () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden && visible && !raf) {
      render();
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const render = (time = 0) => {
    raf = requestAnimationFrame(render);
    if (time - lastFrame < 40) return;
    lastFrame = time;
    program.uniforms.uTime.value = time * 0.001;
    renderer.render({ scene: mesh });
  };
  render();

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    themeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    geometry.remove();
    program.remove();
    renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
