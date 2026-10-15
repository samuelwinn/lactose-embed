(() => {
  const root = document.getElementById("lactose-app");
  if (!root) return;

  const DATA_URL =
    "https://cdn.jsdelivr.net/gh/samuelwinn/lactose-embed@main/games-catalog.json";

  const TREE_URL =
    "https://api.github.com/repos/samuelwinn/lactose-games/git/trees/main?recursive=1";

  const PAGES_BASE =
    "https://samuelwinn.github.io/lactose-games";

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
          <input
            id="lx-search"
            type="search"
            placeholder="Search games…"
            autocomplete="off"
          >
        </label>

        <select id="lx-sort" aria-label="Sort games">
          <option value="az">Name: A–Z</option>
          <option value="za">Name: Z–A</option>
        </select>
      </section>

      <div id="lx-status" class="lx-status">Loading catalog…</div>
      <section id="lx-grid" class="lx-grid" aria-label="Games"></section>

      <div class="lx-more" id="lx-more-wrap" hidden>
        <button id="lx-more" type="button">Load more</button>
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

  // Normalize names so, for example, "1v1.LOL" can match "1v1.html"
  // when the shortened filename is an unambiguous match.
  function normalizeName(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  // Load the list of HTML files hosted by GitHub Pages.
  const filesPromise = fetch(TREE_URL)
    .then(response => {
      if (!response.ok) {
        throw new Error("Could not retrieve the hosted game file list.");
      }
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data.tree)) {
        throw new Error("GitHub returned an invalid file list.");
      }

      const files = data.tree
        .filter(item =>
          item.type === "blob" &&
          /\.html?$/i.test(item.path)
        )
        .map(item => ({
          path: item.path,
          name: normalizeName(
            item.path.split("/").pop().replace(/\.html?$/i, "")
          )
        }));

      if (!files.length) {
        throw new Error("No HTML game files were found.");
      }

      return files;
    });

  // Prefer exact filename matches. Only use a shortened/extended
  // name when it identifies exactly one file.
  function findGameFile(game, files) {
    const wanted = normalizeName(game.name);

    if (!wanted) return null;

    const exact = files.filter(file => file.name === wanted);

    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      const rootMatches = exact.filter(file => !file.path.includes("/"));
      return rootMatches.length === 1 ? rootMatches[0] : null;
    }

    const possible = files.filter(file => {
      if (Math.min(wanted.length, file.name.length) < 3) {
        return false;
      }

      return (
        file.name.startsWith(wanted) ||
        wanted.startsWith(file.name)
      );
    });

    if (possible.length === 1) return possible[0];

    // If several files share a name, prefer a unique file at the root.
    const rootMatches = possible.filter(file =>
      !file.path.includes("/")
    );

    return rootMatches.length === 1 ? rootMatches[0] : null;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function showTabMessage(tab, title, message) {
    if (!tab || tab.closed) return;

    tab.document.open();
    tab.document.write(`
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHTML(title)}</title>
        <style>
          body {
            margin: 0;
            padding: 48px 24px;
            background: #111;
            color: #eee;
            font: 16px/1.6 system-ui, sans-serif;
          }
          main { max-width: 680px; margin: auto; }
          h1 { font-size: 26px; }
          p { color: #ccc; }
        </style>
      </head>
      <body>
        <main>
          <h1>${escapeHTML(title)}</h1>
          <p>${escapeHTML(message)}</p>
        </main>
      </body>
      </html>
    `);
    tab.document.close();
  }

  // Open about:blank immediately during the click, then navigate
  // that tab to the matching hosted HTML game.
  function openGame(game) {
    const gameTab = window.open("about:blank", "_blank");

    if (!gameTab) {
      status.textContent =
        "Your browser blocked the new tab. Allow pop-ups for this site, then try again.";
      return;
    }

    showTabMessage(
      gameTab,
      "Opening " + game.name,
      "Finding the hosted game file…"
    );

    filesPromise
      .then(files => {
        if (gameTab.closed) return;

        const file = findGameFile(game, files);

        if (!file) {
          showTabMessage(
            gameTab,
            "Game file not found",
            'Could not find a unique HTML filename matching "' +
              game.name +
              '". Check that the game is uploaded and that its filename matches the game title.'
          );

          status.textContent =
            'Could not match "' + game.name + '" to an HTML filename.';
          return;
        }

        const encodedPath = file.path
          .split("/")
          .map(segment => encodeURIComponent(segment))
          .join("/");

        gameTab.location.href = PAGES_BASE + "/" + encodedPath;
      })
      .catch(error => {
        console.error("LACTOSE game file error:", error);

        showTabMessage(
          gameTab,
          "Couldn't find the game files",
          "LACTOSE couldn't retrieve the GitHub Pages file list. Check that the lactose-games repository is public and GitHub Pages is enabled."
        );

        status.textContent =
          "Couldn't retrieve the hosted game file list.";
      });
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
      card.addEventListener("click", () => openGame(game));

      fragment.append(card);
    }

    grid.append(fragment);

    count.textContent = filtered.length.toLocaleString() + " games";

    status.textContent = filtered.length
      ? "Showing " +
        shown.length.toLocaleString() +
        " of " +
        filtered.length.toLocaleString() +
        " games"
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
        throw new Error("Catalog request failed: " + response.status);
      }
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        throw new Error("The catalog must contain a JSON array.");
      }

      games = data.filter(game =>
        game &&
        typeof game.name === "string" &&
        typeof game.html === "string"
      );

      applyFilters();
    })
    .catch(error => {
      console.error("LACTOSE catalog error:", error);
      count.textContent = "Catalog unavailable";
      status.textContent =
        "Could not load the catalog. Check the catalog URL and repository.";
    });
})();
