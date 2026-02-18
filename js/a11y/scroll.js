/**
 * @file Scroll - Controller for managing scrolling behavior
 * @module core/js/a11y/scroll
 * @description Manages scrolling behavior across multiple input methods including touch, mouse wheel,
 * and keyboard navigation. Supports selective scroll disabling on specified elements while allowing
 * scrolling in other regions. Handles various edge cases including multi-touch gestures,
 * nested scrollable elements, and accessible form inputs.
 */

/**
 * @class Scroll
 * @classdesc Manages scroll event blocking on specified elements for accessibility purposes.
 * @extends Backbone.Controller
 */
export default class Scroll extends Backbone.Controller {

  /**
   * Sets up event listeners for touch, wheel, and keyboard scroll events across the document
   * and window. Configures key codes for scroll-preventing keys (Page Up/Down, Home/End, Arrow keys)
   * and establishes exclusion selectors for form elements that should allow keyboard interaction.
   * @param {Object} options - Configuration options
   * @param {Object} options.a11y - The accessibility module instance
   * @returns {void}
   */
  initialize({ a11y }) {
    this._a11y = a11y;
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onScrollEvent = this._onScrollEvent.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._scrollDisabledElements = $([]);
    this.$window = $(window);
    this.$body = $('body');
    this._preventScrollOnKeys = {
      33: true, // page up
      34: true, // page down
      35: true, // end
      36: true, // home
      37: true, // left
      38: true, // up
      39: true, // right
      40: true // down
    };
    this._arrowKeys = {
      37: true, // left
      38: true, // up
      39: true, // right
      40: true // down
    };
    this._ignoreKeysOnElementsMatching = 'textarea, input[type=radio], select';
    this._isRunning = false;
    this._touchStartEventObject = null;
    window.addEventListener('touchstart', this._onTouchStart); // mobile
    window.addEventListener('touchend', this._onTouchEnd); // mobile
    window.addEventListener('touchmove', this._onScrollEvent, { passive: false }); // mobile
    window.addEventListener('wheel', this._onScrollEvent, { passive: false });
    document.addEventListener('wheel', this._onScrollEvent, { passive: false });
    document.addEventListener('keydown', this._onKeyDown);
  }

  /**
   * Block scrolling on the given elements.
   * Adds elements to the collection of scroll-disabled elements. Activates scroll event
   * listeners if this is the first disabled element.
   * @param {jQuery|string|Array|HTMLElement} $elements - Element(s) to disable scrolling on
   * @returns {Scroll} Returns this for method chaining.
   */
  disable($elements) {
    $elements = $($elements);
    this._scrollDisabledElements = this._scrollDisabledElements.add($elements);
    this._checkRunning();
    return this;
  }

  /**
   * Stop blocking scrolling on the given elements.
   * Removes elements from the collection of scroll-disabled elements. If no elements remain
   * disabled, deactivates scroll event listeners.
   * @param {jQuery|string|Array|HTMLElement} $elements - Element(s) to re-enable scrolling on
   * @returns {Scroll} Returns this for method chaining.
   */
  enable($elements) {
    $elements = $($elements);
    if (!$elements.length) {
      this.clear();
      return this;
    }
    this._scrollDisabledElements = this._scrollDisabledElements.not($elements);
    this._checkRunning();
    return this;
  }

  /**
   * Clears all scroll-disabled elements and deactivates scroll event listeners.
   * @returns {Scroll} Returns this for method chaining.
   */
  clear() {
    this._scrollDisabledElements = $([]);
    this._checkRunning();
    return this;
  }

  /**
   * Starts or stops listening for scroll events based on disabled element count.
   * Activates scroll event listeners if there are disabled elements, or deactivates them
   * if the disabled collection is empty.
   * @private
   * @returns {void}
   */
  _checkRunning() {
    if (!this._scrollDisabledElements.length) {
      this._stop();
      return;
    }
    this._start();
  }

  /**
   * Start listening for events to block.
   * @private
   * @returns {void}
   */
  _start() {
    if (this._isRunning) {
      return;
    }
    this._isRunning = true;
  }

  /**
   * Captures the touchstart event object for deltaY calculations.
   * Stores the initial touch position to later calculate the direction and distance
   * of touch movement for scroll prevention.
   * @private
   * @param {Event} event - The native touch start event
   * @returns {boolean} Returns true
   */
  _onTouchStart(event) {
    if (!this._isRunning) return;
    event = $.event.fix(event);
    this._touchStartEventObject = event;
    return true;
  }

  /**
   * Clears the touchstart event object.
   * Resets the stored touch start position after the touch ends.
   * @private
   * @returns {boolean} Returns true
   */
  _onTouchEnd() {
    if (!this._isRunning) return;
    this._touchStartEventObject = null;
    return true;
  }

  /**
   * Processes a native scroll event (wheel or touch movement).
   * Delegates to `_preventScroll` to determine if scrolling should be blocked.
   * @private
   * @param {Event} event - The native wheel or touch move event
   * @returns {*} Result from `_preventScroll` (false if blocked, undefined otherwise)
   */
  _onScrollEvent(event) {
    if (!this._isRunning) return;
    event = $.event.fix(event);
    return this._preventScroll(event);
  }

  /**
   * Processes a native keydown event to prevent scroll-related keyboard navigation.
   * Handles arrow keys (when accessible navigation is enabled) and scroll-trigger keys
   * (Page Up/Down, Home/End, arrow keys). Redirects focus to the first scrollable element
   * in an open popup when appropriate. Excludes form elements that should accept keyboard input.
   * @private
   * @param {Event} event - The native keydown event
   * @returns {*} Result from `_preventScroll` if key should be blocked, undefined otherwise
   */
  _onKeyDown(event) {
    if (!this._isRunning) return;
    event = $.event.fix(event);
    if (this._arrowKeys[event.which] && this._a11y.isArrowable(event.target)) {
      return;
    }
    if (!this._preventScrollOnKeys[event.which]) {
      return;
    }
    if (this._a11y.isPopupOpen && !this._isScrollable($(event.target))) {
      const $openPopup = this._a11y.popupStack[this._a11y.popupStack.length - 1];
      const $firstScrollable = this._isScrollable($openPopup)
        ? $openPopup
        : this._a11y._findFirstForwardDescendant($openPopup, this._isScrollable);
      if ($firstScrollable.length) {
        // Correct the keydown event to the first scrollable region in the popup
        event.target = $firstScrollable;
      }
    }
    const $target = $(event.target);
    if ($target.is(this._ignoreKeysOnElementsMatching)) {
      return;
    }
    return this._preventScroll(event);
  }

  /**
   * Prevents scroll on the target element if it's in the disabled collection.
   * Checks if the scroll target is within a disabled element. Handles multi-touch gestures
   * by allowing them through. For single-touch/wheel scrolls, prevents default behavior
   * and returns false if the scroll target is disabled.
   * @private
   * @param {Event} event - The scroll event (wheel, touch, or keyboard)
   * @returns {boolean|undefined} Returns false if scroll is prevented, undefined otherwise
   */
  _preventScroll(event) {
    const isGesture = (event.touches?.length > 1);
    if (isGesture) {
      // allow multiple finger gestures through
      // this will unfortunately allow two finger background scrolling on mobile devices
      // one finger background scrolling will still be disabled
      return;
    }
    const $target = $(event.target);
    if (this._scrollDisabledElements.length) {
      const scrollingParent = this._getScrollingParent(event, $target);
      if (scrollingParent.filter(this._scrollDisabledElements).length === 0) {
        this.$window.scroll();
        return;
      }
    }
    event.preventDefault();
    return false;
  }

  /**
   * Determines which parent element will handle the scroll event.
   * Considers scroll direction (up/down) and whether the parent has available scroll space.
   * Returns the body element if no scrollable parent is found.
   * @private
   * @param {Event} event - The scroll event
   * @param {jQuery} $target - The target element where scroll event originated
   * @returns {jQuery} The parent element that will handle the scroll
   */
  _getScrollingParent(event, $target) {
    const isTouchEvent = event.type === 'touchmove';
    const isKeyDownEvent = event.type === 'keydown';
    const hasTouchStartEvent = this._touchStartEventObject?.originalEvent;
    if ((isTouchEvent && !hasTouchStartEvent) && !isKeyDownEvent) {
      return $target;
    }
    const directionY = this._getScrollDirection(event);
    if (directionY === 'none') {
      return this.$body;
    }
    // Make sure to check the element on which the scroll event was triggered
    const parents = [$target[0], ...$target.parents()];
    for (let i = 0, l = parents.length; i < l; i++) {
      const $parent = $(parents[i]);
      if ($parent.is('body')) {
        return this.$body;
      }
      if (!this._isScrollable($parent)) {
        continue;
      }
      if (!this._isScrolling($parent, directionY)) {
        continue;
      }
      return $parent;
    }
    return this.$body;
  }

  /**
   * Checks if the specified element is scrollable.
   * An element is scrollable if it has `overflow-y` set to 'auto' or 'scroll' and
   * has `pointer-events` enabled (not 'none').
   * @private
   * @param {jQuery} $target - The element to check
   * @returns {boolean} True if element is scrollable, false otherwise
   */
  _isScrollable($target) {
    const scrollType = $target.css('overflow-y');
    if (scrollType !== 'auto' && scrollType !== 'scroll') {
      return false;
    }
    const pointerEvents = $target.css('pointer-events');
    if (pointerEvents === 'none') {
      return false;
    }
    return true;
  }

  /**
   * Checks if the specified element has available scroll space in the given direction.
   * Compares the current scroll position and viewport height against the total scroll height
   * to determine if there's room to scroll in the specified direction.
   * @private
   * @param {jQuery} $target - The element to check
   * @param {string} directionY - Scroll direction: 'none' | 'up' | 'down'
   * @returns {boolean} True if element can scroll in the given direction, false otherwise
   */
  _isScrolling($target, directionY) {
    const scrollTop = Math.ceil($target.scrollTop());
    const innerHeight = $target.outerHeight();
    const scrollHeight = $target[0].scrollHeight;
    let hasScrollingSpace = false;
    switch (directionY) {
      case 'down':
        hasScrollingSpace = scrollTop + innerHeight < scrollHeight;
        if (hasScrollingSpace) {
          return true;
        }
        break;
      case 'up':
        hasScrollingSpace = scrollTop > 0;
        if (hasScrollingSpace) {
          return true;
        }
        break;
    }
    return false;
  }

  /**
   * Determines the vertical direction of scroll from an event.
   * Calculates scroll direction based on the deltaY value. Positive values indicate
   * scrolling up, negative values indicate scrolling down.
   * @private
   * @param {Event} event - The scroll event
   * @returns {string} Scroll direction: 'none' | 'up' | 'down'
   */
  _getScrollDirection(event) {
    const deltaY = this._getScrollDelta(event);
    if (deltaY === 0) {
      return 'none';
    }
    return deltaY > 0 ? 'up' : 'down';
  }

  /**
   * Calculates the scroll delta (distance) from a scroll event.
   * Handles different input methods:
   * - Touch events: calculates delta from touchstart position to current touch position
   * - Keyboard events: returns 1 or -1 based on scroll-trigger key
   * - Mouse wheel: extracts delta from wheelDeltaY or deltaY properties
   * Accounts for cross-browser differences (Firefox/IE delta inversion, Chrome/Safari wheel delta).
   * @private
   * @param {Event} event - The scroll event
   * @returns {number} Pixel delta value (positive = up, negative = down)
   */
  _getScrollDelta(event) {
    let deltaY = 0;
    const isTouchEvent = event.type === 'touchmove';
    const isKeyDownEvent = event.type === 'keydown';
    const originalEvent = event.originalEvent;
    if (isTouchEvent) {
      // Touch events
      // iOS previous + current scroll pos
      const startOriginalEvent = this._touchStartEventObject.originalEvent;
      let currentY = originalEvent.pageY;
      let previousY = startOriginalEvent.pageY;
      if (currentY === 0 || currentY === previousY) {
        // Android chrome current scroll pos
        currentY = originalEvent.touches[0].pageY;
        previousY = startOriginalEvent.touches[0].pageY;
      }
      // Touch: delta calculated from touchstart pos vs touchmove pos
      deltaY = currentY - previousY;
    } else if (isKeyDownEvent) {
      deltaY = [33, 36, 38].includes(event.which)
        ? 1
        : [34, 35, 40].includes(event.which)
          ? -1
          : 0;
    } else {
      // Mouse events
      const hasDeltaY = (originalEvent.wheelDeltaY || originalEvent.deltaY !== undefined);
      if (hasDeltaY) {
        // Desktop: Firefox & IE delta inverted
        deltaY = -originalEvent.deltaY;
      } else {
        // Desktop: Chrome & Safari wheel delta
        deltaY = (originalEvent.wheelDelta || 0);
      }
    }
    return deltaY;
  }

  /**
   * Deactivates the scroll event listener.
   * Sets the running flag to false, disabling scroll event processing.
   * @private
   * @returns {void}
   */
  _stop() {
    if (!this._isRunning) {
      return;
    }
    this._isRunning = false;
  }

}
