
(() => {
  const root = document.getElementById("lactose-app");
  if (!root) return;

  const DATA_URL =
    "https://cdn.jsdelivr.net/gh/samuelwinn/lactose-embed@main/games-catalog.json";

  const TREE_URL =
    "https://api.github.com/repos/samuelwinn/lactose-games/git/trees/main?recursive=1";

  const GAMES_BASE =
    "https://cdn.jsdelivr.net/gh/samuelwinn/lactose-games@main";

  root.innerHTML = `
    <style>
      .lx-viewer {
        position: fixed;
        inset: 20px 20px 20px 20px;
        display: flex;
        flex-direction: column;
        background: rgba(16, 17, 19, 0.97);
        border: 1px solid #2a2b30;
        border-radius: 18px;
        overflow: hidden;
        z-index: 30;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
      }
      .lx-viewer[hidden] { display: none; }
      .lx-viewer-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        background: #17191d;
        border-bottom: 1px solid #2c2d33;
      }
      .lx-viewer-bar strong {
        font-size: 15px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #fff;
      }
      .lx-viewer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lx-viewer-actions button,
      .lx-viewer-actions button:hover {
        background: #1d1e22;
        color: #f4f4f5;
        border: 1px solid #363840;
        border-radius: 10px;
        padding: 8px 12px;
        font: inherit;
        cursor: pointer;
      }
      #lx-frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #000;
      }
      @media (max-width: 640px) {
        .lx-viewer {
          inset: 12px;
        }
        .lx-viewer-bar {
          flex-wrap: wrap;
        }
      }
    </style>
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
        <button id="lx-more" type="button">Load more</button>
      </div>

      <div id="lx-viewer" class="lx-viewer" hidden>
        <div class="lx-viewer-bar">
          <strong id="lx-game-title">Game</strong>
          <div class="lx-viewer-actions">
            <button id="lx-open-new" type="button">Open in new tab</button>
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
  const viewer = $("lx-viewer");
  const frame = $("lx-frame");
  const viewerTitle = $("lx-game-title");
  const closeButton = $("lx-close");
  const openNewButton = $("lx-open-new");

  let games = [];
  let filtered = [];
  let visibleCount = 60;
  let activeGame = null;

  const PAGE_SIZE = 60;

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  // Retrieve the list of uploaded HTML files once per page load.
  const filesPromise = fetch(TREE_URL)
    .then(response => {
      if (!response.ok) {
        throw new Error(
          "Could not retrieve the game list (" + response.status + ")."
        );
      }
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data.tree)) {
        throw new Error("Invalid GitHub file list.");
      }

      return data.tree
        .filter(item =>
          item.type === "blob" && /\.html?$/i.test(item.path)
        )
        .map(item => ({
          path: item.path,
          name: normalizeName(
            item.path.split("/").pop().replace(/\.html?$/i, "")
          )
        }));
    });

  function findGameFile(game, files) {
    const wanted = normalizeName(game.name);
    if (!wanted) return null;

    const exact = files.filter(file => file.name === wanted);

    if (exact.length === 1) return exact[0];

    if (exact.length > 1) {
      const rootMatches = exact.filter(file => !file.path.includes("/"));
      return rootMatches.length === 1 ? rootMatches[0] : null;
    }

    const possible = files.filter(file =>
      Math.min(wanted.length, file.name.length) >= 3 &&
      (
        file.name.startsWith(wanted) ||
        wanted.startsWith(file.name)
      )
    );

    if (possible.length === 1) return possible[0];

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

  function buildGameUrl(filePath) {
    const normalized = String(filePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");

    const parts = normalized
      .split("/")
      .filter(Boolean)
      .map(part => encodeURIComponent(part));

    return parts.length ? GAMES_BASE + "/" + parts.join("/") : GAMES_BASE + "/";
  }

  function buildGameBaseUrl(filePath) {
    const normalized = String(filePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");

    const directory = normalized.includes("/")
      ? normalized.slice(0, normalized.lastIndexOf("/") + 1)
      : "";

    return (GAMES_BASE + "/" + directory).replace(/\/+$/, "/");
  }

  function rewriteRootRelativeUrls(html) {
    return html
      .replace(/((?:src|href)\s*=\s*)(["'])(\/[^"']+?)(\2)/gi, (match, prefix, quote, value) => {
        if (/^(?:[a-z]+:)?\/\//i.test(value) || /^data:/i.test(value)) {
          return match;
        }
        return prefix + quote + value.replace(/^\/+/, "") + quote;
      })
      .replace(/url\(\s*(["']?)(\/[^"')]+)\1\s*\)/gi, (match, quote, value) => {
        if (/^(?:[a-z]+:)?\/\//i.test(value) || /^data:/i.test(value)) {
          return match;
        }
        return "url(" + quote + value.replace(/^\/+/, "") + quote + ")";
      });
  }

  function injectGameBase(html, filePath) {
    const baseHref = buildGameBaseUrl(filePath);
    const baseTag = '<base href="' + baseHref + '">';
    const normalized = rewriteRootRelativeUrls(html);

    if (/<base\s+[^>]*href\s*=/i.test(normalized)) {
      return normalized.replace(/<base\s+[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/i, match => {
        const existing = (RegExp.$1 || RegExp.$2 || RegExp.$3 || "").trim();
        if (!existing) return baseTag;

        try {
          const parsedExisting = new URL(existing, "https://example.com/");
          const parsedBase = new URL(baseHref);
          if (
            parsedExisting.origin === parsedBase.origin &&
            parsedExisting.pathname.startsWith(parsedBase.pathname)
          ) {
            return match;
          }
        } catch (error) {
          // Preserve a valid local fallback when the HTML already contains a broken base.
        }

        return baseTag;
      });
    }

    return normalized.replace(/<head\b[^>]*>/i, match => match + baseTag);
  }

  function writeDocument(targetWindow, html) {
    if (!targetWindow || !targetWindow.document) return false;

    try {
      targetWindow.document.open();
      targetWindow.document.write(html);
      targetWindow.document.close();
      return true;
    } catch (error) {
      console.error("LACTOSE iframe write failed:", error);
      return false;
    }
  }

  function showMessage(tab, title, message) {
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
            padding: 40px 24px;
            background: #111;
            color: #eee;
            font: 16px/1.6 system-ui, sans-serif;
          }
          main { max-width: 680px; margin: auto; }
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

  function loadIntoViewer(game, file, html) {
    activeGame = game;
    viewerTitle.textContent = game.name || "Game";
    viewer.hidden = false;

    const prepared = injectGameBase(html, file.path);
    const iframeReady = writeDocument(frame.contentWindow, prepared);

    if (!iframeReady) {
      status.textContent = "Couldn't render " + game.name + ".";
    }
  }

  function openGameInNewTab(game) {
    const gameTab = window.open("about:blank", "_blank");

    if (!gameTab) {
      status.textContent =
        "The browser blocked the new tab. Allow pop-ups and try again.";
      return;
    }

    showMessage(gameTab, "Opening " + game.name, "Loading the hosted game…");

    filesPromise
      .then(files => {
        const file = findGameFile(game, files);

        if (!file) {
          throw new Error(
            'No unique HTML filename matches "' + game.name + '".'
          );
        }

        const gameURL = buildGameUrl(file.path);

        if (gameTab.closed) return;

        return fetch(gameURL, { cache: "no-store" })
          .then(response => {
            if (!response.ok) {
              throw new Error(
                "Game request failed (" + response.status + ")."
              );
            }
            return response.text().then(html => ({ file, html }));
          })
          .then(({ file, html }) => {
            if (gameTab.closed) return;

            gameTab.opener = null;
            const prepared = injectGameBase(html, file.path);
            writeDocument(gameTab, prepared);
          });
      })
      .catch(error => {
        console.error("LACTOSE game loading error:", error);
        status.textContent = "Couldn't load " + game.name + ".";
        if (gameTab && !gameTab.closed) {
          showMessage(gameTab, "Load failed", "The game could not be opened from jsDelivr.");
        }
      });
  }

  function openGame(game) {
    activeGame = game;
    status.textContent = "Loading " + game.name + "…";

    filesPromise
      .then(files => {
        const file = findGameFile(game, files);

        if (!file) {
          throw new Error(
            'No unique HTML filename matches "' + game.name + '".'
          );
        }

        const gameURL = buildGameUrl(file.path);

        return fetch(gameURL, { cache: "no-store" })
          .then(response => {
            if (!response.ok) {
              throw new Error(
                "Game request failed (" + response.status + ")."
              );
            }
            return response.text().then(html => ({ file, html }));
          })
          .then(({ file, html }) => {
            loadIntoViewer(game, file, html);
            status.textContent = "Loaded " + game.name + ".";
          });
      })
      .catch(error => {
        console.error("LACTOSE game loading error:", error);
        status.textContent = "Couldn't load " + game.name + ".";
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
      ? "Showing " + shown.length.toLocaleString() +
        " of " + filtered.length.toLocaleString() + " games"
      : "No games match your search.";

    $("lx-more-wrap").hidden = visibleCount >= filtered.length;
  }

  $("lx-more").addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  search.addEventListener("input", applyFilters);
  sort.addEventListener("change", applyFilters);
  closeButton.addEventListener("click", () => {
    viewer.hidden = true;
  });
  openNewButton.addEventListener("click", () => {
    if (activeGame) {
      openGameInNewTab(activeGame);
    } else {
      status.textContent = "Select a game to open it in a new tab.";
    }
  });

  fetch(DATA_URL)
    .then(response => {
      if (!response.ok) {
        throw new Error("Catalog request failed (" + response.status + ").");
      }
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        throw new Error("The catalog is not a JSON array.");
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
        "Could not load the catalog. Check the browser Console for the exact error.";
    });
})();
