
(() => {
  const root = document.getElementById("lactose-app");
  if (!root) return;

  // Load the catalog directly from GitHub instead of jsDelivr.
  const DATA_URL =
    "https://raw.githubusercontent.com/samuelwinn/lactose-embed/main/games-catalog.json";

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

  function normalizeGameHtml(html, sourceURL) {
    if (!html || typeof html !== "string") {
      return html;
    }

    const base = sourceURL;
    const rewriteAttribute = (tag, attribute) => {
      const attrPattern = new RegExp(attribute + "\\s*=\\s*['\"]([^'\"]+)['\"]", "gi");
      let match;

      while ((match = attrPattern.exec(html)) !== null) {
        const originalValue = match[1];
        if (!originalValue || /^data:|^javascript:|^#|^mailto:|^tel:|^about:|^https?:\/\//i.test(originalValue)) {
          continue;
        }

        try {
          const absoluteURL = new URL(originalValue, base).href;
          html = html.replace(match[0], match[0].replace(originalValue, absoluteURL));
          attrPattern.lastIndex = match.index + match[0].length + 1;
        } catch (error) {
          console.warn("Could not rewrite " + attribute + " in game HTML:", error);
        }
      }

      return html;
    };

    html = rewriteAttribute("url", "src");
    html = rewriteAttribute("url", "href");
    html = rewriteAttribute("url", "poster");

    if (!/<base\b/i.test(html)) {
      const baseTag = `<base href="${base.replace(/"/g, "&quot;")}">`;

      if (/<head\b[^>]*>/i.test(html)) {
        html = html.replace(/<head\b[^>]*>/i, match => match + baseTag);
      } else {
        html = baseTag + html;
      }
    }

    return html;
  }

  function openGame(game) {
    // Open synchronously during the click to reduce popup blocking.
    const gameTab = window.open("about:blank", "_blank");

    if (!gameTab) {
      status.textContent =
        "The browser blocked the new tab. Allow pop-ups and try again.";
      return;
    }

    showMessage(gameTab, "Opening " + game.name, "Loading game HTML…");

    filesPromise
      .then(files => {
        const file = findGameFile(game, files);

        if (!file) {
          throw new Error(
            'No unique HTML filename matches "' + game.name + '".'
          );
        }

        const encodedPath = file.path
          .split("/")
          .map(part => encodeURIComponent(part))
          .join("/");

        const gameURL = PAGES_BASE + "/" + encodedPath;

        // Fetch the HTML source instead of redirecting to the game URL.
        return fetch(gameURL).then(response => {
          if (!response.ok) {
            throw new Error(
              "Could not load game HTML (" + response.status + ")."
            );
          }
          return response.text();
        }).then(html => ({ html, gameURL }));
      })
      .then(({ html, gameURL }) => {
        if (gameTab.closed) return;

        html = normalizeGameHtml(html, gameURL);

        // Write the fetched source into about:blank to run it there.
        gameTab.document.open();
        gameTab.document.write(html);
        gameTab.document.close();
      })
      .catch(error => {
        console.error("LACTOSE game loading error:", error);

        showMessage(
          gameTab,
          "Couldn't load " + game.name,
          error.message +
          " If this happens on your school computer, its network may be blocking a required GitHub address."
        );

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
