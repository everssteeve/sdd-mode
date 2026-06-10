/* SDD Mode site — navigation accessible (RGAA) — zéro dépendance (RGESN) */
(function () {
  "use strict";

  /* Burger mobile */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* Dropdowns : clic + clavier (Échap referme), un seul ouvert à la fois */
  var menus = Array.prototype.slice.call(document.querySelectorAll(".site-nav li.has-menu"));

  function closeAll(except) {
    menus.forEach(function (li) {
      if (li !== except) {
        li.classList.remove("open");
        var b = li.querySelector("button.menu-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      }
    });
  }

  menus.forEach(function (li) {
    var btn = li.querySelector("button.menu-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var willOpen = !li.classList.contains("open");
      closeAll(li);
      li.classList.toggle("open", willOpen);
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll(null);
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".site-nav li.has-menu")) closeAll(null);
  });

  /* Mémorise la langue choisie pour la redirection de la racine */
  var langLink = document.querySelectorAll(".lang-switch a");
  Array.prototype.forEach.call(langLink, function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("sdd-lang", a.getAttribute("hreflang") || "fr"); } catch (_) {}
    });
  });
})();
