/* SDD Mode site — recherche client-side sur index JSON statique (RGESN : ~15 kB, zéro service externe) */
(function () {
  "use strict";

  var input = document.getElementById("search-input");
  var resultsEl = document.getElementById("search-results");
  var statusEl = document.getElementById("search-status");
  if (!input || !resultsEl) return;

  var lang = document.documentElement.lang === "en" ? "en" : "fr";
  var MSG = {
    fr: {
      loading: "Chargement de l'index…",
      ready: "Index chargé — tapez au moins 2 caractères.",
      none: "Aucun résultat pour « {q} ».",
      count: "{n} résultat(s) pour « {q} ».",
      error: "Impossible de charger l'index de recherche. Servez le site via HTTP (ex. python3 -m http.server)."
    },
    en: {
      loading: "Loading index…",
      ready: "Index loaded — type at least 2 characters.",
      none: "No result for “{q}”.",
      count: "{n} result(s) for “{q}”.",
      error: "Could not load the search index. Serve the site over HTTP (e.g. python3 -m http.server)."
    }
  }[lang];

  var index = null;
  statusEl.textContent = MSG.loading;

  fetch("search-index.json")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      index = data;
      statusEl.textContent = MSG.ready;
      if (input.value) run(input.value);
    })
    .catch(function () { statusEl.textContent = MSG.error; });

  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function score(entry, terms) {
    var title = norm(entry.title), desc = norm(entry.desc);
    var s = 0, hits = [];
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i], found = false;
      if (title.indexOf(t) !== -1) { s += 10; found = true; }
      if (desc.indexOf(t) !== -1) { s += 4; found = true; }
      for (var j = 0; j < entry.sections.length; j++) {
        if (norm(entry.sections[j].t).indexOf(t) !== -1) {
          s += 2; found = true;
          if (hits.indexOf(entry.sections[j]) === -1) hits.push(entry.sections[j]);
        }
      }
      if (!found) return null; /* ET logique : tous les termes requis */
    }
    return { s: s, hits: hits.slice(0, 3) };
  }

  function run(q) {
    var query = q.trim();
    resultsEl.innerHTML = "";
    if (!index || norm(query).length < 2) {
      if (index) statusEl.textContent = MSG.ready;
      return;
    }
    var terms = norm(query).split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < index.length; i++) {
      var r = score(index[i], terms);
      if (r) out.push({ e: index[i], s: r.s, hits: r.hits });
    }
    out.sort(function (a, b) { return b.s - a.s; });

    statusEl.textContent = out.length
      ? MSG.count.replace("{n}", out.length).replace("{q}", query)
      : MSG.none.replace("{q}", query);

    out.slice(0, 30).forEach(function (r) {
      var li = document.createElement("li");
      li.className = "search-hit";
      var a = document.createElement("a");
      a.href = r.e.url;
      a.textContent = r.e.title;
      var p = document.createElement("p");
      p.textContent = r.e.desc;
      li.appendChild(a);
      li.appendChild(p);
      if (r.hits.length) {
        var ul = document.createElement("ul");
        r.hits.forEach(function (h) {
          var hl = document.createElement("li");
          var ha = document.createElement("a");
          ha.href = r.e.url + "#" + h.id;
          ha.textContent = h.t;
          hl.appendChild(ha);
          ul.appendChild(hl);
        });
        li.appendChild(ul);
      }
      resultsEl.appendChild(li);
    });
  }

  var timer = null;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { run(input.value); }, 150);
  });

  /* ?q= dans l'URL */
  try {
    var q = new URLSearchParams(location.search).get("q");
    if (q) { input.value = q; }
  } catch (_) {}
})();
