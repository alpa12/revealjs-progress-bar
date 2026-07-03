---
name: revealjs-progress-bar-user
description: Help programming agents configure and edit Quarto RevealJS presentations that use the revealjs-progress-bar extension. Use when working on a user deck that installed alpa12/revealjs-progress-bar, adding the filter to a .qmd file, tuning progress-bar YAML options, creating a .progress-overview slide, labeling sections, hiding the bar on selected slides, customizing CSS variables, or debugging slide counting/navigation behavior.
---

# RevealJS Progress Bar User

Use this skill for author-facing work in a Quarto RevealJS deck that uses `revealjs-progress-bar`. Treat the extension as already installed under `_extensions/revealjs-progress-bar/`, or install it with:

```bash
quarto add alpa12/revealjs-progress-bar
```

## Workflow

1. Inspect the deck's YAML front matter and confirm the output format is `revealjs`.
2. Add the filter and disable the native RevealJS progress bar unless the user explicitly asks to keep it:

```yaml
format:
  revealjs:
    progress: false
filters:
  - revealjs-progress-bar
```

3. Add or adjust `format.revealjs.progress-bar` options only when the user needs them.
4. Use Quarto heading syntax for section structure; prefer `#` headings for major progress sections and `##` headings for content slides.
5. Render with `quarto render <deck>.qmd` after changes when Quarto is available.

## Common Edits

Use short labels when section titles are too long:

```markdown
# Long Section Title {data-progress-label="Short"}
```

Use an empty label to reserve section width without visible text:

```markdown
# Appendix {data-progress-label=""}
```

Create a presentation plan slide by marking exactly one slide with `.progress-overview`:

```markdown
## Presentation plan {.progress-overview}
```

Hide the bar on a specific slide while keeping that slide in progress calculations:

```markdown
## Appendix Detail {.hide-progress-bar}
```

For main-content slide numbering, use:

```yaml
format:
  revealjs:
    slide-number: c/t
    progress-bar:
      counted-slides: main
      override-native-slide-numbers: true
```

## Styling

Customize with CSS variables in the deck CSS rather than editing extension source files:

```css
:root {
  --rpb-top: 0.7rem;
  --rpb-width: min(88vw, 980px);
  --rpb-fill-color: #2563eb;
  --rpb-track-color: rgba(37, 99, 235, 0.16);
  --rpb-label-active-color: #111827;
}
```

## Detailed Reference

Read [references/features.md](references/features.md) when debugging behavior, choosing options, explaining progress rules, or making non-trivial edits to a deck.
