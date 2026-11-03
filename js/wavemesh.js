/*
 * Wave Mesh, ported to plain JavaScript for the Tabor mockup.
 * Original: https://21st.dev/@ham7a311/components/wave-mesh
 *
 * MIT License. Copyright (c) 2026 Hamza Al-Bulushi
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions: The above copyright notice and this
 * permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
 *
 * A field of dots laid out to the horizon and rolling like a slow sea. The pointer lifts a soft
 * hill where it points on the ground; a click throws off a ring that travels across the field.
 * Here the globe also sends rings (the "globe:ping" event) when a route leaves or lands.
 */
(function () {
  const CAM = 0.62; // camera height above the ground
  const NEAR = 0.35, FAR = 3.4;

  window.mountWaveMesh = function (host, { dot = "196,202,210" } = {}) {
    const canvas = document.createElement("canvas");
    canvas.className = "hero__mesh";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    const ctx = canvas.getContext("2d");

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = !matchMedia("(hover: hover) and (pointer: fine)").matches;
    const dpr = Math.min(devicePixelRatio, 2);
    let W = 0, H = 0, cols = 0, rows = 0, f = 0, hz = 0;
    let raf = 0, visible = true, last = 0;
    const t0 = performance.now();
    const ptr = { x: 0, z: 1.4, s: 0, tx: 0, tz: 1.4, ts: 0 };
    const rings = [];

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      f = Math.max(W, H * 1.2) * 0.55; // focal length
      hz = H * 0.3; // horizon
      cols = Math.round(Math.min(150, Math.max(56, W / 9)));
      rows = Math.round(Math.min(90, Math.max(48, H / 9.5)));
    };

    // World ground spans this half-width at the far edge, so the field always fills the frame.
    const half = () => (W / 2 / f) * FAR * 1.05;

    const height = (x, z, t) => {
      let y = 0.085 * Math.sin(x * 2.2 + t * 0.7) + 0.07 * Math.sin(z * 2.9 - t * 0.9 + x * 0.8) + 0.03 * Math.sin((x + z) * 6.1 + t * 1.6);
      if (ptr.s > 0.01) {
        const d2 = (x - ptr.x) ** 2 + (z - ptr.z) ** 2;
        y += 0.24 * ptr.s * Math.exp(-d2 / 0.07);
      }
      for (const r of rings) {
        const age = t - r.t, d = Math.hypot(x - r.x, z - r.z), front = age * 1.15;
        y += 0.2 * Math.exp(-((d - front) ** 2) / 0.014) * Math.exp(-age * 0.75);
      }
      return y;
    };

    const frame = (t) => {
      ctx.clearRect(0, 0, W, H);
      ptr.x += (ptr.tx - ptr.x) * 0.1;
      ptr.z += (ptr.tz - ptr.z) * 0.1;
      ptr.s += (ptr.ts - ptr.s) * 0.06;
      while (rings.length && t - rings[0].t > 5) rings.shift();
      const hw = half();
      for (let j = 0; j < rows; j++) {
        // Rows are spaced geometrically in depth, so they sit roughly evenly on screen; each row shares a size and a fog.
        const z = FAR * Math.pow(NEAR / FAR, j / (rows - 1));
        const fog = Math.pow(1 - (z - NEAR) / (FAR - NEAR), 1.25);
        const size = Math.max(0.8, Math.min(3.2, 2.3 / z));
        ctx.fillStyle = `rgba(${dot},${(0.08 + fog * 0.6).toFixed(3)})`;
        for (let i = 0; i < cols; i++) {
          const x = -hw + (i / (cols - 1)) * hw * 2;
          const y = height(x, z, t);
          const sx = W / 2 + (x / z) * f;
          if (sx < -4 || sx > W + 4) continue;
          const sy = hz + ((CAM - y) / z) * f;
          ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        }
      }
    };

    const now = () => (performance.now() - t0) / 1000;
    const loop = (ms) => {
      if (!visible || document.hidden) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
      if (coarse && ms - last < 30) return;
      last = ms;
      resize();
      frame(now());
    };
    const wake = () => { if (!reduced && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };

    /** Where on the ground a screen point lands (ignoring the waves). Points above the horizon drop just below it. */
    const ground = (cx, cy, clamp) => {
      const r = host.getBoundingClientRect();
      const sx = cx - r.left;
      let sy = cy - r.top;
      if (sx < 0 || sx > r.width || sy < 0 || sy > r.height) return null;
      if (sy <= hz + 4) {
        if (!clamp) return null;
        sy = hz + H * 0.12;
      }
      const z = Math.min(FAR, Math.max(NEAR, (CAM * f) / (sy - hz)));
      return { x: ((sx - W / 2) * z) / f, z };
    };
    const onMove = (e) => {
      const g = ground(e.clientX, e.clientY, false);
      if (g) { ptr.tx = g.x; ptr.tz = g.z; if (ptr.s < 0.05) { ptr.x = g.x; ptr.z = g.z; } }
      ptr.ts = g ? 1 : 0;
    };
    const onDown = (e) => {
      const g = ground(e.clientX, e.clientY, false);
      if (g) rings.push({ x: g.x, z: g.z, t: now() });
    };

    resize();
    frame(reduced ? 3 : 0);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(host);
    new ResizeObserver(() => { if (reduced) { resize(); frame(3); } }).observe(host);
    document.addEventListener("visibilitychange", wake);
    if (!reduced) {
      wake();
      if (!coarse) window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("globe:ping", (e) => {
        const g = ground(e.detail.x, e.detail.y, true);
        if (g) rings.push({ x: g.x, z: g.z, t: now() });
      });
    }
  };
})();
