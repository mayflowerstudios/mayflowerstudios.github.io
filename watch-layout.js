/* Reuse the existing panels so room state and event listeners stay intact. */
(() => {
  const wrap = document.querySelector('.together-watch > .wrap');
  const workspace = document.querySelector('.wtWrap');
  const nav = document.getElementById('site-nav');
  if (!wrap || !workspace || !nav) return;

  const navHome = document.createComment('navigation mobile position');
  nav.before(navHome);
  const desktopNav = matchMedia('(min-width: 721px)');
  function placeNav() {
    if (desktopNav.matches) wrap.before(nav);
    else navHome.after(nav);
  }
  placeNav();
  desktopNav.addEventListener('change', placeNav);

  const left = document.createElement('aside');
  const right = document.createElement('aside');
  left.className = 'watch-rail watch-rail-left';
  right.className = 'watch-rail watch-rail-right';
  left.setAttribute('aria-label', 'Watch history and playlists');
  right.setAttribute('aria-label', 'Up next');
  left.hidden = right.hidden = true;
  workspace.prepend(left);
  workspace.append(right);

  const panels = [
    ['.historyPanel', left], ['.playlistPanel', left], ['.queuePanel', right],
  ].map(([selector, rail]) => {
    const panel = workspace.querySelector(selector);
    const home = document.createComment('original ' + selector + ' position');
    panel.before(home);
    return { panel, home, rail };
  });
  const wide = matchMedia('(min-width: 1600px)');
  function placePanels() {
    for (const { panel, home, rail } of panels) {
      if (wide.matches) rail.append(panel);
      else home.after(panel);
    }
    left.hidden = right.hidden = !wide.matches;
  }
  placePanels();
  wide.addEventListener('change', placePanels);
})();
