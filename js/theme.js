(function () {
  "use strict";

  var body = document.body;
  var apiBase = (body.dataset.apiBase || "").replace(/\/$/, "");
  var calendarUrl = body.dataset.meetingUrl || "";
  var pageVariant = body.dataset.pageVariant || "portal-audit";
  var previewMode = body.dataset.preview === "true";
  var sharePreview = body.dataset.sharePreview === "true";
  var oauthDialog = document.getElementById("bp-oauth-dialog");
  var manualDialog = document.getElementById("bp-manual-dialog");
  var lastTrigger = null;
  var manualBookingContext = {email:"", firstName:"", company:""};

  document.documentElement.classList.add("bp-js");

  function uuid() {
    return window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : "bp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function funnelId() {
    var current = window.sessionStorage.getItem("bp_funnel_id");
    if (current) return current;
    current = uuid();
    window.sessionStorage.setItem("bp_funnel_id", current);
    return current;
  }

  function attribution() {
    var params = new URLSearchParams(window.location.search);
    return {
      funnel_id: funnelId(), landing_variant: pageVariant,
      utm_source: params.get("utm_source"), utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"), utm_term: params.get("utm_term"),
      utm_content: params.get("utm_content"), gclid: params.get("gclid"),
      gbraid: params.get("gbraid"), wbraid: params.get("wbraid")
    };
  }

  function track(name, detail) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({event:"bp_growth_gap",funnel_event:name,funnel_id:funnelId(),landing_variant:pageVariant}, detail || {}));
    if (!previewMode && apiBase && (name === "landing_view" || name === "primary_cta_click" || name === "hubspot_connect_clicked")) {
      fetch(apiBase + "/v1/events/anonymous", {method:"POST",credentials:"omit",keepalive:true,headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name,attribution:attribution()})}).catch(function () {});
    }
  }

  function adUserDataConsent() {
    return window.__bpAdUserDataConsent === "GRANTED" ? "GRANTED" : "DENIED";
  }

  function safeUrl(candidate) {
    try {
      var parsed = new URL(candidate, window.location.origin);
      if (parsed.protocol === "https:") return parsed.href;
    } catch (error) {}
    return "";
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function setError(form, message) {
    var error = form && form.querySelector("[data-bp-form-error]");
    if (error) error.textContent = message || "";
  }

  function valid(form) {
    var first = null;
    form.querySelectorAll("[required]").forEach(function (field) {
      var invalid = !field.validity.valid;
      if (invalid) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
      if (invalid && !first) first = field;
    });
    if (first) first.focus();
    return !first;
  }

  function openDialog(dialog, trigger) {
    if (!dialog) return;
    lastTrigger = trigger || document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }

  document.querySelectorAll("[data-bp-dialog-close]").forEach(function (button) {
    button.addEventListener("click", function () { closeDialog(button.closest("dialog")); });
  });
  document.querySelectorAll("dialog").forEach(function (dialog) {
    dialog.addEventListener("click", function (event) { if (event.target === dialog) closeDialog(dialog); });
    dialog.addEventListener("cancel", function (event) { event.preventDefault(); closeDialog(dialog); });
    dialog.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusable = Array.from(dialog.querySelectorAll("button:not([disabled]):not([hidden]),input:not([disabled]):not([hidden]),textarea:not([disabled]):not([hidden]),select:not([disabled]):not([hidden]),a[href],iframe")).filter(function (item) { return item.offsetParent !== null; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  });

  function calendarWithKnownValues() {
    var target = safeUrl(calendarUrl);
    if (!target) return "";
    try {
      var parsed = new URL(target);
      parsed.searchParams.set("embed", "true");
      if (manualBookingContext.email) parsed.searchParams.set("email", manualBookingContext.email);
      if (manualBookingContext.firstName) parsed.searchParams.set("firstname", manualBookingContext.firstName);
      if (manualBookingContext.company) parsed.searchParams.set("company", manualBookingContext.company);
      return parsed.href;
    } catch (error) { return ""; }
  }

  function loadCalendar() {
    if (!manualDialog) return;
    var calendar = manualDialog.querySelector("[data-bp-calendar]");
    var frame = calendar && calendar.querySelector("iframe");
    var target = calendarWithKnownValues();
    if (!calendar || !frame || !target) return;
    frame.src = target;
    calendar.hidden = false;
    track("calendar_viewed", {placement:"manual-calendar"});
  }

  function revealManualRoute(payload, trigger, capturedEmail) {
    if (payload && payload.calendar_url) calendarUrl = payload.calendar_url;
    manualBookingContext = {email:capturedEmail || "",firstName:"",company:""};
    openDialog(manualDialog, trigger);
    var details = manualDialog && manualDialog.querySelector("[data-bp-step=details]");
    var complete = manualDialog && manualDialog.querySelector("[data-bp-step=complete]");
    var calendar = manualDialog && manualDialog.querySelector("[data-bp-calendar]");
    var frame = calendar && calendar.querySelector("iframe");
    var captured = manualDialog && manualDialog.querySelector("[data-bp-captured-email]");
    if (details) details.hidden = false;
    if (complete) complete.hidden = true;
    if (calendar) calendar.hidden = true;
    if (frame) frame.removeAttribute("src");
    if (captured) captured.value = manualBookingContext.email;
    var heading = manualDialog && manualDialog.querySelector("#manual-title");
    if (heading) window.setTimeout(function () { heading.focus(); }, 40);
  }

  document.querySelectorAll("[data-bp-hero-email]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = form.querySelector("button[type=submit]");
      if (!valid(form)) { setError(form, "Enter a valid email address."); return; }
      setError(form, "");
      setBusy(button, true);
      var payload = {email:form.elements.email.value.trim(),attribution:attribution(),privacy_notice_presented:true,ad_user_data_consent:adUserDataConsent()};
      var done = function (response) { setBusy(button, false); track("manual_email_submitted"); revealManualRoute(response, button, payload.email); };
      if (previewMode) { window.setTimeout(function () { done({calendar_url:calendarUrl}); }, 250); return; }
      fetch(apiBase + "/v1/manual-leads", {method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload)})
        .then(function (response) { if (!response.ok) throw new Error("manual_lead_failed"); return response.json(); })
        .then(done)
        .catch(function () { setBusy(button, false); setError(form, "We could not save your request. Please try again."); });
    });
  });

  function showConnectError(button, message) {
    var route = button.closest(".bp-connect-route");
    var status = route && route.querySelector(".bp-connect-status");
    if (!status && route) {
      status = document.createElement("p");
      status.className = "bp-form-error bp-connect-status";
      status.setAttribute("role", "alert");
      route.appendChild(status);
    }
    if (status) status.textContent = message;
  }

  function startLocalAudit(button) {
    setBusy(button, true);
    showConnectError(button, "");
    fetch(apiBase + "/v1/test-audits/big-presence", {method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({attribution:attribution()})})
      .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.detail || "scan_failed"); return data; }); })
      .then(function (payload) {
        var target = safeUrl(payload.report_url || payload.url || (apiBase + "/report/embed"));
        if (!target) throw new Error("The report address was not returned.");
        window.location.assign(target);
      })
      .catch(function (error) {
        setBusy(button, false);
        showConnectError(button, error.message === "scan_failed" ? "The local scan could not start. Add the Big Presence test token to the API environment and try again." : error.message);
      });
  }

  document.querySelectorAll("[data-bp-open-oauth]").forEach(function (button) {
    button.addEventListener("click", function () {
      track("hubspot_connect_clicked");
      track("primary_cta_click");
      if (sharePreview) { openDialog(oauthDialog, button); return; }
      if (previewMode) startLocalAudit(button);
      else openDialog(oauthDialog, button);
    });
  });

  var oauthForm = document.querySelector("[data-bp-oauth-form]");
  if (oauthForm) oauthForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var button = oauthForm.querySelector("button[type=submit]");
    if (!valid(oauthForm)) { setError(oauthForm, "Confirm that you are authorised to connect this account."); return; }
    if (sharePreview) {
      setError(oauthForm, "The secure HubSpot connection is disabled in this public feedback preview.");
      return;
    }
    setBusy(button, true);
    fetch(apiBase + "/v1/audit-sessions", {method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({attribution:attribution(),authority_acknowledged:true,ad_user_data_consent:adUserDataConsent()})})
      .then(function (response) { if (!response.ok) throw new Error("oauth_failed"); return response.json(); })
      .then(function (payload) { var target = safeUrl(payload.oauth_url || payload.oauth_start_url); if (!target) throw new Error("oauth_failed"); window.location.assign(target); })
      .catch(function () { setBusy(button, false); setError(oauthForm, "We could not start the HubSpot connection. Please try again."); });
  });

  var detailForm = document.querySelector("[data-bp-manual-details]");
  if (detailForm) detailForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var button = detailForm.querySelector("button[type=submit]");
    var payload = Object.fromEntries(new FormData(detailForm).entries());
    var complete = manualDialog && manualDialog.querySelector("[data-bp-step=complete]");
    var done = function () {
      setBusy(button, false);
      manualBookingContext.firstName = payload.first_name || "";
      manualBookingContext.company = payload.company || "";
      detailForm.closest("[data-bp-step=details]").hidden = true;
      if (complete) complete.hidden = false;
      loadCalendar();
      var heading = manualDialog && manualDialog.querySelector("#manual-calendar-title");
      if (heading) window.setTimeout(function () { heading.focus(); }, 40);
    };
    setBusy(button, true);
    if (!valid(detailForm)) { setBusy(button, false); setError(detailForm, "Complete the required fields."); return; }
    if (previewMode) { window.setTimeout(done, 200); return; }
    fetch(apiBase + "/v1/manual-leads/current", {method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
      .then(function (response) { if (!response.ok) throw new Error("details_failed"); done(); })
      .catch(function () { setBusy(button, false); setError(detailForm, "We could not save these details. Please try again."); });
  });

  document.querySelectorAll("form [required]").forEach(function (field) {
    ["input", "change"].forEach(function (name) { field.addEventListener(name, function () { if (field.validity.valid) field.removeAttribute("aria-invalid"); }); });
  });

  track("landing_view");
}());
