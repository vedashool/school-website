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

  /* ---------- Home photo carousel ---------- */
  function initSchoolCarousel() {
    var AUTOPLAY_DELAY_MS = 2000;
    var carousel = document.getElementById("schoolCarousel");
    var track = document.getElementById("schoolCarouselTrack");
    if (!carousel || !track) return;

    var slides = Array.prototype.slice.call(track.children);
    var dots = Array.prototype.slice.call(carousel.querySelectorAll(".school-carousel-dot"));
    var prev = carousel.querySelector("[data-carousel-prev]");
    var next = carousel.querySelector("[data-carousel-next]");
    if (slides.length < 2 || !prev || !next) return;

    var total = slides.length;
    var current = 0;
    var timer = null;
    var paused = false;
    var inView = true;
    var transitioning = false;

    var clone = slides[0].cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelector("img").alt = "";
    track.appendChild(clone);

    function render(animate) {
      transitioning = animate;
      track.style.transition = animate ? "" : "none";
      track.style.transform = "translate3d(-" + (current * 100) + "%, 0, 0)";
      slides.forEach(function (slide, i) {
        slide.setAttribute("aria-hidden", i === current ? "false" : "true");
      });
      dots.forEach(function (dot, i) {
        if (i === current % total) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });

      if (!animate) {
        void track.offsetWidth;
        track.style.transition = "";
      }
    }

    function schedule() {
      clearTimeout(timer);
      if (reduceMotion || paused || !inView || document.hidden) return;
      timer = setTimeout(function () {
        current += 1;
        render(true);
        schedule();
      }, AUTOPLAY_DELAY_MS);
    }

    function goTo(index) {
      if (transitioning) return;
      if (index === current) { schedule(); return; }
      current = index;
      render(true);
      schedule();
    }

    track.addEventListener("transitionend", function (event) {
      if (event.target !== track || event.propertyName !== "transform") return;
      transitioning = false;
      if (current !== total) return;
      current = 0;
      render(false);
    });

    prev.addEventListener("click", function () {
      if (transitioning) return;
      if (current === 0) {
        current = total;
        render(false);
      }
      current -= 1;
      render(true);
      schedule();
    });
    next.addEventListener("click", function () { goTo(current + 1); });
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () { goTo(i); });
    });

    carousel.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "mouse") { paused = true; schedule(); }
    });
    carousel.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "mouse") { paused = false; schedule(); }
    });
    carousel.addEventListener("focusin", function () { paused = true; schedule(); });
    carousel.addEventListener("focusout", function (event) {
      if (!carousel.contains(event.relatedTarget)) { paused = false; schedule(); }
    });
    document.addEventListener("visibilitychange", schedule);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.1 }).observe(carousel);
    }

    render(false);
    schedule();
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
  safe(initSchoolCarousel);
  safe(initLinks);
})();