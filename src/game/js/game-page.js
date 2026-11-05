(function () {
  const body = document.body;
  const slug = body.dataset.game;
  const name = body.dataset.gameName || 'Game';
  const tagline = body.dataset.gameTagline || '';
  const controlsHint = body.dataset.gameControls || '';
  if (!slug) return;
  const createGame = window.UGG_GAMES && window.UGG_GAMES[slug];
  if (createGame && window.UGG_initGame) {
    window.UGG_initGame({ slug, name, tagline, controlsHint, createGame });
    window.__UGG_GAME_READY__ = true;
    return;
  }
  window.__UGG_GAME_READY__ = false;
  const overlay = document.getElementById('gameOverlay');
  const title = document.getElementById('overlayTitle');
  const text = document.getElementById('overlayText');
  const button = document.getElementById('overlayBtn');
  if (overlay) overlay.classList.add('is-visible');
  if (title) title.textContent = 'Game failed to load';
  if (text) text.textContent = 'Refresh the page to try again.';
  if (button) { button.textContent = 'Refresh'; button.addEventListener('click', () => location.reload()); }
})();
