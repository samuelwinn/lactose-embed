(() => {
  const root = document.getElementById("lactose-app");
  if (!root) return;

  const DATA_URL = "https://cdn.jsdelivr.net/gh/samuelwinn/lactose-embed@main/games-catalog.json";

  root.innerHTML = `
    <div class="lx-shell">
      <header class="lx-header">
        <div class="lx-brand">
          <span class="lx-mark">L</span>
          <div><h1>LACTOSE</h1><p>GAME LIBRARY</p></div>
        </div>
        <div class="lx-count" id="lx-count">Loading games…</div>
      </header>

      <section class="lx-controls">
        <label class="lx-search">
          <span aria-hidden="true">⌕</span>
          <input id="lx-search" type="search" placeholder="Search games…" autocomplete="off">
        </label>
        <select id="lx-sort" aria-label="Sort games">
          <option value="az">Name: A–Z</option>
          <option value="za">Name: Z–A</option>
        </select>
      </section>

      <div id="lx-status" class="lx-status">Loading catalog…</div>
      <section id="lx-grid" class="lx-grid" aria-label="Games"></section>

      <div class="lx-more" id="lx-more-wrap" hidden>
        <button id="lx-more">Load more</button>
      </div>

      <div id="lx-viewer" class="lx-viewer" hidden role="dialog" aria-modal="true" aria-label="Game viewer">
        <div class="lx-viewer-bar">
          <strong id="lx-game-title">Game</strong>
          <div>
            <button id="lx-open-drive" type="button">Open source</button>
            <button id="lx-close" type="button" aria-label="Close game">✕ Close</button>
          </div>
        </div>
        <iframe id="lx-frame" title="Game" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" allowfullscreen loading="lazy"></iframe>
      </div>
    </div>
  `;

  const $ = id => root.querySelector("#" + id);
  const grid = $("lx-grid");
  const search = $("lx-search");
  const sort = $("lx-sort");
  const status = $("lx-status");
  const count = $("lx-count");

  let games = [];
  let filtered = [];
  let visibleCount = 60;
  const PAGE_SIZE = 60;

  function directGameUrl(url) {
    try {
      const u = new URL(url);

      if (u.hostname !== "drive.google.com") {
        return url;
      }

      let id = u.searchParams.get("id");
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);

      if (!id && match) {
        id = match[1];
      }

      return id
        ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
        : url;
    } catch (_) {
      return url;
    }
  }

  function openGame(game) {
    const gameUrl = directGameUrl(game.html);

    // Open the tab immediately during the click to reduce popup blocking.
    const gameTab = window.open("about:blank", "_blank");

    if (!gameTab) {
      status.textContent =
        "Your browser blocked the game tab. Allow pop-ups for this site, then click the game again.";
      return;
    }

    // Navigate the new tab to the game's direct URL.
    // This avoids trying to fetch cross-origin HTML from JavaScript.
    gameTab.location.href = gameUrl;
  }

  function applyFilters() {
    const query = search.value.trim().toLocaleLowerCase();

    filtered = games.filter(game =>
      String(game.name || "").toLocaleLowerCase().includes(query)
    );

    filtered.sort((a, b) => {
      const comparison = String(a.name || "").localeCompare(
        String(b.name || ""),
        undefined,
        { sensitivity: "base" }
      );

      return sort.value === "za" ? -comparison : comparison;
    });

    visibleCount = PAGE_SIZE;
    render();
  }

  function render() {
    const shown = filtered.slice(0, visibleCount);
    grid.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (const game of shown) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lx-card";
      card.title = `Play ${game.name}`;

      const icon = document.createElement("span");
      icon.className = "lx-card-icon";
      icon.textContent =
        String(game.name || "?").trim().charAt(0).toUpperCase() || "?";

      const title = document.createElement("span");
      title.className = "lx-card-title";
      title.textContent = game.name || "Untitled game";

      const action = document.createElement("span");
      action.className = "lx-card-action";
      action.textContent = "PLAY ↗";

      card.append(icon, title, action);
      card.addEventListener("click", () => openGame(game));

      fragment.append(card);
    }

    grid.append(fragment);

    count.textContent = `${filtered.length.toLocaleString()} games`;

    status.textContent = filtered.length
      ? `Showing ${shown.length.toLocaleString()} of ${filtered.length.toLocaleString()} games`
      : "No games match your search.";

    $("lx-more-wrap").hidden = visibleCount >= filtered.length;
  }

  $("lx-more").addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  search.addEventListener("input", applyFilters);
  sort.addEventListener("change", applyFilters);

  fetch(DATA_URL)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Catalog request failed (${response.status})`);
      }

      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        throw new Error("games-catalog.json must contain a JSON array.");
      }

      games = data.filter(
        game =>
          game &&
          typeof game.name === "string" &&
          typeof game.html === "string"
      );

      applyFilters();
    })
    .catch(error => {
      count.textContent = "Catalog unavailable";
      status.textContent =
        "Could not load the catalog. Check the GitHub username, repository, and catalog filename in app.js.";

      console.error("LACTOSE catalog error:", error);
    });
})();
