(() => {
  const root = document.getElementById("lactose-app");
  if (!root) return;

  const DATA_URL =
    "https://cdn.jsdelivr.net/gh/samuelwinn/lactose-embed@main/games-catalog.json";

  root.innerHTML = `
    <div class="lx-shell">
      <header class="lx-header">
        <div class="lx-brand">
          <span class="lx-mark">L</span>
          <div>
            <h1>LACTOSE</h1>
            <p>GAME LIBRARY</p>
          </div>
        </div>
        <div class="lx-count" id="lx-count">Loading games…</div>
      </header>

      <section class="lx-controls">
        <label class="lx-search">
          <span aria-hidden="true">⌕</span>
          <input id="lx-search" type="search"
            placeholder="Search games…" autocomplete="off">
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

  // Convert a Google Drive sharing link into a direct file URL.
  function directGameUrl(url) {
    try {
      const parsed = new URL(url);

      if (parsed.hostname !== "drive.google.com") {
        return url;
      }

      let fileId = parsed.searchParams.get("id");

      const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);

      if (!fileId && match) {
        fileId = match[1];
      }

      if (!fileId) {
        return url;
      }

      return (
        "https://drive.google.com/uc?export=download&id=" +
        encodeURIComponent(fileId)
      );
    } catch (error) {
      return url;
    }
  }

  // Open the game in a separate tab when a card is clicked.
  function openGame(game) {
    const gameTab = window.open("about:blank", "_blank");

    if (!gameTab) {
      status.textContent =
        "The browser blocked the new tab. Allow pop-ups for this site, then try again.";
      return;
    }

    // Show a loading message in the new tab.
    gameTab.document.open();
    gameTab.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Loading game...</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #111;
              color: #fff;
              font: 16px Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          <p>Loading game...</p>
        </body>
      </html>
    `);
    gameTab.document.close();

    // Navigate to the game's direct Google Drive URL.
    gameTab.location.href = directGameUrl(game.html);
  }

  // Filter and sort the catalog.
  function applyFilters() {
    const query = search.value.trim().toLocaleLowerCase();

    filtered = games.filter(game =>
      String(game.name || "")
        .toLocaleLowerCase()
        .includes(query)
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

  // Display the game cards.
  function render() {
    const shown = filtered.slice(0, visibleCount);

    grid.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (const game of shown) {
      const card = document.createElement("button");

      card.type = "button";
      card.className = "lx-card";
      card.title = "Play " + (game.name || "game");

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

      card.addEventListener("click", () => {
        openGame(game);
      });

      fragment.append(card);
    }

    grid.append(fragment);

    count.textContent = filtered.length.toLocaleString() + " games";

    status.textContent = filtered.length
      ? "Showing " +
        Math.min(visibleCount, filtered.length).toLocaleString() +
        " of " +
        filtered.length.toLocaleString() +
        " games"
      : "No games match your search.";

    $("lx-more-wrap").hidden = visibleCount >= filtered.length;
  }

  // Load additional game cards.
  $("lx-more").addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  // Search and sorting controls.
  search.addEventListener("input", applyFilters);
  sort.addEventListener("change", applyFilters);

  // Load the game catalog.
  fetch(DATA_URL)
    .then(response => {
      if (!response.ok) {
        throw new Error("Catalog request failed: " + response.status);
      }

      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        throw new Error("The game catalog must be a JSON array.");
      }

      games = data.filter(game =>
        game &&
        typeof game.name === "string" &&
        typeof game.html === "string"
      );

      applyFilters();
    })
    .catch(error => {
      count.textContent = "Catalog unavailable";

      status.textContent =
        "Could not load the game catalog. Check the catalog URL and repository.";

      console.error("LACTOSE catalog error:", error);
    });
})();
