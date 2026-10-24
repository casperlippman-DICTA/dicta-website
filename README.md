# dictalanguages.com

The website for [DICTA Learning](https://apps.apple.com/us/app/dicta-learning/id6751761814), served by GitHub Pages from the `main` branch. Pushing to `main` publishes the site in about a minute.

| File | What it is |
|------|------------|
| `index.html` | The home page markup, plus the SEO tags in `<head>` |
| `assets/site.css` | All styles, including the light and dark themes |
| `assets/site.js` | The handwriting replay, study-mode tabs, book samples, audience tabs and idea board. Most copy for those sections lives here as data. |
| `privacy-policy-4/` | The privacy policy. **Keep this URL**: the App Store listing links to it. |
| `about-us/`, `contact-us/`, `cart/` | Redirects from the old Squarespace pages |
| `sitemap.xml`, `robots.txt` | For search engines. Update `lastmod` when a page changes. |

To preview locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
