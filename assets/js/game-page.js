import { initGame } from './game-shell.js';

const body = document.body;
const slug = body.dataset.game;
const name = body.dataset.gameName || 'Game';
const tagline = body.dataset.gameTagline || '';
const controlsHint = body.dataset.gameControls || '';

if (slug) {
  import(`./games/${slug}.js`)
    .then((module) => {
      initGame({ slug, name, tagline, controlsHint, createGame: module.default });
      window.__UGG_GAME_READY__ = true;
    })
    .catch((error) => {
      console.error('Game module failed to load:', error);
      window.__UGG_GAME_READY__ = false;
      const overlay = document.getElementById('gameOverlay');
      const title = document.getElementById('overlayTitle');
      const text = document.getElementById('overlayText');
      const button = document.getElementById('overlayBtn');
      if (overlay) overlay.classList.add('is-visible');
      if (title) title.textContent = 'Game failed to load';
      if (text) text.textContent = 'Check your connection and refresh the page to try again.';
      if (button) button.textContent = 'Refresh';
      button?.addEventListener('click', () => location.reload());
    });
}
