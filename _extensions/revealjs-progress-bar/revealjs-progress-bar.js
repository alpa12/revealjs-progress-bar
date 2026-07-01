(function () {
  "use strict";

  var NAV_ID = "rpb-progress-bar";
  var INSTANCE_KEY = "__revealProgressBarInitialized";
  var DEFAULTS = {
    overview: false,
    animateOverviewExit: true,
    sectionWidths: "equal"
  };
  var EXIT_CONTENT_DELAY = 460;
  var EXIT_MOVE_DURATION = 1550;
  var EXIT_BUFFER = 120;

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeWidthMode(value) {
    return value === "proportional" ? "proportional" : "equal";
  }

  function mergeOptions(config) {
    var supplied =
      window.RevealProgressBarOptions ||
      (config && (config["progress-bar"] || config.progressBar)) ||
      {};
    return {
      overview: supplied.overview === undefined ? DEFAULTS.overview : !!supplied.overview,
      animateOverviewExit:
        supplied.animateOverviewExit === undefined
          ? DEFAULTS.animateOverviewExit
          : !!supplied.animateOverviewExit,
      sectionWidths: normalizeWidthMode(supplied.sectionWidths || supplied["section-widths"])
    };
  }

  function getSlidesRoot(deck) {
    var revealElement = deck && deck.getRevealElement ? deck.getRevealElement() : document.querySelector(".reveal");
    return revealElement ? revealElement.querySelector(".slides") : null;
  }

  function getTopSections(slidesRoot) {
    return toArray(slidesRoot ? slidesRoot.children : []).filter(function (child) {
      return child.tagName === "SECTION";
    });
  }

  function getHeading(slide) {
    return slide ? slide.querySelector("h1, h2") : null;
  }

  function getAttributeFromSlideOrHeading(slide, heading, names) {
    for (var i = 0; i < names.length; i += 1) {
      var slideValue = slide ? slide.getAttribute(names[i]) : "";
      if (slideValue && slideValue.trim()) {
        return slideValue.trim();
      }

      var headingValue = heading ? heading.getAttribute(names[i]) : "";
      if (headingValue && headingValue.trim()) {
        return headingValue.trim();
      }
    }

    return "";
  }

  function resolveLabel(slide, fallback) {
    var heading = getHeading(slide);
    var label = getAttributeFromSlideOrHeading(slide, heading, [
      "data-progress-label",
      "progress-label",
      "data-section-label"
    ]);
    if (label) {
      return label;
    }

    var headingText = heading ? heading.textContent.trim() : "";
    return headingText || fallback;
  }

  function resolveFullTitle(slide, fallback) {
    var heading = getHeading(slide);
    var headingText = heading ? heading.textContent.trim() : "";
    return headingText || fallback;
  }

  function isDeckTitleSlide(slide) {
    return !!(slide && slide.id === "title-slide");
  }

  function isOverviewSlide(slide) {
    return !!(slide && slide.classList && slide.classList.contains("progress-overview"));
  }

  function findOverviewSlide(slidesRoot) {
    return slidesRoot ? slidesRoot.querySelector("section.progress-overview") : null;
  }

  function getNestedSlides(topSection) {
    return toArray(topSection ? topSection.children : []).filter(function (child) {
      return child.tagName === "SECTION";
    });
  }

  function findSectionTitleSlide(slides) {
    return slides.find(function (slide) {
      return (
        slide.classList.contains("level1") ||
        slide.classList.contains("title-slide") ||
        !!slide.querySelector(":scope > h1")
      );
    });
  }

  function collectSections(deck, options) {
    var slidesRoot = getSlidesRoot(deck);
    var markedOverviewSlide = findOverviewSlide(slidesRoot);
    var overviewSlide = options.overview ? markedOverviewSlide : null;
    var sections = [];

    function isProgressSlide(slide) {
      if (!slide || isDeckTitleSlide(slide) || isOverviewSlide(slide)) {
        return false;
      }

      if (markedOverviewSlide && compareSlides(deck, slide, markedOverviewSlide) <= 0) {
        return false;
      }

      return true;
    }

    getTopSections(slidesRoot).forEach(function (topSection) {
      if (isDeckTitleSlide(topSection) || isOverviewSlide(topSection)) {
        return;
      }

      var nestedSlides = getNestedSlides(topSection).filter(function (slide) {
        return isProgressSlide(slide);
      });

      if (nestedSlides.length > 0) {
        var titleSlide = findSectionTitleSlide(nestedSlides);
        var contentSlides = nestedSlides;
        if (titleSlide && nestedSlides.length > 1) {
          contentSlides = nestedSlides.filter(function (slide) {
            return slide !== titleSlide;
          });
        }

        var targetSlide = titleSlide || contentSlides[0] || nestedSlides[0];
        var label = resolveLabel(targetSlide, "Section " + (sections.length + 1));
        sections.push({
          label: label,
          fullTitle: resolveFullTitle(targetSlide, label),
          slides: nestedSlides,
          contentSlides: contentSlides,
          targetSlide: targetSlide
        });
        return;
      }

      if (!topSection.classList.contains("slide") || !isProgressSlide(topSection)) {
        return;
      }

      var singleLabel = resolveLabel(topSection, "Section " + (sections.length + 1));
      sections.push({
        label: singleLabel,
        fullTitle: resolveFullTitle(topSection, singleLabel),
        slides: [topSection],
        contentSlides: [topSection],
        targetSlide: topSection
      });
    });

    return {
      sections: sections,
      overviewSlide: overviewSlide,
      progressStartSlide: markedOverviewSlide
    };
  }

  function buildSlideNumbers(sections) {
    var map = new Map();
    var number = 1;
    sections.forEach(function (section) {
      section.contentSlides.forEach(function (slide) {
        if (!map.has(slide)) {
          map.set(slide, number);
          number += 1;
        }
      });
    });
    return map;
  }

  function getSectionWeight(section, options) {
    if (options.sectionWidths === "proportional") {
      return Math.max(1, section.contentSlides.length);
    }
    return 1;
  }

  function createItem(section, index, slideNumbers, options, asButton) {
    var item = document.createElement(asButton ? "button" : "div");
    item.className = "rpb-item";
    item.setAttribute("data-rpb-section-index", String(index));
    item.style.setProperty("--rpb-progress-value", "0%");
    item.style.flexGrow = String(getSectionWeight(section, options));
    item.style.flexBasis = "0";
    if (asButton) {
      item.type = "button";
      item.title = section.label;
      item.setAttribute("aria-label", "Go to section " + section.label);
    }

    var label = document.createElement("span");
    label.className = "rpb-label";
    label.textContent = section.label;

    var track = document.createElement("span");
    track.className = "rpb-track";

    var fill = document.createElement("span");
    fill.className = "rpb-fill";
    track.appendChild(fill);

    if (section.contentSlides.length > 1) {
      var ticks = document.createElement("span");
      ticks.className = "rpb-ticks";
      ticks.setAttribute("aria-hidden", "true");
      for (var i = 1; i < section.contentSlides.length; i += 1) {
        var tick = document.createElement("span");
        tick.className = "rpb-tick";
        tick.style.left = ((i / section.contentSlides.length) * 100).toFixed(3) + "%";
        ticks.appendChild(tick);
      }
      track.appendChild(ticks);
    }

    var numbers = document.createElement("span");
    numbers.className = "rpb-numbers";
    numbers.setAttribute("aria-hidden", "true");
    section.contentSlides.forEach(function (slide, slideIndex) {
      var number = document.createElement("span");
      number.className = "rpb-number";
      number.textContent = String(slideNumbers.get(slide) || slideIndex + 1);
      number.style.left = (((slideIndex + 0.5) / section.contentSlides.length) * 100).toFixed(3) + "%";
      numbers.appendChild(number);
    });
    track.appendChild(numbers);

    item.appendChild(label);
    item.appendChild(track);
    return item;
  }

  function renderNav(deck, state, options) {
    var revealElement = deck.getRevealElement ? deck.getRevealElement() : document.querySelector(".reveal");
    var nav = document.getElementById(NAV_ID);
    if (!nav) {
      nav = document.createElement("div");
      nav.id = NAV_ID;
      nav.className = "rpb-progress rpb-is-hidden";
      nav.setAttribute("role", "navigation");
      nav.setAttribute("aria-label", "Slide section progress");
      (revealElement || document.body).appendChild(nav);
    }

    nav.innerHTML = "";
    state.sections.forEach(function (section, index) {
      nav.appendChild(createItem(section, index, state.slideNumbers, options, true));
    });
    bindNavInteractions(deck, state, nav);
    return nav;
  }

  function renderOverview(state, options) {
    if (!options.overview) {
      return;
    }

    if (!state.overviewSlide) {
      console.warn("[revealjs-progress-bar] overview is enabled, but no slide with class .progress-overview was found.");
      return;
    }

    var slide = state.overviewSlide;
    slide.classList.add("rpb-overview-slide");
    slide.setAttribute("data-visibility", "uncounted");

    var oldShell = slide.querySelector(".rpb-overview-shell");
    if (oldShell) {
      oldShell.remove();
    }

    var shell = document.createElement("div");
    shell.className = "rpb-overview-shell";

    var selectedTitle = document.createElement("div");
    selectedTitle.className = "rpb-overview-title";
    selectedTitle.setAttribute("aria-live", "polite");

    var preview = document.createElement("div");
    preview.className = "rpb-progress rpb-overview-preview";
    preview.setAttribute("aria-hidden", "true");

    state.sections.forEach(function (section, index) {
      preview.appendChild(createItem(section, index, state.slideNumbers, options, false));
    });

    var fragments = document.createElement("div");
    fragments.className = "rpb-overview-fragments";
    state.sections.forEach(function (_section, index) {
      var step = document.createElement("span");
      step.className = "fragment rpb-overview-step";
      step.setAttribute("data-fragment-index", String(index));
      step.setAttribute("data-rpb-section-index", String(index));
      fragments.appendChild(step);
    });

    var endStep = document.createElement("span");
    endStep.className = "fragment rpb-overview-step rpb-overview-end";
    endStep.setAttribute("data-fragment-index", String(state.sections.length));
    endStep.setAttribute("data-rpb-section-index", String(Math.max(0, state.sections.length - 1)));
    fragments.appendChild(endStep);

    shell.appendChild(selectedTitle);
    shell.appendChild(preview);
    shell.appendChild(fragments);
    slide.appendChild(shell);
  }

  function bindNavInteractions(deck, state, nav) {
    nav.addEventListener("mouseleave", function () {
      clearHover(state, nav);
    });

    toArray(nav.children).forEach(function (item) {
      var sectionIndex = Number(item.getAttribute("data-rpb-section-index"));
      var track = item.querySelector(".rpb-track");

      function updateHover(event) {
        var slideIndex = -1;
        if (track && event && track.contains(event.target)) {
          slideIndex = getSlideIndexFromTrack(track, state.sections[sectionIndex], event);
        }
        setHover(state, nav, sectionIndex, slideIndex);
      }

      item.addEventListener("mouseenter", updateHover);
      item.addEventListener("mousemove", updateHover);
      item.addEventListener("click", function (event) {
        if (Number.isNaN(sectionIndex)) {
          return;
        }

        var section = state.sections[sectionIndex];
        if (!section) {
          return;
        }

        if (track && track.contains(event.target)) {
          var contentSlideIndex = getSlideIndexFromTrack(track, section, event);
          var contentSlide = section.contentSlides[contentSlideIndex];
          if (contentSlide) {
            navigateToSlide(deck, contentSlide);
            return;
          }
        }

        navigateToSlide(deck, section.targetSlide);
      });
    });
  }

  function getSlideIndexFromTrack(track, section, event) {
    if (!track || !section || !section.contentSlides.length) {
      return -1;
    }
    var rect = track.getBoundingClientRect();
    if (!(rect.width > 0)) {
      return -1;
    }
    var ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    return clamp(Math.floor(ratio * section.contentSlides.length), 0, section.contentSlides.length - 1);
  }

  function navigateToSlide(deck, slide) {
    if (!deck || !slide || typeof deck.slide !== "function") {
      return;
    }

    if (typeof deck.getIndices === "function") {
      var indices = deck.getIndices(slide);
      if (indices && typeof indices.h === "number") {
        deck.slide(indices.h, indices.v || 0, -1);
        return;
      }
    }

    if (slide.id) {
      window.location.hash = "/" + slide.id;
    }
  }

  function setHover(state, nav, sectionIndex, slideIndex) {
    state.hoverSectionIndex = sectionIndex;
    state.hoverSlideIndex = slideIndex;
    nav.classList.toggle("rpb-is-hovering", sectionIndex >= 0);

    toArray(nav.children).forEach(function (item, itemIndex) {
      var isHovered = itemIndex === sectionIndex;
      item.classList.toggle("rpb-is-hover-focus", isHovered);
      toArray(item.querySelectorAll(".rpb-number")).forEach(function (number, numberIndex) {
        number.classList.toggle("rpb-is-hover-target", isHovered && numberIndex === slideIndex);
      });
    });
  }

  function clearHover(state, nav) {
    state.hoverSectionIndex = -1;
    state.hoverSlideIndex = -1;
    nav.classList.remove("rpb-is-hovering");
    toArray(nav.querySelectorAll(".rpb-is-hover-focus")).forEach(function (item) {
      item.classList.remove("rpb-is-hover-focus");
    });
    toArray(nav.querySelectorAll(".rpb-is-hover-target")).forEach(function (number) {
      number.classList.remove("rpb-is-hover-target");
    });
  }

  function getActiveSectionIndex(sections, currentSlide) {
    return sections.findIndex(function (section) {
      return section.slides.indexOf(currentSlide) >= 0;
    });
  }

  function getContentSlideIndex(section, currentSlide) {
    return section && currentSlide ? section.contentSlides.indexOf(currentSlide) : -1;
  }

  function setItemProgress(item, value) {
    item.style.setProperty("--rpb-progress-value", clamp(value, 0, 100).toFixed(2) + "%");
  }

  function updateCurrentNumber(item, currentIndex) {
    item.classList.toggle("rpb-has-current-number", currentIndex >= 0);
    toArray(item.querySelectorAll(".rpb-number")).forEach(function (number, index) {
      number.classList.toggle("rpb-is-current", index === currentIndex);
    });
  }

  function compareSlides(deck, first, second) {
    if (!first || !second || first === second) {
      return 0;
    }

    if (deck && typeof deck.getIndices === "function") {
      var firstIndices = deck.getIndices(first);
      var secondIndices = deck.getIndices(second);
      if (firstIndices && secondIndices) {
        if (firstIndices.h !== secondIndices.h) {
          return firstIndices.h - secondIndices.h;
        }
        return (firstIndices.v || 0) - (secondIndices.v || 0);
      }
    }

    if (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }
    return 1;
  }

  function isBeforeProgress(deck, state, currentSlide) {
    return !!(
      state.progressStartSlide &&
      currentSlide &&
      compareSlides(deck, currentSlide, state.progressStartSlide) < 0
    );
  }

  function hasDisabledProgressValue(value) {
    value = value ? value.trim().toLowerCase() : "";
    return value === "false" || value === "0" || value === "off" || value === "hide" || value === "hidden";
  }

  function disablesProgressBar(slide) {
    if (!slide) {
      return false;
    }

    var candidates = [slide];
    var parent = slide.parentElement;
    if (parent && parent.tagName === "SECTION" && !parent.classList.contains("slides")) {
      candidates.push(parent);
    }

    return candidates.some(function (candidate) {
      return (
        candidate.classList.contains("rpb-hide-progress") ||
        candidate.classList.contains("hide-progress-bar") ||
        hasDisabledProgressValue(candidate.getAttribute("data-progress-bar")) ||
        hasDisabledProgressValue(candidate.getAttribute("data-progressbar"))
      );
    });
  }

  function syncNav(deck, state, currentSlide) {
    var nav = document.getElementById(NAV_ID);
    if (!nav || !state.sections.length) {
      return;
    }

    var activeIndex = getActiveSectionIndex(state.sections, currentSlide);
    var hideNav =
      !currentSlide ||
      isDeckTitleSlide(currentSlide) ||
      isOverviewSlide(currentSlide) ||
      isBeforeProgress(deck, state, currentSlide) ||
      disablesProgressBar(currentSlide) ||
      activeIndex < 0;

    nav.classList.toggle("rpb-is-hidden", hideNav && !state.overviewExitRunning);
    if (hideNav) {
      return;
    }

    toArray(nav.children).forEach(function (item, index) {
      var section = state.sections[index];
      var contentIndex = getContentSlideIndex(section, currentSlide);
      var isActive = index === activeIndex;
      var progress = 0;

      if (index < activeIndex) {
        progress = 100;
      } else if (isActive && contentIndex >= 0) {
        progress = ((contentIndex + 1) / Math.max(1, section.contentSlides.length)) * 100;
      }

      item.classList.toggle("rpb-is-complete", index < activeIndex);
      item.classList.toggle("rpb-is-active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "step");
      } else {
        item.removeAttribute("aria-current");
      }
      setItemProgress(item, progress);
      updateCurrentNumber(item, isActive ? contentIndex : -1);
    });
  }

  function getOverviewSelectedIndex(slide) {
    var selected = -1;
    toArray(slide ? slide.querySelectorAll(".rpb-overview-step.visible") : []).forEach(function (step) {
      var index = Number(step.getAttribute("data-rpb-section-index"));
      if (!Number.isNaN(index)) {
        selected = Math.max(selected, index);
      }
    });
    return selected;
  }

  function syncOverview(state) {
    var slide = state.overviewSlide;
    if (!slide) {
      return;
    }

    var selectedIndex = getOverviewSelectedIndex(slide);
    var hasSelection = selectedIndex >= 0 && selectedIndex < state.sections.length;
    var title = slide.querySelector(".rpb-overview-title");
    var preview = slide.querySelector(".rpb-overview-preview");
    slide.classList.toggle("rpb-has-selection", hasSelection);

    if (title) {
      title.textContent = hasSelection ? state.sections[selectedIndex].fullTitle : "";
    }

    if (!preview) {
      return;
    }

    toArray(preview.children).forEach(function (item, index) {
      item.classList.toggle("rpb-is-complete", hasSelection && index < selectedIndex);
      item.classList.toggle("rpb-is-active", hasSelection && index === selectedIndex);
      setItemProgress(item, hasSelection && index <= selectedIndex ? 100 : 0);
    });
  }

  function completeNavForOverviewExit(nav) {
    toArray(nav.children).forEach(function (item) {
      item.classList.add("rpb-is-complete");
      item.classList.remove("rpb-is-active");
      item.removeAttribute("aria-current");
      setItemProgress(item, 100);
      updateCurrentNumber(item, -1);
    });
  }

  function navigateToFirstProgressSlide(deck, state) {
    var firstSection = state.sections[0];
    var targetSlide = firstSection && (firstSection.targetSlide || firstSection.contentSlides[0] || firstSection.slides[0]);

    if (targetSlide) {
      navigateToSlide(deck, targetSlide);
      return;
    }

    if (deck && typeof deck.next === "function") {
      deck.next();
    }
  }

  function startOverviewExit(deck, state, options) {
    if (!options.animateOverviewExit || state.overviewExitRunning || !state.overviewSlide) {
      navigateToFirstProgressSlide(deck, state);
      return;
    }

    var nav = document.getElementById(NAV_ID);
    var preview = state.overviewSlide.querySelector(".rpb-overview-preview");
    if (!nav || !preview) {
      navigateToFirstProgressSlide(deck, state);
      return;
    }

    var rect = preview.getBoundingClientRect();
    state.overviewExitRunning = true;
    completeNavForOverviewExit(nav);
    nav.classList.remove("rpb-is-hidden");
    nav.classList.add("rpb-is-overview-setup");
    nav.classList.remove("rpb-is-overview-transition");
    nav.style.setProperty("--rpb-overview-top", rect.top.toFixed(2) + "px");
    nav.style.setProperty("--rpb-overview-width", rect.width.toFixed(2) + "px");
    state.overviewSlide.classList.add("rpb-is-exiting");

    if (typeof deck.configure === "function") {
      deck.configure({ keyboard: false });
    }

    nav.getBoundingClientRect();
    window.setTimeout(function () {
      state.overviewSlide.classList.add("rpb-preview-covered");
      window.requestAnimationFrame(function () {
        nav.classList.add("rpb-is-overview-transition");
      });
    }, EXIT_CONTENT_DELAY);

    window.setTimeout(function () {
      navigateToFirstProgressSlide(deck, state);
      window.setTimeout(function () {
        if (state.overviewExitRunning && deck.getCurrentSlide && deck.getCurrentSlide() !== state.overviewSlide) {
          finishOverviewExit(deck, state);
        }
      }, 80);
    }, EXIT_CONTENT_DELAY + EXIT_MOVE_DURATION + EXIT_BUFFER);
  }

  function finishOverviewExit(deck, state) {
    var nav = document.getElementById(NAV_ID);
    state.overviewExitRunning = false;
    if (state.overviewSlide) {
      state.overviewSlide.classList.remove("rpb-is-exiting");
      state.overviewSlide.classList.remove("rpb-preview-covered");
    }
    if (nav) {
      nav.classList.remove("rpb-is-overview-setup");
      nav.classList.remove("rpb-is-overview-transition");
      nav.style.removeProperty("--rpb-overview-top");
      nav.style.removeProperty("--rpb-overview-width");
    }
    if (deck && typeof deck.configure === "function") {
      deck.configure({ keyboard: true });
    }
    syncNav(deck, state, deck.getCurrentSlide ? deck.getCurrentSlide() : null);
  }

  function createPlugin() {
    var state = {
      sections: [],
      overviewSlide: null,
      progressStartSlide: null,
      slideNumbers: new Map(),
      hoverSectionIndex: -1,
      hoverSlideIndex: -1,
      overviewExitRunning: false
    };

    return {
      id: "RevealProgressBar",
      init: function (deck) {
        if (!deck || deck[INSTANCE_KEY]) {
          return;
        }
        deck[INSTANCE_KEY] = true;

        var options = mergeOptions(deck.getConfig ? deck.getConfig() : {});

        function initialize() {
          var collected = collectSections(deck, options);
          state.sections = collected.sections;
          state.overviewSlide = collected.overviewSlide;
          state.progressStartSlide = collected.progressStartSlide;
          state.slideNumbers = buildSlideNumbers(state.sections);
          renderOverview(state, options);
          renderNav(deck, state, options);
          if (deck.sync) {
            deck.sync();
          }
          syncOverview(state);
          syncNav(deck, state, deck.getCurrentSlide ? deck.getCurrentSlide() : null);
        }

        deck.on("ready", function (event) {
          initialize();
          syncNav(deck, state, event.currentSlide);
        });

        deck.on("slidechanged", function (event) {
          if (state.overviewExitRunning && event.currentSlide !== state.overviewSlide) {
            finishOverviewExit(deck, state);
          }
          syncNav(deck, state, event.currentSlide);
          if (event.currentSlide === state.overviewSlide) {
            syncOverview(state);
          }
        });

        deck.on("fragmentshown", function (event) {
          var fragment = event.fragment;
          if (!fragment || !state.overviewSlide || !state.overviewSlide.contains(fragment)) {
            return;
          }
          syncOverview(state);
          if (fragment.classList.contains("rpb-overview-end")) {
            startOverviewExit(deck, state, options);
          }
        });

        deck.on("fragmenthidden", function (event) {
          var fragment = event.fragment;
          if (fragment && state.overviewSlide && state.overviewSlide.contains(fragment)) {
            syncOverview(state);
          }
        });

        if (deck.isReady && deck.isReady()) {
          initialize();
        }
      }
    };
  }

  function autoStart() {
    if (!window.Reveal || typeof window.Reveal.getConfig !== "function") {
      return;
    }
    createPlugin().init(window.Reveal);
  }

  window.RevealProgressBar = createPlugin;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoStart);
  } else {
    window.setTimeout(autoStart, 0);
  }
})();
