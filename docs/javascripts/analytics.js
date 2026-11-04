/*
 * Custom Google Analytics 4 events for openfrontend.org.
 *
 * Page views, search terms and instant-navigation page changes are already
 * reported by Material for MkDocs (extra.analytics in mkdocs.yml), and only
 * after the visitor accepts analytics cookies (extra.consent).
 *
 * This file adds click events for elements carrying data-ofe-event, e.g.
 *   <a href="..." data-ofe-event="contact_click">Contact NAG</a>
 * Events are queued on the dataLayer; if the visitor declined cookies the
 * gtag library never loads and the queue is simply never sent.
 */
(function () {
  window.dataLayer = window.dataLayer || [];
  // gtag.js requires an `arguments` object, not an array, so define the
  // standard shim rather than pushing arrays directly.
  function gtag() { window.dataLayer.push(arguments); }

  function bind(root) {
    root.querySelectorAll("[data-ofe-event]").forEach(function (el) {
      if (el.dataset.ofeBound) return;
      el.dataset.ofeBound = "1";
      el.addEventListener("click", function () {
        gtag("event", el.dataset.ofeEvent, {
          link_url: el.href || "",
          link_text: (el.textContent || "").trim(),
          page_path: location.pathname
        });
      });
    });
  }

  // Material exposes document$ and re-emits it after instant navigation.
  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(function () { bind(document); });
  } else {
    document.addEventListener("DOMContentLoaded", function () { bind(document); });
  }
})();
