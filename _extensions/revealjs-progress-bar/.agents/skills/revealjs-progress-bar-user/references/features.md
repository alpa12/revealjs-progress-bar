# revealjs-progress-bar Features

## Configuration Surface

The extension is filter-driven. Add it with:

```yaml
filters:
  - revealjs-progress-bar
```

Recommended base configuration:

```yaml
format:
  revealjs:
    progress: false
```

Options can live in `format.revealjs.progress-bar` or top-level `progress-bar`. Kebab-case is preferred in user-facing Quarto YAML; camelCase is also accepted internally.

| Option | Default | Values | Use |
| --- | --- | --- | --- |
| `animate-overview-exit` | `true` | `true`, `false` | Animate from overview preview to top bar before moving to the first progress slide. |
| `section-widths` | `equal` | `equal`, `proportional` | Equal section widths, or proportional width by content-slide count. |
| `show-slide-numbers` | `true` | `true`, `false` | Show adaptive hover/current slide numbers on the bar. |
| `counted-slides` | `all` | `all`, `main` | Use Quarto/RevealJS slide numbers, or count only progress content slides. |
| `override-native-slide-numbers` | `false` | `true`, `false` | When `counted-slides: main`, rewrite native slide numbers to match the main-slide count. |

## Section Detection

- The deck title slide (`#title-slide`) is never counted.
- A slide marked `.progress-overview` is never counted.
- When `.progress-overview` exists, all slides before it are excluded from the progress bar and from `counted-slides: main`.
- Without `.progress-overview`, progress starts after the deck title slide.
- Top-level sections become progress sections.
- For vertical sections, a section title slide is ignored when followed by content slides.
- Fragments do not advance progress.

## Labels And Titles

Section labels resolve in this order:

1. `data-progress-label` on the slide or heading.
2. First `h1` or `h2` text.
3. Generated fallback like `Section 1`.

Use `data-progress-label=""` to keep the section segment but hide the label text. The overview title uses the full heading text, not the shortened label.

## Navigation Behavior

- The fixed top bar is hidden on the title slide, overview slide, slides before the overview, and slides marked `.hide-progress-bar`.
- A `.hide-progress-bar` slide is still included in progress calculations.
- Clicking a section label navigates to the section target slide.
- Clicking inside a section track navigates to the nearest content slide in that section.
- Hovering over the bar enlarges the active/hovered section, reveals ticks, and shows sampled slide numbers.
- Dense decks use an adaptive sampling step for displayed numbers.

## Overview Slide

Mark one slide:

```markdown
## Presentation plan {.progress-overview}
```

The extension injects hidden fragments for each section. Advancing through the overview highlights sections in order. On the final injected fragment, the overview either animates the preview bar to the top bar or jumps directly to the first progress slide if `animate-overview-exit: false`.

## Native Slide Numbers

By default, bar slide numbers follow RevealJS/Quarto numbering (`counted-slides: all`). To show only main progress content:

```yaml
format:
  revealjs:
    slide-number: c/t
    progress-bar:
      counted-slides: main
      override-native-slide-numbers: true
```

`override-native-slide-numbers: true` only has an effect when `counted-slides: main` and Quarto `slide-number` is enabled. Uncounted slides get an empty hidden native slide number.

## Styling Variables

Common CSS variables:

```css
:root {
  --rpb-top: 0.7rem;
  --rpb-width: min(88vw, 980px);
  --rpb-height: 0.14rem;
  --rpb-gap: 0.22rem;
  --rpb-track-color: color-mix(in srgb, currentColor 18%, transparent);
  --rpb-fill-color: currentColor;
  --rpb-label-color: color-mix(in srgb, currentColor 54%, transparent);
  --rpb-label-active-color: currentColor;
  --rpb-number-color: color-mix(in srgb, currentColor 68%, transparent);
  --rpb-focus-color: currentColor;
  --rpb-transition-duration: 220ms;
  --rpb-overview-rise-duration: 1550ms;
}
```

On small screens, the extension lowers `--rpb-top`, narrows `--rpb-width`, and reduces text/bar sizes. Override these carefully in user CSS if deck titles collide with the bar.

## Troubleshooting

- If a standard Quarto HTML article appears instead of a deck, render with `--to revealjs` or ensure the YAML format is `revealjs`.
- If the native RevealJS progress bar also appears, set `format.revealjs.progress: false`.
- If a section is missing, check that it appears after `.progress-overview` and is not only a title/overview slide.
- If labels are too long, add `data-progress-label`.
- If numbers are surprising, decide between `counted-slides: all` and `counted-slides: main`.
