---
name: revealjs-progress-bar-maintainer
description: Use when continuing development of this repository, the Quarto revealjs-progress-bar extension. Covers the product decisions, implementation architecture, valid user constraints, behavior rules, styling expectations, testing workflow, and known pitfalls for maintaining the extension.
---

# RevealJS Progress Bar Maintainer

Use this skill before changing this repository. This project is a Quarto extension named `revealjs-progress-bar`, intended for publication as `alpa12/revealjs-progress-bar` and installation with:

```bash
quarto add alpa12/revealjs-progress-bar
```

The old copied presentation was only a proof of concept. Treat the current repo as a clean extension implementation.

## Product Contract

- Public extension name: `revealjs-progress-bar`.
- GitHub target: `alpa12/revealjs-progress-bar`.
- License: MIT.
- Docs and demo language: English.
- Quarto minimum: `quarto-required: ">=1.4.0"`.
- Keep the public interface small. Do not reintroduce an `overviewTitle` option; the overview slide heading already provides the title.
- Prefer a filter-only Quarto interface. Users should not need both `revealjs-plugins` and `filters`.
- Current user-facing setup:

```yaml
format:
  revealjs:
    progress: false
    progress-bar:
      animate-overview-exit: true
      section-widths: equal
filters:
  - revealjs-progress-bar
```

## Repository Layout

- `_extensions/revealjs-progress-bar/_extension.yml`: extension metadata; contributes the Lua filter.
- `_extensions/revealjs-progress-bar/revealjs-progress-bar.lua`: injects CSS, JS, and serialized options.
- `_extensions/revealjs-progress-bar/revealjs-progress-bar.js`: runtime behavior.
- `_extensions/revealjs-progress-bar/revealjs-progress-bar.css`: extension styling.
- `README.md`: installation and usage docs.
- `example.qmd`: documentation/demo deck.
- `custom.css`: demo-only styling customizations.

Do not commit Quarto render artifacts (`example.html`, `example_files/`, `.quarto/`) or editor-local files (`.luarc.json`, `.DS_Store`).

## Implementation Architecture

The extension is filter-driven:

- `_extension.yml` contributes `revealjs-progress-bar.lua`.
- The Lua filter reads `progress-bar` options from document metadata, including nested `format.revealjs.progress-bar`.
- The Lua filter injects CSS into `in-header`, options into `window.RevealProgressBarOptions`, and JS after body.
- The JS auto-starts when `window.Reveal` is available, but still exposes `window.RevealProgressBar = createPlugin` for compatibility.

Important JS structure:

- `collectSections(deck, options)`: finds progress sections and content slides.
- `renderNav(deck, state, options)`: builds the fixed top progress bar.
- `renderOverview(state, options)`: enhances `.progress-overview`.
- `bindNavInteractions(deck, state, nav)`: hover and click navigation.
- `syncNav(deck, state, currentSlide)`: active/completed/hidden state.
- `syncOverview(state)`: overview title and preview selection.
- `startOverviewExit(deck, state, options)`: overview-to-top animation.
- `navigateToFirstProgressSlide(deck, state)`: jumps from overview to first real content slide.

Keep DOM and CSS classes prefixed with `rpb-*`.

## Behavior Rules To Preserve

- Disable RevealJS native progress in examples/docs with `progress: false`.
- The custom progress bar must not appear before the `.progress-overview` slide when that slide exists.
- If `.progress-overview` exists, exclude everything before it from the bar and slide numbers.
- If no `.progress-overview` exists, start progress after the deck title slide.
- Exclude the deck title slide and overview slide from progress.
- Fragments do not count as progress.
- For vertical sections, ignore the section title slide when it is followed by content slides.
- Click section labels to navigate to the start of that section.
- Click inside a section track to navigate to a specific content slide.
- Hover shows ticks/slide numbers and makes the active/hovered bar thicker with larger labels.
- Section labels resolve in this order:
  1. `data-progress-label`
  2. first `h1`/`h2` text
- Hide the bar on one slide with `.hide-progress-bar`. This hides display only; the slide remains in progress calculation.

## Overview Slide Requirements

Users mark the overview slide with:

```markdown
## Presentation plan {.progress-overview}
```

When a `.progress-overview` slide exists:

- The progress bar preview on the overview slide must use the same dimensions and label sizing as the normal bar.
- The large currently selected section title above the preview should look like a centered H1.
- During overview exit animation:
  1. Slide content disappears except the bar.
  2. The bar slowly rises to the top over roughly 1-2 seconds.
  3. The deck advances to the first progress slide.
- `animate-overview-exit: false` should remain sensible and skip the animation.

## Width Modes

Support:

- `section-widths: equal`: each section receives equal width.
- `section-widths: proportional`: each slide receives equal width, so longer sections are wider.

Keep the default `equal` unless there is an intentional product decision to change it.

## Styling Constraints

Current defaults are deliberately neutral and Quarto-compatible.

Expose and respect CSS variables, including:

```css
:root {
  --rpb-top: 0.7rem;
  --rpb-width: min(88vw, 980px);
  --rpb-height: 0.14rem;
  --rpb-fill-color: currentColor;
  --rpb-track-color: color-mix(in srgb, currentColor 18%, transparent);
  --rpb-label-color: color-mix(in srgb, currentColor 54%, transparent);
  --rpb-label-active-color: currentColor;
}
```

Mobile currently uses a smaller top offset (`--rpb-top: 0.52rem`). Preserve enough space between the top bar and slide titles without moving slide content down.

Important CSS pitfall:

```css
.reveal .slides > section.stack {
  top: 0;
}
```

This fixes Quarto `center: false` decks where top-level vertical stacks can start too low when there is no `# Intro` before `.progress-overview`. Do not remove it unless you replace it with a verified equivalent.

## Validation Checklist

Before finishing meaningful changes, run:

```bash
node --check _extensions/revealjs-progress-bar/revealjs-progress-bar.js
quarto render example.qmd
git status --short --ignored
```

Visually validate:

- Bar hidden before `.progress-overview`.
- Overview title is centered and large.
- Overview exit animation: content fades, bar rises slowly, then presentation starts.
- Slides after overview render at normal vertical position, especially with no preceding `# Intro`.
- Desktop and mobile top spacing.
- Hover ticks, hover slide numbers, and thicker bar.
- Click navigation by label and track.
- `section-widths: equal` and `section-widths: proportional`.
- `.hide-progress-bar` hides the bar only for that slide.
- Fragments do not advance progress.
- Vertical section title slides do not count as content.

## Git And Publication Notes

The repo was reset to a clean `main` branch with an initial commit. The remote should be:

```bash
git@github.com:alpa12/revealjs-progress-bar.git
```

Pushing previously failed because GitHub SSH authentication was not configured in the environment (`Permission denied (publickey)`). Do not treat that as a repository problem.

After SSH/auth is fixed, publish with:

```bash
git push -u origin main
```

Then test installation from a clean directory:

```bash
quarto add alpa12/revealjs-progress-bar
```

Finally, tag a first release when ready:

```bash
git tag v0.1.0
git push origin v0.1.0
```
