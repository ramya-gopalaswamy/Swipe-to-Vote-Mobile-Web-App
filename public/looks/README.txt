GalaSwipe — local outfit images
================================

1. Save your images in this folder (PNG, JPG, or WebP).

2. First image → first outfit in the deck (sort order), second → second, etc.
   Slot files: img1.png … img100.png (see `MAX_LOCAL_LOOK_IMAGES` in src/lib/localLookAssets.js).
   Images 21–100 can repeat the same files as 1–20 with different names (copies on disk).

3. Use a site-root path (Vite serves `public/` as `/`):

     /looks/img1.png

4. Persisting in SQLite: UPDATE `items.image_url` (sqlite3 CLI / DB browser) or extend the Express API;
   or keep local-only overrides in src/lib/localLookAssets.js.

5. Hard-refresh the browser after swapping files.
