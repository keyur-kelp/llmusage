# UI design spec: LLM Usage Control

Version 3, 2026-11-05. Owner: ux-designer. This is the visual source of truth for `frontend/`.
- v1 fixed the audit-1 structure. v2 (§7.1) added the audit-2 gaps.
- **v3 is a visual refresh (§2, §4, §5, §8)**, made after user feedback that the app was "too black" and "doesn't look so design friendly". The user's Mac is in dark mode, and `color-scheme: light dark` put them in the flat near-black default Material dark theme.

Stack: Angular 20 + Angular Material 3 only, plus the approved `marked` + `DOMPurify` (D-1). v3 adds **no** new libraries:
- the logo is inline SVG;
- the fonts are Google Fonts from the CDN, already used in `index.html`;
- the theme switch is `mat-menu`.

**What v3 does not change:** layout structure, breakpoints (§3), every data-testid, every acceptance-test string, and everything audit-2 verified (aria, focus order, live regions, states, responsiveness). Where v3 restyles a component, its anatomy only gains decoration. The roles, labels and testids stay as they are.

---

## 1. Design principles

1. **Money and limits are never ambiguous.** Every amount is `$` plus 6 decimals in tabular figures, right-aligned in tables, and always labelled "left", "used" or "of". A percentage always says what it is a percentage of.
2. **Calm by default, loud only when blocked.** The everyday palette is indigo and cool slate on light surfaces. Amber means low, red means used up or blocked. Colour is never the only signal.
3. **The reason and the way out sit together.** A block always shows which limit was hit, when it resets (IST), and what the user can do in the meantime.
4. **Safe admin.** Destructive or lock-out-relevant actions ask for confirmation. Disabled controls say why.
5. **Designed, not default (v3).** The app has one brand gesture (the indigo-to-violet gradient plus the gauge mark), layered tinted surfaces instead of flat fills, generous radius and soft tinted shadows. Every other choice serves legibility.

---

## 2. Theme tokens (v3)

### 2.1 Brand palette

| Name | Hex | Use |
|---|---|---|
| Indigo 900 | `#312e81` | Gradient start (light top bar, login panel) |
| Indigo 700 | `#4338ca` | Gradient mid, hover on primary |
| **Indigo 600 (brand primary)** | `#4f46e5` | Primary actions, focus, the "normal" meter bar (light) |
| Violet 700 | `#6d28d9` | Gradient end |
| Indigo 300 | `#a5b4fc` | Primary in dark |
| Indigo 100 | `#e0e7ff` | Primary container (light), meta text on gradients |
| **Teal 700 / 300 (tertiary)** | `#0f766e` / `#5eead4` | "On track" chip, the gauge mark's accent arc, Active status |
| Amber 700 / 400 | `#b45309` / `#fbbf24` | Low (under 20% left). **No longer tertiary** (v1 used orange tertiary) |
| Red 700 / 300 | `#b91c1c` / `#fca5a5` | Used up, blocked, errors |
| Slate 900 / 600 | `#0f172a` / `#475569` | Text and secondary text (light) |
| Navy 950 | `#0f1729` | Dark base (replaces the near-black `#121316`) |

**Signature gradient** (`--app-gradient-brand`): light is `linear-gradient(100deg, #312e81 0%, #4338ca 55%, #6d28d9 100%)`. Dark is a dimmer `linear-gradient(100deg, #1e1b4b 0%, #262a6b 60%, #2e1f5e 100%)`. It is used in exactly four places: the top bar, the login brand panel, the user bubble and the logo tile. Nowhere else.

### 2.2 Colour roles, light (default) and dark, with contrast

Every ratio below was computed (WCAG 2.x relative luminance). Text needs ≥ 4.5:1 and non-text UI needs ≥ 3:1. "Tinted bg" is the page base with the 8–10% radial tint at its strongest point (`#e9eafa` light, `#1a233e` dark).

**Surfaces (layering, back to front)**

| Layer | Token | Light | Dark | Use |
|---|---|---|---|---|
| L0 | `--mat-sys-surface` | `#f5f6fb` | `#0f1729` | Page, main chat column, admin page |
| L1 | `--mat-sys-surface-container-low` | `#eef0f8` | `#151f35` | Sidebar, quota column, mobile quota strip |
| L2 | `--app-surface-raised` (`surface-container-lowest` in light) | `#ffffff` | `#1b2640` | Cards, quota cards, assistant bubbles, composer dock, table cards |
| L3 | `--mat-sys-surface-container-high` | `#ffffff` | `#24304d` | Dialogs, menus, select and date panels (plus a level-3 shadow) |
| Track | `--mat-sys-surface-variant` / `--app-track` | `#e2e8f0` | `#2c3a5a` | Meter track |
| Border | `--app-border` | `#e3e7f0` | `#2a3758` | 1 px card and bubble borders (decorative; the shadow does the separating) |
| Border strong | `--mat-sys-outline-variant` | `#d5dae6` | `#33416a` | Dividers, table rows |
| Outline | `--mat-sys-outline` | `#737b8f` | `#7d8bab` | Input borders (non-text, needs 3:1) |

In dark, each step is separated by luminance (L0 to L2 is 1.2:1, L0 to L3 is 1.4:1), a 1 px border and a shadow with a top highlight (§2.5). This is the "clear elevation" the user asked for, instead of the old v2 setup of one near-black fill plus outlines.

**Text and role pairs**

| Pair | Light fg / bg | Ratio | Dark fg / bg | Ratio |
|---|---|---|---|---|
| on-surface / surface | `#0f172a` / `#f5f6fb` | 16.5 | `#e6eaf5` / `#0f1729` | 14.9 |
| on-surface / raised (L2) | `#0f172a` / `#ffffff` | 17.9 | `#e6eaf5` / `#1b2640` | 12.5 |
| on-surface / L3 | `#0f172a` / `#ffffff` | 17.9 | `#e6eaf5` / `#24304d` | 10.9 |
| on-surface-variant / surface | `#475569` / `#f5f6fb` | 7.0 | `#a9b4cc` / `#0f1729` | 8.6 |
| on-surface-variant / tinted bg | `#475569` / `#e9eafa` | 6.4 | `#a9b4cc` / `#1a233e` | 7.5 |
| on-surface-variant / L1 sidebar | `#475569` / `#eef0f8` | 6.7 | `#a9b4cc` / `#151f35` | 7.9 |
| on-surface-variant / L2 | `#475569` / `#ffffff` | 7.6 | `#a9b4cc` / `#1b2640` | 7.2 |
| on-surface-variant / L3 | `#475569` / `#ffffff` | 7.6 | `#a9b4cc` / `#24304d` | 6.3 |
| primary / surface (links, text buttons, focus ring) | `#4f46e5` / `#f5f6fb` | 5.8 | `#a5b4fc` / `#0f1729` | 9.0 |
| primary / L2 | `#4f46e5` / `#ffffff` | 6.3 | `#a5b4fc` / `#1b2640` | 7.5 |
| on-primary / primary (filled buttons) | `#ffffff` / `#4f46e5` | 6.3 | `#1e1b4b` / `#a5b4fc` | 8.0 |
| on-primary-container / primary-container | `#1e1b4b` / `#e0e7ff` | 13.0 | `#e0e7ff` / `#3730a3` | 8.1 |
| on-secondary-container / secondary-container (active nav item, role chip) | `#312e81` / `#e0e7ff` | 9.3 | `#e0e7ff` / `#2b3566` | 9.4 |
| secondary / surface | `#4c5285` / `#f5f6fb` | 6.8 | `#c3c7ee` / `#0f1729` | 10.8 |
| tertiary / surface | `#0f766e` / `#f5f6fb` | 5.1 | `#5eead4` / `#0f1729` | 12.1 |
| on-tertiary-container / tertiary-container ("On track", "Active") | `#115e59` / `#ccfbf1` | 6.7 | `#ccfbf1` / `#134e4a` | 8.4 |
| warn text / surface | `#b45309` / `#f5f6fb` | 4.7 | `#fbbf24` / `#0f1729` | 10.7 |
| on-warn-container / warn-container ("Low" chip) | `#78350f` / `#fef3c7` | 8.1 | `#fde68a` / `#422006` | 11.7 |
| error / surface (inline errors) | `#b91c1c` / `#f5f6fb` | 6.0 | `#fca5a5` / `#0f1729` | 9.4 |
| error / L2 | `#b91c1c` / `#ffffff` | 6.5 | `#fca5a5` / `#1b2640` | 7.9 |
| on-error / error (banner icon tile) | `#ffffff` / `#b91c1c` | 6.5 | `#450a0a` / `#fca5a5` | 8.5 |
| on-error-container / error-container (block banner body) | `#7f1d1d` / `#fee2e2` | 8.2 | `#fecaca` / `#4c1d24` | 9.6 |
| banner title / error-container | `#991b1b` / `#fee2e2` | 6.8 | `#fecaca` / `#4c1d24` | 9.6 |
| model chip | `#3730a3` / `#eef2ff` | 8.9 | `#c7d2fe` / `#26305a` | 8.5 |
| icon tile (card header) | `#4338ca` / `#eef2ff` | 7.1 | `#c7d2fe` / `#26305a` | 8.5 |
| inverse (snackbar, tooltip) | `#f1f5f9` / `#1e293b` | 13.4 | `#0f172a` / `#e6eaf5` | 14.8 |
| inverse-primary (snackbar action) | `#a5b4fc` / `#1e293b` | 7.3 | `#4f46e5` / `#e6eaf5` | 5.2 |
| code block | `#0f172a` / `#f1f3f9` | 16.1 | `#e6eaf5` / `#111a2e` | 14.4 |
| table header text / header row | `#475569` / `#f8f9fc` | 7.2 | `#a9b4cc` / `#1f2a47` | 6.8 |
| row text (meta) / row hover | `#475569` / `#f5f7ff` | 7.1 | `#a9b4cc` / `#222e4d` | 6.4 |
| admin hero card meta | `#475569` / `#eef2ff` | 6.8 | `#a9b4cc` / `#222c55` | 6.5 |

**On the gradient** (top bar, login panel, user bubble). Checked at every stop:

| Pair | Light, worst stop | Ratio | Dark, worst stop | Ratio |
|---|---|---|---|---|
| white text / gradient | `#ffffff` / `#4f46e5` | 6.3 | `#ffffff` / `#262a6b` | 12.9 |
| meta `#e0e7ff` (light) or `#c7d2fe` (dark) / gradient | `#e0e7ff` / `#4f46e5` | 5.1 | `#c7d2fe` / `#262a6b` | 8.7 |
| white / glass chip (`rgba(255,255,255,.16)` over the end stop) | `#ffffff` / `#844adf` | 5.2 | `#ffffff` / `#4f4378` | 8.7 |
| User bubble white / gradient | `#ffffff` / `#4f46e5`→`#6d28d9` | 6.3–7.1 | `#ffffff` / `#4338ca`→`#5b21b6` | 7.9–9.0 |
| User bubble meta "You" | `#e0e7ff` / `#4f46e5` | 5.1 | `#e0e7ff` / `#4338ca` | 6.4 |

**Meter bars (non-text, ≥ 3:1 against the track)**

| State | Light bar / track | Ratio | Dark bar / track | Ratio |
|---|---|---|---|---|
| Normal (≥ 20% left) | `#4f46e5` / `#e2e8f0` | 5.1 | `#a5b4fc` / `#2c3a5a` | 5.7 |
| Low (0–20%) | `#b45309` / `#e2e8f0` | 4.1 | `#fbbf24` / `#2c3a5a` | 6.8 |
| Used up (0%) | the track turns `#b91c1c` (the bar is empty) | 6.5 vs card | the track turns `#fca5a5` | 7.9 vs card |

**Rule (unchanged):** never lower text contrast with `opacity`. Use `--mat-sys-on-surface-variant`.

### 2.3 Typography

**Pairing:** **Plus Jakarta Sans** (700/600) for brand, headings and card titles, and **Inter** (400/500/600) for body, labels and every number. Inter has true tabular figures (`tnum`), so 6 dp money columns line up. Plus Jakarta's geometric, slightly rounded forms give the brand its character. Both come from Google Fonts. This replaces Roboto.

`index.html` font link (replaces the Roboto link; keep `preconnect` and the Material Icons link):
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">
```

| Token | Font, size/line height, weight, tracking | Use |
|---|---|---|
| `--app-type-display` | Jakarta 32/40 700, −0.02em | Login panel headline (≥ 960 only; 26/34 under 960) |
| `--app-type-h1` | Jakarta 24/32 700, −0.01em | Page title "Admin"; login "Sign in" (as h2) |
| `--app-type-brand` | Jakarta 17/24 700, −0.01em | Top-bar wordmark |
| `--app-type-title` | Jakarta 15/22 600 | Card titles (`h2`): "Your weekly quota", "Quotas", "System month-to-date" |
| `--app-type-section` | Jakarta 16/24 600 | Section headers: "Users (week-to-date)", "Daily breakdown" |
| `--app-type-number-xl` | Inter 28/36 600, −0.01em, tnum | Big quota amount |
| `--app-type-number-l` | Inter 22/28 600, tnum | Admin system card amount |
| `--mat-sys-body-large` | Inter 16/24 400 | Message text, inputs |
| `--mat-sys-body-medium` | Inter 14/20 400 | Table cells, meta lines |
| `--mat-sys-label-large` | Inter 14/20 500 | Buttons, tabs (tabs at weight 600) |
| `--mat-sys-label-medium` | Inter 12/16 500 | Chips, "who" line, table headers (600) |
| `--app-type-overline` | Inter 11/16 600, 0.08em, `text-transform: uppercase` | Sidebar group headers "Today", "Earlier" only. Not used on table headers, because the transformed text can change the accessible name |

Numbers always use `.app-num` (`font-variant-numeric: tabular-nums lining-nums`).

### 2.4 Spacing, radius, icons

- Spacing: unchanged 4/8 grid (`--app-space-1…7` = 4, 8, 12, 16, 24, 32, 48).
- Radius (v3, larger): `--app-radius-xs: 6px` (code, tail corner), `-s: 10px` (inputs, icon tiles), `-m: 14px` (buttons, nav items, banner), `-l: 18px` (cards, bubbles, table cards), `-xl: 24px` (dialogs, composer dock, login card), `-pill: 999px`.
- Icon sizes: `--app-icon-s: 16px` (inside chips and meta lines), `--app-icon-m: 20px` (inside buttons, menu items, card-header tiles), `--app-icon-l: 24px` (icon buttons, banner), `--app-icon-xl: 32px` (empty-state tile). Always set `width`, `height` and `font-size` together, and `flex: none`. This also fixes the v2 banner-icon shrink.

### 2.5 Elevation (tinted shadows; never pure-black shadows in light)

| Token | Light | Dark |
|---|---|---|
| `--app-shadow-1` (cards, bubbles) | `0 1px 2px rgb(15 23 42 / .05), 0 1px 3px rgb(30 27 75 / .07)` | `0 1px 0 rgb(255 255 255 / .04) inset, 0 1px 2px rgb(0 0 0 / .35), 0 2px 6px rgb(0 0 0 / .25)` |
| `--app-shadow-2` (composer dock, hovered card, top bar) | `0 4px 12px -2px rgb(30 27 75 / .10), 0 2px 4px rgb(15 23 42 / .05)` | `0 1px 0 rgb(255 255 255 / .05) inset, 0 6px 16px -4px rgb(0 0 0 / .5)` |
| `--app-shadow-3` (menus, dialogs) | `0 16px 40px -12px rgb(30 27 75 / .28), 0 4px 10px rgb(15 23 42 / .06)` | `0 1px 0 rgb(255 255 255 / .06) inset, 0 18px 44px -12px rgb(0 0 0 / .65)` |

### 2.6 Motion

- `--app-motion-fast: 150ms` (hover, colour), `--app-motion-base: 200ms` (enter, theme cross-fade), `--app-motion-slow: 250ms` (banner enter, meter fill).
- Easing: `--app-ease: cubic-bezier(.2, 0, 0, 1)` (standard) and `--app-ease-out: cubic-bezier(.05, .7, .1, 1)` (enter).
- Animate only `opacity`, `transform`, `background-color`, `border-color`, `box-shadow` and `color`. Never use `transition: all`, and never put a global `* { transition }` on the page.
- **`prefers-reduced-motion: reduce`**: all durations become 0 ms, the typing dots stop (shown static at 0.6 scale with full-contrast colour), message and banner enter animations are removed, and Material animations are turned off by providing `MATERIAL_ANIMATIONS` with `{ animationsDisabled: true }` when `matchMedia('(prefers-reduced-motion: reduce)').matches`.

### 2.7 Paste-in SCSS: `frontend/src/styles.scss` (replaces lines 1–41 of the current file; keep the rest and the §4 additions)

The light/dark mechanism:
- `theme-type: color-scheme` makes Material emit every `--mat-sys-*` colour as `light-dark(light, dark)`, and every app token below uses `light-dark()` too.
- The theme then flips by changing **`color-scheme` on `<html>`** and nothing else. The `ThemeService` (§8) sets one class: `theme-light` (the default), `theme-dark` or `theme-system`.
- `light-dark()` is supported in Chrome 123+, Safari 17.5+ and Firefox 120+.

```scss
@use '@angular/material' as mat;

html {
  color-scheme: light;                         // v3: light by default, whatever the OS says
  @include mat.theme((
    color: (
      primary: mat.$violet-palette,            // base hues for generated state layers; exact roles overridden below
      tertiary: mat.$cyan-palette,
      theme-type: color-scheme,                // emits light-dark() so the class switch below works
    ),
    typography: (
      plain-family: ('Inter', system-ui, -apple-system, 'Segoe UI', sans-serif),
      brand-family: ('Plus Jakarta Sans', 'Inter', system-ui, sans-serif),
      bold-weight: 700,
      medium-weight: 500,
      regular-weight: 400,
    ),
    density: 0,
  ));

  // Exact v3 roles (§2.2). Keys are M3 system role names.
  @include mat.theme-overrides((
    background:                light-dark(#f5f6fb, #0f1729),
    on-background:             light-dark(#0f172a, #e6eaf5),
    surface:                   light-dark(#f5f6fb, #0f1729),
    surface-dim:               light-dark(#e6e9f3, #0b1222),
    surface-bright:            light-dark(#ffffff, #24304d),
    surface-container-lowest:  light-dark(#ffffff, #0b1222),
    surface-container-low:     light-dark(#eef0f8, #151f35),
    surface-container:         light-dark(#e9ecf6, #1b2640),
    surface-container-high:    light-dark(#ffffff, #24304d),
    surface-container-highest: light-dark(#e2e6f2, #2c3a5a),
    surface-variant:           light-dark(#e2e8f0, #2c3a5a),
    on-surface:                light-dark(#0f172a, #e6eaf5),
    on-surface-variant:        light-dark(#475569, #a9b4cc),
    outline:                   light-dark(#737b8f, #7d8bab),
    outline-variant:           light-dark(#d5dae6, #33416a),
    primary:                   light-dark(#4f46e5, #a5b4fc),
    on-primary:                light-dark(#ffffff, #1e1b4b),
    primary-container:         light-dark(#e0e7ff, #3730a3),
    on-primary-container:      light-dark(#1e1b4b, #e0e7ff),
    secondary:                 light-dark(#4c5285, #c3c7ee),
    on-secondary:              light-dark(#ffffff, #23284f),
    secondary-container:       light-dark(#e0e7ff, #2b3566),
    on-secondary-container:    light-dark(#312e81, #e0e7ff),
    tertiary:                  light-dark(#0f766e, #5eead4),
    on-tertiary:               light-dark(#ffffff, #042f2e),
    tertiary-container:        light-dark(#ccfbf1, #134e4a),
    on-tertiary-container:     light-dark(#115e59, #ccfbf1),
    error:                     light-dark(#b91c1c, #fca5a5),
    on-error:                  light-dark(#ffffff, #450a0a),
    error-container:           light-dark(#fee2e2, #4c1d24),
    on-error-container:        light-dark(#7f1d1d, #fecaca),
    inverse-surface:           light-dark(#1e293b, #e6eaf5),
    inverse-on-surface:        light-dark(#f1f5f9, #0f172a),
    inverse-primary:           light-dark(#a5b4fc, #4f46e5),
  ));

  @include mat.strong-focus-indicators((border-color: var(--app-focus), border-width: 2px, border-radius: 10px));
}
html.theme-light  { color-scheme: light; }
html.theme-dark   { color-scheme: dark; }
html.theme-system { color-scheme: light dark; }

:root {
  // spacing (unchanged)
  --app-space-1: 4px;  --app-space-2: 8px;  --app-space-3: 12px; --app-space-4: 16px;
  --app-space-5: 24px; --app-space-6: 32px; --app-space-7: 48px;
  // radius (v3)
  --app-radius-xs: 6px; --app-radius-s: 10px; --app-radius-m: 14px; --app-radius-l: 18px;
  --app-radius-xl: 24px; --app-radius-pill: 999px;
  // icons
  --app-icon-s: 16px; --app-icon-m: 20px; --app-icon-l: 24px; --app-icon-xl: 32px;
  // layout (unchanged; topbar is 60 in v3)
  --app-topbar-h: 60px; --app-sidebar-w: 280px; --app-quota-w: 300px; --app-content-max: 880px;
  // motion
  --app-motion-fast: 150ms; --app-motion-base: 200ms; --app-motion-slow: 250ms;
  --app-ease: cubic-bezier(.2, 0, 0, 1); --app-ease-out: cubic-bezier(.05, .7, .1, 1);

  // fonts
  --app-font-brand: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  --app-font-plain: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --app-font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --app-type-display:   700 32px/40px var(--app-font-brand);
  --app-type-h1:        700 24px/32px var(--app-font-brand);
  --app-type-brand:     700 17px/24px var(--app-font-brand);
  --app-type-title:     600 15px/22px var(--app-font-brand);
  --app-type-section:   600 16px/24px var(--app-font-brand);
  --app-type-number-xl: 600 28px/36px var(--app-font-plain);
  --app-type-number-l:  600 22px/28px var(--app-font-plain);
  --app-type-overline:  600 11px/16px var(--app-font-plain);
  --app-num: 'tnum' 1, 'lnum' 1;

  // surfaces and borders
  --app-surface-raised: light-dark(#ffffff, #1b2640);
  --app-surface-sunken: light-dark(#f1f3f9, #111a2e);   // code blocks
  --app-border:         light-dark(#e3e7f0, #2a3758);
  --app-track:          light-dark(#e2e8f0, #2c3a5a);
  --app-row-hover:      light-dark(#f5f7ff, #222e4d);
  --app-thead-bg:       light-dark(#f8f9fc, #1f2a47);
  --app-tile-bg:        light-dark(#eef2ff, #26305a);   // icon tiles, model chip
  --app-tile-fg:        light-dark(#4338ca, #c7d2fe);
  --app-model-chip-fg:  light-dark(#3730a3, #c7d2fe);
  --app-focus:          light-dark(#4f46e5, #a5b4fc);

  // brand gradient + page tint
  --app-grad-1: light-dark(#312e81, #1e1b4b);
  --app-grad-2: light-dark(#4338ca, #262a6b);
  --app-grad-3: light-dark(#6d28d9, #2e1f5e);
  --app-gradient-brand: linear-gradient(100deg, var(--app-grad-1) 0%, var(--app-grad-2) 55%, var(--app-grad-3) 100%);
  --app-bubble-1: light-dark(#4f46e5, #4338ca);
  --app-bubble-2: light-dark(#6d28d9, #5b21b6);
  --app-gradient-bubble: linear-gradient(135deg, var(--app-bubble-1), var(--app-bubble-2));
  --app-on-brand: #ffffff;
  --app-on-brand-muted: light-dark(#e0e7ff, #c7d2fe);
  --app-page-tint: radial-gradient(1200px 600px at 100% -10%, light-dark(rgb(99 102 241 / .08), rgb(129 140 248 / .10)), transparent 60%);
  --app-hero-tint: linear-gradient(135deg, light-dark(#eef2ff, #222c55) 0%, var(--app-surface-raised) 65%);

  // status roles (v3: warn is its own amber, not tertiary)
  --app-ok: var(--mat-sys-primary);
  --app-good-container: var(--mat-sys-tertiary-container);
  --app-on-good-container: var(--mat-sys-on-tertiary-container);
  --app-warn: light-dark(#b45309, #fbbf24);
  --app-warn-container: light-dark(#fef3c7, #422006);
  --app-on-warn-container: light-dark(#78350f, #fde68a);
  --app-danger: var(--mat-sys-error);
  --app-danger-container: var(--mat-sys-error-container);
  --app-on-danger-container: var(--mat-sys-on-error-container);
  --app-danger-title: light-dark(#991b1b, #fecaca);
  --app-danger-border: light-dark(#fecaca, #7f1d1d);
  --app-warn-border: light-dark(#fde68a, #78350f);

  // shadows
  --app-shadow-1: light-dark(rgb(15 23 42 / .05), rgb(0 0 0 / .35)) 0 1px 2px, light-dark(rgb(30 27 75 / .07), rgb(0 0 0 / .25)) 0 1px 3px, inset 0 1px 0 light-dark(transparent, rgb(255 255 255 / .04));
  --app-shadow-2: light-dark(rgb(30 27 75 / .10), rgb(0 0 0 / .5)) 0 4px 12px -2px, light-dark(rgb(15 23 42 / .05), transparent) 0 2px 4px, inset 0 1px 0 light-dark(transparent, rgb(255 255 255 / .05));
  --app-shadow-3: light-dark(rgb(30 27 75 / .28), rgb(0 0 0 / .65)) 0 16px 40px -12px, light-dark(rgb(15 23 42 / .06), transparent) 0 4px 10px, inset 0 1px 0 light-dark(transparent, rgb(255 255 255 / .06));

  // Material component tokens (names verified against @angular/material 20)
  --mat-button-filled-container-shape: var(--app-radius-m);
  --mat-button-outlined-container-shape: var(--app-radius-m);
  --mat-button-text-container-shape: var(--app-radius-m);
  --mat-button-tonal-container-shape: var(--app-radius-m);
  --mat-button-protected-container-shape: var(--app-radius-m);
  --mat-button-filled-container-height: 44px;
  --mat-card-outlined-container-shape: var(--app-radius-l);
  --mat-card-outlined-container-color: var(--app-surface-raised);
  --mat-card-outlined-outline-color: var(--app-border);
  --mat-card-elevated-container-color: var(--app-surface-raised);
  --mat-dialog-container-shape: var(--app-radius-xl);
  --mat-dialog-container-color: var(--mat-sys-surface-container-high);
  --mat-menu-container-shape: var(--app-radius-m);
  --mat-menu-container-color: var(--mat-sys-surface-container-high);
  --mat-select-panel-background-color: var(--mat-sys-surface-container-high);
  --mat-datepicker-calendar-container-background-color: var(--mat-sys-surface-container-high);
  --mat-datepicker-calendar-container-shape: var(--app-radius-l);
  --mat-form-field-outlined-container-shape: var(--app-radius-s);
  --mat-form-field-outlined-outline-color: var(--mat-sys-outline);
  --mat-form-field-outlined-hover-outline-color: var(--mat-sys-on-surface);
  --mat-form-field-outlined-focus-outline-width: 2px;
  --mat-tab-active-indicator-height: 3px;
  --mat-tab-active-indicator-shape: 3px 3px 0 0;
  --mat-tab-label-text-weight: 600;
  --mat-list-active-indicator-shape: var(--app-radius-m);
  --mat-table-background-color: transparent;
  --mat-table-header-headline-color: var(--mat-sys-on-surface-variant);
  --mat-table-header-headline-weight: 600;
  --mat-table-row-item-outline-color: var(--mat-sys-outline-variant);
  --mat-paginator-container-background-color: transparent;
  --mat-sidenav-container-shape: 0;
  --mat-sidenav-container-background-color: var(--mat-sys-surface-container-low);
  --mat-sidenav-content-background-color: transparent;
  --mat-tooltip-container-shape: var(--app-radius-s);
  --mat-snack-bar-container-shape: var(--app-radius-m);
  --mat-progress-bar-track-shape: var(--app-radius-pill);
}

@media (prefers-reduced-motion: reduce) {
  :root { --app-motion-fast: 0ms; --app-motion-base: 0ms; --app-motion-slow: 0ms; }
}

html, body { height: 100%; margin: 0; }
body {
  font: var(--mat-sys-body-large);
  color: var(--mat-sys-on-surface);
  background: var(--app-page-tint), var(--mat-sys-surface);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  transition: background-color var(--app-motion-base) var(--app-ease), color var(--app-motion-base) var(--app-ease);
}
.app-num { font-feature-settings: var(--app-num); font-variant-numeric: tabular-nums lining-nums; }
.mat-icon { flex: none; }
.app-icon-s { width: var(--app-icon-s) !important; height: var(--app-icon-s) !important; font-size: var(--app-icon-s) !important; }
.app-icon-m { width: var(--app-icon-m) !important; height: var(--app-icon-m) !important; font-size: var(--app-icon-m) !important; }
.app-icon-l { width: var(--app-icon-l) !important; height: var(--app-icon-l) !important; font-size: var(--app-icon-l) !important; }

// Surfaces and shared primitives
.app-card {
  background: var(--app-surface-raised); border: 1px solid var(--app-border);
  border-radius: var(--app-radius-l); box-shadow: var(--app-shadow-1);
}
.app-icon-tile {
  display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px;
  border-radius: var(--app-radius-s); background: var(--app-tile-bg); color: var(--app-tile-fg);
}
.app-icon-tile .mat-icon { width: var(--app-icon-m); height: var(--app-icon-m); font-size: var(--app-icon-m); }

// Chips (v3: filled tints, never colour-only)
.app-chip {
  display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px;
  border-radius: var(--app-radius-pill); font: var(--mat-sys-label-medium); font-weight: 600;
  background: var(--app-tile-bg); color: var(--app-tile-fg); border: 0;
}
.app-chip .mat-icon { width: var(--app-icon-s); height: var(--app-icon-s); font-size: var(--app-icon-s); }
.app-chip.good   { background: var(--app-good-container);   color: var(--app-on-good-container); }
.app-chip.warn   { background: var(--app-warn-container);   color: var(--app-on-warn-container); }
.app-chip.danger { background: var(--app-danger-container); color: var(--app-on-danger-container); }
.app-chip.neutral { background: var(--mat-sys-surface-container-low); color: var(--mat-sys-on-surface-variant); }

// Meter (§4.1). Apply to <mat-progress-bar class="app-meter ...">
.app-meter {
  --mat-progress-bar-track-height: 10px; --mat-progress-bar-active-indicator-height: 10px;
  --mat-progress-bar-track-color: var(--app-track);
  --mat-progress-bar-active-indicator-color: var(--app-ok);
  border-radius: var(--app-radius-pill); overflow: hidden;
}
.app-meter.low     { --mat-progress-bar-active-indicator-color: var(--app-warn); }
.app-meter.used-up { --mat-progress-bar-track-color: var(--app-danger); }

// Enter animation for bubbles and banner
@keyframes app-rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: no-preference) {
  .app-rise { animation: app-rise var(--app-motion-base) var(--app-ease-out) both; }
}
```

The `.visually-hidden`, `.app-muted`, table and `.app-cards` rules below line 41 of the current file stay. §4.8 gives v3 additions for the tables.

---

## 3. Layout and breakpoints (unchanged from v2)

Breakpoints stay at ≥ 1024, 600–1023 and < 600, and so do the column structure, the sidenav, the quota strip, the pinned composer and the `.app-cards` table-to-card switch. The only v3 layout change is the top bar height, 56 to **60 px**, to give the logo room. On mobile it stays at 56 px (`@media (max-width: 599.98px) { :root { --app-topbar-h: 56px } }`).

### 3.1 Wireframes (v3 changes marked with *)

**Chat, desktop ≥ 1024**
```
+==================================================================================+
|* [◔] LLM Usage Control  (gradient bar, white)          [☀] UX USER  Admin  Log out|  60
+--------------+-------------------------------------------------+-----------------+
| [+ New chat] |  Model [claude-sonnet-5-5 v]                    | +-------------+ |
|              |                                                 | |*[👤] Your weekly quota (On track)|
| TODAY        |                         +-----------------------+| | $0.098234 left|
| ▌Name three… |                         |  You  (gradient bubble)|| | [██████████░] | 10px rounded
|   Today 20:32|                         +-----------------------+| | 98.23% left    of $0.100000 |
| EARLIER      | +---------------------------------+             | | ⏱ Resets Sat 07 Nov 2026, 00:00 IST |
|   …          | |*[◔] Assistant  [claude-sonnet-5-5]|  (white card, shadow) +-------------+ |
|              | |  • Red  • **Blue**              |             |  (System card)   |
|              | +---------------------------------+             |                  |
|              | +------- composer dock (radius 24, shadow-2) --+|                  |
|              | | [ Message                         ] [➤ Send] ||                  |
|              | | Enter to send · Shift+Enter for a new line    ||                  |
|              | +----------------------------------------------+|                  |
+--------------+-------------------------------------------------+-----------------+
  L1 sidebar        L0 page (+ radial tint top-right)              L1 quota column
```

**Chat, empty state***
```
                 +------------+
                 |  [ forum ] |   72 px tile, radius 20, brand gradient, white 32 px icon
                 +------------+
              Start a conversation              (type-h1 22/30 Jakarta 700)
   Pick a model and send a message. Each reply shows
   the model that answered, and your quota updates after it.   (body-medium, on-surface-variant, max 420)
     [ 💡 Summarise a paragraph ]  [ 💡 Explain a concept ]  [ 💡 Draft an email ]  (should: suggestion chips)
```

**Login, ≥ 960 (split)***
```
+-------------------------------+--------------------------------------------+
| (brand gradient panel, 44%)   |                                  [☀ v]     |
|  [◔] LLM Usage Control        |       +--------------------------------+   |
|                               |       |  Sign in                       |   |
|  Chat with Claude,            |       |  Use the account your admin    |   |
|  within budget.               |       |  created for you.              |   |
|                               |       |  [ Email                     ] |   |
|  ✓ Your weekly quota, live    |       |  [ Password              (👁) ] |   |
|  ✓ A team-wide monthly cap    |       |  ! Invalid email or password   |   |
|  ✓ Cost per message to 6 dp   |       |  [         Sign in           ] |   |
|                               |       +--------------------------------+   |
|  Times shown in IST           |                                            |
+-------------------------------+--------------------------------------------+
```
At 600–959 the panel becomes a 120 px gradient header band above the centred card. Under 600 it is a 96 px band with the logo and wordmark only, and the card is full width with 16 px margins, overlapping the band by 24 px.

---

## 4. Components (v3)

Anatomy, roles, testids and copy from v1/v2 are kept. Each section adds the **v3 look** and its states.

### 4.1 Quota meter `[ui-quota-meter]`
- **Card:** `.app-card`, padding 20 (16 on tablet), gap 12 between cards.
- **Header row:** `.app-icon-tile` (`person` for the user card, `groups` for the system card), the `h2` title in `--app-type-title`, and a state chip at the end (`margin-inline-start: auto`).
  - ≥ 20% left: **"On track"** chip, `.app-chip.good`, `check_circle` icon (new, so the normal state also carries text).
  - Under 20% left: **"Low"** chip, `.app-chip.warn`, `warning` icon.
  - 0% left: **"Used up"** chip, `.app-chip.danger`, `block` icon.
- **Amount:** the `quota-*-remaining` element in `--app-type-number-xl`, tnum. The word "left" is wrapped in `<span class="unit">` (15/22 500, on-surface-variant) inside the **same** testid element, so its text stays `$0.098234 left`.
- **Meter:** `mat-progress-bar class="app-meter"` plus a state class (`low` or `used-up`), 10 px thick and pill-shaped. Keep `aria-label` and `aria-valuetext` (v2). The host clip rounds both track ends. The indicator's leading edge stays square, which is intended because it reads as an exact value.
- **Meta row** (flex, space-between): "98.23% left" (body-medium 600, on-surface) at the start and "of $0.100000" (plus " (personal limit)" when overridden) at the end, on-surface-variant.
- **Reset line:** a `schedule` icon (`--app-icon-s`) plus "Resets Sat 07 Nov 2026, 00:00 IST" (testid `quota-*-reset`).
- **State styling:**
  - Low: `border-color: var(--app-warn-border); box-shadow: inset 3px 0 0 var(--app-warn), var(--app-shadow-1)`.
  - Used up: `border-color: var(--app-danger-border); box-shadow: inset 3px 0 0 var(--app-danger), var(--app-shadow-1)`. This replaces the v2 2 px left border.
- **Loading:** the card with a skeleton. Two 12 px rounded bars (`--app-track`, shimmer only when motion is allowed) plus the visible text "Loading quota…". **Error:** the card with an `error` icon tile in the danger colours, "Couldn't load quota." and a `mat-button` "Retry". `role="alert"` is kept.
- **Mobile strip:** L1 background. Each row: a 6 px wide × 28 px tall vertical pill in the state colour, then "You" or "Sys" (label-medium 600), the amount and "· 98%". The chevron button keeps `aria-expanded`. The expanded detail uses the same card styles without the shadow.
- Testids and copy constraints are unchanged (`$0.10`, `$0.100000 left`).

### 4.2 Block banner `[ui-block-banner]`
- **Container:** `role="alert"`, `tabindex="-1"`, `.app-rise` enter animation, `background: var(--app-danger-container)`, `border: 1px solid var(--app-danger-border)`, radius `--app-radius-l`, padding 16 20, `box-shadow: var(--app-shadow-1)`.
- **Leading tile:** 40 px circle, `background: var(--app-danger)`, `color: var(--mat-sys-on-error)`, `block` icon at `--app-icon-l` with `flex: none` (fixes the audit-2 shrink).
- **Title** (`quota-block-reason`): `--app-type-title` at 16/24, `--app-danger-title`. **Body:** body-medium, `--app-on-danger-container`. The reset time (`quota-reset-time`) is `<strong>`, tnum, `white-space: nowrap`.
- **Copy (unchanged):**
  - Personal: "Personal quota reached" / "You've used your weekly limit of $0.100000. You can chat again from **Sat 07 Nov 2026, 00:00 IST**. Ask an admin if you need more."
  - System: "System quota reached" / "The team's monthly limit of $0.500000 is used up, so chat is paused for everyone. It resets **01 Dec 2026, 00:00 IST**."
- **Focus:** `:focus-visible` gives a 2 px `--app-focus` outline at 2 px offset. The focus-on-block behaviour is unchanged.
- The `chat-error` banner (non-quota errors) uses the same shape with an `error_outline` icon.

### 4.3 Message bubbles `[ui-message]`
- **User:** `background: var(--app-gradient-bubble)`, `color: #fff`, radius `18px 18px 6px 18px` (tail bottom-right), `box-shadow: var(--app-shadow-1)`, padding 12 16, max-width 80% (92% on mobile). The "You" line is `--app-on-brand-muted`, label-medium 600. Links inside use `#fff` with an underline.
- **Assistant:** `.app-card` look (raised surface, `--app-border`, `--app-shadow-1`), radius `18px 18px 18px 6px` (tail bottom-left), padding 12 16, max-width 85%. The who line is a 20 px brand gauge mark (§8.3, `aria-hidden`), then "Assistant" (label-medium 600, on-surface), then the **model chip**: `--app-tile-bg` background, `--app-model-chip-fg` text, label-medium 500, height 22, pill. **The `message-model` element must contain only the model id text** (the test uses exact `toHaveText`). Put no icon inside it.
- **Markdown:** paragraphs 0 0 8px. Lists use 20 px indent. Inline `code` and `pre` use `--app-font-mono` 13.5/20 on `--app-surface-sunken`, radius `--app-radius-xs`, padding 2 6 (`pre` 12 14, `overflow-x: auto`). Links are `--mat-sys-primary`, underlined. Tables in replies use a 1 px `--mat-sys-outline-variant` grid.
- **Enter:** new bubbles get `.app-rise` (200 ms). Streaming deltas do **not** re-trigger it.
- **Spacing:** 12 px between bubbles. 20 px between turns from different senders.
- Roles are unchanged: `role="log"`, `aria-live="polite"`, `aria-busy` on the streaming bubble.

### 4.4 Streaming indicator `[ui-streaming]`
- Typing bubble: the assistant shape with three 8 px dots in `--mat-sys-primary` (v2 used on-surface-variant), animated `translateY(-3px)` plus opacity over 1.2 s, staggered 150 ms. Reduced motion: static dots.
- After the first delta, the bubble's bottom edge shows a 3 px indeterminate `mat-progress-bar` clipped to the bubble radius (`overflow: hidden` on the bubble).
- Behaviour is unchanged (the textarea stays enabled, focus stays put).

### 4.5 Conversation sidebar `[ui-sidebar]`
- L1 surface. 16 px padding. A 1 px `--app-border` on the inline-end edge.
- "New chat": `mat-flat-button`, full width, 44 px high, `add` icon at `--app-icon-m`.
- Group headers ("Today", "Earlier"): `--app-type-overline`, on-surface-variant, padding 16 12 6.
- Items: radius `--app-radius-m`, margin 2 0, title body-medium 500 (ellipsis), time label-medium on-surface-variant.
  - Hover: `background: var(--app-row-hover)` over 150 ms.
  - Active: `--mat-list-active-indicator-color: var(--mat-sys-secondary-container)`, plus a 3 px × 20 px pill in `--mat-sys-primary` at the inline-start edge (`::before`), and the title in on-secondary-container.
- Empty state: a `forum` icon at `--app-icon-l` in an `.app-icon-tile`, then "No conversations yet" (string kept), then "Your chats will appear here." Loading: 3 skeleton rows (radius 10, `--app-track`).

### 4.6 Composer `[ui-composer]`
- **Dock:** wraps the form field and the Send button. `.app-card` with radius `--app-radius-xl`, `box-shadow: var(--app-shadow-2)`, padding 8 8 4 16, margin-bottom 12.
- **Field:** inside the dock the outline field stays (visible `mat-label` "Message" is kept for accessibility) but uses `--mat-form-field-outlined-outline-color: transparent` in its resting state. On focus the outline becomes the 2 px primary, so the dock carries the edge. The hint is kept.
- **Send:** `mat-flat-button`, `send` icon, label "Send" (icon-only with `aria-label="Send"` on mobile), radius `--app-radius-m`.
  - Busy: a 18 px spinner in `--mat-sys-on-primary`.
  - Disabled: Material default (on-surface 12%).
  - Blocked: keep the tooltip "Blocked until <reset>".
- Dark: the dock is L2 (`#1b2640`) on L0. In v2 this was an outline on near-black.

### 4.7 Top bar / app shell `[ui-shell]`
- **Bar:** `background: var(--app-gradient-brand)`, `color: var(--app-on-brand)`, height `--app-topbar-h`, padding 0 20 (8 on mobile), `box-shadow: var(--app-shadow-2)`, `position: relative; z-index: 2`. Remove the v2 `surface-container` background and border.
- **Brand:**
  - **Logo tile** (§8.3): 32 px, radius 10, `rgb(255 255 255 / .14)` fill, 1 px `rgb(255 255 255 / .28)` border, 20 px gauge SVG.
  - **Wordmark:** "LLM Usage Control" in `--app-type-brand`. On admin the breadcrumb "›" and "Admin" use `--app-on-brand-muted` at title-medium 500.
- **Right cluster (desktop):**
  - The user name (body-medium, `--app-on-brand-muted`).
  - The role chip "ADMIN": `rgb(255 255 255 / .16)` fill, white, label-medium 600, pill. Contrast 5.2 or better (§2.2).
  - The **theme toggle** (§8), then Admin/Chat and Log out.
- **Buttons on the bar:** text and icon buttons need on-brand colours, so scope these tokens to `.bar`:
  ```scss
  .bar {
    --mat-button-text-label-text-color: #fff;
    --mat-button-text-state-layer-color: #fff;
    --mat-icon-button-icon-color: #fff;
    --mat-icon-button-state-layer-color: #fff;
    --app-focus: #fff;                       // focus ring on the gradient: white, 6.3:1 or better
  }
  .bar :is(a, button):focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  ```
- **Skip link:** white pill with `--mat-sys-primary` text (5.8), shown over the bar on focus.
- Behaviour, mobile ⋮ menu, `h1` and `<title>` are unchanged. The theme item joins the ⋮ menu (§8).

### 4.8 Data tables `[ui-tables]`
- **Card:** each table sits in a `.app-table-card` (`.app-card` plus `overflow: hidden`). `.app-table-scroll` lives inside it, so only the table scrolls.
- **Header row:** `background: var(--app-thead-bg)`, height 44, label-medium 600 (no uppercase), on-surface-variant, and a bottom border `--mat-sys-outline-variant`.
- **Body rows:** 52 px high. Hover `background: var(--app-row-hover)` over 150 ms. The last row has no border. The first column keeps 20 px inline-start padding, the last column 20 px inline-end.
- **User cell:** name (body-medium 500) above email (body-small, on-surface-variant), both two-line on desktop too (v2 put them inline).
- **Status column (Users tab):** "Active" as `.app-chip.good` with `check_circle`, "Inactive" as `.app-chip.neutral` with `pause_circle`. The slide toggle stays as the control. The chip is the label (text, not colour only).
- **Override chip:** `.app-chip` (tile colours) "override".
- **Total row:** `background: var(--app-thead-bg)`, weight 600, 1 px top border `--mat-sys-outline`.
- **Paginator:** transparent, inside the card's footer with a 1 px top border.
- **Mobile `.app-cards`:** each row is an `.app-card`, radius `--app-radius-l`, padding 12 16, gap 10.
- Number alignment, money, percent and date formats are unchanged.

### 4.9 Forms and validation `[ui-forms]`
- Settings groups become `.app-card` sections with padding 24, a header row (`.app-icon-tile` with `savings` for "Quotas" and `event_repeat` for "Reset schedule", plus the `--app-type-title` heading) and fields with a 16 px gap and `subscriptSizing="dynamic"` (v2).
- **Action bar:** at the bottom of the form, a row with a 1 px top border holding "Changes apply to the next message." (on-surface-variant), then Discard (`mat-button`), then Save changes (`mat-flat-button`).
- The success snackbar uses inverse surface with radius 14.
- Validation behaviour is unchanged (D-2 is still open).

### 4.10 Confirm dialogs `[ui-confirm-dialog]`
- Radius 24, L3 surface, `--app-shadow-3` (Material level 3 is fine), padding 24.
- Title: `--app-type-section` 20/28.
- Destructive dialogs show a 40 px circle tile with the `--app-danger-container` background and a `--app-danger` icon (`person_off` for deactivate, `admin_panel_settings` for remove admin) above the title.
- Actions are right-aligned: Cancel (text, default focus) and the confirm button. A destructive confirm is a flat button with `--mat-button-filled-container-color: var(--mat-sys-error)` and `--mat-button-filled-label-text-color: var(--mat-sys-on-error)` (6.5 / 8.5).
- Copy and focus return (v2) are unchanged.

### 4.11 Toasts and empty states `[ui-feedback]`
- **Snackbar:** inverse surface, radius 14, `--app-shadow-3`, action colour inverse-primary.
- **Chat empty state:**
  - A 72 px tile (radius 20, `--app-gradient-brand`, white 32 px `forum` icon, `--app-shadow-2`).
  - **"Start a conversation"** in `--app-type-h1` at 22/30. Keep this string for the unit test.
  - "Pick a model and send a message. Each reply shows the model that answered, and your quota updates after it." in body-medium, on-surface-variant, max-width 420.
  - The block is centred vertically in the message area, with `.app-rise` on enter.
  - *Should:* three suggestion chips (`mat-stroked-button`, radius pill, `lightbulb` icon at 16 px): "Summarise a paragraph", "Explain a concept", "Draft an email". A click puts a starter prompt in the composer and focuses it. It never sends.
- **Other empty states** (sidebar, daily "No usage in this range", users filter "No users match "<q>""): an icon tile plus a one-line title plus an on-surface-variant hint, centred, padding 32.

### 4.12 Admin page `[ui-admin]` (v3)
- **Page header:** `h1` "Admin" in `--app-type-h1`, then the subtitle "Usage, quotas and accounts" in body-medium on-surface-variant, with 24 px top padding and the content max-width 1200 centred.
- **Tabs:** `mat-tab-group` with a 3 px rounded indicator, labels at 600, and each label with a leading icon at 20 px: `insights` for Usage, `tune` for Settings, `group` for Users. The accessible names stay exactly "Usage", "Settings" and "Users": put the icon in `<mat-icon aria-hidden="true">` before the text, and check `getByRole('tab', { name: 'Usage' })` still matches.
- **System month-to-date card** (`system-usage`):
  - A **hero card**: `.app-card` with `background: var(--app-hero-tint)`, padding 24, max-width 640.
  - Amount line `system-used` in `--app-type-number-l`. Keep the text "… used of $0.500000" (the test asserts "of $0.50").
  - Meter `.app-meter` showing used (unchanged framing).
  - Meta "14.00% used · Period 01 Nov 2026, 00:00 IST – resets 01 Dec 2026, 00:00 IST" on-surface-variant, wrapping onto 2 lines under 600.

---

## 5. Login `[ui-login]` (v3)

- **Layout:** a CSS grid `grid-template-columns: minmax(360px, 44%) 1fr` at ≥ 960. The brand panel and form column at 600–959 and under 600 follow §3.1.
- **Brand panel:**
  - Background `--app-gradient-brand` plus two soft decorative circles: `radial-gradient(circle at 20% 110%, rgb(255 255 255 / .10), transparent 40%)` and `radial-gradient(circle at 110% 10%, rgb(94 234 212 / .18), transparent 35%)`.
  - Padding 48, white text.
  - Contents, top to bottom:
    - The logo tile (40 px) and wordmark (`--app-type-brand` at 20/28).
    - Pushed to the vertical centre: the headline "Chat with Claude, within budget." in `--app-type-display`.
    - Three items with `check_circle` icons (20 px, `#5eead4`, decorative), in `--app-on-brand-muted` body-large: "Your weekly quota, live", "A team-wide monthly cap", "Cost per message, to 6 decimals".
    - At the bottom: "All times are shown in IST" (body-small, `--app-on-brand-muted`).
  - The panel is `aria-hidden="false"` but contains no interactive elements. The headline is a `p`, not a heading. The page `h1` is "LLM Usage Control", the wordmark text (§7 keeps one `h1`).
- **Form column:** L0 with the page tint, the card centred vertically.
  - **Card:** `.app-card`, radius 24, padding 32 (24 under 600), max-width 400, `--app-shadow-2`.
  - **Header:** "Sign in" (`h2`, `--app-type-h1`), then "Use the account your admin created for you." (body-medium, on-surface-variant). This replaces "Sign in to chat and see your quota", which no test asserts.
  - **Fields:** Email (`type="email"`, `autocomplete="username"`) and Password (`autocomplete="current-password"`). The password field has a visibility icon button with `aria-label` "Show password" / "Hide password" and `aria-pressed`.
  - **Error:** `role="alert"` (`login-error`), shown as a compact danger banner (radius 10, `--app-danger-container`, `error` icon at 20 px) above the button.
  - **Button:** `login-submit`, full width, 48 px high. Busy shows a spinner plus "Signing in…".
  - **Theme toggle:** the §8 icon button sits top-right of the form column (absolute, 16 px inset).
- **Dark:** the panel uses the dark gradient, and the form column is L0 navy with an L2 card. It is never near-black.

---

## 6. Do / don't

| Do | Don't |
|---|---|
| Use `--mat-sys-*` and `--app-*` tokens; colours come from `light-dark()` tokens | Hard-code hex in components, or use `opacity` to dim text |
| Use the brand gradient only on the top bar, login panel, user bubble, logo tile and empty-state tile | Put gradients on buttons, tables or meters |
| Separate layers with surface step + border + tinted shadow | Use pure black (`#000`) shadows in light, or `#121316`-style near-black in dark |
| Right-align every number with tabular figures (Inter tnum) | Use Jakarta for numbers or table cells |
| Pair every status colour with a word and an icon ("On track", "Low", "Used up", "Active") | Use red, amber or teal alone |
| Size icons with the four `--app-icon-*` tokens and `flex: none` | Let a flex row shrink an icon |
| Animate opacity, transform and colours for 150–250 ms, and honour reduced motion | Use `transition: all`, or animate layout or streaming text |
| Keep `message-model`, `quota-*-remaining` and `system-used` text exactly as today | Put icons or extra words inside those testid elements |
| Test at 390, 768 and 1440 in **Light, Dark and System** | Assume System = Light |

## 7. Decisions for the user

- **D-1 Markdown:** resolved, `marked` + `DOMPurify` approved.
- **D-2 Save on invalid input:** still open (see §7.1).
- **D-3 (new, optional) Material Symbols Rounded instead of Material Icons:** a softer icon style that matches Jakarta. It is the same Google Fonts CDN and not a new library. It needs `MatIconRegistry.setDefaultFontSetClass('material-symbols-rounded')` plus a link change, and a check of every ligature name (for example `chat_bubble_outline` becomes `chat_bubble`). Recommendation: yes, but only after the v3 musts land. It is listed as a *should* below and is not required for approval.

## 7.0 Implementation work list (v1)

| Key | Screen | Priority | Change |
|---|---|---|---|
| [ui-responsive-chat] | Chat | must | Breakpoint layout in §3 (done in round 2) |
| [ui-responsive-admin] | Admin | must | Table scroll wrappers, card list under 600, stretch tabs (done) |
| [ui-sidebar] | Chat | must | `routerLink`, `aria-current`, time line, empty/loading (done) |
| [ui-streaming] | Chat | must | Typing indicator, progress line, focus kept, live region (done) |
| [ui-theme] | All | must | **Superseded by v3 [ui3-tokens]/[ui3-theme-switch]** |
| [ui-shell] | All | must | Shared top bar, `h1`/`<title>`, skip link, mobile menu (done; restyled by [ui3-topbar]) |
| [ui-quota-meter] | Chat, Admin | must | Thresholds, aria, states (done; restyled by [ui3-meter]) |
| [ui-block-banner] | Chat | must | Copy and focus (done; restyled by [ui3-banner]) |
| [ui-confirm-dialog] | Admin Users | must | Confirms and self-row explanation (done) |
| [ui-tables] | Admin | must | Numeric alignment, formats, states (done; restyled by [ui3-tables]) |
| [ui-message], [ui-composer], [ui-forms], [ui-feedback] | — | should | Done in round 2; restyled in v3 |

### 7.1 Addendum v2 (2026-11-05, from audit-2), still open where not yet built

| Key | Screen | Priority | Change |
|---|---|---|---|
| [ui-usage-pagination] | Admin Usage | must | `mat-paginator` (25/50/100, first/last) plus a "Filter by name or email" field on Users (week-to-date). Sort before paging. Daily breakdown reachable without scrolling past every user. Keep `user-usage-table`, `daily-table` |
| [ui-dialog-server-error] | Admin Users dialog | must | The dialog saves itself, shows a busy Save, stays open on error. 409 shows `mat-error` "A user with this email already exists" under Email, with focus there |
| [ux-dialog-focus-return] | Admin Users | should | Return focus to the opener (look it up by user id after reload) |
| [ux-lock-aria] | Admin Users self row | must | The focusable lock icon must not be `aria-hidden`. Add `aria-describedby` on the disabled toggle |
| [ux-action-names] | Admin Users | should | `aria-label="Edit <name>"`, `"Reset password for <name>"` |
| [ui-forms] | Settings, user dialog | should | `subscriptSizing="dynamic"`, 8 px or more between fields, short override hint |
| [ui-block-banner] | Chat | should | Icon `flex: none` 24 px (also covered by [ui3-banner]); Send tooltip while blocked |
| [ux-date-format] | Admin Usage | should | `MAT_DATE_FORMATS` display `dd MMM yyyy` |
| [ui-responsive-admin] | Admin Usage daily @ < 600 | should | Date `nowrap` min-width 96; User cell name over email |
| [ui-shell] | All @ < 600 | should | Name out of the mobile bar, into the ⋮ menu (done) |

**Open decision D-2 (Save on invalid input):** unchanged from v2.

---

## 8. v3 visual refresh

### 8.1 What changes, at a glance

| Area | v2 (what the user saw) | v3 |
|---|---|---|
| Default theme | Followed the OS, so dark on the user's Mac | **Always Light** on first visit. The user picks Light, Dark or System, remembered per browser |
| Dark theme | `#121316` near-black, flat, outline-only cards | Navy `#0f1729` base, L1 `#151f35`, L2 `#1b2640`, L3 `#24304d`, borders and highlight shadows |
| Brand | Azure default, no mark, grey bar | Indigo → violet gradient bar, gauge logo mark, teal accent |
| Type | Roboto everywhere | Plus Jakarta Sans (headings) + Inter (body, numbers) |
| Cards and bubbles | 12 px outlined | 18 px raised with tinted shadows; gradient user bubble; white or navy assistant card |
| Meters | 4 px default bar | 10 px pill, one colour per state, plus an "On track", "Low" or "Used up" chip |
| Empty chat | Small icon and a line | Gradient tile, headline, explainer, optional suggestions |
| Login | Lone card | Split brand panel and card |

### 8.2 Theme switch `[ui3-theme-switch]`

**Behaviour**
- Modes: `light` (default), `dark`, `system`.
- Storage key: **`llmuc.theme`** in `localStorage`, per browser and not per user, so it applies on the login page too.
- Wrap every read and write in `try { … } catch { /* ignore */ }`. A missing or invalid value, or storage that throws (Safari private mode, blocked storage), means `light`. When a write fails the app still switches for the session.
- Applying a mode sets exactly one of `theme-light`, `theme-dark` or `theme-system` on `document.documentElement` (remove the other two). CSS does the rest (§2.7). Nothing else in the app reads the mode, and components never branch on it.
- `system` follows the OS live, because CSS `color-scheme: light dark` does this by itself with no `matchMedia` listener. The only listener needed is for the *icon* (see below), if the engineer chooses to show the resolved scheme. Not required.
- **No flash:** add a tiny inline script in `index.html` `<head>`, before the stylesheets, so the class is set before first paint:
  ```html
  <script>
    (function () {
      var m = 'light';
      try { var s = localStorage.getItem('llmuc.theme'); if (s === 'dark' || s === 'system') m = s; } catch (e) {}
      document.documentElement.classList.add('theme-' + m);
    })();
  </script>
  ```
- A **`ThemeService`** (`frontend/src/app/core/theme.service.ts`, `providedIn: 'root'`):
  - `mode = signal<'light' | 'dark' | 'system'>(read())`
  - `set(mode)` applies the class and persists the value (in try/catch).
  - It also sets `<meta name="theme-color">` to `#312e81` (light) or `#0f1729` (dark or system). This is optional.
- **Cross-fade:** for 200 ms after a switch, add `theme-switching` to `<html>`. While that class is present, `html.theme-switching *, html.theme-switching *::before { transition: background-color var(--app-motion-base) var(--app-ease), color var(--app-motion-base) var(--app-ease), border-color var(--app-motion-base) var(--app-ease) !important; }` applies. Then remove the class. Skip all of this under reduced motion.

**UI, desktop and tablet (≥ 600):** an icon button in the top bar, between the user name / role chip and the Admin/Chat link.
- `button mat-icon-button`, `data-testid="theme-toggle"`, `[matMenuTriggerFor]="themeMenu"`.
- `aria-label="Theme: Light"`, `"Theme: Dark"` or `"Theme: System"` (the current mode). `matTooltip` "Change theme". `aria-haspopup="menu"` comes from Material.
- Icon by mode: `light_mode`, `dark_mode` or `brightness_auto`, at 24 px, white on the bar.

**The menu** `#themeMenu` (one `mat-menu`, `aria-label="Theme"`, `xPosition="before"`):

| Item | testid | Icon (20 px) | Label | Secondary line (label-medium, on-surface-variant) |
|---|---|---|---|---|
| Light | `theme-light` | `light_mode` | Light | — |
| Dark | `theme-dark` | `dark_mode` | Dark | — |
| System | `theme-system` | `brightness_auto` | System | Match your device |

- Each item is `button mat-menu-item role="menuitemradio" [attr.aria-checked]="mode() === 'x'"`.
- The selected item shows a trailing `check` icon in `--mat-sys-primary` (decorative, `aria-hidden`) and has its label at 600.
- Selecting an item applies it immediately and closes the menu. Focus returns to the trigger (Material default). No snackbar, because the change is visible and `aria-checked` plus the trigger's new label announce it.
- Keyboard: arrows, Enter/Space and Esc (Material).

**UI, mobile (< 600):** there is no separate icon in the bar. In the existing ⋮ menu, after the disabled user-name item and before Admin/Chat, add:
- `button mat-menu-item data-testid="theme-toggle" [matMenuTriggerFor]="themeMenu"` with the `contrast` icon and the label **"Theme: Light"** (or Dark or System). It opens the same `#themeMenu` as a submenu.
- The testids `theme-light`, `theme-dark` and `theme-system` are therefore identical at every width, and only one `theme-toggle` is rendered at a time.

**Login page:** the same trigger and menu, as a standalone `app-theme-toggle` component (the shell and login both use it) with on-surface icon colour, top-right. The `testid` values are the same.

**Copy summary:** "Theme: Light" / "Theme: Dark" / "Theme: System" (trigger name), "Change theme" (tooltip), "Light", "Dark", "System", "Match your device" (menu).

### 8.3 Logo mark `[ui3-logo]`

A gauge (a usage meter), drawn as inline SVG with `aria-hidden="true"` and `focusable="false"`. `currentColor` takes the context colour (white on the bar). The accent arc is teal.

```html
<svg class="app-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
  <path d="M6.34 17.66A8 8 0 1 1 17.66 17.66" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>
  <path d="M6.34 17.66A8 8 0 0 1 17.14 5.87" fill="none" stroke="#5eead4" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M12 12l2.9-3.45" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="2" fill="currentColor"/>
</svg>
```
- The `opacity` here is on a decorative stroke, not on text, so the no-opacity rule does not apply.
- Tile: `.app-logo-tile { display:inline-grid; place-items:center; width:32px; height:32px; border-radius:10px; background: rgb(255 255 255 / .14); border: 1px solid rgb(255 255 255 / .28); color:#fff; }`.
- In the assistant who line, the mark is used bare at 20 px with `color: var(--mat-sys-primary)` and the accent arc kept teal.
- Put it in one shared `AppLogoComponent` (`app-logo`, input `size`).

### 8.4 Implementation list (v3)

Work top to bottom. Each item keeps every testid and test string listed at the end.

| # | Key | Priority | Change |
|---|---|---|---|
| 1 | [ui3-tokens] | **must** | Replace the theme block in `styles.scss` with §2.7: violet/cyan base, `mat.theme-overrides` with the §2.2 roles, `html { color-scheme: light }` plus the three `theme-*` classes, all `--app-*` tokens, the Material component tokens, `strong-focus-indicators`, body page tint, `.app-card`, `.app-chip` variants, `.app-meter`, `.app-rise`, icon-size utilities. Delete the v2 `color-scheme: light dark` |
| 2 | [ui3-theme-switch] | **must** | The `ThemeService` (signal, `llmuc.theme`, try/catch on read and write, default `light`, sets one `theme-*` class on `<html>`), plus the inline pre-boot script in `index.html` (§8.2) |
| 3 | [ui3-theme-switch] | **must** | The theme trigger and `#themeMenu` per §8.2, with testids `theme-toggle`, `theme-light`, `theme-dark`, `theme-system`, `role="menuitemradio"` plus `aria-checked`, `aria-label="Theme: <Mode>"`. It is an icon button in the bar at ≥ 600 and a "Theme: <Mode>" submenu item in the ⋮ menu at < 600. Build it as a reusable `ThemeToggleComponent`. Add unit tests: default light, persists, survives `localStorage` throwing |
| 4 | [ui3-fonts] | **must** | `index.html`: swap the Roboto link for Inter + Plus Jakarta Sans (§2.3). Use the typography map in §2.7. Headings, card titles and the wordmark use `--app-type-*`. Numbers stay Inter tnum |
| 5 | [ui3-topbar] | **must** | Shell bar: brand gradient, 60 px (56 mobile), `--app-shadow-2`, logo tile plus wordmark (§8.3), on-brand button tokens and white focus ring scoped to `.bar` (§4.7), glass role chip, theme trigger in the right cluster. Remove the v2 surface-container background and border |
| 6 | [ui3-logo] | **must** | `AppLogoComponent` with the SVG in §8.3. Used in the bar, the login panel and the assistant who line |
| 7 | [ui3-dark-surfaces] | **must** | Apply the layering: chat `.container`/`.page` on `surface` (L0, transparent so the body tint shows through), sidebar and quota column `surface-container-low` (L1) with a 1 px `--app-border` instead of `outline-variant`, cards, bubbles and composer dock on `--app-surface-raised` (L2), dialogs, menus and panels on `surface-container-high` (L3) via the tokens. Verify dark at 1440 and 390 shows four distinct layers |
| 8 | [ui3-meter] | **must** | Quota cards per §4.1: `.app-card`, header icon tile plus title plus state chip ("On track", "Low", "Used up"), the amount with `<span class="unit">left</span>` inside the same testid, `.app-meter` 10 px pill with a state class, meta row (pct start, "of $X" end), reset line with `schedule` icon, warn and danger inset accent. Admin system card uses the same `.app-meter` |
| 9 | [ui3-banner] | **must** | Block and chat-error banners per §4.2: 40 px circle icon tile (`flex: none`), title in `--app-danger-title`, bordered danger container, radius 18, `.app-rise`. Copy, `role`, focus and testids unchanged |
| 10 | [ui3-bubbles] | **must** | Per §4.3: gradient user bubble (tail bottom-right), raised assistant card (tail bottom-left), who line with logo mark plus "Assistant" plus model chip (`message-model` text only), markdown code styles, `.app-rise` on new bubbles only, 3 px clipped streaming bar, primary-colour typing dots |
| 11 | [ui3-composer] | **must** | The composer dock per §4.6 (raised, radius 24, `--app-shadow-2`, borderless resting field, 2 px primary focus outline). The label "Message" and the hint stay visible |
| 12 | [ui3-empty-chat] | **must** | The chat empty state per §4.11: gradient 72 px tile, "Start a conversation" headline (string kept), two-line explainer, centred, `.app-rise` |
| 13 | [ui3-login] | **must** | Login per §5: split brand panel at ≥ 960, a band under that, raised card radius 24, "Sign in" plus the new subcopy, password visibility toggle, compact error banner, 48 px full-width submit with busy label, theme toggle top-right. Keep `login-submit`, `login-error` and the `h1` "LLM Usage Control" |
| 14 | [ui3-tables] | **must** | Per §4.8: `.app-table-card` wrapper, tinted header row, 52 px rows with hover, name/email two-line user cell, Active/Inactive chips, tinted total row, paginator in the card footer, mobile cards as `.app-card` |
| 15 | [ui3-admin] | **must** | Per §4.12: page header with subtitle, tab icons (accessible names still exactly "Usage", "Settings", "Users"), system hero card with `--app-hero-tint` and the `--app-type-number-l` amount ("of $0.50" kept), Settings cards with icon-tile headers and the action bar (§4.9) |
| 16 | [ui3-motion] | **must** | 150/200/250 ms tokens, the enter animation only on bubbles, banner and empty state, sidebar and row hover 150 ms, the theme cross-fade (§8.2), and the reduced-motion handling in §2.6 (0 ms, static dots, `MATERIAL_ANIMATIONS` disabled) |
| 17 | [ui3-icons] | **must** | Every `mat-icon` sized via the `--app-icon-*` tokens (16 chips and meta, 20 buttons, menu and tiles, 24 icon buttons and banner, 32 empty tile) with `flex: none`. No ad-hoc 10–13 px or 40 px icons remain |
| 18 | [ui3-sidebar] | should | Per §4.5: overline group headers, rounded items with hover, primary pill on the active item, richer empty state ("Your chats will appear here.") |
| 19 | [ui3-dialogs] | should | Per §4.10: radius 24, danger icon tile on destructive confirms, error-filled confirm button |
| 20 | [ui3-suggestions] | should | Empty-chat suggestion chips (§4.11). They fill the composer and never auto-send |
| 21 | [ui3-strip] | should | Mobile quota strip state pills (§4.1) |
| 22 | [ui3-symbols] | should | D-3, Material Symbols Rounded, only if the user approves |

**Must items: 17** (#1–#17). Should items: 5. The open v2 musts in §7.1 ([ui-usage-pagination], [ui-dialog-server-error], [ux-lock-aria]) still apply alongside these.

### 8.5 Acceptance checks for the refresh (for the next audit)

- **First visit with the OS in dark mode:** the app opens **light**.
- **Theme switching:**
  - Choose Dark, then reload: the page stays dark with no light flash.
  - Choose System: the theme follows the OS toggle live.
  - With `localStorage` blocked (DevTools: throw on access): the app loads light and switching works for the session.
- **Contrast:** axe or the Lighthouse contrast check passes in Light and Dark on chat (normal, low, used-up, blocked), admin (all three tabs, dialogs) and login.
- **Layering:** in dark at 1440, the background, sidebar, cards, bubbles and menu are each visibly distinct.
- **Testids and strings:** all the testids below, plus `theme-*`, resolve. `message-model` text equals the model id. `system-usage` contains "of $0.50". `quota-user-remaining` contains the 6 dp amount and "left".
- **Reduced motion:** with `prefers-reduced-motion: reduce`, no element animates.
- **Responsive:** no horizontal scroll at 390.

**Data-testids that must be kept unchanged:** `model-picker`, `composer-input`, `send-button`, `message-assistant`, `message-user`, `message-model`, `quota-user-remaining`, `quota-system-remaining`, `quota-user-reset`, `quota-system-reset`, `quota-block-reason`, `quota-reset-time`, `conversation-item`, `new-chat`, `chat-error`, `admin-link`, `back-to-chat`, `menu-user-name`, `logout`, `login-submit`, `login-error`, `system-usage`, `system-used`, `user-usage-table`, `daily-table`, `daily-row`, `daily-total-cost`, `load-daily`, `settings-save`, `settings-error`, `settings-saved`, `setting-*`, `users-table`, `user-row`, `user-row-email`, `create-user`, `edit-user`, `reset-user-password`, `active-toggle` (a disabled one stays on the self row), `user-name`, `user-email`, `user-password`, `user-role`, `user-override`, `user-save`. **New:** `theme-toggle`, `theme-light`, `theme-dark`, `theme-system`.

**Test strings that must still match:**
- Tab names "Usage", "Settings" and "Users" (exact).
- "Start a conversation" and "No conversations yet" (unit tests).
- `quota-block-reason` containing "Personal" or "System".
- `quota-reset-time` containing "IST".
- The duplicate-email error matching `/already exists/`.
- "of $0.50" in `system-usage`.
- `$0.10` in `quota-user-remaining`, and no `$0.100000 left` after a message.
