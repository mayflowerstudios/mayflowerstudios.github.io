const canvas = document.getElementById("fireflies");
if (!canvas) {
  console.warn("Fireflies canvas not found!");
} else {
  const ctx = canvas.getContext("2d", { alpha: true });

  let fireflies = [];
  let DPR = window.devicePixelRatio || 1;
  let width = 0, height = 0;
  let rafId = null;

  // Count scales with screen size but capped
  function getMaxFireflies() {
    return Math.min(90, Math.floor(window.innerWidth / 14));
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Warm firefly colors (RGB only; alpha handled separately)
  const colors = [
    [251,191,36],  // gold
    [253,224,71],  // soft yellow
    [252,211,77]   // dim amber
  ];

  function resize() {
    DPR = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  class Firefly {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = Math.random() * height;

      // core size + halo size
      this.r = Math.random() * 1.2 + 0.8;          // core radius
      this.halo = this.r * (6 + Math.random() * 6); // halo radius

      // drift speed
      this.vx = (Math.random() - 0.5) * 0.18;
      this.vy = (Math.random() - 0.5) * 0.14;

      // twinkle
      this.phase = Math.random() * Math.PI * 2;
      this.tw = Math.random() * 0.012 + 0.004;

      // brightness
      this.base = Math.random() * 0.18 + 0.10; // minimum glow
      this.amp = Math.random() * 0.30 + 0.22;  // twinkle amplitude

      // color
      this.rgb = colors[Math.floor(Math.random() * colors.length)];

      // spawn fade-in so they don't “pop”
      this.spawn = initial ? Math.random() : 0;
      this.spawnRate = Math.random() * 0.012 + 0.006;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      // gentle “float”
      this.phase += this.tw;
      const twinkle = this.base + (Math.sin(this.phase) * 0.5 + 0.5) * this.amp;

      // spawn fade in
      this.spawn = Math.min(1, this.spawn + this.spawnRate);

      this.a = twinkle * this.spawn;

      // wrap edges
      if (this.x < -40) this.x = width + 40;
      if (this.x > width + 40) this.x = -40;
      if (this.y < -40) this.y = height + 40;
      if (this.y > height + 40) this.y = -40;
    }

    draw() {
      const [r, g, b] = this.rgb;

      // halo (soft glow)
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.halo);
      grad.addColorStop(0, `rgba(${r},${g},${b},${this.a})`);
      grad.addColorStop(0.25, `rgba(${r},${g},${b},${this.a * 0.35})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.halo, 0, Math.PI * 2);
      ctx.fill();

      // core (sharp dot)
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, this.a * 1.4)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function init() {
    fireflies = [];
    if (prefersReducedMotion) return;

    const count = getMaxFireflies();
    for (let i = 0; i < count; i++) fireflies.push(new Firefly());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Makes glows feel magical (additive blend)
    ctx.globalCompositeOperation = "lighter";

    for (const f of fireflies) {
      f.update();
      f.draw();
    }

    // Reset blend mode
    ctx.globalCompositeOperation = "source-over";

    rafId = requestAnimationFrame(animate);
  }

  function start() {
    if (rafId) return;
    animate();
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Init
  resize();
  init();
  start();

  // Resize
  window.addEventListener("resize", () => {
    resize();
    init();
  });

  // Pause when tab is hidden (saves battery/CPU)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
}
