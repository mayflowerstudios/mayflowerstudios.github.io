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
  await loadPartial("#shared-nav", "partials/nav.html");
  await loadPartial("#shared-footer", "partials/footer.html");
  setYear();
  highlightNav();
})();
