/* ==========================================================
   VEDA SCHOOL ADMIN PANEL
   Talks to Supabase with the public key plus the admin's login.
   The database rules (schema.sql) are what really protect the data;
   this screen simply hides everything until the admin signs in.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- SETTINGS (edit here) ---------- */
  var BUCKET = "gallery";
  var MAX_FILES_AT_ONCE = 30;   // photos per upload
  var MAX_ORIGINAL_MB = 15;     // largest original photo accepted
  var MAX_WIDTH = 1600;         // photos are shrunk to this width...
  var MAX_HEIGHT = 2000;        // ...and never taller than this
  var JPEG_QUALITY = 0.8;       // about 80%
  var ENQUIRIES_LIMIT = 200;    // newest enquiries shown
  var ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  var C = window.VEDA || {};
  var BASE = String(C.supabaseUrl || "").replace(/\/$/, "");
  var KEY = String(C.supabaseAnonKey || "");
  var SESSION_KEY = "vedaAdminSession";
  var VIEWS = ["home", "add", "remove", "cats", "enq"];

  var $ = function (id) { return document.getElementById(id); };
  var session = null, refreshing = null, uploading = false, cats = [], queue = [], toastT = null;

  /* ---------- Small helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function userError(msg) { var e = new Error(msg); e.user = true; return e; }
  function authError() { var e = new Error("Please sign in again."); e.auth = true; return e; }
  function configured() { return BASE && KEY && !/YOUR-/i.test(BASE + KEY); }

  function setMsg(node, text, kind) {
    if (!text) { node.hidden = true; node.textContent = ""; node.className = "ad-msg"; return; }
    node.textContent = text;
    node.className = "ad-msg " + (kind || "err");
    node.setAttribute("role", kind === "ok" ? "status" : "alert");
    node.hidden = false;
  }

  function toast(text) {
    var t = $("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 3500);
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return iso || ""; }
  }

  function friendly(e) {
    if (!e) return "Something went wrong. Please try again.";
    if (e.user) return e.message;
    if (e instanceof TypeError) return "There is no internet connection. Please check it and try again.";
    if (e.code === "23505") return "A category with this name already exists.";
    if (e.code === "23503") return "This category still has photos, so it cannot be deleted.";
    if (e.code === "23514") return "That name is not allowed. Please use 1 to 40 characters.";
    if (e.status === 403 || e.code === "42501") return "You are not allowed to do this. Please sign out and sign in again.";
    if (e.status === 413) return "That photo is too large to upload.";
    return "Something went wrong. Please try again.";
  }

  function handleErr(e, msgEl) {
    if (e && e.auth) { goLogin("Your session ended. Please sign in again."); return; }
    setMsg(msgEl, friendly(e), "err");
  }

  /* ---------- Supabase calls ---------- */
  function headers(token, extra) {
    var h = { apikey: KEY };
    if (token) h.Authorization = "Bearer " + token;
    else if (KEY.indexOf("sb_") !== 0) h.Authorization = "Bearer " + KEY;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function authCall(path, body, token) {
    return fetch(BASE + "/auth/v1/" + path, {
      method: "POST",
      headers: headers(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var d = {};
        try { d = t ? JSON.parse(t) : {}; } catch (e) {}
        if (!r.ok) {
          var err = new Error(d.msg || d.message || d.error_description || ("HTTP " + r.status));
          err.status = r.status;
          err.code = d.error_code || d.error;
          throw err;
        }
        return d;
      });
    });
  }

  function loadSession() {
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { session = null; }
  }
  function saveSession(s) {
    session = s;
    try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function toSession(d) {
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600))
    };
  }

  function getToken() {
    if (!session || !session.access_token) return Promise.reject(authError());
    var now = Math.floor(Date.now() / 1000);
    if (session.expires_at - now > 60) return Promise.resolve(session.access_token);
    if (!refreshing) {
      refreshing = authCall("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
        .then(function (d) { var s = toSession(d); saveSession(s); return s.access_token; })
        .then(function (t) { refreshing = null; return t; },
              function () { refreshing = null; saveSession(null); throw authError(); });
    }
    return refreshing;
  }

  function rest(method, path, body, prefer) {
    return getToken().then(function (token) {
      var h = headers(token);
      if (body !== undefined) h["Content-Type"] = "application/json";
      if (prefer) h.Prefer = prefer;
      return fetch(BASE + "/rest/v1/" + path, {
        method: method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined
      });
    }).then(function (r) {
      if (r.status === 401) { saveSession(null); throw authError(); }
      return r.text().then(function (t) {
        var d = null;
        try { d = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          var err = new Error((d && d.message) || ("HTTP " + r.status));
          err.status = r.status;
          err.code = d && d.code;
          throw err;
        }
        return d;
      });
    });
  }

  function uploadFile(path, blob, onProgress) {
    return getToken().then(function (token) {
      return new Promise(function (resolve, reject) {
        var x = new XMLHttpRequest();
        x.open("POST", BASE + "/storage/v1/object/" + BUCKET + "/" + path);
        x.setRequestHeader("apikey", KEY);
        x.setRequestHeader("Authorization", "Bearer " + token);
        x.setRequestHeader("Content-Type", blob.type || "image/jpeg");
        x.setRequestHeader("cache-control", "max-age=31536000");
        x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
        x.onload = function () {
          if (x.status >= 200 && x.status < 300) { resolve(); return; }
          var err = new Error("HTTP " + x.status);
          err.status = x.status;
          if (x.status === 401) err.auth = true;
          reject(err);
        };
        x.onerror = function () { reject(new TypeError("network")); };
        x.send(blob);
      });
    });
  }

  function removeFile(path) {
    return getToken().then(function (token) {
      return fetch(BASE + "/storage/v1/object/" + BUCKET + "/" + path, { method: "DELETE", headers: headers(token) });
    }).then(function (r) {
      if (!r.ok && r.status !== 404) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
    });
  }

  /* ---------- Pop-up (confirmations and rename) ---------- */
  function ask(o) {
    return new Promise(function (resolve) {
      var modal = $("modal"), mInput = $("mInput"), mYes = $("mYes"), mNo = $("mNo"), mThumb = $("mThumb"), mText = $("mText");
      var last = document.activeElement;
      var hasInput = typeof o.input === "string";

      $("mTitle").textContent = o.title || "";
      mText.textContent = o.text || "";
      mText.hidden = !o.text;
      if (o.thumb) { mThumb.src = o.thumb; mThumb.hidden = false; } else { mThumb.removeAttribute("src"); mThumb.hidden = true; }
      mInput.hidden = !hasInput;
      mInput.value = hasInput ? o.input : "";
      $("mErr").textContent = "";
      mYes.textContent = o.yes || "OK";
      mYes.className = "btn btn-lg " + (o.danger ? "btn-danger" : "btn-primary");
      mNo.hidden = !o.no;
      mNo.textContent = o.no || "";
      modal.hidden = false;
      document.body.classList.add("modal-open");

      function close(res) {
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        mYes.onclick = null; mNo.onclick = null; modal.onclick = null; modal.onkeydown = null;
        if (last && last.focus && document.contains(last)) last.focus();
        resolve(res);
      }
      function yes() {
        var v = mInput.value.trim();
        if (hasInput && !v) { $("mErr").textContent = "Please type a name."; mInput.focus(); return; }
        close({ ok: true, value: v });
      }
      function no() { close({ ok: false }); }

      mYes.onclick = yes;
      mNo.onclick = no;
      modal.onclick = function (e) { if (e.target === modal) no(); };
      modal.onkeydown = function (e) {
        if (e.key === "Escape") { e.preventDefault(); no(); }
        else if (e.key === "Enter" && e.target === mInput) { e.preventDefault(); yes(); }
        else if (e.key === "Tab") {
          var f = [mInput, mNo, mYes].filter(function (x) { return !x.hidden; });
          var i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      };
      (hasInput ? mInput : (o.danger && o.no ? mNo : mYes)).focus();
    });
  }

  /* ---------- Sign in / out ---------- */
  function goLogin(msg, kind) {
    saveSession(null);
    $("app").hidden = true;
    $("loginView").hidden = false;
    $("loginPassword").value = "";
    setMsg($("loginMsg"), msg || "", kind || "err");
  }

  function goApp() {
    $("loginView").hidden = true;
    $("app").hidden = false;
    setMsg($("loginMsg"), "");
    show("home");
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("loginEmail").value.trim(), pw = $("loginPassword").value;
    setMsg($("loginMsg"), "");
    if (!configured()) { setMsg($("loginMsg"), "The website setup is not finished yet. Please contact your web developer.", "err"); return; }
    if (!email || !pw) { setMsg($("loginMsg"), "Please type your email and password.", "err"); return; }

    var btn = $("loginBtn");
    btn.disabled = true;
    btn.textContent = "Signing in\u2026";
    authCall("token?grant_type=password", { email: email, password: pw }).then(function (d) {
      saveSession(toSession(d));
      goApp();
    }).catch(function (err) {
      var m;
      if (err instanceof TypeError) m = "There is no internet connection. Please check it and try again.";
      else if (err.status === 429) m = "Too many attempts. Please wait a few minutes and try again.";
      else if (err.status === 400 || err.status === 401 || err.status === 422) m = "The email or password is not correct.";
      else m = "Could not sign in. Please try again.";
      setMsg($("loginMsg"), m, "err");
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "Sign in";
    });
  });

  $("signOutBtn").addEventListener("click", function () {
    if (uploading) { toast("Please wait until the upload has finished."); return; }
    var t = session && session.access_token;
    if (t) authCall("logout", {}, t).catch(function () {});
    goLogin("You have been signed out.", "ok");
  });

  /* ---------- Navigation ---------- */
  function show(name) {
    if (uploading && name !== "add") { toast("Please wait until the upload has finished."); return; }
    VIEWS.forEach(function (v) { $("v-" + v).hidden = v !== name; });
    $("backBtn").hidden = name === "home";
    window.scrollTo(0, 0);
    var h = $("v-" + name).querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    if (name === "add") initAdd();
    else if (name === "remove") loadRemove();
    else if (name === "cats") loadCats();
    else if (name === "enq") loadEnq();
  }

  $("backBtn").addEventListener("click", function () { show("home"); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-go")); });
  });

  window.addEventListener("beforeunload", function (e) {
    if (uploading) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Categories helpers ---------- */
  function findCat(name) {
    var n = name.trim().toLowerCase();
    for (var i = 0; i < cats.length; i++) if (cats[i].name.trim().toLowerCase() === n) return cats[i];
    return null;
  }
  function checkName(name) {
    if (!name) return "Please type a name.";
    if (name.length > 40) return "Please use 40 characters or fewer.";
    return "";
  }

  /* ==========================================================
     1. ADD PHOTOS
     ========================================================== */
  function fillCatSelect(selectId) {
    var s = $("addCat");
    s.textContent = "";
    cats.forEach(function (c) { var o = el("option", null, c.name); o.value = c.id; s.appendChild(o); });
    var n = el("option", null, "+ Create a new category");
    n.value = "__new__";
    s.appendChild(n);
    s.value = selectId || (cats.length ? cats[0].id : "__new__");
    toggleNew();
  }
  function toggleNew() { $("newCatWrap").hidden = $("addCat").value !== "__new__"; }
  $("addCat").addEventListener("change", toggleNew);

  function initAdd() {
    if (uploading) return;
    setMsg($("addMsg"), "");
    queue = [];
    $("queueList").textContent = "";
    updateUploadBtn();
    rest("GET", "categories?select=id,name&order=name.asc").then(function (d) {
      cats = d || [];
      fillCatSelect();
    }).catch(function (e) { handleErr(e, $("addMsg")); });
  }

  function checkFile(f) {
    var okType = ALLOWED_TYPES.indexOf(f.type) !== -1 || (!f.type && /\.(jpe?g|png|webp)$/i.test(f.name));
    if (!okType) return "Not a JPG, PNG or WebP photo";
    if (f.size === 0) return "This file is empty";
    if (f.size > MAX_ORIGINAL_MB * 1024 * 1024) return "Too large (maximum " + MAX_ORIGINAL_MB + " MB)";
    return "";
  }

  function setRow(q, text, cls) {
    q.st.textContent = text;
    q.st.className = "up-status " + (cls || "");
  }

  function updateUploadBtn() {
    var any = queue.some(function (q) { return q.state === "ready" || q.state === "failed"; });
    $("uploadBtn").disabled = uploading || !any;
  }

  function setAddBusy(b) {
    $("uploadBtn").disabled = b;
    $("uploadBtn").textContent = b ? "Uploading\u2026 please keep this page open" : "Upload photos";
    $("fileInput").disabled = b;
    $("addCat").disabled = b;
    $("newCatName").disabled = b;
    $("backBtn").disabled = b;
    $("signOutBtn").disabled = b;
    $("fileLabel").style.opacity = b ? ".55" : "";
    $("fileLabel").style.pointerEvents = b ? "none" : "";
    if (!b) updateUploadBtn();
  }

  $("fileInput").addEventListener("change", function () {
    var files = Array.prototype.slice.call($("fileInput").files || []);
    $("fileInput").value = "";
    if (uploading) return;
    queue = [];
    $("queueList").textContent = "";
    setMsg($("addMsg"), "");

    var extra = 0;
    if (files.length > MAX_FILES_AT_ONCE) { extra = files.length - MAX_FILES_AT_ONCE; files = files.slice(0, MAX_FILES_AT_ONCE); }

    files.forEach(function (f) {
      var li = el("li", "up-row");
      var st = el("span", "up-status");
      var bar = el("div", "up-bar");
      var fill = el("i");
      bar.appendChild(fill);
      li.appendChild(el("span", "up-name", f.name));
      li.appendChild(st);
      li.appendChild(bar);
      var q = { file: f, state: "ready", st: st, fill: fill, bar: bar };
      var why = checkFile(f);
      if (why) { q.state = "rejected"; setRow(q, why, "bad"); bar.hidden = true; }
      else setRow(q, "Ready", "");
      queue.push(q);
      $("queueList").appendChild(li);
    });

    if (extra) setMsg($("addMsg"), "You can add up to " + MAX_FILES_AT_ONCE + " photos at a time. " + extra + " extra photo" + (extra > 1 ? "s were" : " was") + " left out.", "err");
    updateUploadBtn();
  });

  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { reject(new Error("bad image")); return; }
        var s = Math.min(1, MAX_WIDTH / w, MAX_HEIGHT / h);
        var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
        var c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";            // PNGs with transparency get a white background
        ctx.fillRect(0, 0, cw, ch);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, cw, ch);
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error("bad image")); }, "image/jpeg", JPEG_QUALITY);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }

  function resolveCategory() {
    var v = $("addCat").value;
    if (v !== "__new__") return Promise.resolve(v);
    var name = $("newCatName").value.trim();
    var bad = checkName(name);
    if (bad) return Promise.reject(userError("Please type a name for the new category."));
    var existing = findCat(name);
    if (existing) return Promise.resolve(existing.id);
    return rest("POST", "categories", { name: name }, "return=representation").then(function (rows) {
      var row = rows && rows[0];
      if (!row) throw userError("The category could not be created. Please try again.");
      cats.push(row);
      cats.sort(function (a, b) { return a.name.localeCompare(b.name); });
      fillCatSelect(row.id);
      $("newCatName").value = "";
      return row.id;
    });
  }

  function uploadOne(q, catId) {
    q.bar.hidden = false;
    q.fill.style.width = "0%";
    setRow(q, "Preparing\u2026", "");
    return compress(q.file).then(function (blob) {
      var path = catId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
      setRow(q, "Uploading\u2026", "");
      return uploadFile(path, blob, function (pct) { q.fill.style.width = pct + "%"; setRow(q, pct + "%", ""); }).then(function () {
        var url = BASE + "/storage/v1/object/public/" + BUCKET + "/" + path;
        return rest("POST", "photos", { url: url, storage_path: path, category_id: catId }, "return=minimal")
          .catch(function (e) {
            // saving the record failed: remove the file so nothing is left behind
            return removeFile(path).catch(function () {}).then(function () { throw e; });
          });
      });
    }).then(function () {
      q.state = "done";
      q.fill.style.width = "100%";
      setRow(q, "Uploaded", "good");
    }, function (e) {
      q.state = "failed";
      setRow(q, e && e.name !== "TypeError" && e.message === "bad image" ? "Could not read this photo" : "Failed", "bad");
      throw e;
    });
  }

  $("uploadBtn").addEventListener("click", function () {
    if (uploading) return;
    setMsg($("addMsg"), "");
    var todo = queue.filter(function (q) { return q.state === "ready" || q.state === "failed"; });
    if (!todo.length) { setMsg($("addMsg"), "Please choose some photos first.", "err"); return; }

    uploading = true;
    setAddBusy(true);
    var done = 0, failed = 0;

    resolveCategory().then(function (catId) {
      return todo.reduce(function (p, q) {
        return p.then(function () {
          return uploadOne(q, catId).then(function () { done++; }, function (e) {
            if (e && e.auth) throw e;
            failed++;
          });
        });
      }, Promise.resolve());
    }).then(function () {
      if (failed === 0) setMsg($("addMsg"), "All done! " + done + " photo" + (done === 1 ? " was" : "s were") + " uploaded. " + (done === 1 ? "It" : "They") + " will now show on the website.", "ok");
      else setMsg($("addMsg"), done + " uploaded, " + failed + " could not be uploaded. Tap \u201CUpload photos\u201D to try the failed ones again.", "err");
    }).catch(function (e) {
      handleErr(e, $("addMsg"));
    }).then(function () {
      uploading = false;
      setAddBusy(false);
    });
  });

  /* ==========================================================
     2. DELETE PHOTOS
     ========================================================== */
  function loadRemove() {
    var body = $("rmBody");
    body.textContent = "Loading photos\u2026";
    setMsg($("rmMsg"), "");
    Promise.all([
      rest("GET", "categories?select=id,name&order=name.asc"),
      rest("GET", "photos?select=id,url,storage_path,category_id,created_at&order=created_at.desc&limit=1000")
    ]).then(function (r) {
      cats = r[0] || [];
      renderRemove(cats, r[1] || []);
    }).catch(function (e) { body.textContent = ""; handleErr(e, $("rmMsg")); });
  }

  function renderRemove(catRows, photos) {
    var body = $("rmBody");
    body.textContent = "";
    var groups = 0;

    catRows.forEach(function (c) {
      var mine = photos.filter(function (p) { return p.category_id === c.id; });
      if (!mine.length) return;
      groups++;

      var sec = el("section", "rm-group");
      var h = el("h2", null, c.name);
      var count = el("span", null, mine.length + (mine.length === 1 ? " photo" : " photos"));
      h.appendChild(count);
      var grid = el("div", "ph-grid");
      sec.appendChild(h);
      sec.appendChild(grid);
      var g = { n: mine.length, count: count, sec: sec };

      mine.forEach(function (p) {
        var fig = el("figure", "ph");
        var img = el("img");
        img.src = p.url;
        img.alt = "Photo in " + c.name;
        img.loading = "lazy";
        var btn = el("button", "btn btn-danger", "Delete");
        btn.type = "button";
        btn.setAttribute("aria-label", "Delete this photo from " + c.name);
        btn.addEventListener("click", function () { deletePhoto(p, fig, btn, g); });
        fig.appendChild(img);
        fig.appendChild(btn);
        grid.appendChild(fig);
      });
      body.appendChild(sec);
    });

    if (!groups) body.appendChild(el("div", "ad-card", "There are no photos yet. Use \u201CAdd photos\u201D to upload some."));
  }

  function deletePhoto(p, fig, btn, g) {
    ask({
      title: "Delete this photo?",
      text: "It will be removed from the website. This cannot be undone.",
      thumb: p.url, yes: "Yes, delete", no: "No, keep it", danger: true
    }).then(function (r) {
      if (!r.ok) return;
      btn.disabled = true;
      btn.textContent = "Deleting\u2026";
      var fileProblem = false;
      return rest("DELETE", "photos?id=eq." + encodeURIComponent(p.id), undefined, "return=representation").then(function (rows) {
        if (!rows || !rows.length) throw userError("This photo could not be deleted. Please sign out, sign in again and try once more.");
        return removeFile(p.storage_path).then(null, function () { fileProblem = true; });
      }).then(function () {
        fig.remove();
        g.n--;
        g.count.textContent = g.n + (g.n === 1 ? " photo" : " photos");
        if (g.n <= 0) g.sec.remove();
        if (!$("rmBody").querySelector(".rm-group")) $("rmBody").appendChild(el("div", "ad-card", "There are no photos left."));
        toast(fileProblem ? "Photo removed from the website, but its stored file could not be deleted." : "Photo deleted.");
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = "Delete";
        handleErr(e, $("rmMsg"));
      });
    });
  }

  /* ==========================================================
     3. MANAGE CATEGORIES
     ========================================================== */
  function loadCats() {
    var list = $("catList");
    list.textContent = "Loading\u2026";
    setMsg($("catMsg"), "");
    Promise.all([
      rest("GET", "categories?select=id,name&order=name.asc"),
      rest("GET", "photos?select=category_id&limit=5000")
    ]).then(function (r) {
      cats = r[0] || [];
      var counts = {};
      (r[1] || []).forEach(function (p) { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
      renderCats(counts);
    }).catch(function (e) { list.textContent = ""; handleErr(e, $("catMsg")); });
  }

  function renderCats(counts) {
    var list = $("catList");
    list.textContent = "";
    if (!cats.length) { list.appendChild(el("li", "ad-card", "No categories yet. Create your first one above.")); return; }

    cats.forEach(function (c) {
      var n = counts[c.id] || 0;
      var li = el("li", "cat-row");
      var info = el("div", "cat-info");
      info.appendChild(el("strong", null, c.name));
      info.appendChild(el("span", null, n + (n === 1 ? " photo" : " photos")));
      var actions = el("div", "cat-actions");
      var rn = el("button", "btn btn-outline", "Rename");
      rn.type = "button";
      rn.setAttribute("aria-label", "Rename " + c.name);
      var dl = el("button", "btn btn-danger", "Delete");
      dl.type = "button";
      dl.setAttribute("aria-label", "Delete " + c.name);
      rn.addEventListener("click", function () { renameCat(c); });
      dl.addEventListener("click", function () { deleteCat(c, n); });
      actions.appendChild(rn);
      actions.appendChild(dl);
      li.appendChild(info);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  $("catCreateBtn").addEventListener("click", function () {
    var name = $("catNewName").value.trim(), msg = $("catMsg");
    setMsg(msg, "");
    var bad = checkName(name);
    if (bad) { setMsg(msg, bad, "err"); return; }
    if (findCat(name)) { setMsg(msg, "A category with this name already exists.", "err"); return; }
    var btn = $("catCreateBtn");
    btn.disabled = true;
    rest("POST", "categories", { name: name }, "return=representation").then(function (rows) {
      if (!rows || !rows.length) throw userError("The category could not be created. Please try again.");
      $("catNewName").value = "";
      toast("Category created.");
      loadCats();
    }).catch(function (e) { handleErr(e, msg); }).then(function () { btn.disabled = false; });
  });

  function renameCat(c) {
    ask({ title: "Rename category", input: c.name, yes: "Save", no: "Cancel" }).then(function (r) {
      if (!r.ok) return;
      var name = r.value.trim();
      if (name === c.name) return;
      var bad = checkName(name);
      if (bad) { setMsg($("catMsg"), bad, "err"); return; }
      var dup = findCat(name);
      if (dup && dup.id !== c.id) { setMsg($("catMsg"), "A category with this name already exists.", "err"); return; }
      return rest("PATCH", "categories?id=eq." + encodeURIComponent(c.id), { name: name }, "return=representation").then(function (rows) {
        if (!rows || !rows.length) throw userError("The category could not be renamed. Please try again.");
        toast("Category renamed.");
        loadCats();
      });
    }).catch(function (e) { handleErr(e, $("catMsg")); });
  }

  function deleteCat(c, n) {
    if (n > 0) {
      ask({
        title: "This category cannot be deleted",
        text: "\u201C" + c.name + "\u201D still has " + n + " photo" + (n === 1 ? "" : "s") + ". Delete those photos first (use \u201CDelete photos\u201D), then you can delete the category.",
        yes: "OK"
      });
      return;
    }
    ask({
      title: "Delete this category?",
      text: "\u201C" + c.name + "\u201D has no photos and will be removed.",
      yes: "Yes, delete", no: "No, keep it", danger: true
    }).then(function (r) {
      if (!r.ok) return;
      return rest("DELETE", "categories?id=eq." + encodeURIComponent(c.id), undefined, "return=representation").then(function (rows) {
        if (!rows || !rows.length) throw userError("The category could not be deleted. Please try again.");
        toast("Category deleted.");
        loadCats();
      });
    }).catch(function (e) { handleErr(e, $("catMsg")); });
  }

  /* ==========================================================
     4. VIEW ENQUIRIES (read only)
     ========================================================== */
  function loadEnq() {
    var body = $("enqBody");
    body.textContent = "Loading enquiries\u2026";
    setMsg($("enqMsg"), "");
    rest("GET", "enquiries?select=id,parent_name,phone,class_interest,message,created_at&order=created_at.desc&limit=" + ENQUIRIES_LIMIT).then(function (rows) {
      body.textContent = "";
      rows = rows || [];
      if (!rows.length) { body.appendChild(el("div", "ad-card", "No enquiries yet.")); return; }
      if (rows.length >= ENQUIRIES_LIMIT) body.appendChild(el("p", "help", "Showing the newest " + ENQUIRIES_LIMIT + " enquiries."));
      rows.forEach(function (r) {
        var card = el("article", "enq-item");
        var top = el("div", "enq-top");
        top.appendChild(el("h3", null, r.parent_name));
        top.appendChild(el("span", "chip", r.class_interest));
        card.appendChild(top);
        var a = el("a", "enq-phone", r.phone);
        a.href = "tel:" + String(r.phone).replace(/[^\d+]/g, "");
        card.appendChild(a);
        if (r.message) card.appendChild(el("p", "enq-msg", r.message));
        card.appendChild(el("div", "enq-date", fmtDate(r.created_at)));
        body.appendChild(card);
      });
    }).catch(function (e) { body.textContent = ""; handleErr(e, $("enqMsg")); });
  }

  /* ---------- Start ---------- */
  function boot() {
    if (!configured()) {
      goLogin("The website setup is not finished yet. Please contact your web developer.", "err");
      return;
    }
    loadSession();
    if (!session) { goLogin(""); return; }
    getToken().then(function (token) {
      return fetch(BASE + "/auth/v1/user", { headers: headers(token) });
    }).then(function (r) {
      if (!r.ok) throw authError();
      goApp();
    }).catch(function (e) {
      if (e instanceof TypeError) goLogin("There is no internet connection. Please check it and try again.", "err");
      else goLogin("");
    });
  }
  boot();
})();