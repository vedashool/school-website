/* Shared header, footer and WhatsApp button.
   Edit once here and every page updates. */
(function () {
  var C = window.VEDA || {};
  var page = document.body.getAttribute("data-page") || "";

  var links = [
    { id: "home",      label: "Home",                    href: "index.html" },
    { id: "about",     label: "About Our School",        href: "about.html" },
    { id: "vision",    label: "Vision and Mission",      href: "about.html#vision-mission" },
    { id: "academics", label: "Academics",               href: "academics.html" },
    { id: "contact",   label: "Admissions",              href: "contact.html#admissions" },
    { id: "gallery",   label: "Gallery",                 href: "index.html#gallery" }
  ];

  var navItems = links.map(function (l) {
    var current = l.id === page ? ' aria-current="page" class="active"' : "";
    return '<li><a href="' + l.href + '"' + current + ">" + l.label + "</a></li>";
  }).join("");

  var header =
    '<header class="site-header" id="siteHeader">' +
      '<div class="container header-inner">' +
        '<a class="brand" href="index.html" aria-label="' + C.name + ' – Home">' +
          '<img src="assets/img/logo.png" alt="' + C.name + ' logo" width="44" height="44" onerror="this.style.display=\'none\'">' +
          '<span class="brand-text">' + C.shortName + "<small>English Medium School</small></span>" +
        "</a>" +
        '<nav class="main-nav" id="mainNav" aria-label="Main navigation"><ul>' + navItems + "</ul></nav>" +
        '<div class="header-actions">' +
          '<a class="btn btn-primary btn-sm" href="contact.html#admissions">Apply Now</a>' +
          '<button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="mainNav" aria-label="Open menu">' +
            "<span></span><span></span><span></span>" +
          "</button>" +
        "</div>" +
      "</div>" +
    "</header>";

  var mapsHref = (C.mapLat && C.mapLng)
    ? "https://www.google.com/maps?q=" + C.mapLat + "," + C.mapLng
    : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Kovvada, Andhra Pradesh 533006");

  var footerLinks = links.map(function (l) {
    return '<li><a href="' + l.href + '">' + l.label + "</a></li>";
  }).join("");

  var footer =
    '<footer class="site-footer">' +
      '<div class="container footer-grid">' +
        '<div class="footer-col">' +
          '<h3 class="footer-title">' + C.name + "</h3>" +
          "<p>Nursery to 10th class, English medium.</p>" +
        "</div>" +
        '<div class="footer-col">' +
          "<h4>Quick Links</h4>" +
          "<ul>" + footerLinks + "</ul>" +
        "</div>" +
        '<div class="footer-col">' +
          "<h4>Visit and Call</h4>" +
          "<p>" + C.address + "</p>" +
          '<p><a href="tel:' + C.phone + '">' + C.phoneDisplay + "</a></p>" +
          (C.email ? '<p><a href="mailto:' + C.email + '">' + C.email + "</a></p>" : "") +
        "</div>" +
        '<div class="footer-col">' +
          "<h4>School Timings</h4>" +
          "<p>" + C.timings + "</p>" +
          '<p><a href="' + mapsHref + '" target="_blank" rel="noopener">Find us on Google Maps</a></p>' +
        "</div>" +
      "</div>" +
      '<div class="container footer-map">' +
        "<h4>School Location</h4>" +
        '<div class="footer-map-frame">' +
          '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12581.594702515702!2d82.1842121554199!3d16.963809200000007!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a3787bd88c770a1%3A0xb11a7ed7e5c75bc1!2sVEDA%20ENGLISH%20MEDIUM%20SCHOOL!5e1!3m2!1sen!2sin!4v1795080458057!5m2!1sen!2sin" title="VEDA ENGLISH MEDIUM SCHOOL location on Google Maps" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
        "</div>" +
      "</div>" +
      '<div class="footer-bottom"><div class="container">' +
        "&copy; " + new Date().getFullYear() + " " + C.name + ". All rights reserved." +
      "</div></div>" +
    "</footer>";

  var wa =
    '<a class="wa-float" href="https://wa.me/' + C.whatsapp + "?text=" + encodeURIComponent(C.whatsappMessage) +
    '" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">' +
      '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">' +
        '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>' +
      "</svg>" +
    "</a>";

  var h = document.getElementById("site-header");
  var f = document.getElementById("site-footer");
  if (h) h.innerHTML = header;
  if (f) f.innerHTML = footer;
  document.body.insertAdjacentHTML("beforeend", wa);

  /* Mobile menu + header shadow */
  var hdr = document.getElementById("siteHeader");
  var toggle = document.getElementById("navToggle");
  if (!hdr || !toggle) return;

  function setOpen(open) {
    hdr.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  toggle.addEventListener("click", function () {
    setOpen(!hdr.classList.contains("nav-open"));
  });
  document.getElementById("mainNav").addEventListener("click", function (e) {
    if (e.target.tagName === "A") setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });
  function onScroll() { hdr.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();