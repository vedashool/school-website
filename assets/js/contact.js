/* ==========================================================
   CONTACT PAGE: contact details, Google Map, enquiry form.
   Enquiries are saved to the Supabase "enquiries" table.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- SETTINGS (edit here) ---------- */
  var MAX_ENQUIRIES_PER_HOUR = 3;  // per browser
  var MIN_FILL_SECONDS = 3;        // forms sent faster than this are treated as bots
  var RATE_KEY = "vedaEnquiryLog";

  var C = window.VEDA || {};
  var $ = function (id) { return document.getElementById(id); };
  var loadedAt = Date.now();

  /* ---------- Contact details (from config.js) ---------- */
  function fillDetails() {
    var a = $("cAddress");
    if (a) a.textContent = C.address || "";

    var p = $("cPhone");
    if (p) { p.textContent = C.phoneDisplay || ""; p.href = "tel:" + (C.phone || ""); }

    var eRow = $("cEmailRow"), e = $("cEmail");
    if (eRow && e) {
      if (C.email) { e.textContent = C.email; e.href = "mailto:" + C.email; eRow.hidden = false; }
      else eRow.hidden = true;
    }

    var t = $("cTimings");
    if (t) t.textContent = C.timings || "";

    var dRow = $("cDaysRow"), d = $("cDays");
    if (dRow && d) {
      if (C.openDays) { d.textContent = C.openDays; dRow.hidden = false; }
      else dRow.hidden = true;
    }
  }

  /* ---------- Map: exact pin from coordinates (not a business-name search) ---------- */
  function initMap() {
    var box = $("mapBox");
    if (!box) return;
    var num = /^-?\d{1,3}(\.\d+)?$/;
    var lat = String(C.mapLat || "").trim(), lng = String(C.mapLng || "").trim();
    if (!num.test(lat) || !num.test(lng)) return; // keep the friendly placeholder

    var f = document.createElement("iframe");
    f.src = "https://www.google.com/maps?q=" + lat + "," + lng + "&z=17&output=embed";
    f.title = "Map showing the location of Veda English Medium School";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.setAttribute("allowfullscreen", "");
    box.appendChild(f);

    var note = $("mapNote");
    if (note) note.hidden = true;
    var link = $("mapLink");
    if (link) { link.href = "https://www.google.com/maps?q=" + lat + "," + lng; link.hidden = false; }
  }

  /* ---------- Enquiry form ---------- */
  var form = $("enquiryForm");
  if (!form) { fillDetails(); initMap(); return; }

  var statusEl = $("enqStatus"), doneEl = $("enqDone"), againBtn = $("enqAgain"), submitBtn = $("enqSubmit");

  function configured() {
    return C.supabaseUrl && C.supabaseAnonKey && !/YOUR-/i.test(C.supabaseUrl + C.supabaseAnonKey);
  }

  function send(payload) {
    var headers = {
      apikey: C.supabaseAnonKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal" // the public can insert but never read enquiries back
    };
    if (C.supabaseAnonKey.indexOf("sb_") !== 0) headers.Authorization = "Bearer " + C.supabaseAnonKey;
    return fetch(C.supabaseUrl.replace(/\/$/, "") + "/rest/v1/enquiries", {
      method: "POST", headers: headers, body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); });
  }

  /* Rate limit (per browser, last hour) */
  function getLog() {
    try {
      var cut = Date.now() - 3600000;
      return JSON.parse(localStorage.getItem(RATE_KEY) || "[]").filter(function (t) { return t > cut; });
    } catch (e) { return []; }
  }
  function logSend() {
    try {
      var log = getLog();
      log.push(Date.now());
      localStorage.setItem(RATE_KEY, JSON.stringify(log));
    } catch (e) {}
  }

  /* Messages */
  function setError(id, msg) {
    var input = $(id), wrap = input.closest(".field"), err = wrap.querySelector(".field-error");
    wrap.classList.toggle("has-error", !!msg);
    err.textContent = msg || "";
    if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }
  function showError(msg) { statusEl.textContent = msg; statusEl.hidden = false; }
  function setBusy(b) {
    submitBtn.disabled = b;
    submitBtn.textContent = b ? "Sending\u2026" : "Send Enquiry";
  }
  function showDone() {
    form.hidden = true;
    statusEl.hidden = true;
    doneEl.hidden = false;
    doneEl.focus();
  }

  function validate(v) {
    var first = null;
    function bad(id, msg) { setError(id, msg); if (!first) first = $(id); }
    setError("parentName", ""); setError("phone", ""); setError("classInterest", "");
    if (v.name.length < 2) bad("parentName", "Please enter your name.");
    if (!/^\+?\d{7,15}$/.test(v.phoneClean)) bad("phone", "Please enter a valid phone number.");
    if (!v.cls) bad("classInterest", "Please choose a class.");
    if (first) { first.focus(); return false; }
    return true;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.hidden = true;

    var v = {
      name: $("parentName").value.trim(),
      phone: $("phone").value.trim(),
      cls: $("classInterest").value,
      msg: $("message").value.trim()
    };
    v.phoneClean = v.phone.replace(/[\s\-().]/g, "");
    if (!validate(v)) return;

    // Spam protection: bots that fill the hidden field or submit instantly get a fake "success"
    var trap = form.elements["company_url"] ? form.elements["company_url"].value : "";
    if (trap || (Date.now() - loadedAt) < MIN_FILL_SECONDS * 1000) { showDone(); return; }

    if (getLog().length >= MAX_ENQUIRIES_PER_HOUR) {
      showError("You have already sent a few enquiries. Please call us or message us on WhatsApp, or try again a little later.");
      return;
    }
    if (!configured()) {
      showError("Online enquiries are not available right now. Please call us or message us on WhatsApp.");
      return;
    }

    setBusy(true);
    send({
      parent_name: v.name.slice(0, 80),
      phone: v.phone.slice(0, 20),
      class_interest: v.cls,
      message: v.msg ? v.msg.slice(0, 1000) : null
    }).then(function () {
      logSend();
      showDone();
    }).catch(function () {
      showError("We could not send your enquiry just now. Please call us or message us on WhatsApp.");
    }).then(function () {
      setBusy(false);
    });
  });

  againBtn.addEventListener("click", function () {
    form.reset();
    doneEl.hidden = true;
    form.hidden = false;
    loadedAt = Date.now();
    $("parentName").focus();
  });

  fillDetails();
  initMap();
})();