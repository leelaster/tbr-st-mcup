/*
 * Sonar dots: a faint dot grid behind the hero. Rings expand from a point and gently lift the
 * dots they pass. Quiet ambient pings fire on their own; the globe adds a ping where a route
 * lands (the "globe:ping" event). Inspired by Sonar Grid on 21st.dev (MIT).
 */
(function () {
  window.mountSonar = function (cv, host, { colour = [196, 202, 210], gap = 26 } = {}) {
    const ctx = cv.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pings = [];
    let W = 0, H = 0, dpr = 1, raf = 0, visible = true, nextAmbient = 0;

    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = host.clientWidth;
      H = host.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    };

    const ping = (x, y, strong = false) => {
      pings.push({ x, y, t0: performance.now(), speed: strong ? 190 : 130, life: strong ? 3.2 : 4.2, amp: strong ? 0.75 : 0.4 });
      if (pings.length > 10) pings.shift();
    };

    const draw = (now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (let i = pings.length - 1; i >= 0; i--) if ((now - pings[i].t0) / 1000 > pings[i].life) pings.splice(i, 1);
      const live = pings.map((p) => {
        const age = (now - p.t0) / 1000;
        return { ...p, r: age * p.speed, fade: p.amp * (1 - age / p.life) };
      });
      const ox = (W % gap) / 2 + gap / 2, oy = (H % gap) / 2 + gap / 2;
      const [r, g, b] = colour;
      for (let y = oy; y < H; y += gap) {
        for (let x = ox; x < W; x += gap) {
          let lift = 0;
          for (const p of live) {
            const d = Math.hypot(x - p.x, y - p.y) - p.r;
            lift += Math.exp(-(d * d) / 260) * p.fade;
          }
          lift = Math.min(1, lift);
          const a = 0.16 + 0.6 * lift;
          ctx.fillStyle = `rgb(${r} ${g} ${b} / ${a.toFixed(3)})`;
          const s = 1.7 + lift * 1.5;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
    };

    const tick = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (now > nextAmbient) {
        ping(W * (0.08 + Math.random() * 0.84), H * (0.1 + Math.random() * 0.8));
        nextAmbient = now + 2600 + Math.random() * 2200;
      }
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (still) return draw(performance.now());
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("globe:ping", (e) => {
      const b = host.getBoundingClientRect();
      ping(e.detail.x - b.left, e.detail.y - b.top, true);
    });
    new ResizeObserver(() => {
      size();
      draw(performance.now());
    }).observe(host);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    }).observe(host);
    document.addEventListener("visibilitychange", () => !document.hidden && start());
    size();
    start();
  };
})();
