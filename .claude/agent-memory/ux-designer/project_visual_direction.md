---
name: project-visual-direction
description: v3 visual direction decided 2026-11-05 - light default, Light/Dark/System switch, indigo-violet gradient brand, navy dark, Jakarta+Inter
metadata:
  type: project
---
The user called the v2 app "too black" and said it "doesn't look so design friendly". Their Mac is in dark mode, so `color-scheme: light dark` gave them flat near-black Material. User decisions (2026-11-05):
- Light is always the default.
- A Light / Dark / System switch in the top bar (in the ⋮ menu on mobile), stored in localStorage `llmuc.theme` with try/catch. Testids: theme-toggle, theme-light, theme-dark, theme-system.
- Dark theme is soft navy with layered surfaces. No new UI libraries.

The v3 spec is in docs/ux/ui-design.md §2, §4, §5 and §8:
- Palette: brand #4f46e5 indigo with an indigo→violet gradient (top bar, login panel, user bubble, logo tile only), teal tertiary, amber warn (no longer tertiary).
- Dark layers: #0f1729 / #151f35 / #1b2640 / #24304d.
- Type: Plus Jakarta Sans for headings, Inter for body and numbers.
- Switch mechanism: theme-type color-scheme + mat.theme-overrides with light-dark(). The theme flips via a `theme-*` class on html that sets color-scheme.
- 17 must items [ui3-*].

**Why:** the user explicitly wants a designed, distinctive look, and dark mode on their OS must not force dark.
**How to apply:** in the next audit, score Visual design against v3. Check: first load is light even with the OS in dark; there's no flash on reload in dark; dark shows 4 distinct layers; message-model text stays exactly the model id. Related: [[project-audit-findings]]
