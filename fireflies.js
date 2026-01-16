const canvas = document.getElementById("fireflies");
const ctx = canvas.getContext("2d");

let fireflies = [];
let DPR = window.devicePixelRatio || 1;
let width, height;

const MAX_FIREFLIES = Math.min(80, Math.floor(window.innerWidth / 15));
const colors = [
  "rgba(251,191,36,0.9)",   // warm gold
  "rgba(253,224,71,0.8)",   // soft yellow
  "rgba(252,211,77,0.7)"    // dim glow
];

// Respect reduced motion
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * DPR;
  canvas.height = height * DPR;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

class Firefly {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = Math.random() * 1.4 + 0.6;
    this.alpha = Math.random() * 0.6 + 0.2;
    this.speedX = (Math.random() - 0.5) * 0.15;
    this.speedY = (Math.random() - 0.5) * 0.12;
    this.twinkleSpeed = Math.random() * 0.015 + 0.005;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.phase = Math.random() * Math.PI * 2;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.phase += this.twinkleSpeed;
    this.alpha = 0.3 + Math.sin(this.phase) * 0.3;

    // wrap around screen edges
    if (this.x < -20) this.x = width + 20;
    if (this.x > width + 20) this.x = -20;
    if (this.y < -20) this.y = height + 20;
    if (this.y > height + 20) this.y = -20;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color.replace(/[\d.]+\)$/g, `${this.alpha})`);
    ctx.fill();
  }
}

function init() {
  fireflies = [];
  const count = prefersReducedMotion ? 0 : MAX_FIREFLIES;
  for (let i = 0; i < count; i++) {
    fireflies.push(new Firefly());
  }
}

function animate() {
  ctx.clearRect(0, 0, width, height);
  fireflies.forEach(f => {
    f.update();
    f.draw();
  });
  requestAnimationFrame(animate);
}

resize();
init();
animate();

window.addEventListener("resize", () => {
  resize();
  init();
});
