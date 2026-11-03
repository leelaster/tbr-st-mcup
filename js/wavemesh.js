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

  window.mountWaveMesh = function (host, { dot = "196,202,210", origin = null } = {}) {
    const canvas = document.createElement("canvas");
    canvas.className = "hero__mesh";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    const ctx = canvas.getContext("2d");

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = !matchMedia("(hover: hover) and (pointer: fine)").matches;
    const dpr = Math.min(devicePixelRatio, 2);
    let W = 0, H = 0, cols = 0, rows = 0, f = 0, hz = 0;
    let raf = 0, visible = true, last = 0, nextPulse = 0;
    const t0 = performance.now();
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

    // a calm swell, plus slow rings travelling out from the point on the ground beneath the globe
    const height = (x, z, t) => {
      let y = 0.03 * Math.sin(x * 1.6 + t * 0.35) + 0.022 * Math.sin(z * 2.2 - t * 0.4 + x * 0.6);
      // rows close to the camera are magnified on screen, so rings are damped there to stay smooth
      const near = Math.min(1, Math.max(0, (z - NEAR) / 1.1)) ** 1.5;
      if (near <= 0) return y;
      for (const r of rings) {
        const age = t - r.t, d = Math.hypot(x - r.x, z - r.z), front = age * r.speed;
        y += near * r.amp * Math.exp(-((d - front) ** 2) / 0.03) * Math.exp(-age * 0.32);
      }
      return y;
    };

    const frame = (t) => {
      ctx.clearRect(0, 0, W, H);
      if (t > nextPulse) {
        emit(0.075, 0.42);
        nextPulse = t + 2.8;
      }
      while (rings.length && t - rings[0].t > 10) rings.shift();
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

    /** The point on the ground just beneath the globe, in world units. */
    const source = () => {
      const h = host.getBoundingClientRect();
      const g = origin ? origin.getBoundingClientRect() : h;
      const sx = g.left + g.width / 2 - h.left;
      const sy = Math.max(hz + H * 0.1, Math.min(H - 4, g.top + g.height * 0.86 - h.top));
      const z = Math.min(FAR, Math.max(NEAR, (CAM * f) / (sy - hz)));
      return { x: ((sx - W / 2) * z) / f, z };
    };
    const emit = (amp, speed) => {
      const s = source();
      rings.push({ x: s.x, z: s.z, t: now(), amp, speed });
    };

    resize();
    frame(reduced ? 3 : 0);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(host);
    new ResizeObserver(() => { if (reduced) { resize(); frame(3); } }).observe(host);
    document.addEventListener("visibilitychange", wake);
    if (!reduced) {
      wake();
      // a route leaving or landing sends a slightly stronger ring out from the globe
      window.addEventListener("globe:ping", () => emit(0.1, 0.5));
    }
  };
})();
