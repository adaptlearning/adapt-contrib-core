/**
 * @file Deprecated A11y API - Backward compatibility shims for legacy jQuery methods
 * @module core/js/a11y/deprecated
 * @description Provides backward compatibility by mapping deprecated jQuery accessibility
 * methods to the new A11y module API. All deprecated methods log warnings directing
 * developers to the modern replacements.
 *
 * **Method Categories:**
 * - **Removed**: Methods that no longer serve a purpose (log removal notice, return stub)
 * - **Deprecated**: Methods that map to new API equivalents (log warning, call new API)
 *
 * **jQuery Instance Methods ($.fn):**
 * - `a11y_on` → `a11y.findTabbable()` + `a11y.toggleAccessible()`
 * - `a11y_popup` → `a11y.popupOpened()`
 * - `a11y_cntrl` → `a11y.toggleAccessible()` + `a11y.toggleEnabled()`
 * - `a11y_cntrl_enabled` → `a11y.toggleAccessibleEnabled()`
 * - `isReadable` → `a11y.isReadable()`
 * - `focusNoScroll` → `a11y.focus()`
 * - `focusNext` → `a11y.focusNext()` or `a11y.findFirstReadable()`
 * - `focusOrNext` → `a11y.focusFirst()`
 * - `a11y_focus` → `a11y.focusFirst()`
 * - `scrollDisable` → `a11y.scrollDisable()`
 * - `scrollEnable` → `a11y.scrollEnable()`
 *
 * **jQuery Static Methods ($):**
 * - `a11y_on` → `a11y.toggleHidden()`
 * - `a11y_popdown` → `a11y.popupClosed()`
 * - `a11y_focus` → `a11y.focusFirst()`
 * - `a11y_normalize` → `a11y.normalize()`
 * - `a11y_remove_breaks` → `a11y.removeBreaks()`
 */

/**
 * Registers deprecated jQuery methods that map to the new A11y API.
 * Called during A11y module initialization to maintain backward compatibility.
 * @param {Object} a11y - The A11y module instance for API delegation and logging
 */
export default function(a11y) {

  // Extend jQuery prototype with deprecated instance methods
  Object.assign($.fn, {

    isFixedPostion() {
      a11y.log.removed('$("..").isFixedPostion was unneeded and has been removed, let us know if you need it back.');
      return false;
    },

    a11y_aria_label() {
      a11y.log.removed('$("..").a11y_aria_label was incorrect behaviour.');
      return this;
    },

    limitedScrollTo() {
      a11y.log.removed('$.limitedScrollTo had no impact on the screen reader cursor.');
      return this;
    },

    a11y_text() {
      a11y.log.removed('a11y_text is no longer required. https://tink.uk/understanding-screen-reader-interaction-modes/');
      return this;
    },

    a11y_selected() {
      a11y.log.removed('$("..").a11y_selected is removed. Please use aria-live instead.');
      return this;
    },

    a11y_on(isOn) {
      a11y.log.deprecated('$("..").a11y_on, use a11y.findTabbable($element); and a11y.toggleAccessible($elements, isAccessible); instead.');
      const $tabbable = a11y.findTabbable(this);
      a11y.toggleAccessible($tabbable, isOn);
      return this;
    },

    a11y_only() {
      a11y.log.removed('$("..").a11y_only, use a11y.popupOpened($popupElement); instead.');
      return this;
    },

    scrollDisable() {
      if (a11y.config._options._isScrollDisableEnabled === false) {
        return this;
      }
      a11y.log.deprecated('$("..").scrollDisable, use a11y.scrollDisable($elements); instead.');
      a11y.scrollDisable(this);
      return this;
    },

    scrollEnable() {
      if (a11y.config._options._isScrollDisableEnabled === false) {
        return this;
      }
      a11y.log.deprecated('$("..").scrollEnable, use a11y.scrollEnable($elements); instead.');
      a11y.scrollEnable(this);
      return this;
    },

    a11y_popup() {
      a11y.log.deprecated('$("..").a11y_popup, use a11y.popupOpened($popupElement); instead.');
      return a11y.popupOpened(this);
    },

    a11y_cntrl(isOn, withDisabled) {
      a11y.log.deprecated('$("..").a11y_cntrl, use a11y.toggleAccessible($elements, isAccessible); and if needed a11y.toggleEnabled($elements, isEnabled); instead.');
      a11y.toggleAccessible(this, isOn);
      if (withDisabled) a11y.toggleEnabled(this, isOn);
      return this;
    },

    a11y_cntrl_enabled(isOn) {
      a11y.log.deprecated('$("..").a11y_cntrl_enabled, use a11y.toggleAccessibleEnabled($elements, isAccessibleEnabled); instead.');
      a11y.toggleAccessibleEnabled(this, isOn);
      return this;
    },

    isReadable() {
      a11y.log.deprecated('$("..").isReadable, use a11y.isReadable($element); instead.');
      return a11y.isReadable(this);
    },

    findForward(selector) {
      a11y.log.removed('$("..").findForward has been removed as the use cases are very small, let us know if you need it back.');
      return a11y._findFirstForward(this, selector);
    },

    findWalk(selector) {
      a11y.log.removed('$("..").findWalk has been removed as the use cases are very small, let us know if you need it back.');
      return a11y._findFindForwardDescendant(this, selector);
    },

    focusNoScroll() {
      a11y.log.deprecated('$("..").focusNoScroll, use a11y.focus($element); instead.');
      return a11y.focus(this);
    },

    focusNext(returnOnly) {
      a11y.log.deprecated('$("..").focusNext, use a11y.focusNext($element); or if needed a11y.findFirstReadable($element); instead.');
      if (returnOnly) {
        return a11y.findFirstReadable(this);
      }
      return a11y.focusNext(this);
    },

    focusOrNext(returnOnly) {
      a11y.log.deprecated('$("..").focusOrNext, use a11y.focusFirst($element); or if needed a11y.findFirstReadable($element); or a11y.isReadable($element); instead.');
      if (returnOnly) {
        if (a11y.isReadable(this)) return this;
        return a11y.findFirstReadable(this);
      }
      return a11y.focusFirst(this);
    },

    a11y_focus(dontDefer) {
      a11y.log.deprecated('$("..").a11y_focus, use a11y.focusFirst($element, { defer: true }); instead.');
      a11y.focusFirst(this, { defer: !dontDefer });
      return this;
    }

  });

  // Extend jQuery static object with deprecated static methods
  Object.assign($, {

    a11y_alert() {
      a11y.log.removed('$.a11y_alert is removed. Please use aria-live instead.');
      return this;
    },

    a11y_update() {
      a11y.log.removed('a11y_update is no longer required.');
      return this;
    },

    a11y_text(text) {
      a11y.log.removed('a11y_text is no longer required. https://tink.uk/understanding-screen-reader-interaction-modes/');
      return text;
    },

    a11y_on(isOn, selector) {
      a11y.log.deprecated('$("..").a11y_on, use a11y.toggleHidden($elements, isHidden); instead.');
      return a11y.toggleHidden(selector, !isOn);
    },

    a11y_popdown($focusTarget) {
      a11y.log.removed('$.a11y_popdown, use a11y.popupClosed($focusTarget); instead.');
      return a11y.popupClosed($focusTarget);
    },

    a11y_focus(dontDefer) {
      a11y.log.deprecated('$.a11y_focus, use a11y.focusFirst("body", { defer: true }); instead.');
      a11y.focusFirst('body', { defer: !dontDefer });
      return this;
    },

    a11y_normalize(html) {
      a11y.log.deprecated('$.a11y_normalize, use a11y.normalize("html"); instead.');
      return a11y.normalize(html);
    },

    a11y_remove_breaks(html) {
      a11y.log.deprecated('$.a11y_remove_breaks, use a11y.removeBreaks("html"); instead.');
      return a11y.removeBreaks(html);
    }

  });
}
