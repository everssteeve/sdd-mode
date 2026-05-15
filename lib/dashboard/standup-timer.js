// AIAD SDD Mode — Dashboard : stand-up timer PM (#472).
//
// Widget countdown 15 min (paramétrable) pour cadrer le rituel daily
// standup directement depuis pm.html. Click "Démarrer" → décompte
// affiché en cadran, notification Web Notification API à 0 s. Permet
// au PM de mener le standup sans basculer vers une autre app.
//
// Purement client-side (CSS + script). Pas de serveur, pas de stockage
// long terme. Cache `notification permission` au 1er click.
//
// Aucun effet de bord serveur. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

const TIMER_CSS = `<style>
.pm-standup {
  display: grid; grid-template-columns: auto 1fr auto;
  gap: 1rem; align-items: center;
  padding: .8rem 1rem; margin: .5rem 0;
  border: 1px solid var(--border, #ddd); border-radius: .5rem;
  background: var(--card-bg, #fff);
}
.pm-standup.is-running { border-color: #4c6ef5; background: rgba(76,110,245,.04); }
.pm-standup.is-done { border-color: #c92a2a; background: rgba(201,42,42,.04); animation: pmstandupPulse 1.2s ease-in-out infinite; }
@keyframes pmstandupPulse {
  0%, 100% { background: rgba(201,42,42,.04); }
  50% { background: rgba(201,42,42,.18); }
}
.pm-standup-clock {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 2rem; font-weight: 700; letter-spacing: -.04em;
  font-variant-numeric: tabular-nums;
  min-width: 7ch; text-align: center;
}
.pm-standup-info { font-size: .85rem; }
.pm-standup-info-titre { font-weight: 600; }
.pm-standup-info-meta { color: var(--muted, #777); font-size: .75rem; }
.pm-standup-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
.pm-standup-btn {
  padding: .35rem .7rem; border-radius: .25rem; border: 0;
  cursor: pointer; font-size: .82rem; font-weight: 500;
}
.pm-standup-btn.primary { background: var(--accent, #4c6ef5); color: #fff; }
.pm-standup-btn.danger { background: #c92a2a; color: #fff; }
.pm-standup-btn.secondary { background: transparent; color: inherit; border: 1px solid var(--border, #ccc); }
.pm-standup-btn:hover { filter: brightness(1.1); }
.pm-standup-presets { display: flex; gap: .25rem; }
.pm-standup-preset {
  padding: .2rem .45rem; background: transparent;
  border: 1px solid var(--border, #ccc); border-radius: .2rem;
  cursor: pointer; font-size: .7rem; color: inherit;
}
.pm-standup-preset.active { background: var(--accent, #4c6ef5); color: #fff; border-color: var(--accent, #4c6ef5); }
@media print { .pm-standup { display: none !important; } }
</style>`;

const TIMER_SCRIPT = `<script>
(function () {
  function init() {
    var clock = document.getElementById('pm-standup-clock');
    var card = document.getElementById('pm-standup-card');
    var btnStart = document.getElementById('pm-standup-start');
    var btnReset = document.getElementById('pm-standup-reset');
    var btnNotify = document.getElementById('pm-standup-notify');
    if (!clock || !card) return;
    var DEFAULT_MIN = 15;
    var remaining = DEFAULT_MIN * 60; // secondes
    var intervalId = null;
    var notifyEnabled = false;
    function format(s) {
      var m = Math.floor(Math.abs(s) / 60);
      var ss = Math.abs(s) % 60;
      var sign = s < 0 ? '-' : '';
      return sign + m + ':' + (ss < 10 ? '0' + ss : ss);
    }
    function render() {
      clock.textContent = format(remaining);
      card.classList.remove('is-running', 'is-done');
      if (intervalId) {
        if (remaining <= 0) card.classList.add('is-done');
        else card.classList.add('is-running');
      }
    }
    function tick() {
      remaining -= 1;
      render();
      if (remaining === 0) {
        try {
          if (notifyEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Stand-up terminé', { body: 'Le timer 15 min est écoulé.' });
          }
        } catch (e) { /* ignore */ }
        try {
          // Beep audio (data URI minimaliste WAV)
          var audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
          audio.play().catch(function () { /* autoplay bloqué */ });
        } catch (e) { /* ignore */ }
      }
    }
    function start() {
      if (intervalId) return;
      intervalId = setInterval(tick, 1000);
      btnStart.textContent = 'Pause';
      render();
    }
    function pause() {
      clearInterval(intervalId);
      intervalId = null;
      btnStart.textContent = 'Reprendre';
      render();
    }
    function reset() {
      pause();
      var minutes = parseInt(document.querySelector('.pm-standup-preset.active')?.getAttribute('data-min') || DEFAULT_MIN, 10);
      remaining = minutes * 60;
      btnStart.textContent = 'Démarrer';
      render();
    }
    btnStart.addEventListener('click', function () {
      if (intervalId) pause();
      else start();
    });
    btnReset.addEventListener('click', reset);
    if (btnNotify) btnNotify.addEventListener('click', function () {
      if (!('Notification' in window)) return;
      Notification.requestPermission().then(function (perm) {
        notifyEnabled = perm === 'granted';
        btnNotify.textContent = notifyEnabled ? '🔔 Notifications ON' : '🔕 Refusé';
      });
    });
    // Presets
    document.querySelectorAll('.pm-standup-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.pm-standup-preset').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        if (!intervalId) reset();
      });
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocStandupTimer() {
  return `${TIMER_CSS}<section>
    <h2>Stand-up timer <span class="count">rituel daily PM/PE</span></h2>
    <p class="muted" style="font-size:.85rem">Décompte pour cadrer le rituel standup. Presets 10 / 15 / 30 min. Notification Web à 0 s (avec accord navigateur).</p>
    <div class="pm-standup" id="pm-standup-card" role="timer" aria-label="Stand-up timer">
      <div class="pm-standup-clock" id="pm-standup-clock">15:00</div>
      <div class="pm-standup-info">
        <div class="pm-standup-info-titre">Daily standup</div>
        <div class="pm-standup-info-meta">État de l'équipe · blockers · intentions du jour</div>
        <div class="pm-standup-presets" role="radiogroup" aria-label="Durée">
          <button type="button" class="pm-standup-preset" data-min="10" role="radio" aria-checked="false">10 min</button>
          <button type="button" class="pm-standup-preset active" data-min="15" role="radio" aria-checked="true">15 min</button>
          <button type="button" class="pm-standup-preset" data-min="30" role="radio" aria-checked="false">30 min</button>
        </div>
      </div>
      <div class="pm-standup-actions">
        <button type="button" class="pm-standup-btn primary" id="pm-standup-start">Démarrer</button>
        <button type="button" class="pm-standup-btn secondary" id="pm-standup-reset">Reset</button>
        <button type="button" class="pm-standup-btn secondary" id="pm-standup-notify">🔔 Activer notif</button>
      </div>
    </div>
  </section>${TIMER_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  blocStandupTimer as standupTimerSection,
};
