(function () {
  "use strict";

  var NAV_ID = "rpb-progress-bar";
  var INSTANCE_KEY = "__revealProgressBarInitialized";
  var DEFAULTS = {
    animateOverviewExit: true,
    sectionWidths: "equal",
    showSlideNumbers: true,
    countedSlides: "all",
    overrideNativeSlideNumbers: false
  };
  var EXIT_CONTENT_DELAY = 460;
  var EXIT_MOVE_DURATION = 1550;
  var EXIT_BUFFER = 120;
  var SLIDE_NUMBER_STEPS = [1, 2, 5, 10, 25, 100];
  var FALLBACK_MAX_VISIBLE_NUMBERS = 18;
  var DEFAULT_MAX_WIDTH_PER_SLIDE = 0.1;

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeWidthMode(value) {
    return value === "proportional" ? "proportional" : "equal";
  }

  function normalizeCountedSlides(value) {
    return value === "main" ? "main" : "all";
  }

  function mergeOptions(config) {
    var supplied =
      window.RevealProgressBarOptions ||
      (config && (config["progress-bar"] || config.progressBar)) ||
      {};
    return {
      animateOverviewExit:
        supplied.animateOverviewExit === undefined
          ? DEFAULTS.animateOverviewExit
          : !!supplied.animateOverviewExit,
      sectionWidths: normalizeWidthMode(supplied.sectionWidths || supplied["section-widths"]),
      showSlideNumbers:
        supplied.showSlideNumbers === undefined && supplied["show-slide-numbers"] === undefined
          ? DEFAULTS.showSlideNumbers
          : !!(supplied.showSlideNumbers !== undefined ? supplied.showSlideNumbers : supplied["show-slide-numbers"]),
      countedSlides: normalizeCountedSlides(supplied.countedSlides || supplied["counted-slides"]),
      overrideNativeSlideNumbers:
        supplied.overrideNativeSlideNumbers === undefined && supplied["override-native-slide-numbers"] === undefined
          ? DEFAULTS.overrideNativeSlideNumbers
          : !!(
              supplied.overrideNativeSlideNumbers !== undefined
                ? supplied.overrideNativeSlideNumbers
                : supplied["override-native-slide-numbers"]
            )
    };
  }

  function getRevealElement(deck) {
    var revealElement = deck && deck.getRevealElement ? deck.getRevealElement() : document.querySelector(".reveal");
    return revealElement || null;
  }

  function getSlidesRoot(deck) {
    var revealElement = getRevealElement(deck);
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
      if (slide && slide.hasAttribute(names[i])) {
        return (slide.getAttribute(names[i]) || "").trim();
      }

      if (heading && heading.hasAttribute(names[i])) {
        return (heading.getAttribute(names[i]) || "").trim();
      }
    }

    return null;
  }

  function resolveLabel(slide, fallback) {
    var heading = getHeading(slide);
    var label = getAttributeFromSlideOrHeading(slide, heading, ["data-progress-label"]);
    if (label !== null) {
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

  function isSectionTitleSlide(slide) {
    return !!(
      slide &&
      (slide.classList.contains("level1") ||
        slide.classList.contains("title-slide") ||
        !!slide.querySelector(":scope > h1"))
    );
  }

  function findSectionTitleSlide(slides) {
    return slides.find(function (slide) {
      return isSectionTitleSlide(slide);
    });
  }

  function hasProgressHeading(slide) {
    return !!(slide && slide.querySelector(":scope > h1, :scope > h2"));
  }

  function collectSectionsFromFlatSlides(deck, markedOverviewSlide) {
    var sections = [];
    var flatSlides = getNumberedSlides(deck, getSlidesRoot(deck));
    var afterOverview = !markedOverviewSlide;
    var currentGroup = null;

    function finishCurrentGroup() {
      if (!currentGroup) {
        return;
      }

      var contentSlides =
        currentGroup.contentSlides.length > 0 ? currentGroup.contentSlides : [currentGroup.targetSlide];
      var label = resolveLabel(currentGroup.targetSlide, "Section " + (sections.length + 1));
      sections.push({
        label: label,
        fullTitle: resolveFullTitle(currentGroup.targetSlide, label),
        slides: currentGroup.slides,
        contentSlides: contentSlides,
        targetSlide: currentGroup.targetSlide
      });
      currentGroup = null;
    }

    flatSlides.forEach(function (slide) {
      if (!slide || isDeckTitleSlide(slide)) {
        return;
      }

      if (isOverviewSlide(slide)) {
        if (slide === markedOverviewSlide) {
          afterOverview = true;
        }
        return;
      }

      if (!afterOverview || !hasProgressHeading(slide)) {
        return;
      }

      if (isSectionTitleSlide(slide)) {
        finishCurrentGroup();
        currentGroup = {
          targetSlide: slide,
          slides: [slide],
          contentSlides: []
        };
        return;
      }

      if (currentGroup) {
        currentGroup.slides.push(slide);
        currentGroup.contentSlides.push(slide);
        return;
      }

      var singleLabel = resolveLabel(slide, "Section " + (sections.length + 1));
      sections.push({
        label: singleLabel,
        fullTitle: resolveFullTitle(slide, singleLabel),
        slides: [slide],
        contentSlides: [slide],
        targetSlide: slide
      });
    });

    finishCurrentGroup();
    return sections;
  }

  function collectSections(deck, options) {
    var slidesRoot = getSlidesRoot(deck);
    var markedOverviewSlide = findOverviewSlide(slidesRoot);
    var overviewSlide = markedOverviewSlide || null;
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

    if (sections.length === 0 && deck && typeof deck.getSlides === "function") {
      sections = collectSectionsFromFlatSlides(deck, markedOverviewSlide);
    }

    return {
      sections: sections,
      overviewSlide: overviewSlide,
      progressStartSlide: markedOverviewSlide
    };
  }

  function getNumberedSlides(deck, slidesRoot) {
    if (deck && typeof deck.getSlides === "function") {
      return deck.getSlides().filter(function (slide) {
        return slide && !(slide.classList && slide.classList.contains("stack"));
      });
    }

    var slides = [];
    getTopSections(slidesRoot).forEach(function (topSection) {
      var nestedSlides = getNestedSlides(topSection);
      if (nestedSlides.length > 0) {
        nestedSlides.forEach(function (slide) {
          slides.push(slide);
        });
        return;
      }
      slides.push(topSection);
    });
    return slides;
  }

  function buildSlideNumbers(deck, sections, options) {
    var map = new Map();

    if (options.countedSlides === "all") {
      getNumberedSlides(deck, getSlidesRoot(deck)).forEach(function (slide, index) {
        if (!map.has(slide)) {
          var revealPastCount = deck && typeof deck.getSlidePastCount === "function" ? deck.getSlidePastCount(slide) : null;
          map.set(slide, typeof revealPastCount === "number" ? revealPastCount + 1 : index + 1);
        }
      });
      return map;
    }

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

  function getMinimumSlideNumberGap(slideNumbers) {
    var maxSlideNumber = 0;
    slideNumbers.forEach(function (number) {
      maxSlideNumber = Math.max(maxSlideNumber, number);
    });
    var digitCount = String(Math.max(1, maxSlideNumber)).length;
    return Math.max(22, digitCount * 10 + 6);
  }

  function getTotalTrackWidth(container) {
    return toArray(container ? container.children : []).reduce(function (total, item) {
      var track = item.querySelector(".rpb-track");
      var rect = track ? track.getBoundingClientRect() : null;
      return total + (rect && rect.width ? rect.width : 0);
    }, 0);
  }

  function stepFitsRenderedTracks(sections, container, step, minimumGap) {
    return toArray(container ? container.children : []).every(function (item, index) {
      var section = sections[index];
      var count = section && section.contentSlides ? section.contentSlides.length : 0;
      if (count <= 1) {
        return true;
      }

      var track = item.querySelector(".rpb-track");
      var rect = track ? track.getBoundingClientRect() : null;
      if (!rect || !(rect.width > 0)) {
        return true;
      }

      return (rect.width * step) / count >= minimumGap;
    });
  }

  function chooseSlideNumberStep(sections, slideNumbers, container) {
    var totalSlideCount = slideNumbers ? slideNumbers.size : 0;
    if (totalSlideCount <= 1) {
      return 1;
    }

    var minimumGap = getMinimumSlideNumberGap(slideNumbers);
    var totalTrackWidth = getTotalTrackWidth(container);

    if (totalTrackWidth > 0) {
      for (var i = 0; i < SLIDE_NUMBER_STEPS.length; i += 1) {
        var step = SLIDE_NUMBER_STEPS[i];
        var fitsTotalDensity = (totalTrackWidth * step) / totalSlideCount >= minimumGap;
        if (fitsTotalDensity && stepFitsRenderedTracks(sections, container, step, minimumGap)) {
          return step;
        }
      }
      return SLIDE_NUMBER_STEPS[SLIDE_NUMBER_STEPS.length - 1];
    }

    for (var j = 0; j < SLIDE_NUMBER_STEPS.length; j += 1) {
      if (Math.ceil(totalSlideCount / SLIDE_NUMBER_STEPS[j]) <= FALLBACK_MAX_VISIBLE_NUMBERS) {
        return SLIDE_NUMBER_STEPS[j];
      }
    }
    return SLIDE_NUMBER_STEPS[SLIDE_NUMBER_STEPS.length - 1];
  }

  function isSampledSlideNumber(slideNumber, step) {
    return slideNumber === 1 || step <= 1 || slideNumber % step === 0;
  }

  function updateSlideNumberSampling(container, sections, slideNumbers) {
    if (!container || !sections || !slideNumbers) {
      return;
    }

    var step = chooseSlideNumberStep(sections, slideNumbers, container);
    container.setAttribute("data-rpb-number-step", String(step));
    toArray(container.children).forEach(function (item) {
      item.setAttribute("data-rpb-number-step", String(step));
      toArray(item.querySelectorAll(".rpb-number")).forEach(function (number) {
        var slideNumber = Number(number.getAttribute("data-rpb-slide-number"));
        number.classList.toggle("rpb-is-sampled", !Number.isNaN(slideNumber) && isSampledSlideNumber(slideNumber, step));
      });
    });
  }

  function getCssVariable(element, name) {
    if (!element || !window.getComputedStyle) {
      return "";
    }
    return window.getComputedStyle(element).getPropertyValue(name).trim();
  }

  function createCssProbe(element) {
    var probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.left = "-10000px";
    probe.style.top = "0";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.boxSizing = "border-box";
    (element && element.parentElement ? element.parentElement : document.body).appendChild(probe);
    return probe;
  }

  function resolveCssLength(element, value, fallback) {
    if (!value) {
      return fallback;
    }

    var numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    var probe = createCssProbe(element);
    probe.style.width = value;
    probe.style.height = "0";
    var rect = probe.getBoundingClientRect();
    probe.remove();
    return Number.isFinite(rect.width) && rect.width >= 0 ? rect.width : fallback;
  }

  function resolveCssRatio(element, value, fallback) {
    if (!value) {
      return fallback;
    }

    var trimmed = value.trim();
    var numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return clamp(numeric, 0, 1);
    }

    if (trimmed.indexOf("%") > -1 && /^-?\d*\.?\d+%$/.test(trimmed)) {
      return clamp(parseFloat(trimmed) / 100, 0, 1);
    }

    var wrapper = createCssProbe(element);
    var child = document.createElement("div");
    wrapper.style.width = "1000px";
    wrapper.style.height = "0";
    child.style.width = trimmed;
    child.style.height = "0";
    wrapper.appendChild(child);
    var rect = child.getBoundingClientRect();
    wrapper.remove();

    if (Number.isFinite(rect.width) && rect.width >= 0) {
      return clamp(rect.width / 1000, 0, 1);
    }
    return fallback;
  }

  function getViewportSize() {
    var visualViewport = window.visualViewport || null;
    return {
      width: visualViewport && visualViewport.width ? visualViewport.width : window.innerWidth,
      height: visualViewport && visualViewport.height ? visualViewport.height : window.innerHeight
    };
  }

  function getProgressSlideCount(sections) {
    return (sections || []).reduce(function (total, section) {
      return total + (section && section.contentSlides ? section.contentSlides.length : 0);
    }, 0);
  }

  function measureDeckLayout(deck) {
    var revealElement = getRevealElement(deck);
    var slidesRoot = getSlidesRoot(deck);
    var viewport = getViewportSize();
    var revealRect = revealElement
      ? revealElement.getBoundingClientRect()
      : { left: 0, width: viewport.width, height: viewport.height };
    var slidesRect = slidesRoot ? slidesRoot.getBoundingClientRect() : null;
    var contentLeft = slidesRect && slidesRect.width > 0 ? slidesRect.left : revealRect.left;
    var contentWidth = slidesRect && slidesRect.width > 0 ? slidesRect.width : revealRect.width;
    var scale = deck && typeof deck.getScale === "function" ? deck.getScale() : 0;

    if (!(scale > 0) && slidesRoot && slidesRoot.offsetWidth > 0 && slidesRect && slidesRect.width > 0) {
      scale = slidesRect.width / slidesRoot.offsetWidth;
    }
    if (!(scale > 0)) {
      scale = 1;
    }

    var styleElement = document.getElementById(NAV_ID) || revealElement || document.documentElement;
    var fallbackWidth = Math.min(viewport.width * 0.88, 1176);
    var fallbackHeight = Math.max(1, viewport.height * 0.00207);

    return {
      contentLeft: contentLeft,
      contentWidth: Math.max(0, contentWidth),
      contentCenter: contentLeft + contentWidth / 2,
      scale: scale,
      maxWidth: resolveCssLength(styleElement, getCssVariable(styleElement, "--rpb-width"), fallbackWidth),
      maxWidthPerSlide: resolveCssRatio(
        styleElement,
        getCssVariable(styleElement, "--rpb-max-width-per-slide"),
        DEFAULT_MAX_WIDTH_PER_SLIDE
      ),
      top: resolveCssLength(styleElement, getCssVariable(styleElement, "--rpb-top"), viewport.height * 0.0104),
      height: resolveCssLength(styleElement, getCssVariable(styleElement, "--rpb-height"), fallbackHeight),
      gap: resolveCssLength(styleElement, getCssVariable(styleElement, "--rpb-gap"), viewport.height * 0.00326),
      labelSize: resolveCssLength(styleElement, getCssVariable(styleElement, "--rpb-label-size"), viewport.height * 0.0126),
      labelMargin: resolveCssLength(
        styleElement,
        getCssVariable(styleElement, "--rpb-label-margin"),
        viewport.height * 0.00296
      ),
      numberSize: resolveCssLength(styleElement, getCssVariable(styleElement, "--rpb-number-size"), viewport.height * 0.01555),
      numberOffset: resolveCssLength(
        styleElement,
        getCssVariable(styleElement, "--rpb-number-offset"),
        viewport.height * 0.00385
      ),
      numberHeight: resolveCssLength(
        styleElement,
        getCssVariable(styleElement, "--rpb-number-height"),
        viewport.height * 0.00859
      ),
      labelHoverLift: resolveCssLength(
        styleElement,
        getCssVariable(styleElement, "--rpb-label-hover-lift"),
        viewport.height * 0.00044
      ),
      numberHoverLift: resolveCssLength(
        styleElement,
        getCssVariable(styleElement, "--rpb-number-hover-lift"),
        viewport.height * 0.00074
      ),
      exitLift: resolveCssLength(styleElement, getCssVariable(styleElement, "--rpb-exit-lift"), viewport.height * 0.00267)
    };
  }

  function computeProgressBarWidth(state, metrics) {
    var progressSlideCount = getProgressSlideCount(state.sections);
    var slideLimitedWidth = metrics.contentWidth * Math.max(1, progressSlideCount) * metrics.maxWidthPerSlide;
    return Math.max(0, Math.min(metrics.contentWidth, metrics.maxWidth, slideLimitedWidth));
  }

  function setPixelVariable(element, name, value) {
    if (element && Number.isFinite(value)) {
      element.style.setProperty(name, Math.max(0, value).toFixed(3) + "px");
    }
  }

  function applyLayoutDimensions(element, metrics, width, scale) {
    var divisor = scale > 0 ? scale : 1;
    setPixelVariable(element, "--rpb-computed-width", width / divisor);
    setPixelVariable(element, "--rpb-computed-height", metrics.height / divisor);
    setPixelVariable(element, "--rpb-computed-gap", metrics.gap / divisor);
    setPixelVariable(element, "--rpb-computed-label-size", metrics.labelSize / divisor);
    setPixelVariable(element, "--rpb-computed-label-margin", metrics.labelMargin / divisor);
    setPixelVariable(element, "--rpb-computed-number-size", metrics.numberSize / divisor);
    setPixelVariable(element, "--rpb-computed-number-offset", metrics.numberOffset / divisor);
    setPixelVariable(element, "--rpb-computed-number-height", metrics.numberHeight / divisor);
    setPixelVariable(element, "--rpb-computed-label-hover-lift", metrics.labelHoverLift / divisor);
    setPixelVariable(element, "--rpb-computed-number-hover-lift", metrics.numberHoverLift / divisor);
    setPixelVariable(element, "--rpb-computed-exit-lift", metrics.exitLift / divisor);
  }

  function applyProgressBarLayout(deck, state) {
    var metrics = measureDeckLayout(deck);
    var width = computeProgressBarWidth(state, metrics);
    var nav = document.getElementById(NAV_ID);

    if (nav) {
      setPixelVariable(nav, "--rpb-computed-left", metrics.contentCenter);
      setPixelVariable(nav, "--rpb-computed-top", metrics.top);
      applyLayoutDimensions(nav, metrics, width, 1);
    }

    if (state.overviewSlide) {
      applyLayoutDimensions(state.overviewSlide, metrics, width, metrics.scale);
    }

    return metrics;
  }

  function scheduleProgressBarLayout(deck, state, afterLayout) {
    state.layoutAfterLayout = afterLayout || state.layoutAfterLayout || null;
    if (state.layoutFrame) {
      return;
    }

    state.layoutFrame = window.requestAnimationFrame(function () {
      var callback = state.layoutAfterLayout;
      state.layoutFrame = null;
      state.layoutAfterLayout = null;
      applyProgressBarLayout(deck, state);
      if (callback) {
        callback();
      }
    });
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
      item.title = section.fullTitle || section.label;
      item.setAttribute("aria-label", "Go to section " + (section.fullTitle || section.label));
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

    if (options.showSlideNumbers) {
      var numbers = document.createElement("span");
      numbers.className = "rpb-numbers";
      numbers.setAttribute("aria-hidden", "true");
      section.contentSlides.forEach(function (slide, slideIndex) {
        var number = document.createElement("span");
        var slideNumber = slideNumbers.get(slide) || slideIndex + 1;
        number.className = "rpb-number";
        number.textContent = String(slideNumber);
        number.setAttribute("data-rpb-slide-index", String(slideIndex));
        number.setAttribute("data-rpb-slide-number", String(slideNumber));
        number.style.left = (((slideIndex + 0.5) / section.contentSlides.length) * 100).toFixed(3) + "%";
        numbers.appendChild(number);
      });
      track.appendChild(numbers);
    }

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
    if (!state.overviewSlide) {
      return;
    }

    var slide = state.overviewSlide;
    slide.classList.add("rpb-overview-slide");

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
        updateSlideNumberSampling(nav, state.sections, state.slideNumbers);
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
      toArray(item.querySelectorAll(".rpb-number")).forEach(function (number) {
        var numberSlideIndex = Number(number.getAttribute("data-rpb-slide-index"));
        number.classList.toggle(
          "rpb-is-hover-target",
          isHovered && !Number.isNaN(numberSlideIndex) && numberSlideIndex === slideIndex
        );
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
    toArray(item.querySelectorAll(".rpb-number")).forEach(function (number) {
      var slideIndex = Number(number.getAttribute("data-rpb-slide-index"));
      number.classList.toggle("rpb-is-current", !Number.isNaN(slideIndex) && slideIndex === currentIndex);
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
      return candidate.classList.contains("hide-progress-bar");
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

  function getNativeSlideNumberElement(deck) {
    var revealElement = deck && deck.getRevealElement ? deck.getRevealElement() : document.querySelector(".reveal");
    return revealElement ? revealElement.querySelector(".slide-number") : null;
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getSlideHref(deck, slide) {
    if (deck && deck.location && typeof deck.location.getHash === "function") {
      return "#" + deck.location.getHash(slide);
    }
    if (slide && slide.id) {
      return "#/" + slide.id;
    }
    return window.location.hash || "#";
  }

  function getNativeSlideNumberFormat(deck) {
    var config = deck && typeof deck.getConfig === "function" ? deck.getConfig() : {};
    return config ? config.slideNumber : null;
  }

  function shouldShowNativeTotal(format) {
    return format === "c/t";
  }

  function renderNativeSlideNumber(number, total, href, includeTotal) {
    var escapedHref = escapeAttribute(href);
    if (!includeTotal) {
      return '<a href="' + escapedHref + '"><span class="slide-number-a">' + number + "</span></a>";
    }
    return (
      '<a href="' +
      escapedHref +
      '"><span class="slide-number-a">' +
      number +
      '</span><span class="slide-number-delimiter"> / </span><span class="slide-number-b">' +
      total +
      "</span></a>"
    );
  }

  function updateNativeSlideNumberText(nativeNumber, number, total, includeTotal) {
    var current = nativeNumber.querySelector(".slide-number-a");
    var delimiter = nativeNumber.querySelector(".slide-number-delimiter");
    var totalElement = nativeNumber.querySelector(".slide-number-b");

    if (!current || (includeTotal && !totalElement)) {
      return false;
    }

    current.textContent = String(number);
    if (includeTotal) {
      totalElement.textContent = String(total);
      if (delimiter && delimiter.textContent.trim() === "/") {
        delimiter.textContent = " / ";
      }
    }
    return true;
  }

  function syncNativeSlideNumber(deck, state, options, currentSlide) {
    if (!options.overrideNativeSlideNumbers || options.countedSlides !== "main") {
      return;
    }

    var nativeNumber = getNativeSlideNumberElement(deck);
    if (!nativeNumber) {
      return;
    }

    var slideNumber = state.slideNumbers.get(currentSlide);
    nativeNumber.setAttribute("data-rpb-overridden", "true");

    if (!slideNumber) {
      nativeNumber.innerHTML = "";
      nativeNumber.style.visibility = "hidden";
      return;
    }

    nativeNumber.style.removeProperty("visibility");
    var includeTotal = shouldShowNativeTotal(getNativeSlideNumberFormat(deck));
    if (updateNativeSlideNumberText(nativeNumber, slideNumber, state.slideNumbers.size, includeTotal)) {
      return;
    }

    nativeNumber.innerHTML = renderNativeSlideNumber(slideNumber, state.slideNumbers.size, getSlideHref(deck, currentSlide), includeTotal);
  }

  function scheduleNativeSlideNumberSync(deck, state, options, currentSlide) {
    window.requestAnimationFrame(function () {
      syncNativeSlideNumber(deck, state, options, currentSlide || (deck.getCurrentSlide ? deck.getCurrentSlide() : null));
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

    applyProgressBarLayout(deck, state);
    var rect = preview.getBoundingClientRect();
    state.overviewExitRunning = true;
    completeNavForOverviewExit(nav);
    nav.classList.remove("rpb-is-hidden");
    nav.classList.add("rpb-is-overview-setup");
    nav.classList.remove("rpb-is-overview-transition");
    nav.style.setProperty("--rpb-overview-top", rect.top.toFixed(2) + "px");
    nav.style.setProperty("--rpb-overview-left", (rect.left + rect.width / 2).toFixed(2) + "px");
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
      nav.style.removeProperty("--rpb-overview-left");
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
      overviewExitRunning: false,
      layoutFrame: null,
      layoutAfterLayout: null
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
          state.slideNumbers = buildSlideNumbers(deck, state.sections, options);
          renderOverview(state, options);
          renderNav(deck, state, options);
          if (deck.sync) {
            deck.sync();
          }
          scheduleProgressBarLayout(deck, state, updateRenderedSlideNumberSampling);
          syncOverview(state);
          syncNav(deck, state, deck.getCurrentSlide ? deck.getCurrentSlide() : null);
          scheduleNativeSlideNumberSync(deck, state, options);
        }

        function updateRenderedSlideNumberSampling() {
          var nav = document.getElementById(NAV_ID);
          if (nav) {
            updateSlideNumberSampling(nav, state.sections, state.slideNumbers);
          }

          if (state.overviewSlide) {
            var preview = state.overviewSlide.querySelector(".rpb-overview-preview");
            if (preview) {
              updateSlideNumberSampling(preview, state.sections, state.slideNumbers);
            }
          }
        }

        deck.on("ready", function (event) {
          initialize();
          syncNav(deck, state, event.currentSlide);
          scheduleNativeSlideNumberSync(deck, state, options, event.currentSlide);
        });

        deck.on("slidechanged", function (event) {
          if (state.overviewExitRunning && event.currentSlide !== state.overviewSlide) {
            finishOverviewExit(deck, state);
          }
          syncNav(deck, state, event.currentSlide);
          scheduleNativeSlideNumberSync(deck, state, options, event.currentSlide);
          if (event.currentSlide === state.overviewSlide) {
            syncOverview(state);
          }
        });

        deck.on("resize", function () {
          scheduleProgressBarLayout(deck, state, updateRenderedSlideNumberSampling);
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

        window.addEventListener("resize", function () {
          scheduleProgressBarLayout(deck, state, updateRenderedSlideNumberSampling);
        });

        if (window.visualViewport) {
          window.visualViewport.addEventListener("resize", function () {
            scheduleProgressBarLayout(deck, state, updateRenderedSlideNumberSampling);
          });
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
