/* Explainer animé — lecteur de scènes (accueil FR/EN).
   Amélioration progressive : sans JS, ou si l'utilisateur préfère réduire
   les animations, les scènes restent affichées en liste statique.
   Lecture uniquement à l'initiative de l'utilisateur, pausable (WCAG 2.2.2). */
(function () {
  var root = document.querySelector("[data-explainer]");
  if (!root) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var scenes = root.querySelectorAll(".scene");
  var controls = root.querySelector(".explainer-controls");
  var playBtn = root.querySelector(".explainer-play");
  var prevBtn = root.querySelector(".explainer-prev");
  var nextBtn = root.querySelector(".explainer-next");
  var status = root.querySelector(".explainer-status");
  var bar = root.querySelector(".explainer-progress span");
  if (!scenes.length || !controls || !playBtn) return;

  var L = {
    play: root.getAttribute("data-label-play") || "Lecture",
    pause: root.getAttribute("data-label-pause") || "Pause",
    replay: root.getAttribute("data-label-replay") || "Revoir",
    status: root.getAttribute("data-label-status") || "Scène {n} sur {t}"
  };

  var durations = Array.prototype.map.call(scenes, function (s) {
    return (parseFloat(s.getAttribute("data-duration")) || 12) * 1000;
  });
  var total = durations.reduce(function (a, b) { return a + b; }, 0);
  var current = 0;
  var elapsed = 0;       // temps écoulé dans la scène courante (ms)
  var playing = false;
  var last = 0;
  var raf = 0;

  function offset(i) {
    var o = 0;
    for (var k = 0; k < i; k++) o += durations[k];
    return o;
  }

  function render() {
    Array.prototype.forEach.call(scenes, function (s, i) {
      s.classList.toggle("is-active", i === current);
    });
    var title = scenes[current].getAttribute("data-title") || "";
    status.textContent = L.status.replace("{n}", current + 1).replace("{t}", scenes.length) + (title ? " — " + title : "");
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === scenes.length - 1;
    progress();
  }

  function progress() {
    if (bar) bar.style.width = ((offset(current) + elapsed) / total * 100).toFixed(2) + "%";
  }

  function restartAnimations() {
    // Relance les animations CSS de la scène active.
    var s = scenes[current];
    s.classList.remove("is-active");
    void s.offsetWidth;
    s.classList.add("is-active");
  }

  function tick(now) {
    if (!playing) return;
    elapsed += now - last;
    last = now;
    if (elapsed >= durations[current]) {
      if (current === scenes.length - 1) {
        elapsed = durations[current];
        stop(true);
        return;
      }
      current += 1;
      elapsed = 0;
      render();
    } else {
      progress();
    }
    raf = window.requestAnimationFrame(tick);
  }

  function start() {
    if (current === scenes.length - 1 && elapsed >= durations[current]) {
      current = 0;
      elapsed = 0;
      render();
    }
    playing = true;
    root.classList.add("is-playing");
    playBtn.textContent = L.pause;
    playBtn.setAttribute("aria-pressed", "true");
    restartAnimations();
    last = window.performance.now();
    raf = window.requestAnimationFrame(tick);
  }

  function stop(ended) {
    playing = false;
    window.cancelAnimationFrame(raf);
    root.classList.remove("is-playing");
    playBtn.textContent = ended ? L.replay : L.play;
    playBtn.setAttribute("aria-pressed", "false");
  }

  function go(i) {
    current = Math.max(0, Math.min(scenes.length - 1, i));
    elapsed = 0;
    render();
    if (playing) restartAnimations();
  }

  playBtn.addEventListener("click", function () { playing ? stop(false) : start(); });
  prevBtn.addEventListener("click", function () { go(current - 1); });
  nextBtn.addEventListener("click", function () { go(current + 1); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && playing) stop(false);
  });

  root.classList.add("is-player");
  controls.hidden = false;
  render();
})();
