/**
 * @file Keyboard Focus Outline - Input method-aware focus outline management
 * @module core/js/a11y/keyboardFocusOutline
 * @description Controls focus outline visibility based on user input method.
 * Hides focus outlines for mouse users while preserving them for keyboard navigation,
 * improving visual aesthetics without sacrificing accessibility.
 *
 * **Behavior Modes:**
 * - **Keyboard-only outlines**: Hidden by default, shown when navigation keys pressed
 * - **Disabled outlines**: Focus outlines completely removed (not recommended)
 * - **Default**: Focus outlines always visible
 *
 * **Trigger Keys:** Tab, Enter, Space, Arrow keys
 *
 * @example
 * import KeyboardFocusOutline from 'core/js/a11y/keyboardFocusOutline';
 * const focusOutline = new KeyboardFocusOutline({ a11y });
 */
import Adapt from 'core/js/adapt';

/**
 * @class KeyboardFocusOutline
 * @classdesc Toggles focus outline visibility based on keyboard vs mouse input.
 * @extends Backbone.Controller
 */
export default class KeyboardFocusOutline extends Backbone.Controller {

  /**
   * Initializes the keyboard focus outline controller.
   * Binds event handler, caches HTML element, and defines trigger key map.
   * @param {Object} options - Configuration options
   * @param {Object} options.a11y - Reference to the parent A11y module instance
   */
  initialize({ a11y }) {
    this.a11y = a11y;
    this._onKeyDown = this._onKeyDown.bind(this);
    this.$html = $('html');
    this.showOnKeys = {
      9: true, // tab
      13: true, // enter
      32: true, // space
      37: true, // arrow left
      38: true, // arrow up
      39: true, // arrow right
      40: true // arrow down
    };
    this.listenTo(Adapt, {
      'accessibility:ready': this._attachEventListeners
    });
  }

  /**
   * Attaches keydown listener and applies initial styling.
   * @private
   */
  _attachEventListeners() {
    document.addEventListener('keydown', this._onKeyDown);
    this._start();
  }

  /**
   * Applies initial focus outline styling based on configuration.
   * Adds `a11y-disable-focusoutline` class if outlines should be hidden.
   * @private
   */
  _start() {
    const config = this.a11y.config;
    if (config._options._isFocusOutlineDisabled) {
      this.$html.addClass('a11y-disable-focusoutline');
      return;
    }
    if (!config._isEnabled || !config._options._isFocusOutlineKeyboardOnlyEnabled) {
      return;
    }
    this.$html.addClass('a11y-disable-focusoutline');
  }

  /**
   * Handles keydown events to show focus outline on keyboard navigation.
   * Removes `a11y-disable-focusoutline` class when a trigger key is pressed
   * on a tabbable element that isn't in the ignore list.
   * @param {KeyboardEvent} event - The keydown event
   * @private
   */
  _onKeyDown(event) {
    const config = this.a11y.config;
    if (config._options._isFocusOutlineDisabled) {
      this.$html.addClass('a11y-disable-focusoutline');
      return;
    }
    if (!config._isEnabled || !config._options._isFocusOutlineKeyboardOnlyEnabled || !this.showOnKeys[event.keyCode]) {
      return;
    }
    const $element = $(event.target);
    if (!$element.is(config._options._tabbableElements) || $element.is(config._options._focusOutlineKeyboardOnlyIgnore)) {
      return;
    }
    this.$html.removeClass('a11y-disable-focusoutline');
  }

}
