/*
 * Signal ribbons: a band of fine lines that flows diagonally across the section and slowly
 * twists, like a ribbon of waveforms. The pointer gently pushes the lines aside; a click sends a
 * shockwave through them. Colours run from Tabor blue through cyan to Tabor green, the same
 * ribbon Tabor uses on its trade-show stand. Inspired by Aether Ribbon Mesh on 21st.dev.
 */
(function () {
  const STOPS_LIGHT = ["#0b6fb3", "#1aa7d9", "#38c6c0", "#8cc63f"];
  const STOPS_DARK = ["#2a8fd8", "#3fc1e6", "#5fd6c2", "#a6d13f"];

  window.mountRibbons = function (host, { dark = false, lines = 64 } = {}) {
    const cv = document.createElement("canvas");
    cv.className = "ribbons";
    cv.setAttribute("aria-hidden", "true");
    host.prepend(cv);
    const ctx = cv.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const stops = dark ? STOPS_DARK : STOPS_LIGHT;
    let W = 0, H = 0, dpr = 1, raf = 0, visible = true, grad = null;
    const t0 = performance.now();
    const ptr = { x: -1e4, y: -1e4, s: 0, ts: 0 };
    const shocks = [];

    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = host.clientWidth;
      H = host.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      grad = ctx.createLinearGradient(W * 0.15, H, W, 0);
      stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    };

    // the band's centre line: enters low on the left, sweeps up to the top right
    const centre = (u) => (dark ? H * (0.75 - 0.5 * u) : H * (0.86 - 0.64 * Math.pow(u, 0.85)));

    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ptr.s += (ptr.ts - ptr.s) * 0.08;
      while (shocks.length && t - shocks[0].t > 2.4) shocks.shift();
      const step = Math.max(6, W / 220);
      const band = Math.min(H * (dark ? 0.34 : 0.42), 340);
      ctx.strokeStyle = grad;
      ctx.lineWidth = dark ? 1 : 1.1;
      for (let i = 0; i < lines; i++) {
        const k = i / (lines - 1) - 0.5; // -0.5 .. 0.5 across the band
        ctx.globalAlpha = (dark ? 0.36 : 0.62) * (0.55 + 0.45 * Math.cos(k * Math.PI));
        ctx.beginPath();
        for (let x = -step; x <= W + step; x += step) {
          const u = x / W;
          // twist: the band narrows and flips as the phase travels along it
          const twist = Math.cos(u * 3.4 - t * 0.28 + 0.6) * 0.85 + Math.sin(u * 1.3 + t * 0.17) * 0.25;
          let y = centre(u) + k * band * twist;
          y += Math.sin(u * 9 + t * 0.9 + i * 0.12) * 5 * (0.4 + Math.abs(k)); // fine ripple along each line
          // the pointer lifts a soft bump that pushes lines apart
          if (ptr.s > 0.01) {
            const dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy;
            y += Math.sign(dy || 1) * 38 * ptr.s * Math.exp(-d2 / 9000);
          }
          for (const s of shocks) {
            const age = t - s.t, d = Math.hypot(x - s.x, y - s.y), front = age * 520;
            y += Math.sign(y - s.y || 1) * 26 * Math.exp(-((d - front) ** 2) / 1800) * Math.exp(-age * 1.6);
          }
          x <= -step ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (still) return draw(t0 + 4000);
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const local = (e) => {
      const b = host.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top, inside: e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom };
    };
    if (!still) {
      if (fine) {
        window.addEventListener("pointermove", (e) => {
          const p = local(e);
          ptr.ts = p.inside ? 1 : 0;
          if (p.inside) { ptr.x = p.x; ptr.y = p.y; }
        }, { passive: true });
      }
      host.addEventListener("pointerdown", (e) => {
        if (e.target.closest("a, button, input, textarea")) return;
        const p = local(e);
        shocks.push({ x: p.x, y: p.y, t: (performance.now() - t0) / 1000 });
      });
    }

    new ResizeObserver(() => { size(); draw(performance.now()); }).observe(host);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(host);
    document.addEventListener("visibilitychange", () => !document.hidden && start());
    size();
    start();
  };
})();
