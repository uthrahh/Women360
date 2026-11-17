import { useEffect, useRef } from "react";

const VERTEX = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

// A slow flow of soft light: three layers of smooth noise warp each other, and the result picks between a deep purple, lavender and orange.
const FRAGMENT = `
precision mediump float;
uniform vec2 r;
uniform float t;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r.xy;
  uv.x *= r.x / r.y;
  vec2 q = vec2(fbm(uv * 1.6 + t * 0.05), fbm(uv * 1.6 + vec2(5.2, 1.3) - t * 0.04));
  float f = fbm(uv * 1.4 + 2.2 * q + t * 0.03);
  vec3 deep = vec3(0.165, 0.106, 0.361);
  vec3 lav  = vec3(0.788, 0.722, 1.0);
  vec3 org  = vec3(1.0, 0.604, 0.322);
  vec3 col = mix(deep, lav, smoothstep(0.25, 0.75, f));
  col = mix(col, org, smoothstep(0.55, 0.95, q.x * f * 1.9));
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * The chat's moving sky. Drawn at a quarter of the screen's pixels and scaled up (it is all soft light), and only while it is on screen
 * and the tab is visible. With reduced motion it draws one still frame. If WebGL isn't there, the CSS gradient underneath is all she sees.
 * The context is never force-lost on cleanup: React's StrictMode re-runs effects on the same canvas, and a lost context can't come back.
 */
export function ChatShader({ still }: { still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(program, "r");
    const uTime = gl.getUniformLocation(program, "t");

    let raf = 0;
    let visible = true;
    const start = performance.now();

    const resize = () => {
      const w = Math.max(2, Math.round(canvas.clientWidth / 4));
      const h = Math.max(2, Math.round(canvas.clientHeight / 4));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const draw = (seconds: number) => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.dataset.ready = "true";
    };
    const frame = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw((performance.now() - start) / 1000 + 8);
      raf = requestAnimationFrame(frame);
    };
    const run = () => {
      if (still) {
        draw(11);
        return;
      }
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      run();
    });
    observer.observe(canvas);
    const onVisibility = () => run();
    document.addEventListener("visibilitychange", onVisibility);
    const onResize = () => still && draw(11);
    window.addEventListener("resize", onResize);
    run();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      delete canvas.dataset.ready;
    };
  }, [still]);

  return <canvas ref={ref} aria-hidden="true" />;
}
