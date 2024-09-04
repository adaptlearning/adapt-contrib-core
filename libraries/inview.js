'use strict';
// inview 2024-09-04
(function() {
  // ENUMERATION SUPPORT
  function ENUM(e) {
    for (let i = 0, l = e.length; i < l; i++) {
      const n = e[i].toLowerCase();
      // eslint-disable-next-line no-new-wrappers
      this[n] = (new Number(i));
      this[n].string = n;
    }
  }
  // handler id generation
  let idIndex = 0;
  function makeId(element, data) {
    // make a unique event id from the element's expando property and the event handler guid
    element[$.expando] = element[$.expando] || ++idIndex;
    return data.guid + '-' + element[$.expando];
  }
  // create trigger thresholds for IntersectionObserver at 0.1% inview change
  const thresholdIncrements = 1000;
  const thresholds = (new Array(thresholdIncrements + 1)).fill(0).map((v, index) => index / thresholdIncrements);
  // make types and states enums
  const TYPE = new ENUM(['onscreen', 'inview']);
  const INVIEW_STATES = new ENUM(['none', 'top', 'bottom', 'left', 'right', 'both']);
  // handler, locking, config and window variables
  const registered = [];
  const locks = [];
  const config = {
    options: {},
    config(options) {
      if (typeof options !== 'object') return;
      Object.assign(config.options, options);
    }
  };
  // window size handlers
  const wndw = {
    $el: $(window),
    height: null,
    width: null,
    heightRatio: null,
    widthRatio: null,
    resize() {
      wndw.height = window.innerHeight || wndw.$el.height();
      wndw.width = window.innerWidth || wndw.$el.width();
      wndw.heightRatio = (100 / wndw.height);
      wndw.widthRatio = (100 / wndw.width);
      process();
    }
  };
  // handler functions
  function register(element, data, type) {
    const observer = new IntersectionObserver(entries => {
      if (isLocked()) {
        item.shouldTriggerAfterUnlock = true;
        return;
      }
      const measurement = getMeasurement(item.element);
      const uniqueMeasurementId = measurement.uniqueMeasurementId;
      const hasMeasureChanged = (
        !item.uniqueMeasurementId ||
        item.uniqueMeasurementId !== uniqueMeasurementId
      );
      if (!hasMeasureChanged) return;
      item.onscreen = measurement.uniqueMeasurementId;
      switch (item.type) {
        case TYPE.onscreen:
          processOnScreen(item, measurement);
          break;
        case TYPE.inview:
          processInView(item, measurement);
      }
    }, {
      root: null,
      threshold: thresholds
    });
    const item = {
      id: makeId(element, data),
      element,
      type,
      onscreen: isLocked() ? null : getMeasurement(element).uniqueMeasurementId,
      shouldTriggerAfterUnlock: false,
      observer
    };
    registered.push(item);
    observer.observe(element);
  }
  function unregister(element, data, type) {
    const findId = makeId(element, data);
    // run in reverse to prevent index shifts
    for (let i = registered.length - 1, l = -1; i > l; i--) {
      const item = registered[i];
      if (item.id !== findId || item.type !== type) continue;
      registered.splice(i, 1);
      item.observer.disconnect();
    }
  }
  function process() {
    const registeredCount = registered.length;
    if (registeredCount === 0) return;
    const triggerable = registered.filter(item => item.shouldTriggerAfterUnlock);
    triggerable.forEach(item => {
      const measurement = getMeasurement(item.element);
      item.onscreen = measurement.uniqueMeasurementId;
      item.shouldTriggerAfterUnlock = false;
      switch (item.type) {
        case TYPE.onscreen:
          processOnScreen(item, measurement);
          break;
        case TYPE.inview:
          processInView(item, measurement);
      }
    });
  }
  function processOnScreen(item, measurement) {
    $(item.element).trigger('onscreen', measurement);
  }
  function processInView(item, measurement) {
    const isTopOnScreen = (measurement.percentFromTop >= 0 && measurement.percentFromTop < 100);
    const isBottomOnScreen = (measurement.percentFromBottom >= 0 && measurement.percentFromBottom < 100);
    const isLeftOnScreen = (measurement.percentFromLeft >= 0 && measurement.percentFromLeft < 100);
    const isRightOnScreen = (measurement.percentFromRight >= 0 && measurement.percentFromRight < 100);
    const visiblePartY = (isTopOnScreen && isBottomOnScreen)
      ? INVIEW_STATES.both.string
      : isTopOnScreen
        ? INVIEW_STATES.top.string
        : isBottomOnScreen
          ? INVIEW_STATES.bottom.string
          : INVIEW_STATES.none.string;
    const visiblePartX = (isLeftOnScreen && isRightOnScreen)
      ? INVIEW_STATES.both.string
      : isLeftOnScreen
        ? INVIEW_STATES.left.string
        : isRightOnScreen
          ? INVIEW_STATES.right.string
          : INVIEW_STATES.none.string;
    const inviewState = [
      measurement.onscreen, // inview true/false
      visiblePartX, // left, right, both, none
      visiblePartY // top, bottom, both, none
    ];
    item._inviewPreviousState = inviewState;
    item._measurePreviousState = measurement;
    $(item.element).trigger('inview', inviewState);
  }
  // interface to allow for inview/onscreen to be disabled
  function lock(name) {
    if (isLocked(name)) return;
    locks.push(name);
  }
  function unlock(name) {
    if (!isLocked(name)) return;
    for (let i = 0, l = locks.length; i < l; i++) {
      const lock = locks[i];
      if (lock !== name) continue;
      locks.splice(i, 1);
      break;
    }
    process();
  }
  function isLocked(name) {
    if (!name) return (locks.length > 0);
    for (let i = 0, l = locks.length; i < l; i++) {
      const lock = locks[i];
      if (lock === name) return true;
    }
    return false;
  }
  function getMeasurement (element) {
    const offset = element.getBoundingClientRect();
    const height = offset.height;
    const width = offset.width;
    // topleft from topleft of window
    const top = offset.top;
    const left = offset.left;
    // bottomright from bottomright of window
    const bottom = wndw.height - (top + height);
    const right = wndw.width - (left + width);
    // percentages of above
    const percentFromTop = Math.round(wndw.heightRatio * top);
    const percentFromLeft = Math.round(wndw.widthRatio * left);
    const percentFromBottom = Math.round(wndw.heightRatio * bottom);
    const percentFromRight = Math.round(wndw.widthRatio * right);
    // inview
    let inviewHorizontal = (left + width > 0 && right < 0 && left < 0)
      ? width // fully onscreen
      : (left < 0)
        ? (width + left) // offscreen left
        : (left + width > wndw.width)
          ? (wndw.width - left) // offscreen right
          : width; // fully onscreen
    let inviewVertical = (top + height > 0 && bottom < 0 && top < 0)
      ? height // fully onscreen
      : (top < 0)
        ? (height + top)// offscreen top
        : (top + height > wndw.height)
          ? (wndw.height - top)// offscreen bottom
          : height; // fully onscreen
    // cap floor at 0 - cannot have negative inviews.
    if (inviewVertical < 0) inviewVertical = 0;
    if (inviewHorizontal < 0) inviewHorizontal = 0;
    const percentInviewVertical = Math.round((100 / height) * inviewVertical);
    const percentInviewHorizontal = Math.round((100 / width) * inviewHorizontal);
    const elementArea = height * width;
    const inviewArea = inviewVertical * inviewHorizontal;
    const percentInview = Math.round((100 / elementArea) * inviewArea);
    let onscreen = percentInview > 0;
    const offScreenSide = (percentFromRight > 100 || percentFromLeft > 100 || percentFromBottom > 100 || percentFromTop > 100);
    if (offScreenSide) onscreen = false;
    const hasNoSize = (height <= 0 && width <= 0);
    if (hasNoSize) onscreen = false;
    let cssHidden = isElementHidden(element);
    if (cssHidden) onscreen = false;
    if (onscreen) {
      // perform some extra checks to make sure item is onscreen
      const parents = getParents(element);
      // go through all the parents except the html tag
      for (let i = 0, l = parents.length - 1; i < l; i++) {
        const parent = parents[i];
        cssHidden = isElementHidden(parent);
        // check if parents are visibility hidden or display none
        if (cssHidden) {
          onscreen = false;
          break;
        }
        // check if child is out of bounds inside its parent, unless fullscreen
        const isOutOfBound = isOutOfBounds(element, parent);
        const isElementFullscreen = element === document.fullscreenElement;
        if (isOutOfBound && !isElementFullscreen) {
          onscreen = false;
          break;
        }
      }
    }
    const uniqueMeasurementId = '' + top + left + bottom + right + height + width + wndw.height + wndw.width + onscreen;
    return {
      top,
      left,
      bottom,
      right,
      percentFromTop,
      percentFromLeft,
      percentFromBottom,
      percentFromRight,
      percentInview,
      percentInviewHorizontal,
      percentInviewVertical,
      onscreen,
      uniqueMeasurementId,
      timestamp: (new Date()).getTime()
    };
  }
  function isElementHidden(element) {
    let cssHidden = (element.style.display === 'none' || element.style.visibility === 'hidden');
    if (cssHidden) return true;
    const style = window.getComputedStyle(element, null);
    cssHidden = (style.display === 'none' || style.visibility === 'hidden');
    return cssHidden;
  }
  function getParents(element) {
    const parents = [];
    let parent;
    while ((parent = element.parentElement)) {
      parents.push(parent);
      element = parent;
    }
    return parents;
  }
  function isOutOfBounds(element, parent) {
    const $parent = $(parent);
    if ($parent.css('overflow') === 'visible') return false;
    const $element = $(element);
    const elementPos = $element.offset();
    elementPos.bottom = (elementPos.top + element.clientHeight);
    elementPos.right = (elementPos.left + element.clientWidth);
    const parentPos = $parent.offset();
    parentPos.bottom = (parentPos.top + parent.clientHeight);
    parentPos.right = (parentPos.left + parent.clientWidth);
    // check inclusive of bounding rectangle edges
    const isOutOfBounds = (Math.floor(elementPos.bottom) <= Math.ceil(parentPos.top) ||
      Math.floor(elementPos.right) <= Math.ceil(parentPos.left) ||
      Math.ceil(elementPos.top) >= Math.floor(parentPos.bottom) ||
      Math.ceil(elementPos.left) >= Math.floor(parentPos.right));
    return isOutOfBounds;
  }
  // jQuery element + event handler attachment / removal
  Object.assign($.event.special, {
    onscreen: {
      noBubble: true,
      add(data) {
        register(this, data, TYPE.onscreen);
      },
      remove(data) {
        unregister(this, data, TYPE.onscreen);
      }
    },
    inview: {
      noBubble: true,
      add(data) {
        register(this, data, TYPE.inview);
      },
      remove(data) {
        unregister(this, data, TYPE.inview);
      }
    }
  });
  // jQuery interfaces
  // element functions
  Object.assign($.fn, {
    onscreen(callback) {
      if (callback) {
        // standard event attachment jquery api behaviour
        this.on('onscreen', callback);
        return this;
      }
      return getMeasurement($(this)[0]);
    },
    inview(callback) {
      if (callback) {
        // standard event attachment jquery api behaviour
        this.on('inview', callback);
        return this;
      }
      return getMeasurement($(this)[0]);
    }
  });
  // force an inview check - standard trigger event jquery api behaviour
  $.inview = $.onscreen = function() {
    console.log('calling $.inview or $.onscreen directly is deprecate');
  };
  // attach locking interface to $.inview.lock(name); etc
  Object.assign($.inview, { lock, unlock, isLocked }, config);
  wndw.resize();
})();
