/* ==========================================================
   VEDA GALLERY: category tabs, auto-sliding carousel, lightbox.
   Photos are read from Supabase (public, read-only anon key).
   Categories are never hard-coded: they come from the database.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- SETTINGS (edit here) ---------- */
  var SLIDE_DELAY_SECONDS = 3.5;   // how long each slide stays (3 to 4 works well)
  var RESUME_AFTER_SECONDS = 4;    // pause after hover/touch/drag before auto-sliding resumes
  var TRANSITION_MS = 700;         // slide animation speed
  var SWIPE_PX = 40;               // minimum swipe distance
  var MAX_DOTS = 12;               // more photos than this: show "3 / 20" instead of dots

  var C = window.VEDA || {};
  var $ = function (id) { return document.getElementById(id); };
  var root = $("gallery");
  if (!root) return;

  var categoriesEl = $("galleryCategories"), stateEl = $("galleryState"), stage = $("galleryStage"),
      viewport = $("galleryViewport"), track = $("galleryTrack"),
      prevBtn = $("galleryPrev"), nextBtn = $("galleryNext"),
      dotsEl = $("galleryDots"), countEl = $("galleryCount"),
      lb = $("lightbox"), lbImg = $("lbImg"), lbCap = $("lbCap"),
      lbClose = $("lbClose"), lbPrev = $("lbPrev"), lbNext = $("lbNext");

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var all = [], cats = [];
  var items = [], n = 0, p = 1, idx = 0, slideW = 0, sliding = false, busy = false;
  var timer = null, resumeT = null, holding = false, inView = true;
  var drag = null, didDrag = false, preloaded = {};
  var lbIdx = 0, lbTrigger = null, lbOpen = false, lbDrag = null, lbSwiped = false;

  /* ---------- Data ---------- */
  function configured() {
    return C.supabaseUrl && C.supabaseAnonKey && !/YOUR-/i.test(C.supabaseUrl + C.supabaseAnonKey);
  }

  function api(path) {
    var headers = { apikey: C.supabaseAnonKey };
    // Legacy anon keys are JWTs and go in Authorization too; new "sb_publishable_" keys do not.
    if (C.supabaseAnonKey.indexOf("sb_") !== 0) headers.Authorization = "Bearer " + C.supabaseAnonKey;
    return fetch(C.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, { headers: headers })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
  }

  function showState(msg, retry) {
    stopTimers();
    stage.hidden = true;
    stateEl.hidden = false;
    stateEl.textContent = msg;
    if (retry) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-outline btn-sm";
      b.textContent = "Try again";
      b.addEventListener("click", load);
      stateEl.appendChild(document.createElement("br"));
      stateEl.appendChild(b);
    }
  }

  function load() {
    categoriesEl.hidden = true;
    categoriesEl.textContent = "";
    showState("Loading photos\u2026");
    if (!configured()) { showState("Photos will be added soon."); return; }

    Promise.all([
      api("categories?select=id,name&order=name.asc"),
      api("photos?select=id,url,category_id,created_at&order=created_at.desc") // newest first
    ]).then(function (res) {
      var catRows = res[0] || [], photoRows = res[1] || [];
      var names = {};
      catRows.forEach(function (c) { names[c.id] = c.name; });

      all = photoRows.map(function (r) {
        var cn = names[r.category_id] || "";
        return {
          id: r.id, url: r.url, catId: r.category_id, cat: cn,
          alt: (cn ? cn + " \u2013 " : "") + "photo at Veda English Medium School"
        };
      });
      cats = catRows.map(function (c) {
        var photos = all.filter(function (photo) { return photo.catId === c.id; });
        return {
          id: c.id,
          name: c.name,
          count: photos.length,
          coverUrl: photos.length ? photos[0].url : ""
        };
      });

      renderCategories();
      if (!all.length) { showState("Photos will be added soon."); return; }

      stateEl.hidden = true;
      stage.hidden = false;
      build(all);
    }).catch(function () {
      showState("Photos could not be loaded right now. Please try again in a moment.", true);
    });
  }

  /* ---------- Achievement category cards ---------- */
  function renderCategories() {
    categoriesEl.textContent = "";
    var list = [{ id: "all", name: "All Photos", count: all.length }].concat(cats);
    categoriesEl.hidden = cats.length === 0;
    list.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "achievement-card achievement-color-" + (i % 4);
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");

      if (c.coverUrl) {
        var cover = document.createElement("img");
        cover.className = "achievement-cover";
        cover.src = c.coverUrl;
        cover.alt = "";
        cover.loading = "lazy";
        cover.decoding = "async";
        b.appendChild(cover);
      }

      var shade = document.createElement("span");
      shade.className = "achievement-shade";
      shade.setAttribute("aria-hidden", "true");
      b.appendChild(shade);

      var mark = document.createElement("span");
      mark.className = "achievement-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = '<svg class="icon"><use href="#i-trophy"/></svg>';
      b.appendChild(mark);

      var name = document.createElement("span");
      name.className = "achievement-name";
      name.textContent = c.name;
      b.appendChild(name);

      var count = document.createElement("span");
      count.className = "achievement-count";
      count.textContent = c.count + (c.count === 1 ? " photo" : " photos");
      b.appendChild(count);

      b.addEventListener("click", function () { selectCategory(c.id); });
      categoriesEl.appendChild(b);
    });
  }

  function selectCategory(id) {
    Array.prototype.forEach.call(categoriesEl.children, function (el, i) {
      var selected = i === 0 ? id === "all" : cats[i - 1].id === id;
      el.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    var list = id === "all" ? all : all.filter(function (x) { return x.catId === id; });
    if (!list.length) {
      stopTimers();
      stage.hidden = true;
      stateEl.hidden = false;
      stateEl.textContent = "Photos for this category will be added soon.";
      stateEl.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      return;
    }

    stateEl.hidden = true;
    stage.hidden = false;
    build(list);
    stage.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }

  /* ---------- Slider ---------- */
  function perView() {
    var w = window.innerWidth;
    return w >= 1000 ? 3 : (w >= 700 ? 2 : 1);
  }

  function makeSlide(it, i, clone) {
    var slide = document.createElement("div");
    slide.className = "g-slide";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "g-card";
    b.setAttribute("data-i", i);
    var img = document.createElement("img");
    img.src = it.url;
    img.alt = it.alt;
    img.decoding = "async";
    img.loading = i < p + 1 ? "eager" : "lazy";
    img.draggable = false;
    b.appendChild(img);
    if (clone) {
      slide.setAttribute("aria-hidden", "true");
      b.tabIndex = -1;
    } else {
      b.setAttribute("aria-label", "Open photo " + (i + 1) + " of " + n + (it.cat ? ", " + it.cat : ""));
    }
    slide.appendChild(b);
    return slide;
  }

  function build(list) {
    stopTimers();
    holding = false;
    items = list;
    n = list.length;
    idx = 0;
    busy = false;
    p = perView();
    sliding = n > p;

    track.textContent = "";
    var frag = document.createDocumentFragment();
    list.forEach(function (it, i) { frag.appendChild(makeSlide(it, i, false)); });
    if (sliding) for (var c = 0; c < p; c++) frag.appendChild(makeSlide(list[c], c, true)); // clones for endless loop
    track.appendChild(frag);

    track.classList.toggle("is-static", !sliding);
    stage.classList.toggle("is-static", !sliding);
    layout();
    buildDots();
    updateDots();
    preloadAhead();
    start();
  }

  function layout() {
    var vw = viewport.clientWidth;
    slideW = n === 1 ? Math.min(vw, 640) : vw / p;
    Array.prototype.forEach.call(track.children, function (s) { s.style.width = slideW + "px"; });
    place(false);
  }

  function place(animate) {
    track.style.transition = (animate && !reduce)
      ? "transform " + TRANSITION_MS + "ms cubic-bezier(.65,0,.35,1)" : "none";
    track.style.transform = "translate3d(" + (-idx * slideW) + "px,0,0)";
  }

  function after(fn) { setTimeout(fn, reduce ? 0 : TRANSITION_MS + 30); }

  function next() {
    if (!sliding || busy) return;
    busy = true;
    idx++;
    place(true);
    updateDots();
    preloadAhead();
    after(function () {
      if (idx >= n) { idx = 0; place(false); } // jump from the clone back to the real first slide
      busy = false;
    });
  }

  function prev() {
    if (!sliding || busy) return;
    busy = true;
    if (idx === 0) { idx = n; place(false); void track.offsetWidth; } // jump to the clones, then slide back
    idx--;
    place(true);
    updateDots();
    preloadAhead();
    after(function () { busy = false; });
  }

  function goTo(i) {
    if (!sliding || busy || i === idx) return;
    busy = true;
    idx = i;
    place(true);
    updateDots();
    preloadAhead();
    after(function () { busy = false; });
  }

  /* ---------- Dots / counter ---------- */
  function buildDots() {
    dotsEl.textContent = "";
    var showDots = sliding && n <= MAX_DOTS;
    dotsEl.hidden = !showDots;
    countEl.hidden = !(sliding && n > MAX_DOTS);
    if (!showDots) return;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var d = document.createElement("button");
        d.type = "button";
        d.className = "g-dot";
        d.setAttribute("aria-label", "Go to photo " + (i + 1));
        d.addEventListener("click", function () { hold(); goTo(i); release(); });
        dotsEl.appendChild(d);
      })(i);
    }
  }

  function updateDots() {
    var a = sliding ? idx % n : 0;
    Array.prototype.forEach.call(dotsEl.children, function (d, i) {
      if (i === a) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
    });
    countEl.textContent = (a + 1) + " / " + n;
  }

  /* ---------- Preload so slides never flash blank ---------- */
  function preload(i) {
    if (!n) return;
    var it = items[((i % n) + n) % n];
    if (!it || preloaded[it.url]) return;
    preloaded[it.url] = 1;
    var im = new Image();
    im.decoding = "async";
    im.src = it.url;
  }
  function preloadAhead() {
    for (var k = 0; k < p + 2; k++) preload(idx + k);
    preload(idx - 1);
  }

  /* ---------- Auto-slide with pause / resume ---------- */
  function canAuto() { return sliding && !reduce && inView && !holding && !document.hidden; }
  function start() {
    clearTimeout(timer);
    if (!sliding || reduce) return;
    timer = setTimeout(tick, SLIDE_DELAY_SECONDS * 1000);
  }
  function tick() { if (canAuto()) next(); start(); }
  function stopTimers() { clearTimeout(timer); clearTimeout(resumeT); }
  function hold() { holding = true; clearTimeout(timer); clearTimeout(resumeT); }
  function release() {
    clearTimeout(resumeT);
    resumeT = setTimeout(function () { holding = false; start(); }, RESUME_AFTER_SECONDS * 1000);
  }

  /* ---------- Lightbox ---------- */
  function showLB() {
    var it = items[lbIdx];
    if (!it) return;
    lbImg.src = it.url;
    lbImg.alt = it.alt;
    lbCap.textContent = (it.cat ? it.cat + " \u00B7 " : "") + (lbIdx + 1) + " / " + n;
    lbPrev.hidden = lbNext.hidden = n < 2;
    if (n > 1) { preload(lbIdx + 1); preload(lbIdx - 1); }
  }
  function openLB(i, trigger) {
    lbIdx = i;
    lbTrigger = trigger;
    lbOpen = true;
    hold();
    showLB();
    lb.hidden = false;
    document.body.classList.add("lb-open");
    lbClose.focus();
  }
  function closeLB() {
    if (!lbOpen) return;
    lbOpen = false;
    lb.hidden = true;
    lbImg.removeAttribute("src");
    document.body.classList.remove("lb-open");
    if (lbTrigger && document.contains(lbTrigger)) lbTrigger.focus();
    release();
  }
  function stepLB(d) {
    if (n < 2) return;
    lbIdx = (lbIdx + d + n) % n;
    showLB();
  }

  /* ---------- Events ---------- */
  function bind() {
    prevBtn.addEventListener("click", function () { hold(); prev(); release(); });
    nextBtn.addEventListener("click", function () { hold(); next(); release(); });

    // Hover (mouse only) and keyboard focus pause the slider
    stage.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hold(); });
    stage.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") release(); });
    stage.addEventListener("focusin", hold);
    stage.addEventListener("focusout", release);

    // Touch / mouse drag and swipe
    viewport.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY };
      didDrag = false;
      hold();
    });
    function endDrag(e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (e.type === "pointerup" && sliding) {
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
          didDrag = true;
          if (dx < 0) next(); else prev();
        }
      }
      release();
    }
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);

    // Keyboard focus on an off-screen slide must not scroll the clipped viewport
    viewport.addEventListener("scroll", function () { viewport.scrollLeft = 0; });

    // Tap an image: open the lightbox
    track.addEventListener("click", function (e) {
      if (didDrag) { didDrag = false; return; }
      var b = e.target.closest ? e.target.closest(".g-card") : null;
      if (b) openLB(parseInt(b.getAttribute("data-i"), 10) || 0, b);
    });

    // Lightbox controls
    lbClose.addEventListener("click", closeLB);
    lbPrev.addEventListener("click", function () { stepLB(-1); });
    lbNext.addEventListener("click", function () { stepLB(1); });
    lb.addEventListener("click", function (e) {
      if (lbSwiped) { lbSwiped = false; return; }
      if (e.target === lb) closeLB();
    });
    lb.addEventListener("pointerdown", function (e) { lbDrag = { x: e.clientX, y: e.clientY }; lbSwiped = false; });
    lb.addEventListener("pointerup", function (e) {
      if (!lbDrag) return;
      var dx = e.clientX - lbDrag.x, dy = e.clientY - lbDrag.y;
      lbDrag = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) { lbSwiped = true; stepLB(dx < 0 ? 1 : -1); }
    });
    document.addEventListener("keydown", function (e) {
      if (!lbOpen) return;
      if (e.key === "Escape") closeLB();
      else if (e.key === "ArrowLeft") stepLB(-1);
      else if (e.key === "ArrowRight") stepLB(1);
      else if (e.key === "Tab") {
        var f = [lbClose, lbPrev, lbNext].filter(function (b) { return !b.hidden; });
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        i = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
        f[i].focus();
      }
    });

    // Only auto-slide while the gallery is on screen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.1 }).observe(stage);
    }

    // Re-layout on resize (rebuild only when the number of visible images changes)
    var rT;
    window.addEventListener("resize", function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        if (!n) return;
        if (perView() !== p) build(items); else layout();
      }, 150);
    });
  }

  try {
    bind();
    load();
  } catch (e) {
    showState("Photos could not be loaded right now.");
  }
})();