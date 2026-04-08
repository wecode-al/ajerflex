# AjerFlix

Vite + React streaming UI backed by TMDB search/discovery data and route-driven watch pages.

## Routes

- `/lock`
- `/search?q=&type=&genre=`
- `/watch/:mediaType/:id?source=&season=&episode=`

Deep links are protected. If a visitor is locked and opens a nested route directly, the app sends them to `/lock` and resumes the requested route after a valid PIN.

## Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## SiteGround Deploy

This app uses `BrowserRouter`, so the server must rewrite unknown application routes to `index.html`.

For Apache-style hosting, deploy the built files together with the included `.htaccess`:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```
