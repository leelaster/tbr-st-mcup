/*
 * Floating capsule bar. One shared panel ("morph") serves Products, Solutions, About and Search:
 * it resizes to fit the pane it shows, slides under the item that opened it, and the panes slide
 * in from the side you moved toward. On small screens the capsule grows into the menu itself.
 */
(function () {
  const bar = document.getElementById("bar");
  const capsule = document.getElementById("capsule");
  const morph = document.getElementById("morph");
  const box = morph.querySelector(".morph__box");
  const caret = morph.querySelector(".morph__caret");
  const panes = [...morph.querySelectorAll(".pane")];
  const order = panes.map((p) => p.dataset.pane);
  const triggers = [...capsule.querySelectorAll("[data-open]")];
  const toggle = document.getElementById("toggle");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let current = null, closeTimer = 0;

  // the capsule lifts off the page once you scroll
  const onScroll = () => bar.classList.toggle("is-stuck", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const pane = (name) => panes.find((p) => p.dataset.pane === name);

  const place = (name, trigger) => {
    const p = pane(name);
    const w = p.offsetWidth, h = p.offsetHeight;
    const c = capsule.getBoundingClientRect(), t = trigger.getBoundingClientRect();
    const mid = t.left + t.width / 2 - c.left;
    // centre under the item, but stay inside the page column: the panel may reach left past
    // the capsule (over the space beside the logo) and never past the capsule's right edge
    const col = bar.querySelector(".bar__wrap"), cs = getComputedStyle(col);
    const minX = col.getBoundingClientRect().left + parseFloat(cs.paddingLeft) - c.left;
    const x = Math.max(minX, Math.min(c.width - w, mid - w / 2));
    box.style.width = w + "px";
    box.style.height = h + "px";
    morph.style.transform = `translateX(${x}px)`;
    caret.style.transform = `translateX(${mid - x - 7}px) rotate(45deg)`;
  };

  const open = (name, trigger) => {
    clearTimeout(closeTimer);
    if (current === name) return;
    const from = order.indexOf(current), to = order.indexOf(name);
    const first = !current;
    morph.classList.toggle("is-first", first); // the first opening appears in place instead of sliding
    panes.forEach((p) => {
      const i = order.indexOf(p.dataset.pane);
      p.classList.toggle("is-on", p.dataset.pane === name);
      p.classList.toggle("is-left", !first && i < to && p.dataset.pane !== name);
      p.classList.toggle("is-right", !first && i > to && p.dataset.pane !== name);
    });
    if (!first) pane(name).style.setProperty("--from", from < to ? "28px" : "-28px");
    triggers.forEach((b) => b.setAttribute("aria-expanded", b.dataset.open === name));
    place(name, trigger);
    morph.classList.add("is-open");
    current = name;
    if (name === "search") setTimeout(() => pane("search").querySelector("input").focus(), 60);
  };
  const close = () => {
    morph.classList.remove("is-open");
    triggers.forEach((b) => b.setAttribute("aria-expanded", "false"));
    current = null;
  };
  const closeSoon = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, 160);
  };

  triggers.forEach((b) => {
    if (fine && b.dataset.open !== "search") b.addEventListener("pointerenter", () => open(b.dataset.open, b));
    b.addEventListener("click", () => (current === b.dataset.open ? close() : open(b.dataset.open, b)));
  });
  // moving onto a plain link closes the panel; leaving the capsule closes it after a short grace
  capsule.querySelectorAll(".capsule__menu a").forEach((a) => a.addEventListener("pointerenter", () => current && current !== "search" && closeSoon()));
  capsule.addEventListener("pointerleave", () => current && current !== "search" && closeSoon());
  capsule.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  document.addEventListener("pointerdown", (e) => current && !capsule.contains(e.target) && close());
  addEventListener("resize", () => current && place(current, triggers.find((b) => b.dataset.open === current)));

  // small screens: the capsule expands into the menu
  toggle.addEventListener("click", () => {
    const isOpen = bar.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen);
    toggle.querySelector("span").textContent = isOpen ? "Close" : "Menu";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (current) {
      const t = triggers.find((b) => b.dataset.open === current);
      close();
      t && t.focus();
    }
    if (bar.classList.contains("is-open")) toggle.click();
  });
})();
