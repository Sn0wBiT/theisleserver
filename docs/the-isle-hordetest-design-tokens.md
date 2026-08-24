# The Isle / HordeTest UI — Design Tokens

> Reverse-engineered from the supplied HordeTest UI reference image.
> Values are approximate visual matches intended as a practical starting point for implementation, not official game assets/tokens.

## 1. Design direction

- **Theme:** dark survival-tech / field terminal
- **Base palette:** near-black green with desaturated teal
- **Accent:** pale mint / cyan-green
- **Active controls:** pale green-gray fill with very dark text
- **Borders:** thin mint lines with occasional brighter highlight
- **Surface treatment:** translucent dark panels over game imagery
- **Typography:** narrow / condensed techno-monospace look, mostly uppercase
- **Density:** compact, information-heavy HUD
- **Corners:** almost square; very small radius
- **Decoration:** subtle scanlines/noise, worn/organic outer-frame texture

---

## 2. Color tokens

```css
:root {
  /* Canvas / surfaces */
  --color-bg-canvas: #071512;
  --color-bg-panel: rgba(5, 29, 25, 0.92);
  --color-bg-panel-soft: rgba(8, 39, 34, 0.82);
  --color-bg-panel-elevated: rgba(10, 48, 41, 0.90);
  --color-bg-overlay: rgba(0, 12, 10, 0.68);

  /* Interactive surfaces */
  --color-control-default: rgba(6, 31, 27, 0.88);
  --color-control-hover: rgba(17, 65, 56, 0.95);
  --color-control-active: #9BCDBB;
  --color-control-active-hover: #B2DECE;
  --color-control-disabled: rgba(52, 82, 73, 0.45);

  /* Text */
  --color-text-primary: #9AD0BE;
  --color-text-secondary: #6FA697;
  --color-text-muted: #4E786D;
  --color-text-inverse: #10241F;
  --color-text-bright: #C2E6D8;

  /* Borders / dividers */
  --color-border-default: #6BB8A3;
  --color-border-strong: #9BD7C4;
  --color-border-subtle: rgba(105, 182, 160, 0.42);
  --color-divider: rgba(111, 190, 168, 0.48);

  /* Semantic */
  --color-success: #7FC5A5;
  --color-warning: #D6C36B;
  --color-danger: #C96F67;
  --color-info: #7FB8B1;

  /* Progress / chart */
  --color-progress-track: #162822;
  --color-progress-fill: #E3E7B2;
  --color-waveform: #81D4BD;

  /* Decorative frame */
  --color-frame-shadow: rgba(0, 0, 0, 0.72);
  --color-frame-moss-dark: #35432E;
  --color-frame-moss-mid: #5A6640;
  --color-frame-moss-light: #7B8350;
}
```

### Suggested Tailwind-style palette

```ts
export const isleColors = {
  ink: {
    950: "#071512",
    900: "#091C18",
    800: "#0D2B25",
    700: "#113A31",
  },
  terminal: {
    300: "#9AD0BE",
    400: "#81C0AD",
    500: "#6BB8A3",
    600: "#579787",
    700: "#416F64",
  },
  active: {
    100: "#C2E6D8",
    200: "#B2DECE",
    300: "#9BCDBB",
  },
  status: {
    success: "#7FC5A5",
    warning: "#D6C36B",
    danger: "#C96F67",
    info: "#7FB8B1",
  },
}
```

---

## 3. Typography tokens

The reference uses a **condensed, geometric/techno display face** with a terminal feel.

Recommended fallbacks:

1. `Rajdhani`
2. `Share Tech Mono`
3. `Oxanium`
4. `IBM Plex Mono`
5. system monospace

```css
:root {
  --font-display: "Rajdhani", "Oxanium", sans-serif;
  --font-mono: "Share Tech Mono", "IBM Plex Mono", monospace;

  --font-size-2xs: 10px;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;

  --line-height-tight: 1.05;
  --line-height-ui: 1.2;
  --line-height-body: 1.4;

  --tracking-tight: 0.01em;
  --tracking-ui: 0.06em;
  --tracking-wide: 0.10em;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
}
```

### Text styles

```css
.ui-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--tracking-wide);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
  color: var(--color-text-primary);
}

.ui-label {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  letter-spacing: var(--tracking-ui);
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.ui-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-primary);
}
```

---

## 4. Spacing scale

The UI is compact and grid-oriented.

```css
:root {
  --space-0: 0;
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 12px;
  --space-6: 16px;
  --space-7: 20px;
  --space-8: 24px;
  --space-9: 32px;
}
```

Recommended usage:

- button vertical padding: `4–6px`
- button horizontal padding: `12–16px`
- panel internal padding: `8–12px`
- section gap: `8px`
- major column gap: `12–16px`

---

## 5. Radius tokens

The reference is effectively square.

```css
:root {
  --radius-none: 0;
  --radius-xs: 1px;
  --radius-sm: 2px;
  --radius-md: 3px;
}
```

Use `--radius-xs` or `--radius-sm` for most controls.

---

## 6. Border tokens

```css
:root {
  --border-width-hairline: 1px;
  --border-width-control: 2px;

  --border-default:
    var(--border-width-hairline) solid var(--color-border-default);

  --border-control:
    var(--border-width-control) solid var(--color-border-default);

  --border-active:
    var(--border-width-control) solid var(--color-border-strong);
}
```

---

## 7. Shadow / glow tokens

The UI relies more on contrast and line work than soft shadows.

```css
:root {
  --shadow-panel:
    0 0 0 1px rgba(0, 0, 0, 0.55),
    0 8px 24px rgba(0, 0, 0, 0.42);

  --shadow-control-active:
    0 0 6px rgba(144, 215, 194, 0.18);

  --glow-text:
    0 0 4px rgba(129, 212, 189, 0.16);

  --glow-line:
    0 0 5px rgba(107, 184, 163, 0.22);
}
```

Avoid modern large blur shadows.

---

## 8. Opacity tokens

```css
:root {
  --opacity-panel: 0.92;
  --opacity-panel-soft: 0.82;
  --opacity-muted: 0.62;
  --opacity-disabled: 0.42;
  --opacity-decoration: 0.20;
}
```

---

## 9. Layout tokens

```css
:root {
  --panel-min-width: 520px;
  --panel-max-width: 920px;

  --sidebar-width: 112px;
  --header-height: 34px;
  --control-height-sm: 22px;
  --control-height-md: 28px;

  --grid-stroke: 1px;
}
```

Recommended layout characteristics:

- left navigation rail
- strong vertical and horizontal separators
- compact multi-column information groups
- content aligned to a strict grid
- important status sections separated by rule lines
- bottom status/progress region visually anchored to the panel edge

---

## 10. Component tokens

### Panel

```css
.isle-panel {
  background:
    linear-gradient(rgba(5, 29, 25, 0.92), rgba(5, 29, 25, 0.92));
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-panel);
  color: var(--color-text-primary);
}
```

### Navigation button — default

```css
.isle-nav-button {
  min-height: 28px;
  padding: 4px 12px;

  background: rgba(6, 31, 27, 0.88);
  border: 2px solid var(--color-border-default);
  border-radius: var(--radius-xs);

  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
}
```

### Navigation button — hover

```css
.isle-nav-button:hover {
  background: rgba(17, 65, 56, 0.95);
  border-color: var(--color-border-strong);
  color: var(--color-text-bright);
}
```

### Navigation button — active

```css
.isle-nav-button[data-active="true"] {
  background: var(--color-control-active);
  border-color: var(--color-border-strong);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-control-active);
}
```

### Section heading

```css
.isle-section-heading {
  padding-bottom: 3px;
  border-bottom: 1px solid var(--color-divider);

  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.10em;
  line-height: 1;
  text-transform: uppercase;
}
```

### Key/value stat row

```css
.isle-stat-row {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px;
  align-items: baseline;
}

.isle-stat-key {
  color: var(--color-text-secondary);
}

.isle-stat-value {
  color: var(--color-text-primary);
}
```

### Progress bar

```css
.isle-progress {
  height: 8px;
  background: var(--color-progress-track);
  border: 1px solid rgba(107, 184, 163, 0.4);
}

.isle-progress > span {
  display: block;
  height: 100%;
  background: var(--color-progress-fill);
}
```

---

## 11. Scanline / terminal texture

Use very subtly.

```css
.isle-terminal-texture {
  position: relative;
}

.isle-terminal-texture::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;

  background:
    repeating-linear-gradient(
      to bottom,
      rgba(140, 220, 195, 0.025) 0,
      rgba(140, 220, 195, 0.025) 1px,
      transparent 1px,
      transparent 3px
    );

  mix-blend-mode: screen;
}
```

Optional noise:

```css
.isle-noise {
  background-image:
    radial-gradient(rgba(255,255,255,0.025) 0.5px, transparent 0.5px);
  background-size: 3px 3px;
}
```

Keep noise opacity under `0.05`.

---

## 12. Interaction tokens

```css
:root {
  --duration-instant: 60ms;
  --duration-fast: 100ms;
  --duration-normal: 160ms;

  --ease-ui: linear;
}
```

The UI should feel immediate rather than soft or springy.

Recommended transitions:

```css
transition:
  background-color var(--duration-fast) var(--ease-ui),
  border-color var(--duration-fast) var(--ease-ui),
  color var(--duration-fast) var(--ease-ui);
```

---

## 13. Icon tokens

- line icon style
- `1–1.5px` visual stroke
- mostly square geometry
- avoid rounded “consumer app” iconography
- icon sizes:
  - small: `12px`
  - default: `16px`
  - large: `20px`

```css
:root {
  --icon-sm: 12px;
  --icon-md: 16px;
  --icon-lg: 20px;
}
```

---

## 14. Recommended shadcn / Tailwind semantic mapping

```css
:root {
  --background: 166 50% 5%;
  --foreground: 160 35% 71%;

  --card: 169 70% 7%;
  --card-foreground: 160 35% 71%;

  --popover: 169 65% 8%;
  --popover-foreground: 160 35% 71%;

  --primary: 161 33% 71%;
  --primary-foreground: 162 38% 10%;

  --secondary: 168 44% 15%;
  --secondary-foreground: 160 38% 77%;

  --muted: 166 32% 13%;
  --muted-foreground: 164 25% 51%;

  --accent: 164 32% 58%;
  --accent-foreground: 162 38% 10%;

  --destructive: 4 45% 60%;
  --destructive-foreground: 0 0% 100%;

  --border: 164 34% 57%;
  --input: 164 34% 57%;
  --ring: 160 44% 73%;

  --radius: 0.125rem;
}
```

---

## 15. Tailwind config example

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss"

export default {
  theme: {
    extend: {
      colors: {
        isle: {
          canvas: "#071512",
          panel: "#051D19",
          panelSoft: "#082722",
          control: "#061F1B",
          controlHover: "#114138",
          active: "#9BCDBB",
          text: "#9AD0BE",
          textSecondary: "#6FA697",
          textMuted: "#4E786D",
          border: "#6BB8A3",
          borderStrong: "#9BD7C4",
          progress: "#E3E7B2",
        },
      },
      borderRadius: {
        isle: "2px",
      },
      fontFamily: {
        isle: ["Rajdhani", "Oxanium", "sans-serif"],
        "isle-mono": ["Share Tech Mono", "IBM Plex Mono", "monospace"],
      },
      letterSpacing: {
        isle: "0.06em",
        "isle-wide": "0.10em",
      },
      transitionDuration: {
        60: "60ms",
        100: "100ms",
      },
    },
  },
} satisfies Config
```

---

## 16. React / shadcn component styling direction

Suggested utility classes for the main HUD shell:

```tsx
<div
  className="
    bg-isle-panel/95
    border border-isle-border
    rounded-isle
    font-isle-mono
    text-isle-text
    shadow-xl
  "
>
  ...
</div>
```

Active tab/button:

```tsx
className="
  h-7
  border-2 border-isle-borderStrong
  bg-isle-active
  px-3
  font-isle
  text-[12px]
  uppercase
  tracking-isle
  text-[#10241F]
  rounded-isle
"
```

Inactive tab/button:

```tsx
className="
  h-7
  border-2 border-isle-border
  bg-isle-control
  px-3
  font-isle
  text-[12px]
  uppercase
  tracking-isle
  text-isle-text
  rounded-isle

  hover:bg-isle-controlHover
  hover:border-isle-borderStrong
"
```

---

## 17. Visual rules to preserve the reference feel

### Do

- use near-black green instead of neutral gray
- keep borders thin and visible
- make text slightly desaturated
- use condensed uppercase headings
- use translucent panels
- use grid-based dividers
- keep padding compact
- reserve filled pale-green surfaces for active/selected actions
- add subtle scanline/noise texture
- keep transitions quick and linear

### Avoid

- large border radii
- pill buttons
- heavy blur/glassmorphism
- large drop shadows
- pure white text
- saturated neon cyan
- generous SaaS-style spacing
- spring animations
- oversized icons

---

## 18. Compact token JSON equivalent

```json
{
  "color": {
    "background": {
      "canvas": "#071512",
      "panel": "#051D19",
      "panelSoft": "#082722",
      "overlay": "rgba(0,12,10,0.68)"
    },
    "text": {
      "primary": "#9AD0BE",
      "secondary": "#6FA697",
      "muted": "#4E786D",
      "inverse": "#10241F",
      "bright": "#C2E6D8"
    },
    "border": {
      "default": "#6BB8A3",
      "strong": "#9BD7C4",
      "subtle": "rgba(105,182,160,0.42)"
    },
    "control": {
      "default": "#061F1B",
      "hover": "#114138",
      "active": "#9BCDBB"
    },
    "status": {
      "success": "#7FC5A5",
      "warning": "#D6C36B",
      "danger": "#C96F67",
      "info": "#7FB8B1"
    }
  },
  "radius": {
    "xs": "1px",
    "sm": "2px",
    "md": "3px"
  },
  "spacing": {
    "1": "2px",
    "2": "4px",
    "3": "6px",
    "4": "8px",
    "5": "12px",
    "6": "16px",
    "7": "20px",
    "8": "24px"
  },
  "typography": {
    "display": "Rajdhani, Oxanium, sans-serif",
    "mono": "Share Tech Mono, IBM Plex Mono, monospace"
  }
}
```

---

## 19. Implementation priority

For a close match, prioritize these in order:

1. **Palette**
2. **Typography**
3. **1–2px teal borders**
4. **Compact spacing**
5. **Square geometry**
6. **Panel translucency**
7. **Scanline/noise treatment**
8. **Organic/moss outer-frame artwork**

The outer moss/worn frame should ideally be implemented as an image asset or 9-slice texture rather than pure CSS.
