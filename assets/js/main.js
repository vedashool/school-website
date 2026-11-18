/* Intro animation, scroll reveal, page transitions, small helpers.
   Everything is wrapped so a failure here can never block the page. */
(function () {
  var C = window.VEDA || {};
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* ---------- Intro (Home only, once per session) ---------- */
  var INTRO_VISIBLE_MS = 2600; // time before the screen lifts away
  var INTRO_LIFT_MS = 900;     // must match the CSS transition on .intro
  var INTRO_HARD_LIMIT_MS = 4500;

  function initIntro() {
    var intro = document.getElementById("intro");
    if (!intro) return;
    var finished = false;

    function remove() {
      if (finished) return;
      finished = true;
      try { sessionStorage.setItem("vedaIntro", "1"); } catch (e) {}
      document.documentElement.classList.remove("has-intro");
      if (intro.parentNode) intro.parentNode.removeChild(intro);
    }
    function leave() {
      if (finished) return;
      intro.classList.add("is-leaving");
      setTimeout(remove, INTRO_LIFT_MS + 50);
    }

    if (!document.documentElement.classList.contains("has-intro")) { remove(); return; }

    var skip = document.getElementById("introSkip");
    if (skip) skip.addEventListener("click", leave);
    setTimeout(leave, INTRO_VISIBLE_MS);
    setTimeout(remove, INTRO_HARD_LIMIT_MS); // hard failsafe
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.classList.add("reveal");
        child.style.transitionDelay = (i * 70) + "ms";
      });
    });
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Page transitions ---------- */
  function initTransitions() {
    if (reduceMotion) return;
    function norm(p) { return p.replace(/index\.html$/, ""); }
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.protocol !== location.protocol || url.origin !== location.origin) return;
      if (norm(url.pathname) === norm(location.pathname) && url.search === location.search) return; // same page
      e.preventDefault();
      document.body.classList.add("page-leave");
      setTimeout(function () { location.href = url.href; }, 260);
    });
    window.addEventListener("pageshow", function () {
      document.body.classList.remove("page-leave");
    });
  }

  /* ---------- Helpers: call + WhatsApp links ---------- */
  function initLinks() {
    document.querySelectorAll("[data-call]").forEach(function (a) { a.href = "tel:" + C.phone; });
    document.querySelectorAll("[data-wa]").forEach(function (a) {
      a.href = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(C.whatsappMessage);
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  function safe(fn) { try { fn(); } catch (e) { /* never block the page */ } }
  safe(initIntro);
  safe(initReveal);
  safe(initTransitions);
  safe(initLinks);
})();