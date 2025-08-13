# Satellite Launch Planner — Liquid Glass UI

This is a Vite + React + Tailwind project generated from your uploaded JSX component.

## Quick start

1. Extract or clone this folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run dev server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
5. Preview production build locally:
   ```bash
   npm run preview
   ```

## Deploying to GitHub Pages

- If you want to deploy to `https://<username>.github.io/<repo>/` set `base` in `vite.config.js` to `'/<repo>/'` and then either use `gh-pages`:
  ```bash
  npm run build
  npm run deploy
  ```
  or use the included GitHub Actions workflow (already configured for `dist/`).

## Notes

- The uploaded JSX file was copied to `src/App.jsx`. The default export from that file is used as the app root.
- If you see styling issues after deploying, confirm `tailwind` classes are being processed: `src/index.css` has Tailwind directives and `tailwind.config.cjs` content paths include `./src/**/*`.
