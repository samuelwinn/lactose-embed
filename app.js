(() => {
  const root = document.getElementById("lactose-app");
  if (!root) return;
  const DATA_URL = "https://cdn.jsdelivr.net/gh/samuelwinn/lactose-embed@main/games-catalog.json";
  root.innerHTML = `
    <div class="lx-shell">
      <header class="lx-header"><div class="lx-brand"><span class="lx-mark">L</span><div><h1>LACTOSE</h1><p>GAME LIBRARY</p></div></div><div class="lx-count" id="lx-count">Loading games…</div></header>
      <section class="lx-controls"><label class="lx-search"><span aria-hidden="true">⌕</span><input id="lx-search" type="search" placeholder="Search games…" autocomplete="off"></label><select id="lx-sort" aria-label="Sort games"><option value="az">Name: A–Z</option><option value="za">Name: Z–A</option></select></section>
      <div id="lx-status" class="lx-status">Loading catalog…</div><section id="lx-grid" class="lx-grid" aria-label="Games"></section>
      <div class="lx-more" id="lx-more-wrap" hidden><button id="lx-more">Load more</button></div>
      <div id="lx-viewer" class="lx-viewer" hidden role="dialog" aria-modal="true" aria-label="Game viewer"><div class="lx-viewer-bar"><strong id="lx-game-title">Game</strong><div><button id="lx-open-drive" type="button">Open source</button><button id="lx-close" type="button" aria-label="Close game">✕ Close</button></div></div><iframe id="lx-frame" title="Game" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" allowfullscreen loading="lazy"></iframe></div>
    </div>`;
  const $ = id => root.querySelector("#" + id);
  const grid = $("lx-grid"), search = $("lx-search"), sort = $("lx-sort"), status = $("lx-status"), count = $("lx-count"), viewer = $("lx-viewer"), frame = $("lx-frame");
  let games = [], filtered = [], visibleCount = 60;
  const PAGE_SIZE = 60;
  function driveEmbedUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname !== "drive.google.com") return url;
      let id = u.searchParams.get("id");
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (!id && m) id = m[1];
      return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : url;
    } catch (_) { return url; }
  }
  function applyFilters() {
    const q = search.value.trim().toLocaleLowerCase();
    filtered = games.filter(g => String(g.name || "").toLocaleLowerCase().includes(q));
    filtered.sort((a,b) => {
      const c = String(a.name || "").localeCompare(String(b.name || ""), undefined, {sensitivity:"base"});
      return sort.value === "za" ? -c : c;
    });
    visibleCount = PAGE_SIZE; render();
  }
  function render() {
    const shown = filtered.slice(0, visibleCount); grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const game of shown) {
      const card = document.createElement("button"); card.type = "button"; card.className = "lx-card"; card.title = `Play ${game.name}`;
      const icon = document.createElement("span"); icon.className = "lx-card-icon"; icon.textContent = String(game.name || "?").trim().charAt(0).toUpperCase() || "?";
      const title = document.createElement("span"); title.className = "lx-card-title"; title.textContent = game.name || "Untitled game";
      const action = document.createElement("span"); action.className = "lx-card-action"; action.textContent = "PLAY ↗";
      card.append(icon,title,action); card.addEventListener("click", () => openGame(game)); frag.append(card);
    }
    grid.append(frag); count.textContent = `${filtered.length.toLocaleString()} games`;
    status.textContent = filtered.length ? `Showing ${shown.length.toLocaleString()} of ${filtered.length.toLocaleString()} games` : "No games match your search.";
    $("lx-more-wrap").hidden = visibleCount >= filtered.length;
  }
  function openGame(game) {
    $("lx-game-title").textContent = game.name || "Game";
    $("lx-open-drive").onclick = () => window.open(game.html, "_blank", "noopener,noreferrer");
    viewer.hidden = false; frame.src = driveEmbedUrl(game.html);
    root.querySelector(".lx-shell").classList.add("lx-playing");
  }
  function closeGame() {
    viewer.hidden = true; frame.src = "about:blank";
    root.querySelector(".lx-shell").classList.remove("lx-playing");
  }
  $("lx-close").addEventListener("click", closeGame);
  $("lx-more").addEventListener("click", () => { visibleCount += PAGE_SIZE; render(); });
  search.addEventListener("input", applyFilters); sort.addEventListener("change", applyFilters);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !viewer.hidden) closeGame(); });
  fetch(DATA_URL).then(r => { if (!r.ok) throw new Error(`Catalog request failed (${r.status})`); return r.json(); })
    .then(data => { if (!Array.isArray(data)) throw new Error("games-catalog.json must contain a JSON array."); games = data.filter(g => g && typeof g.name === "string" && typeof g.html === "string"); applyFilters(); })
    .catch(err => { count.textContent = "Catalog unavailable"; status.textContent = "Could not load the catalog. Check your GitHub username, repository, and catalog filename in app.js."; console.error("LACTOSE catalog error:",err); });
})();
