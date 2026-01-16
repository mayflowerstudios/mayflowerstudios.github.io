function injectFavicon(href = "/assets/icons/favicon.png") {
  // If there’s already a favicon link, don’t duplicate it
  if (document.querySelector('link[rel="icon"]')) return;

  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";

  // Optional cache-buster so updates show up faster
  link.href = `${href}?v=1`;

  document.head.appendChild(link);

  // Optional: iOS home screen icon
  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = `${href}?v=1`;
  document.head.appendChild(apple);
}

function injectFireflies(){
  if (document.getElementById("fireflies")) return;

  const canvas = document.createElement("canvas");
  canvas.id = "fireflies";
  document.body.prepend(canvas);
}

async function loadPartial(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  const res = await fetch(url);
  el.innerHTML = await res.text();
}

function setYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

function highlightNav() {
  const key = document.body.dataset.nav;
  if (!key) return;
  const link = document.querySelector(`.pill[data-nav="${key}"]`);
  if (link) link.classList.add("active");
}

(async function initShared() {
  injectFavicon("/assets/icons/favicon.png");
  injectFireflies();

  await loadPartial("#shared-nav", "partials/nav.html");
  await loadPartial("#shared-footer", "partials/footer.html");
  setYear();
  highlightNav();
})();
