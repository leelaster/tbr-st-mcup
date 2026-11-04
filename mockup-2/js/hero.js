/*
 * Hero title, in four beats:
 *   1. build: a typewriter; only the newest letter scrambles through a couple of random
 *      characters (the Motion Primitives TextScramble set) before it settles and the next begins
 *   2. hold: a band of Tabor blue shimmers once across both lines
 *   3. dissolve: TextScramble (motion-primitives.com/docs/text-scramble) run in reverse: from the first letter onward, letters
 *      turn to random characters and then vanish (they keep their space, so lines don't jump)
 *   4. half a second of empty space, then the next title builds
 */
(function () {
  const h1 = document.getElementById("htitle");
  const main = h1.querySelector(".htitle__main");
  const sub = h1.querySelector(".htitle__sub");
  const data = [...document.querySelectorAll("#slide-data li")].map((li) => ({ t: li.dataset.title, s: li.dataset.sub }));
  const dots = [...document.querySelectorAll("#dots button")];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // TextScramble defaults: same character set; speed is the redraw interval in seconds
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const SPEED = 0.05;
  const WINDOW = 6;         // while dissolving, how many letters ahead of the cut are scrambling
  const TYPE_SPEED = 24;    // ms each random glyph is shown while building
  const TYPE_FRAMES = 2;    // random glyphs each new letter shows before it settles
  const SHINE = 3200, HOLD = 4200, GAP = 500;
  const ERASE_TIME = 1000;  // the whole dissolve, start to finish
  const rand = () => CHARS[Math.floor(Math.random() * CHARS.length)];

  let i = 0, timer = 0, wait = 0;

  // draw the full title string, split back into its black and grey parts; letters for which
  // visible(k) is false keep their space but are invisible, so lines never jump
  const render = (text, cut, visible = () => true) => {
    const draw = (el, from, to) => {
      const nodes = [];
      let run = "", hidden = false;
      const flush = () => {
        if (!run) return;
        if (hidden) {
          const g = document.createElement("span");
          g.className = "gone";
          g.textContent = run;
          nodes.push(g);
        } else nodes.push(run);
        run = "";
      };
      for (let k = from; k < to; k++) {
        const h = !visible(k);
        if (h !== hidden) { flush(); hidden = h; }
        run += text[k];
      }
      flush();
      el.replaceChildren(...nodes);
    };
    draw(main, 0, cut);
    draw(sub, cut + 1, text.length);
  };

  // build: a typewriter. Only the newest letter scrambles; the next letter starts only once
  // the one before it has settled. Spaces don't scramble, they just appear.
  const type = (full, cut, done) => {
    clearInterval(timer);
    let k = 0, frame = 0;
    timer = setInterval(() => {
      // the current letter has had its glyphs: it settles, and the next one takes over
      if (frame === TYPE_FRAMES) {
        frame = 0;
        k++;
      }
      while (k < full.length && full[k] === " ") k++;
      if (k >= full.length) {
        clearInterval(timer);
        render(full, cut);
        return done();
      }
      const shown = full.slice(0, k) + rand() + full.slice(k + 1);
      render(shown, cut, (n) => n <= k);
      frame++;
    }, TYPE_SPEED);
  };

  // dissolve: TextScramble from Motion Primitives run in reverse. From the first letter on,
  // letters just ahead of the cut turn to random characters, then vanish.
  const dissolve = (full, cut, done) => {
    clearInterval(timer);
    const duration = ERASE_TIME / 1000;
    const steps = duration / SPEED;
    let step = 0;
    timer = setInterval(() => {
      const head = (step / steps) * full.length;
      let out = "";
      for (let k = 0; k < full.length; k++) {
        if (full[k] === " ") out += " ";
        else out += k >= head && k < head + WINDOW ? rand() : full[k];
      }
      render(out, cut, (n) => n >= head);
      step++;
      if (step > steps) {
        clearInterval(timer);
        render(full, cut, () => false);
        done();
      }
    }, SPEED * 1000);
  };

  // one slow sweep across the bold line, then on through the grey line
  const shimmer = () => {
    h1.classList.add("is-shine");
    const frames = [{ backgroundPosition: "100% 0" }, { backgroundPosition: "0% 0" }];
    const ease = "cubic-bezier(0.65, 0, 0.35, 1)";
    main.animate(frames, { duration: SHINE * 0.55, delay: 300, easing: ease, fill: "both" });
    sub.animate(frames, { duration: SHINE * 0.75, delay: 300 + SHINE * 0.3, easing: ease, fill: "both" });
  };

  const play = (n) => {
    clearTimeout(wait);
    clearInterval(timer);
    h1.classList.remove("is-shine");
    i = (n + data.length) % data.length;
    const { t, s } = data[i];
    const full = t + " " + s;
    h1.setAttribute("aria-label", full);
    const letters = full.replace(/ /g, "").length;
    const build = letters * TYPE_FRAMES * TYPE_SPEED;
    dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
    dots[i].style.setProperty("--dur", build + HOLD + ERASE_TIME + GAP + "ms");
    if (still) {
      render(full, t.length);
      wait = setTimeout(() => play(i + 1), 7000);
      return;
    }
    render(full, t.length, () => false);
    type(full, t.length, () => {
      shimmer();
      wait = setTimeout(() => {
        h1.classList.remove("is-shine");
        dissolve(full, t.length, () => {
          wait = setTimeout(() => play(i + 1), GAP);
        });
      }, HOLD);
    });
  };

  // reserve the height of the tallest title, so the button below never moves between titles
  const fit = () => {
    const probe = h1.cloneNode(false);
    probe.removeAttribute("id");
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${h1.offsetWidth}px;min-height:0`;
    h1.parentNode.appendChild(probe);
    let tallest = 0;
    data.forEach(({ t, s }) => {
      probe.innerHTML = "";
      const m = document.createElement("strong");
      m.className = "htitle__main";
      m.textContent = t;
      const g = document.createElement("span");
      g.className = "htitle__sub";
      g.textContent = s;
      probe.append(m, " ", g);
      tallest = Math.max(tallest, probe.offsetHeight);
    });
    probe.remove();
    h1.style.minHeight = tallest + "px";
  };
  new ResizeObserver(fit).observe(h1.parentNode);
  document.fonts && document.fonts.ready.then(fit);
  fit();

  dots.forEach((d, n) => d.addEventListener("click", () => play(n)));
  play(0);
})();
