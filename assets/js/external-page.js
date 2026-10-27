/* Wrapper for third-party HTML5 games. The iframe only loads after Play.
   A non-blocking warning appears if the external game stays on its own
   loading screen, with Reload, New tab and local fallback actions. */
(() => {
  const frame = document.getElementById('externalFrame');
  const cover = document.getElementById('externalCover');
  const stage = document.getElementById('externalStage');
  const status = document.getElementById('externalStatus');
  const stuck = document.getElementById('externalStuck');
  if (!frame || !cover || !stage) return;

  const src = frame.dataset.src;
  let loaded = false;
  let stuckTimer = null;

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function showStuck() {
    if (stuck) stuck.hidden = false;
  }

  function armStuckTimer() {
    if (stuckTimer) clearTimeout(stuckTimer);
    stuckTimer = setTimeout(showStuck, 12000);
  }

  function load() {
    if (!src) {
      setStatus('This game has no external host. Use the local fallback below.');
      showStuck();
      return;
    }
    loaded = true;
    cover.classList.add('is-hidden');
    setStatus('Loading game…');
    frame.src = src;
    armStuckTimer();
  }

  frame.addEventListener('load', () => {
    if (!frame.src) return;
    setStatus('Game frame loaded. If it stays on its own loading screen, use Reload, New tab or the fallback.');
    armStuckTimer();
  });

  document.querySelectorAll('[data-external-play]').forEach((button) => {
    button.addEventListener('click', load);
  });

  document.querySelectorAll('[data-external-reload]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!loaded) {
        load();
        return;
      }
      setStatus('Reloading…');
      frame.src = src;
      armStuckTimer();
    });
  });

  document.querySelectorAll('[data-external-fullscreen]').forEach((button) => {
    button.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
        return;
      }
      stage.requestFullscreen?.().catch(() => stage.classList.toggle('is-expanded'));
    });
  });

  document.querySelector('[data-external-dismiss]')?.addEventListener('click', () => {
    if (stuck) stuck.hidden = true;
  });

  document.addEventListener('fullscreenchange', () => {
    document.querySelectorAll('[data-external-fullscreen]').forEach((button) => {
      button.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    });
  });

  if (!src) {
    setStatus('No external game URL is configured. Use the fallback below.');
    showStuck();
  }
})();
