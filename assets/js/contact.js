/* ==========================================================
   CONTACT PAGE: contact details.
   ========================================================== */
(function () {
  "use strict";

  var C = window.VEDA || {};
  var $ = function (id) { return document.getElementById(id); };

  function fillDetails() {
    var address = $("cAddress");
    if (address) address.textContent = C.address || "";

    var phone = $("cPhone");
    if (phone) {
      phone.textContent = C.phoneDisplay || "";
      phone.href = "tel:" + (C.phone || "");
    }

    var emailRow = $("cEmailRow"), email = $("cEmail");
    if (emailRow && email) {
      if (C.email) {
        email.textContent = C.email;
        email.href = "mailto:" + C.email;
        emailRow.hidden = false;
      } else {
        emailRow.hidden = true;
      }
    }

    var timings = $("cTimings");
    if (timings) timings.textContent = C.timings || "";

    var daysRow = $("cDaysRow"), days = $("cDays");
    if (daysRow && days) {
      if (C.openDays) {
        days.textContent = C.openDays;
        daysRow.hidden = false;
      } else {
        daysRow.hidden = true;
      }
    }
  }

  fillDetails();
})();
