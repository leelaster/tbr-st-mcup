/*
 * Route Globe, ported to plain JavaScript for the Tabor mockup.
 * Original: https://21st.dev/@ham7a311/components/route-globe
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
 * A dotted globe with arcs from one hub. Each route lifts off the surface on a great circle,
 * a comet runs along it and the destination pulses when it lands. Drag to spin.
 */
(function () {
  const RAD = Math.PI / 180;

  // ---- land grid -------------------------------------------------------------------------
  let grid = null;
  function landAt(lon, lat) {
    if (!grid) {
      grid = new Uint8Array(360 * 180);
      let i = 0;
      for (const run of window.LAND_RLE.split(".")) {
        if (!run) continue;
        const v = Number(run[0]), n = parseInt(run.slice(1), 36);
        if (v) grid.fill(v, i, i + n);
        i += n;
      }
    }
    const col = Math.min(359, Math.max(0, Math.floor((((lon + 180) % 360) + 360) % 360)));
    const row = Math.min(179, Math.max(0, Math.floor(90 - lat)));
    return grid[row * 360 + col];
  }

  // ---- sphere maths ----------------------------------------------------------------------
  const toVec = (lon, lat) => {
    const l = lon * RAD, p = lat * RAD;
    return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
  };

  function landDots(samples) {
    const out = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < samples; i++) {
      const y = 1 - (2 * (i + 0.5)) / samples;
      const r = Math.sqrt(1 - y * y), a = i * golden;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const c = landAt(Math.atan2(x, z) / RAD, Math.asin(y) / RAD);
      if (c && c !== 7) out.push(x, y, z);
    }
    return new Float32Array(out);
  }

  function rotate(v, yaw, tilt) {
    const [x, y, z] = v;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    return [x1, y * ct - z1 * st, y * st + z1 * ct];
  }

  function slerp(a, b, t) {
    const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const w = Math.acos(d);
    if (w < 1e-6) return a;
    const s = Math.sin(w), ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  }

  function drawGlobe(ctx, dots, v, colour, dot, glow, ground) {
    const { cx, cy, r, yaw, tilt } = v;
    const g = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.22);
    g.addColorStop(0, glow);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
    ctx.fill();
    // a solid body, so the page background does not show through the sphere
    if (ground) {
      const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      body.addColorStop(0, "#0c1a2c");
      body.addColorStop(1, ground);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.005, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = colour;
    const cy_ = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    ctx.globalAlpha = 0.09;
    for (let i = 0; i < dots.length; i += 3) {
      const x = dots[i], y = dots[i + 1], z = dots[i + 2];
      const x1 = x * cy_ - z * sy, z1 = x * sy + z * cy_, y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      if (z2 >= 0) continue;
      ctx.fillRect(cx + x1 * r - dot * 0.35, cy - y2 * r - dot * 0.35, dot * 0.7, dot * 0.7);
    }
    for (let band = 0; band < 4; band++) {
      const lo = band / 4, hi = (band + 1) / 4;
      ctx.globalAlpha = 0.35 + 0.65 * hi;
      for (let i = 0; i < dots.length; i += 3) {
        const x = dots[i], y = dots[i + 1], z = dots[i + 2];
        const x1 = x * cy_ - z * sy, z1 = x * sy + z * cy_, y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        if (z2 < lo || z2 >= hi || z2 < 0) continue;
        const s = dot * (0.7 + 0.3 * z2);
        ctx.fillRect(cx + x1 * r - s / 2, cy - y2 * r - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- the component ---------------------------------------------------------------------
  window.mountRouteGlobe = function (el, { hub, places, theme }) {
    const cv = document.createElement("canvas");
    cv.className = "rg__canvas";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", `A globe with routes from ${hub.name} to ${places.map((p) => p.name).join(", ")}`);
    const tip = document.createElement("div");
    tip.className = "rg__tip";
    tip.hidden = true;
    el.append(cv, tip);

    const ctx = cv.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots = landDots(window.innerWidth < 640 ? 18000 : 30000);
    const H = toVec(hub.lon, hub.lat);
    const routes = places.map((p, i) => ({ p, v: toVec(p.lon, p.lat), offset: i / places.length }));
    const home = hub.lon * RAD - 0.35;
    const st = { yaw: home, tilt: 22 * RAD, vy: 0, vt: 0, drag: false, px: 0, py: 0, last: 0, idle: 0 };
    let W = 0, Hh = 0, dpr = 1, raf = 0, visible = true;
    const t0 = performance.now();
    const pins = [];
    const pulse = { t: -1e9, k: 1, lastHover: -1e9, inside: false, downX: 0, downY: 0 };
    const touch = (strong) => {
      pulse.t = performance.now();
      pulse.k = strong ? 1 : 0.6;
      window.dispatchEvent(new CustomEvent("globe:touch", { detail: { strong } }));
      if (reduced) draw(performance.now());
    };
    const onSphere = (e) => {
      const b = cv.getBoundingClientRect();
      return Math.hypot(e.clientX - b.left - W / 2, e.clientY - b.top - Hh / 2) < radius();
    };

    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = el.clientWidth;
      Hh = el.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(Hh * dpr);
    };
    const radius = () => Math.min(W, Hh) * 0.4;
    const project = (v, lift, r, cx, cy) => {
      const [x, y, z] = rotate(v, st.yaw, st.tilt);
      return { x: cx + x * r * lift, y: cy - y * r * lift, z };
    };
    const label = (text, x, y, colour, left = false) => {
      ctx.font = "500 10.5px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.textAlign = left ? "right" : "left";
      const lx = left ? x - 14 : x + 9;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgb(6 10 17 / 0.85)";
      ctx.strokeText(text, lx, y + 3.5);
      ctx.fillStyle = colour;
      ctx.fillText(text, lx, y + 3.5);
      ctx.textAlign = "left";
    };

    const draw = (now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hh);
      const r = radius(), cx = W / 2, cy = Hh / 2;
      drawGlobe(ctx, dots, { cx, cy, r, yaw: st.yaw, tilt: st.tilt }, theme.land, Math.max(1.4, r / 150), theme.glow, theme.ground);
      // a single pulse after the globe is touched: a ring of light leaves the rim and fades
      const pk = (now - pulse.t) / 1400;
      if (pk >= 0 && pk < 1) {
        const e = 1 - Math.pow(1 - pk, 3);
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1.5 * (1 - pk) + 0.5;
        ctx.globalAlpha = 0.55 * (1 - pk) * pulse.k;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.01 + 0.32 * e), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const t = (now - t0) / 1000;
      pins.length = 0;
      ctx.lineCap = "round";
      for (const rt of routes) {
        const ang = Math.acos(Math.max(-1, Math.min(1, H[0] * rt.v[0] + H[1] * rt.v[1] + H[2] * rt.v[2])));
        const height = 0.06 + ang * 0.12;
        const pts = [];
        for (let k = 0; k <= 48; k++) {
          const u = k / 48;
          pts.push(project(slerp(H, rt.v, u), 1 + Math.sin(Math.PI * u) * height, r, cx, cy));
        }
        ctx.strokeStyle = theme.arc;
        ctx.lineWidth = 1.1;
        for (let k = 0; k < 48; k++) {
          const a = pts[k], b = pts[k + 1];
          const hidden = a.z < 0 && Math.hypot(a.x - cx, a.y - cy) < r;
          ctx.globalAlpha = hidden ? 0.06 : 0.4;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        const cycle = 4.2, ph = reduced ? 0.999 : (t / cycle + rt.offset) % 1;
        const head = Math.floor(Math.min(1, ph / 0.7) * 48);
        for (let k = Math.max(0, head - 10); k < head; k++) {
          const a = pts[k], b = pts[k + 1];
          if (a.z < 0 && Math.hypot(a.x - cx, a.y - cy) < r) continue;
          ctx.globalAlpha = (1 - (head - k) / 10) * 0.95;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        const end = pts[48];
        const front = end.z > 0;
        pins.push({ p: rt.p, x: end.x, y: end.y, front });
        if (front) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = theme.arc;
          ctx.beginPath();
          ctx.arc(end.x, end.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          if (ph > 0.7) {
            const k = (ph - 0.7) / 0.3;
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(end.x, end.y, 3 + k * 16, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = Math.min(1, end.z * 4);
          label(rt.p.name.toUpperCase(), end.x, end.y, theme.muted);
        }
      }
      const h = project(H, 1, r, cx, cy);
      if (h.z > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = theme.text;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = Math.min(1, h.z * 4);
        label(`HQ · ${hub.name.toUpperCase()}`, h.x, h.y, theme.text, true);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
      st.last = now;
      if (!st.drag) {
        st.yaw += st.vy * dt;
        st.tilt += st.vt * dt;
        st.vy *= Math.pow(0.05, dt);
        st.vt *= Math.pow(0.05, dt);
        // when left alone, ease back toward the hub and sway gently around it, so the hub stays in view
        if (now - st.idle > 2500) {
          const target = home + Math.sin(now / 9000) * 0.45;
          let d = (target - st.yaw) % (Math.PI * 2);
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          st.yaw += d * Math.min(1, dt * 0.6);
        }
        st.tilt = Math.max(-0.9, Math.min(0.9, st.tilt + (22 * RAD - st.tilt) * Math.min(1, dt * 0.4)));
      }
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (reduced) return draw(performance.now());
      if (!raf) {
        st.last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    cv.addEventListener("pointerdown", (e) => {
      pulse.downX = e.clientX;
      pulse.downY = e.clientY;
      cv.setPointerCapture(e.pointerId);
      st.drag = true;
      st.px = e.clientX;
      st.py = e.clientY;
      st.vy = st.vt = 0;
      el.dataset.dragging = "";
    });
    cv.addEventListener("pointermove", (e) => {
      if (st.drag) {
        const r = radius();
        const dx = e.clientX - st.px, dy = e.clientY - st.py;
        st.px = e.clientX;
        st.py = e.clientY;
        st.yaw -= dx / r;
        st.tilt = Math.max(-0.9, Math.min(0.9, st.tilt + dy / r));
        st.vy = (-dx / r) * 30;
        st.vt = (dy / r) * 30;
        st.idle = performance.now();
        if (reduced) draw(performance.now());
        tip.hidden = true;
        return;
      }
      // hovering onto the sphere sends a soft ripple, at most every few seconds
      const inside = onSphere(e);
      if (inside && !pulse.inside && performance.now() - pulse.lastHover > 4000) {
        pulse.lastHover = performance.now();
        touch(false);
      }
      pulse.inside = inside;
      const b = cv.getBoundingClientRect();
      const x = e.clientX - b.left, y = e.clientY - b.top;
      const near = pins.filter((p) => p.front).map((p) => ({ ...p, d: Math.hypot(p.x - x, p.y - y) })).sort((a, c) => a.d - c.d)[0];
      if (near && near.d < 18) {
        tip.innerHTML = `<strong>${near.p.name}</strong><span>${near.p.note || ""}</span>`;
        tip.style.left = near.x + "px";
        tip.style.top = near.y + "px";
        tip.hidden = false;
      } else tip.hidden = true;
    });
    const up = (e) => {
      // a click (not a drag) on the sphere makes the globe pulse once
      if (e.type === "pointerup" && Math.hypot(e.clientX - pulse.downX, e.clientY - pulse.downY) < 5 && onSphere(e)) touch(true);
      st.drag = false;
      st.idle = performance.now();
      delete el.dataset.dragging;
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", () => {
      tip.hidden = true;
      pulse.inside = false;
    });

    new ResizeObserver(() => {
      size();
      draw(performance.now());
    }).observe(el);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    }).observe(el);
    document.addEventListener("visibilitychange", () => !document.hidden && start());
    size();
    start();
  };
})();
