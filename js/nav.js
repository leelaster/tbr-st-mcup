/*
 * Top bar: background fades in once the page scrolls, one highlight slides between menu items,
 * dropdowns open on hover (with a short grace period so the pointer can travel into the panel),
 * on click, and from the keyboard. Escape closes whatever is open.
 */
(function () {
  const nav = document.getElementById("nav");
  const menu = document.getElementById("menu");
  const pill = menu.querySelector(".menu__pill");
  const items = [...menu.querySelectorAll(".menu__item")];
  const search = document.getElementById("search");
  const burger = document.getElementById("burger");
  const drawer = document.getElementById("drawer");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let openItem = null, closeTimer = 0;

  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // the sliding highlight: appears in place the first time, then glides between items
  const movePill = (link) => {
    const m = menu.getBoundingClientRect(), r = link.getBoundingClientRect();
    pill.classList.toggle("no-slide", !menu.classList.contains("has-pill"));
    pill.style.width = r.width + "px";
    pill.style.transform = `translate(${r.left - m.left}px, ${r.top - m.top}px)`;
    menu.classList.add("has-pill");
  };

  const close = (item) => {
    item.classList.remove("is-open");
    item.querySelector(".menu__link").setAttribute("aria-expanded", "false");
    if (openItem === item) openItem = null;
  };
  const open = (item) => {
    clearTimeout(closeTimer);
    if (openItem === item) return;
    if (openItem) close(openItem);
    if (!item.hasAttribute("data-menu")) return;
    item.classList.add("is-open");
    item.querySelector(".menu__link").setAttribute("aria-expanded", "true");
    openItem = item;
  };
  const closeAll = () => {
    if (openItem) close(openItem);
    menu.classList.remove("has-pill");
  };
  const closeSoon = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeAll, 140);
  };

  items.forEach((item) => {
    const link = item.querySelector(".menu__link");
    if (fine) {
      item.addEventListener("pointerenter", () => {
        movePill(link);
        open(item);
      });
    }
    link.addEventListener("click", (e) => {
      if (!item.hasAttribute("data-menu")) return;
      e.preventDefault();
      if (item.classList.contains("is-open") && !fine) close(item);
      else {
        open(item);
        movePill(link);
      }
    });
    link.addEventListener("focus", () => movePill(link));
  });
  menu.addEventListener("pointerleave", closeSoon);
  menu.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  menu.addEventListener("focusout", (e) => {
    if (!menu.contains(e.relatedTarget)) closeAll();
  });
  document.addEventListener("pointerdown", (e) => {
    if (openItem && !menu.contains(e.target)) closeAll();
  });

  // search: the icon opens a field that grows out to the left
  const sBtn = search.querySelector("button"), sInput = search.querySelector("input");
  sBtn.addEventListener("pointerdown", (e) => e.preventDefault()); // keep focus in the field while toggling
  sBtn.addEventListener("click", () => {
    const isOpen = search.classList.toggle("is-open");
    sBtn.setAttribute("aria-expanded", isOpen);
    if (isOpen) sInput.focus();
  });
  sInput.addEventListener("blur", () => {
    if (!sInput.value) {
      search.classList.remove("is-open");
      sBtn.setAttribute("aria-expanded", "false");
    }
  });

  // phone and tablet menu
  const setDrawer = (isOpen) => {
    nav.classList.toggle("is-open", isOpen);
    burger.setAttribute("aria-expanded", isOpen);
    burger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    drawer.setAttribute("aria-hidden", !isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  };
  burger.addEventListener("click", () => setDrawer(!nav.classList.contains("is-open")));
  matchMedia("(min-width: 1101px)").addEventListener("change", (e) => e.matches && setDrawer(false));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (openItem) {
      const link = openItem.querySelector(".menu__link");
      closeAll();
      link.focus();
    }
    if (search.classList.contains("is-open")) sInput.blur();
    if (nav.classList.contains("is-open")) setDrawer(false);
  });
})();
