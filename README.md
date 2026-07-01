# revealjs-progress-bar

A section-aware progress bar for Quarto RevealJS presentations.

`revealjs-progress-bar` replaces the default linear RevealJS progress indicator with a compact navigation bar that tracks progress by section. It supports short section labels, slide ticks, adaptive hover slide numbers, click navigation, and an optional overview slide.

## Installation

```bash
quarto add alpa12/revealjs-progress-bar
```

## Minimal Usage

Add the extension to a RevealJS presentation and disable the native progress bar:

```yaml
---
title: "My Presentation"
format:
  revealjs:
    progress: false
filters:
  - revealjs-progress-bar
---
```

## Overview Slide

The extension can enhance a slide marked with `.progress-overview` into a presentation plan.

```markdown
## Presentation plan {.progress-overview}
```

Enable the overview in your YAML:

```yaml
format:
  revealjs:
    progress: false
    progress-bar:
      overview: true
      animate-overview-exit: true
filters:
  - revealjs-progress-bar
```

If `overview: true` but no `.progress-overview` slide exists, the deck still renders normally and the extension logs a warning in the browser console.

## Section Labels

Use `data-progress-label` when the full section title is too long for the progress bar:

```markdown
# Detailed Section Title {data-progress-label="Short"}
```

The extension also supports `data-section-label` for compatibility with older decks. If no label is provided, the first `h1` or `h2` text is used.

## Hide The Bar On One Slide

Add `data-progress-bar="false"` to a slide to hide the progress bar on that slide only:

```markdown
## Appendix Detail {data-progress-bar="false"}
```

The slide remains part of the progress calculation; only the bar display is hidden.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `progress-bar.overview` | `false` | Enhance a slide with `.progress-overview` into an overview slide. |
| `progress-bar.animate-overview-exit` | `true` | Animate the overview progress bar into the top navigation bar before advancing. |
| `progress-bar.section-widths` | `"equal"` | Use `"equal"` for equal section widths or `"proportional"` for equal slide widths. |

## Styling

Customize the bar with CSS variables:

```css
:root {
  --rpb-top: 0.7rem;
  --rpb-width: min(88vw, 980px);
  --rpb-height: 0.14rem;
  --rpb-fill-color: #2563eb;
  --rpb-track-color: rgba(37, 99, 235, 0.16);
  --rpb-label-color: rgba(17, 24, 39, 0.58);
  --rpb-label-active-color: #111827;
}
```

## Progress Rules

- Fragments do not count as progress.
- The deck title slide is excluded.
- A marked `.progress-overview` slide is excluded.
- When `.progress-overview` exists, all slides before it are excluded from the progress bar and slide numbers.
- Hover slide numbers use a global sampling step for dense decks while respecting tight section widths.
- Section title slides are ignored when a vertical section has a title slide followed by content slides.

## Development

Render the example deck:

```bash
quarto render example.qmd
```

Preview while editing:

```bash
quarto preview example.qmd
```

The files installed by Quarto live in `_extensions/revealjs-progress-bar/`. The root `README.md` and `example.qmd` are for documentation and development.

## License

MIT
