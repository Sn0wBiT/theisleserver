# TPNIsleControlHUD Frontend Design Tokens

Current token export from `TPNIsleControlHUD/frontend/src/styles/globals.css`.
The HUD uses a dark survival-terminal visual language: near-black green surfaces,
desaturated mint text and borders, pale amber actions, square corners, and subtle
scanline overlays.

## Source of truth

- `TPNIsleControlHUD/frontend/src/styles/globals.css`
- Tailwind theme tokens are declared in `@theme` and `@theme inline`.
- Runtime surface, control, semantic, and motion tokens are declared in `:root`.
- `.dark` contains the default shadcn dark-mode compatibility values.

## Core palette

| Token | Value | Role |
| --- | --- | --- |
| `--color-ink` | `#10241f` | Dark text / inverse text |
| `--color-charcoal` | `#051d19` | Button and deep control surface |
| `--color-soil` | `#082722` | Secondary dark surface |
| `--color-stone` | `#6bb8a3` | Default mint border and scrollbar |
| `--color-ash` | `#6fa697` | Secondary text |
| `--color-bone` | `#9ad0be` | Primary readable text |
| `--color-lichen` | `#81c0ad` | Accent mint |
| `--color-moss` | `#9bcdbb` | Positive/connected state |
| `--color-amber` | `#d6c36b` | Action, warning, and active accent |
| `--color-rust` | `#c96f67` | Error, danger, and health accent |

## Surface, control, and border tokens

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg-canvas` | `#071512` | Base canvas color |
| `--color-bg-panel` | `rgb(5 29 25 / 0.92)` | Primary translucent panel |
| `--color-bg-panel-soft` | `rgb(8 39 34 / 0.82)` | Quest card / soft panel |
| `--color-control-default` | `rgb(6 31 27 / 0.88)` | Default control surface |
| `--color-control-hover` | `rgb(17 65 56 / 0.95)` | Hover control surface |
| `--color-control-active` | `#9bcdbb` | Active control fill |
| `--color-border-default` | `#6bb8a3` | Standard border |
| `--color-border-strong` | `#9bd7c4` | Emphasized border |
| `--color-border-subtle` | `rgb(105 182 160 / 0.42)` | Divider / low-contrast border |

## Semantic and data-visualization tokens

| Token | Value | Role |
| --- | --- | --- |
| `--color-progress-track` | `#162822` | Progress bar track |
| `--color-progress-fill` | `#e3e7b2` | Default progress fill |
| `--color-moss` | `#9bcdbb` | Connected/positive accent |
| `--color-amber` | `#d6c36b` | Warning/action accent |
| `--color-rust` | `#c96f67` | Error/health accent |

Some component rules reference optional aliases such as
`--color-text-bright`, `--color-text-primary`, `--color-success`,
`--color-muted`, `--color-terminal-400`, and `--color-waveform`. These aliases
are not declared by the current stylesheet; the rules supply fallbacks where
available, usually `--color-bone`, `--color-ash`, or `--color-lichen`. The
semantic colors in the component treatments below therefore resolve to their
fallbacks unless another stylesheet defines those aliases.

## Typography

| Token | Value |
| --- | --- |
| `--font-display` | `"Segoe UI", "Noto Sans", sans-serif` |
| `--font-sans` | `"Segoe UI", "Noto Sans", sans-serif` |
| `--font-mono` | `"Cascadia Mono", Consolas, "Noto Sans Mono", monospace` |
| `--font-heading` | `var(--font-sans)` |

The later `@theme inline` declaration maps `--font-sans` to
`'Geist Variable', sans-serif` for Tailwind utility generation. Direct CSS
rules that use `var(--font-sans)` resolve against the final custom-property
value in the cascade.

Implemented text conventions:

- `.eyebrow`: mono, `8px`, `1em` line height, `0.16em` tracking, uppercase,
  secondary ash color.
- HUD labels: mono, compact sizes, uppercase, increased letter spacing.
- HUD values and headings: bone/mint text with restrained tracking.

## Shape, spacing, and motion

| Token | Value | Role |
| --- | --- | --- |
| `--radius-isle` | `2px` | HUD panel radius |
| `--duration-fast` | `100ms` | Fast interaction timing |
| `--shadow-hud` | `0 0 0 1px rgb(0 0 0 / 0.55), 0 8px 24px rgb(0 0 0 / 0.42)` | Standard panel shadow |
| `--shadow-hud-heavy` | same as `--shadow-hud` | Expanded minimap shadow |

Additional implemented geometry conventions:

- Default borders are `1px`.
- Quest cards use a `1px` radius.
- The HUD panel scanline layer uses a repeating vertical gradient with a
  `1px` line every `3px` at `2.5%` opacity.
- Compact minimap width is `clamp(210px, 18vw, 280px)`.
- Expanded minimap width is `min(960px, calc(100vw - 32px))` and height is
  `min(75vh, 760px)`.
- HUD status panel padding is `14px 15px 0`; compact status padding is
  `10px 11px 0`.

## Component tokens and treatments

### HUD panels

`.hud-panel` uses `--radius-isle` and `--color-bg-panel`. Its `::after`
pseudo-element adds the scanline treatment without intercepting pointer input.

### Dino status

`.dino-status` uses a mint border, a dark green diagonal gradient, and
`--shadow-hud`. Its top accent line uses `--color-control-active`; health uses
`--color-rust`; growth uses `--color-amber`; hunger and thirst use the success
mint.

### Minimap

Minimap surfaces use `rgb(5 29 25 / 0.94)` or `--color-bg-panel`. Coordinates
and status overlays use `rgb(5 29 25 / 0.8)` with subtle mint borders. Interactive
minimaps transition border color and vertical position over `120ms`.

### Toasts and Leaflet controls

- Toast border: `rgb(154 168 106 / 0.55)`.
- Toast background: `rgb(23 26 22 / 0.96)`.
- Leaflet canvas background: `#091511`.
- Leaflet attribution background: `rgb(5 29 25 / 0.82)`.
- Leaflet controls use the panel background, bone text, and subtle borders.

## Accessibility and rendering defaults

- `html`, `body`, and `#root` are transparent to support CEF layered-window
  compositing.
- The body uses `--color-bone` and the sans font by default.
- User selection is disabled globally to match overlay interaction behavior.
- Reduced-motion users receive shortened transitions and animations.
- At viewport heights below `650px`, panels are limited to
  `calc(100vh - 24px)`.

## shadcn compatibility tokens

The stylesheet also includes the standard shadcn semantic variables in `:root`
and `.dark`: `--background`, `--foreground`, `--card`, `--popover`, `--primary`,
`--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`,
`--ring`, `--chart-1` through `--chart-5`, and sidebar equivalents.

These currently use the shadcn OKLCH defaults and are exposed to Tailwind via
`@theme inline` mappings such as `--color-background`, `--color-foreground`,
`--color-primary`, `--color-border`, and `--color-ring`. They are compatibility
tokens rather than the primary visual language of the HUD.
