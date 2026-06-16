/* shared.js — Mayflower Studios */
(function () {

  function injectBg() {
    if (document.querySelector('.bg-scene')) return;
    const s1 = document.createElement('div'); s1.className = 'bg-scene';
    const s2 = document.createElement('div'); s2.className = 'bg-glow';
    document.body.prepend(s2);
    document.body.prepend(s1);
  }

  function injectFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    const l = document.createElement('link'); l.rel = 'icon'; l.type = 'image/png'; l.href = '/assets/icons/favicon.png?v=2';
    const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = '/assets/icons/favicon.png?v=2';
    document.head.appendChild(l); document.head.appendChild(a);
  }

  function injectFireflies() {
    if (document.getElementById('fireflies')) return;
    const c = document.createElement('canvas'); c.id = 'fireflies';
    document.body.prepend(c);
  }

  function injectPetals() {
    if (document.getElementById('petals')) return;
    const c = document.createElement('canvas'); c.id = 'petals';
    document.body.prepend(c);
    startPetals(c);
  }

  function startPetals(canvas) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    let W, H, petals = [], DPR = 1;
    const COLORS = ['rgba(249,168,212,', 'rgba(251,207,232,', 'rgba(196,181,253,', 'rgba(253,242,248,'];
    function resize() {
      DPR = window.devicePixelRatio || 1; W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function Petal(initial) {
      this.x = Math.random() * W;
      this.y = initial ? Math.random() * H : -20;
      this.size = 2.5 + Math.random() * 4;
      this.vy = 0.22 + Math.random() * 0.42;
      this.vx = (Math.random() - .5) * .35;
      this.rot = Math.random() * Math.PI * 2;
      this.rs = (Math.random() - .5) * .011;
      this.swing = Math.random() * Math.PI * 2;
      this.ss = .008 + Math.random() * .012;
      this.sa = .4 + Math.random() * .8;
      this.a = .15 + Math.random() * .45;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    Petal.prototype.update = function () {
      this.swing += this.ss;
      this.x += this.vx + Math.sin(this.swing) * this.sa;
      this.y += this.vy; this.rot += this.rs;
      if (this.y > H + 30) { this.x = Math.random() * W; this.y = -20; }
    };
    Petal.prototype.draw = function () {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
      ctx.fillStyle = this.color + this.a + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, this.size, this.size * 1.7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    };
    function init() {
      petals = [];
      const n = Math.min(55, Math.floor(W / 30));
      for (let i = 0; i < n; i++) petals.push(new Petal(true));
    }
    let raf;
    function animate() {
      ctx.clearRect(0, 0, W, H);
      petals.forEach(p => { p.update(); p.draw(); });
      raf = requestAnimationFrame(animate);
    }
    resize(); init(); animate();
    window.addEventListener('resize', () => { resize(); init(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
      else if (!raf) animate();
    });
  }

  function buildNav() {
    // Normalize legacy data-nav values to the canonical six groups
    // Canonical sections. Aliases map section-specific data-nav values.
    const ALIAS = {
      'together-room': 'together',
      'watch': 'together',
      'watch-together': 'together',
      'server': 'together',
      'sakari': 'stories',
    };
    const raw = document.body.dataset.nav || '';
    const key = ALIAS[raw] || raw;
    const links = [
      { href: '/',              label: 'Home',     key: 'home'     },
      { href: '/together.html', label: 'Together', key: 'together' },
      { href: '/sakari.html',   label: 'Stories',  key: 'stories'  },
    ];
    const linksHtml = links.map(l =>
      `<a href="${l.href}"${l.key === key ? ' class="nav-active"' : ''}>${l.label}</a>`
    ).join('');
    return `<nav class="site-nav">
        <div class="nav-inner">
          <a href="/" class="nav-brand">
            <strong>Mayflower Studios</strong>
          </a>
          <button class="nav-mob-btn" id="navToggle" aria-label="Menu">☰</button>
          <div class="nav-links" id="navLinks">
            ${linksHtml}
            <a href="/account.html" class="nav-account" id="navAccount" data-nav="account">Sign in</a>
          </div>
        </div>
      </nav>`;
  }

  function buildFooter() {
    return `<footer class="site-footer">
        <span class="footer-brand">Mayflower Studios</span>
        <div class="footer-links">
          <a href="/together.html">Together</a>
          <a href="/sakari.html">Stories</a>
          <a href="https://ko-fi.com/mayflowerstudiosteam" target="_blank" rel="noopener">Support ↗</a>
          <a href="/privacy.html">Privacy</a>
          <a href="/tos.html">Terms</a>
        </div>
        <p class="footer-copy">© <span class="footer-year"></span> Mayflower Studios — made with 🌸 and fireflies</p>
      </footer>`;
  }

  /* Supports both new (#site-nav) and legacy (#shared-nav) selectors */
  function injectNav() {
    const html = buildNav();
    ['#site-nav', '#shared-nav'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    });
    const toggle = document.getElementById('navToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.getElementById('navLinks').classList.toggle('open');
      });
    }
  }

  function injectFooter() {
    const html = buildFooter();
    ['#site-footer', '#shared-footer'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    });
    document.querySelectorAll('.footer-year').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  }

  function initReveal() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.07 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  function loadFireflies() {
    // Only load if not already loaded by a <script src> tag on the page
    if (window._firefliesLoaded) return;
    window._firefliesLoaded = true;
    const s = document.createElement('script');
    s.src = '/fireflies.js';
    document.body.appendChild(s);
  }

  // Bump this whenever auth.js / chat.js / profile-view.js change, so browsers
  // and the GitHub Pages CDN fetch the new version instead of a cached copy.
  var MF_ASSET_VER = '8';

  function loadScript(src, attrs) {
    if (document.querySelector(`script[data-mf-src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src + (src.indexOf('?') === -1 ? '?v=' : '&v=') + MF_ASSET_VER;
    s.setAttribute('data-mf-src', src);
    if (attrs) Object.keys(attrs).forEach(k => s.setAttribute(k, attrs[k]));
    document.body.appendChild(s);
  }

  function loadAuthAndChat() {
    // auth.js defines window.MFAuth (universal identity).
    if (!window.MFAuth) loadScript('/auth.js', { 'data-mf-auth': '1' });
    // profile-view.js defines window.MFProfile (public profile overlay).
    loadScript('/profile-view.js', { 'data-mf-profile': '1' });
    // chat.js injects the universal floating chat once MFAuth is ready.
    loadScript('/chat.js', { 'data-mf-chat': '1' });
  }

  function initAccountNav() {
    function whenAuth(cb) {
      if (window.MFAuth) return cb();
      let n = 0;
      const iv = setInterval(() => {
        if (window.MFAuth) { clearInterval(iv); cb(); }
        else if (++n > 80) clearInterval(iv);
      }, 80);
    }
    whenAuth(() => {
      if (!MFAuth.isConfigured()) return;
      MFAuth.onChange((user) => {
        const el = document.getElementById('navAccount');
        if (!el) return;
        if (user) {
          const name = MFAuth.name() || 'Account';
          el.textContent = '👤 ' + name;
          el.classList.add('nav-signed-in');
        } else {
          el.textContent = 'Sign in';
          el.classList.remove('nav-signed-in');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectFavicon();
    injectBg();
    injectFireflies();
    injectPetals();
    injectNav();
    injectFooter();
    initReveal();
    loadFireflies();
    loadAuthAndChat();
    initAccountNav();
  });

})();