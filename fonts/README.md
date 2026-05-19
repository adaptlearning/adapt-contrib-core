# Icon font

The `vanilla` icon font is generated via [IcoMoon](https://icomoon.io). It is referenced in `src/core/less/_defaults/icons.less` via `@font-face`.

## Files

| File | Purpose |
|------|---------|
| `vanilla.woff` / `vanilla.woff2` | Compiled font files used at runtime |
| `Vanilla icons.json` | IcoMoon app project state - import this to resume editing in the app |
| `vanilla-icons.icomoon.json` | IcoMoon font definition (new app format) - use this to regenerate the font |
| `selection.json` | Legacy IcoMoon backup (old app format) - kept for backwards compatibility |

## Updating the core icon set

Use this when adding, removing, or modifying icons in the shared `vanilla` font used across all projects.

1. Go to [icomoon.io](https://icomoon.io) and open the app.
2. Import `Vanilla icons.json` from the project selection screen.
3. Add, remove, or modify icons as needed.
4. Export the font package (the zip download).
5. Replace `vanilla.woff` and `vanilla.woff2` with the new files from the `fonts/` folder in the zip.
6. Replace `vanilla-icons.icomoon.json` with the version from the zip root.
7. Update `icons.less` if any icon class names or unicode values have changed.

Do not manually edit the font files or JSON files.
