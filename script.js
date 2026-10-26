// Theme toggle
const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;

function getPreferredTheme() {
  const stored = localStorage.getItem('bedrock-theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  try { localStorage.setItem('bedrock-theme', theme); } catch (e) { /* private browsing */ }
}

setTheme(getPreferredTheme());

themeToggle.addEventListener('click', () => {
  const current = root.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// Category filter
const categoryButtons = document.querySelectorAll('.category');
categoryButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryButtons.forEach(b => b.classList.remove('category--active'));
    btn.classList.add('category--active');
  });
});

// Search — ready for when games are added
const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  const cards = document.querySelectorAll('.game-card');
  const empty = document.getElementById('emptyState');

  let visible = 0;
  cards.forEach(card => {
    const title = card.dataset.title || '';
    const match = !query || title.toLowerCase().includes(query);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  if (empty) {
    empty.style.display = (cards.length === 0 || visible === 0) ? '' : 'none';
  }
});

// Smooth nav background on scroll
const nav = document.querySelector('.nav');
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      nav.style.borderBottomColor = window.scrollY > 20
        ? 'var(--border)'
        : 'transparent';
      ticking = false;
    });
    ticking = true;
  }
});

// Intersection Observer for scroll animations
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.feature, .category, .empty-state').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});
