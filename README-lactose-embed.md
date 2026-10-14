# lactose-embed

Files for embedding the LACTOSE game catalog inside Google Sites using jsDelivr. GitHub Pages is not required.

## Files
- `games-catalog.json` — 972 entries from the provided JSON file
- `app.js` — catalog loading, search, sorting, pagination, and game viewer
- `style.css` — styling
- `google-sites-embed.html` — embed snippet

## Setup
1. Upload all four files to the root of the public `lactose-embed` repository.
2. Replace `YOUR-GITHUB-USERNAME` in `app.js` and `google-sites-embed.html` with your GitHub username.
3. Commit the changes.
4. In Google Sites, choose **Insert → Embed → Embed code** and paste `google-sites-embed.html`.

The catalog contains Google Drive viewer URLs. The app converts common Drive file URLs to `/preview` links. Some files may not embed because of permissions or browser restrictions. The **Open source** button opens the original Drive URL.

This does not require GitHub Pages.
