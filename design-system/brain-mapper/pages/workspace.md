# Workspace — brAIn Mapper

Overrides `MASTER.md` for the Obsidian-like vault workspace.

## Intent

Dense knowledge-work surface: ribbon + file tree + editor/preview + graph.
Luxury comes from restraint, not decoration.

## Deviations from Master

- **Surfaces:** keep Developer Tool tokens (`--color-background`, `--color-card`, `--color-muted`) but treat borders as hairlines. Prefer `rgba(148, 163, 184, 0.16)` over the raw `#475569` block border so panels recede like Obsidian.
- **Accent:** `--color-accent` (`#22C55E`) is reserved for primary actions (open vault, apply links, save). Do not tint the chrome.
- **Radius:** 4px controls, 0px app chrome. No pill legends, no 12px cards.
- **Buttons:** flat, no gradient, no lift on hover. Hover = background `--color-muted`.
- **Icons:** Phosphor-style 16px outline SVGs only. Never emoji.
- **Typography:** IBM Plex Sans 13px UI; JetBrains Mono 13.5px editor and paths.
- **Motion:** 150–200ms opacity/color only. Honor `prefers-reduced-motion`.
- **Layout:** 48px ribbon, 260px sidebar, 22px status bar, 36px tab bar.

## IA

1. Ribbon: Fichiers, Graphe, Problèmes.
2. Sidebar: vault tree + filename filter.
3. Center: tabs (open notes + Graphe) with Edit / Aperçu for Markdown.
4. Status: vault path, counts, dirty/saved.

## Accessibility

Visible focus ring (`--color-ring`), `aria-pressed` / `aria-expanded` on icon controls, skip-to-editor link, search empty state with a next action.
