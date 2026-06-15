// Guard against running twice. This file is referenced both by a direct
// <script src="fireflies.js"> tag on some pages AND injected by shared.js's
// loadFireflies(). Running twice in the same global scope previously threw
// "Identifier 'canvas' has already been declared", a fatal SyntaxError that
// aborted other scripts on the page. The IIFE keeps canvas/ctx local, and the
// flag makes a second load a harmless no-op.
if (window._firefliesLoaded) {
  // already initialized — do nothing
} else {
  window._firefliesLoaded = true;
(function () {
const canvas = document.getElementById("fireflies");
if (!canvas) {
  console.warn("Fireflies canvas not found!");
} else {
  const ctx = canvas.getContext("2d", { alpha: true });

  let fireflies = [];
  let anchors = [];
  let DPR = window.devicePixelRatio || 1;
  let width = 0, height = 0;
  let rafId = null;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Mouse “magic” (soft attraction)
  const mouse = { x: 0, y: 0, active: false };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener("mouseleave", () => (mouse.active = false));

  function getMaxFireflies() {
    // Far fewer on phones: each firefly draws a radial-gradient halo with
    // additive blending every frame, which is heavy on mobile GPUs and a real
    // battery cost. Cap low on small/touch screens, normal on desktop.
    const w = window.innerWidth;
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (coarse || w < 700) return Math.min(28, Math.floor(w / 26));
    return Math.min(85, Math.floor(w / 16));
  }

  // On phones the device-pixel-ratio is often 2.5–3×, which means the canvas
  // is enormous and every gradient fill covers 6–9× the pixels. Cap the DPR we
  // render at to keep fill cost sane without looking blurry.
  function effectiveDPR() {
    const real = window.devicePixelRatio || 1;
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return coarse ? Math.min(real, 1.5) : Math.min(real, 2);
  }

  // Warm firefly colors
  const colors = [
    [251, 191, 36], // gold
    [253, 224, 71], // soft yellow
    [252, 211, 77], // dim amber
  ];

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  function resize() {
    DPR = effectiveDPR();
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function makeAnchors() {
    // A few invisible “glades” they tend to orbit around
    const count = Math.max(3, Math.min(7, Math.floor(width / 420)));
    anchors = [];
    for (let i = 0; i < count; i++) {
      anchors.push({
        x: rand(width * 0.15, width * 0.85),
        y: rand(height * 0.15, height * 0.85),
        // anchors drift slightly (forest breathing)
        ax: rand(-0.02, 0.02),
        ay: rand(-0.015, 0.015),
      });
    }
  }

  function pickAnchor() {
    return anchors[Math.floor(Math.random() * anchors.length)];
  }

  class Firefly {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = Math.random() * height;

      // Softer magical glows
      this.r = rand(0.9, 2.2);            // core
      this.halo = this.r * rand(10, 18);  // halo

      // Gentle float movement
      this.ang = rand(0, Math.PI * 2);
      this.vx = rand(-0.06, 0.06);
      this.vy = rand(-0.05, 0.05);

      // Wandering personality
      this.turn = rand(0.002, 0.008);     // curvy
      this.maxSpeed = rand(0.18, 0.42);   // slow magical float
      this.drag = rand(0.987, 0.995);

      // Spiral drift (occasional)
      this.spiralT = rand(0, 10);
      this.spiralRate = rand(0.25, 0.65);
      this.spiralAmp = rand(0.004, 0.02);

      // Anchor “glade” attraction
      this.anchor = pickAnchor();
      this.anchorPull = rand(0.004, 0.014);

      // ---- "Most firefly" blink settings (slower + rarer + softer) ----
      this.blinkT = rand(0, 1);
      this.blinkLen = rand(4.5, 9.0);   // slower cycles
      this.onFrac = rand(0.04, 0.09);   // shorter pulses
      this.base = rand(0.01, 0.05);     // dim minimum glow
      this.peak = rand(0.55, 0.90);     // peak brightness

      // Extra “rest” bias: some stay dark longer (more natural)
      this.restBias = rand(0.0, 0.35);

      // Rare sparkle bloom
      this.bloomCooldown = rand(2.0, 8.0);
      this.bloom = 0;

      // Color
      this.rgb = colors[Math.floor(Math.random() * colors.length)];

      // Spawn fade in
      this.spawn = initial ? Math.random() : 0;
      this.spawnRate = rand(0.006, 0.016);

      // When to re-pick anchor
      this.reanchor = rand(6, 16);
    }

    blinkAlpha(dt) {
      this.blinkT += dt;
      if (this.blinkT >= this.blinkLen) this.blinkT -= this.blinkLen;

      const t = this.blinkT / this.blinkLen; // 0..1

      // Shorter on-window for some (restBias)
      const on = this.onFrac * (1 - this.restBias);

      // Centered pulse with wrap-around distance
      const center = 0.35;
      let d = Math.abs(t - center);
      d = Math.min(d, 1 - d);

      const half = on * 0.5;
      if (d > half) return this.base;

      // Inside pulse: softer rise/fall
      const u = 1 - d / half; // 0..1 (1 at center)
      const smooth = Math.pow(u, 1.6);   // slower, softer envelope
      return lerp(this.base, this.peak, smooth);
    }

    update(dt) {
      // fade in
      this.spawn = Math.min(1, this.spawn + this.spawnRate);

      // occasionally pick a new anchor (feels like drifting between glades)
      this.reanchor -= dt;
      if (this.reanchor <= 0) {
        this.anchor = pickAnchor();
        this.reanchor = rand(6, 18);
        this.anchorPull = rand(0.004, 0.014);
      }

      // wander heading
      this.ang += rand(-this.turn, this.turn);

      // spiral influence
      this.spiralT += dt * this.spiralRate;
      const spiral = Math.sin(this.spiralT) * this.spiralAmp;

      // direction vector
      const dx = Math.cos(this.ang);
      const dy = Math.sin(this.ang);

      // base acceleration (very gentle)
      let ax = dx * 0.01 + (-dy) * spiral;
      let ay = dy * 0.01 + ( dx) * spiral;

      // anchor pull (soft)
      const adx = this.anchor.x - this.x;
      const ady = this.anchor.y - this.y;
      const ad = Math.hypot(adx, ady) || 1;
      ax += (adx / ad) * this.anchorPull;
      ay += (ady / ad) * this.anchorPull;

      // subtle mouse “curiosity”
      if (mouse.active) {
        const mx = mouse.x - this.x;
        const my = mouse.y - this.y;
        const md = Math.hypot(mx, my) || 1;
        const near = clamp01(1 - md / 420); // only within ~420px
        const mousePull = 0.006 * near;     // soft
        ax += (mx / md) * mousePull;
        ay += (my / md) * mousePull;
      }

      // integrate velocity
      this.vx += ax;
      this.vy += ay;

      // clamp speed softly
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > this.maxSpeed) {
        const s = this.maxSpeed / sp;
        this.vx *= s;
        this.vy *= s;
      }

      // drag
      this.vx *= this.drag;
      this.vy *= this.drag;

      this.x += this.vx;
      this.y += this.vy;

      // edges: wrap softly (big margin so it’s unseen)
      const margin = 90;
      if (this.x < -margin) this.x = width + margin;
      if (this.x > width + margin) this.x = -margin;
      if (this.y < -margin) this.y = height + margin;
      if (this.y > height + margin) this.y = -margin;

      // sparkle bloom (rare tiny magic pulse)
      this.bloomCooldown -= dt;
      if (this.bloomCooldown <= 0) {
        this.bloomCooldown = rand(3.0, 10.0);
        this.bloom = rand(0.35, 0.9);
      }
      this.bloom = Math.max(0, this.bloom - dt * 1.2);

      // brightness
      const blink = this.blinkAlpha(dt);
      const bloomBoost = this.bloom * 0.35;
      this.a = (blink + bloomBoost) * this.spawn;
    }

    draw() {
      const [r, g, b] = this.rgb;

      // halo
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.halo);
      grad.addColorStop(0, `rgba(${r},${g},${b},${this.a})`);
      grad.addColorStop(0.22, `rgba(${r},${g},${b},${this.a * 0.30})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.halo, 0, Math.PI * 2);
      ctx.fill();

      // core
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, this.a * 1.6)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function init() {
    fireflies = [];
    if (prefersReducedMotion) return;

    makeAnchors();
    const count = getMaxFireflies();
    for (let i = 0; i < count; i++) fireflies.push(new Firefly());
  }

  // Drift anchors subtly (forest “breathing”)
  function updateAnchors(dt) {
    for (const a of anchors) {
      a.x += a.ax;
      a.y += a.ay;

      // bounce softly inside safe bounds
      if (a.x < width * 0.12 || a.x > width * 0.88) a.ax *= -1;
      if (a.y < height * 0.12 || a.y > height * 0.88) a.ay *= -1;
    }
  }

  // Ambient drift doesn't need 60fps. Throttle to ~30fps, which halves the
  // per-second draw work (and battery) with no visible difference for a slow
  // floating effect.
  const FRAME_MS = 1000 / 30;
  let last = performance.now();
  let lastDraw = 0;
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    if (now - lastDraw < FRAME_MS) return;   // skip this frame
    lastDraw = now;

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = "lighter";

    updateAnchors(dt);
    for (const f of fireflies) {
      f.update(dt);
      f.draw();
    }

    ctx.globalCompositeOperation = "source-over";
  }

  function start() {
    if (rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(animate);
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  resize();
  init();
  start();

  // External pause control. Other pages (e.g. Watch Together) can call
  // window.fireflies.pause() while a video is playing so the ambient canvas
  // isn't burning battery behind the player, then .resume() afterward.
  let externallyPaused = false;
  window.fireflies = {
    pause() { externallyPaused = true; stop(); },
    resume() { externallyPaused = false; if (!document.hidden) start(); },
  };

  window.addEventListener("resize", () => {
    resize();
    init();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!externallyPaused) start();
  });
}
})();
}