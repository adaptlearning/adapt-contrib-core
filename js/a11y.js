/**
 * @file Accessibility Controller - Core accessibility system managing keyboard and screen reader support.
 * @module core/js/a11y
 * @description Singleton service managing the entire accessibility system. Provides API for
 * managing focus across keyboard and mouse interactions, `aria-hidden` attribute management for screen readers,
 * popup modal focus containment, aria level calculation for semantic heading hierarchy and
 * element state validation (tabbable, readable, focusable). Handles complex DOM traversal
 * and browser-specific quirks in focus behavior.
 *
 * **Architecture:**
 * - Singleton controller (exported as instance)
 * - Manages focus assignment and validation
 * - Controls aria-hidden and tabindex attributes
 * - Manages popup isolation and focus wrapping
 * - Provides DOM query methods for accessible elements
 * - Integrates with logging and deprecated API warnings
 *
 * **Events:**
 * - Listens to Adapt events for navigation and content changes to manage focus and visibility
 * - Triggers `accessibility:ready` when initialized and ready for use
 *
 * **Usage:**
 * ```js
 * import a11y from 'core/js/a11y';
 * if (a11y.isEnabled()) {
 * // Perform accessibility specific setup
 * }
 * a11y.focus('.my-element'); // Focus an element
 * a11y.toggleHidden('.contentobject', true); // Hide content from screen readers
 * a11y.popupOpened($dialog); // Manage focus for popup
 * a11y.popupClosed(); // Restore focus after popup closed
 * a11y.ariaLevel({ id: 'section-1', level: 'page', override: '@page+1' }); // Calculate aria-level
 * a11y.isTabbable($element); // Check if element is tabbable
 * a11y.isReadable($element); // Check if element is readable by screen readers
 * a11y.isFocusable($element); // Check if element can receive focus
 * a11y.gotoPreviousActiveElement(); // Return focus to previous element
 * a11y.setPopupCloseTo('.sidebar'); // Set focus target for popup close
 * a11y.isPopupOpen(); // Check if popup is currently open
 * a11y.popupStack; // Inspect current popup stack
 * a11y.log.warn('This is a warning message'); // Log a warning message
 * a11y.log.removed('This API is removed'); // Log a removed API warning
 * a11y.log.deprecated('This API is deprecated'); // Log a deprecated API warning
 * ```
 */

import Adapt from 'core/js/adapt';
import offlineStorage from 'core/js/offlineStorage';
import device from 'core/js/device';
import location from 'core/js/location';
import AriaDisabled from './a11y/ariaDisabled';
import BrowserConfig from './a11y/browserConfig';
import BrowserFocus from 'core/js/a11y/browserFocus';
import FocusOptions from 'core/js/a11y/focusOptions';
import KeyboardFocusOutline from 'core/js/a11y/keyboardFocusOutline';
import Log from 'core/js/a11y/log';
import Scroll from 'core/js/a11y/scroll';
import TopOfContentObject from './a11y/topOfContentObject';
import WrapFocus from 'core/js/a11y/wrapFocus';
import Popup from 'core/js/a11y/popup';
import defaultAriaLevels from 'core/js/enums/defaultAriaLevels';
import deprecated from 'core/js/a11y/deprecated';
import logging from 'core/js/logging';
import data from './data';

/**
 * @class A11y
 * @classdesc Manages all accessibility features including focus flow, keyboard navigation,
 * screen reader interaction, and popup isolation. Central service for validating and managing
 * interactive element accessibility throughout the course.
 * @extends {Backbone.Controller}
 * @fires accessibility:ready When accessibility system is initialized and ready
 */
class A11y extends Backbone.Controller {

  defaults() {
    return {
      _isPrefersReducedMotionEnabled: true,
      _isFocusOutlineKeyboardOnlyEnabled: true,
      /**
       * `_isFocusOutlineDisabled` ignores `_isEnabled` and can be used when all other
       * accessibility features have been disabled.
       */
      _isFocusOutlineDisabled: false,
      _isFocusAssignmentEnabled: true,
      _isFocusOnClickEnabled: true,
      _isClickDelayedAfterFocusEnabled: false,
      _isFocusNextOnDisabled: true,
      _isScrollDisableEnabled: true,
      _isAriaHiddenManagementEnabled: true,
      _isPopupManagementEnabled: true,
      _isPopupWrapFocusEnabled: true,
      _isPopupAriaHiddenManagementEnabled: true,
      _isPopupTabIndexManagementEnabled: true,
      /**
       * Do not change `aria-hidden` on these elements.
       */
      _ariaHiddenExcludes: ':not(#wrapper):not(body)',
      _tabbableElements: 'a,button,input,select,textarea,[tabindex]:not([data-a11y-force-focus])',
      _focusOutlineKeyboardOnlyIgnore: 'input,textarea',
      /**
       * Designate these elements as not tabbable.
       */
      _tabbableElementsExcludes: ':not(.a11y-ignore):not([data-a11y-force-focus])',
      _focusableElements: 'a,button,input,select,textarea,[tabindex],label',
      _readableElements: '[role=heading],[aria-label],[aria-labelledby],[alt]',
      /**
       * Prevent adapt from focusing forward onto these elements.
       */
      _focusForwardElementsExcludes: ':not([aria-labelledby][role=dialog],[aria-labelledby][role=main],[aria-labelledby][role=region],[aria-labelledby][role=radiogroup],[aria-labelledby][role=group],[aria-labelledby][role=tablist],[aria-labelledby][role=list],[aria-labelledby][role=tree],[aria-labelledby][role=treegrid],[aria-labelledby][role=table],[aria-labelledby][role=grid][aria-labelledby],[role=menu],[aria-labelledby][role=rowgroup])',
      /**
       * Selector for elements which cause tab wrapping.
       */
      _focusguard: '.a11y-focusguard',
      /**
       * Specifies all stylistic elements.
       */
      _wrapStyleElements: 'b,i,abbr,strong,em,small,sub,sup,ins,del,mark,zw,nb',
      /**
       * Specified elements are navigated by the keyboard arrows.
       */
      _arrowElements: 'input[type=radio]',
      /**
       * Logging settings
       */
      _warnFirstOnly: true,
      _warn: true
    };
  }

  initialize() {
    this.isFocusable = this.isFocusable.bind(this);
    this.isReadable = this.isReadable.bind(this);
    this.isTabbable = this.isTabbable.bind(this);
    this.$html = $('html');
    this._htmlCharRegex = /&.*;/g;
    /** @type {Object} */
    this.config = null;
    this._ariaDisabled = new AriaDisabled({ a11y: this });
    this._browserConfig = new BrowserConfig({ a11y: this });
    this._browserFocus = new BrowserFocus({ a11y: this });
    this._keyboardFocusOutline = new KeyboardFocusOutline({ a11y: this });
    this._wrapFocus = new WrapFocus({ a11y: this });
    this._popup = new Popup({ a11y: this });
    this._scroll = new Scroll({ a11y: this });
    this._topOfContentObject = new TopOfContentObject({ a11y: this });
    this._isForcedFocus = false;
    this.log = new Log({ a11y: this });
    deprecated(this);
    this._removeLegacyElements();
    this.listenToOnce(Adapt, {
      'configModel:dataLoaded': this._onConfigDataLoaded,
      'navigationView:postRender': this._removeLegacyElements
    }, this);
    Adapt.on('device:changed', this._setupNoSelect);
    this.listenTo(Adapt, {
      'router:location': this._onNavigationStart,
      'contentObjectView:ready router:plugin': this._onNavigationEnd
    });
    this._lastFocusTime = 0;
    this._activeElements = [];
    $(document.body).on('focusin', () => {
      this._activeElements.unshift(document.activeElement);
      this._activeElements = this._activeElements.filter(this.isReadable);
      this._activeElements.length = 10;
      this._lastFocusTime = Date.now();
    });
  }

  /**
   * Handles config data loaded event from Adapt framework.
   * Internal event handler called when accessibility configuration is ready.
   * Initializes accessibility features based on config, triggers 'accessibility:ready' event.
   * Sets up the focuser div and applies configuration classes.
   * @private
   * @fires A11y#accessibility:ready
   */
  _onConfigDataLoaded() {
    this.config = Adapt.config.get('_accessibility');
    this.config._isActive = false;
    this.config._options = _.defaults(this.config._options || {}, this.defaults());
    offlineStorage.set('a11y', false);
    this.$html.toggleClass('has-accessibility', this.isEnabled());
    this._setupNoSelect();
    this._addFocuserDiv();
    if (this._isReady) {
      return;
    }
    this._isReady = true;
    Adapt.trigger('accessibility:ready');
  }

  /**
   * Disables text selection on elements with configured classes.
   * Internal utility method called to apply u-no-select class when configured.
   * Prevents accidental text selection during keyboard navigation.
   * @private
   */
  _setupNoSelect() {
    if (!this.config?._disableTextSelectOnClasses) {
      return;
    }
    const classes = this.config._disableTextSelectOnClasses.split(' ');
    const isMatch = classes.some(className => this.$html.is(className));
    this.$html.toggleClass('u-no-select', isMatch);
  }

  /**
   * Creates or reuses the a11y-focuser div for keyboard focus management.
   * Internal utility that creates a hidden div with id="a11y-focuser" used by focus()
   * method for initiating focus events and managing focus state. Only created once.
   * @private
   */
  _addFocuserDiv() {
    if ($('#a11y-focuser').length) {
      return;
    }
    $('body').append($('<div id="a11y-focuser" class="a11y-ignore" tabindex="-1">&nbsp;</div>'));
  }

  /**
   * Cleanup method that removes deprecated #accessibility-toggle and #accessibility-instructions
   * elements from DOM and warns developers to update .html files.
   * @private
   */
  _removeLegacyElements() {
    const $legacyElements = $('body').children('#accessibility-toggle, #accessibility-instructions');
    const $navigationElements = $('.nav').find('#accessibility-toggle, #accessibility-instructions');
    if (!$legacyElements.length && !$navigationElements.length) {
      return;
    }
    logging.warn('REMOVED: #accessibility-toggle and #accessibility-instructions have been removed. Please remove them from all of your .html files.');
    $legacyElements.remove();
    $navigationElements.remove();
  }

  /**
   * Internal event handler fired when navigation starts (location change).
   * Triggered by 'router:location' Adapt event. Hides content objects from screen readers
   * during page transitions to prevent reading stale content. Should not announce updates
   * until _onNavigationEnd fires after new content is ready.
   * @private
   * @listens Adapt#router:location
   */
  _onNavigationStart() {
    if (!this.isEnabled()) {
      return;
    }
    // Stop document reading
    _.defer(() => this.toggleHidden('.contentobject', true));
  }

  /**
   * Internal event handler fired when navigation content is fully ready.
   * Triggered by 'contentObjectView:ready' and 'router:plugin' Adapt events.
   * Re-enables content visibility to screen readers once new content is rendered.
   * Validates that this is the correct navigation by comparing model ID with location.
   * @private
   * @param {Backbone.View} [view] - The content view that just became ready
   * @listens Adapt#contentObjectView:ready
   * @listens Adapt#router:plugin
   */
  _onNavigationEnd(view) {
    // Prevent sub-menu items provoking behaviour
    if ((view?.model?.get('_id') !== location._currentId) || !this.isEnabled()) {
      return;
    }
    // Allow document to be read
    this.toggleHidden('.contentobject', false);
  }

  /**
   * Deprecated method retained for backward compatibility.
   * Accessibility is now always active when enabled. This method only logs a removal
   * warning and returns false. Use {@link A11y#isEnabled isEnabled()} to check accessibility status.
   * @deprecated Use {@link A11y#isEnabled isEnabled()} instead
   * @returns {boolean} Always false
   */
  isActive() {
    this.log.removed('Accessibility is now always active when enabled. Please unify your user experiences.');
    return false;
  }

  /**
   * Checks if accessibility features are enabled in the course configuration.
   * @returns {boolean} True if accessibility is enabled via config._accessibility._isEnabled,
   *                    false otherwise
   */
  isEnabled() {
    return this.config?._isEnabled;
  }

  /**
   * Gets the time in milliseconds since the last focus event occurred.
   * Used to determine if focus was just changed (very recent) or if significant time
   * has passed since last focus interaction. Useful for distinguishing user initiated
   * focus from programmatic focus assignment.
   * @type {number}
   * @readonly
   * @returns {number} Milliseconds since Date.now() when last focus event fired
   */
  get timeSinceLastFocus() {
    return Date.now() - this._lastFocusTime;
  }

  /**
   * Gets the element that currently has focus.
   * Returns the first element in the active element stack, which tracks all elements
   * that have received focus through focusin events. Independent of
   * {@link A11y#isForcedFocus isForcedFocus} - includes both user and programmatic focus.
   * @type {Element}
   * @readonly
   * @returns {Element|undefined} Currently focused element, or undefined if no focus history
   * @see {@link A11y#previousActiveElement previousActiveElement}
   */
  get currentActiveElement() {
    return this._activeElements[0];
  }

  /**
   * Gets the element that had focus before the current element.
   * Returns the second element in the active element stack. Critical for
   * {@link A11y#gotoPreviousActiveElement gotoPreviousActiveElement()} to restore
   * focus after dismissing popups and modals. Maintains focus history for returns.
   * @type {Element}
   * @readonly
   * @returns {Element|undefined} Previously focused element, or undefined if insufficient history
   * @see {@link A11y#currentActiveElement currentActiveElement}
   * @see {@link A11y#gotoPreviousActiveElement gotoPreviousActiveElement()}
   */
  get previousActiveElement() {
    return this._activeElements[1];
  }

  /**
   * Calculates the appropriate aria-level for a heading based on content hierarchy.
   * Computes semantic heading levels using configuration from config.json or relative increments
   * from ancestor models. Supports absolute values (1-9), type names ("page", "component"),
   * and relative increments ("@page+1"). Respects _ariaLevel overrides on models and only increments
   * level when the ancestor has a displayTitle.
   * @param {Object} [options={}] - Aria level calculation options
   * @param {string|number} [options.id] - Used to automate the heading level when relative increments are used
   * @param {string|number} [options.level='1'] - Default level: type name ("page", "component"),
   *                                               absolute value (1-9), or relative increment ("@page+1")
   * @param {string|number} [options.override=null] - Override level, takes precedence over default
   * @returns {number} Computed aria-level (typically 1-6 for standard headings)
   * @example
   * // Relative increment from ancestor page level
   * const level = a11y.ariaLevel({
   *   id: 'article-1',
   *   level: 'page',
   *   override: '@page+1'
   * });
   * @example
   * // Absolute heading level
   * const level = a11y.ariaLevel({ override: '2' });
   * @example
   * // Backward compatible positional arguments (legacy)
   * const level = a11y.ariaLevel('page', '@page+1');
   */
  ariaLevel({
    id = null,
    level = '1',
    override = null
  } = {}) {
    if (level === 'course') level = 'menu';
    if (arguments.length === 2) {
      // backward compatibility
      level = arguments[0];
      override = arguments[1];
      id = null;
    }
    // get the global configuration from config.json
    const ariaLevels = Adapt.config.get('_accessibility')?._ariaLevels ?? defaultAriaLevels;
    // Fix for authoring tool schema _ariaLevel = 0 default
    if (override === 0) override = null;
    /**
     * Recursive function to calculate aria-level
     * @param {string} id Model id
     * @param {string} level Default name, relative increment or absolute level
     * @param {number} [offset=0] Total offset count from first absolute value
     * @returns
     */
    function calculateLevel(id = null, level, offset = 0) {
      const isNumber = !isNaN(level);
      const isTypeName = /[a-zA-z]/.test(level);
      if (!isTypeName && isNumber) {
        // if an absolute value is found, use it, adding the accumulated offset
        return parseInt(level) + offset;
      }
      // parse the level value as a relative string
      const relativeDescriptor = Adapt.parseRelativeString(level);
      // lookup the default value from `config.json:_accessibility._ariaLevels`
      const nextLevel = ariaLevels?.['_' + relativeDescriptor.type];
      const hasModelId = Boolean(id);
      if (!hasModelId) {
        logging.warnOnce('Cannot calculate appropriate heading level, no model id was specified');
        return calculateLevel(id, nextLevel, offset + relativeDescriptor.offset);
      }
      // try to find the next relevant ancestor, or use the specified model
      const nextModel = data.findById(id)?.findAncestor(relativeDescriptor.type?.toLowerCase()) ?? data.findById(id);
      const nextModelId = nextModel?.get('_id') ?? id;
      // check overrides, check title existence, adjust offset accordingly
      let nextModelOverride = nextModel.get('_ariaLevel');
      const hasNextTitle = Boolean(nextModel.get('displayTitle')) || Boolean(nextModelOverride);
      // Fix for authoring tool schema _ariaLevel = 0 default
      if (nextModelOverride === 0) nextModelOverride = null;
      const accumulatedOffset = offset + (hasNextTitle ? relativeDescriptor.offset : 0);
      const resolvedLevel = nextModelOverride ?? nextLevel;
      // move towards the parents until an absolute value is found
      return calculateLevel(nextModelId, resolvedLevel, accumulatedOffset);
    }
    return calculateLevel(id, override ?? level);
  }

  /**
   * Sets or removes the `aria-hidden` attribute on elements.
   * Manages screen reader visibility by adding or removing the `aria-hidden="true"` attribute.
   * When enabled in config, controls whether elements are announced to assistive technology.
   * Only applies changes if accessibility is enabled and aria-hidden management is configured.
   * @param {jQuery|string|HTMLElement|Array} $elements - Elements to toggle
   * @param {boolean} [isHidden=true] - If true, sets aria-hidden; if false, removes it
   * @returns {A11y} Chainable
   */
  toggleHidden($elements, isHidden = true) {
    $elements = $($elements);
    const config = this.config;
    if (!config._isEnabled || !config._options._isAriaHiddenManagementEnabled) {
      return this;
    }
    if (isHidden === true) {
      $elements.attr('aria-hidden', true);
    } else {
      $elements.removeAttr('aria-hidden');
    }
    return this;
  }

  /**
   * Toggles both accessible and enabled states on elements.
   * Convenience method that calls both {@link A11y#toggleAccessible toggleAccessible()} and
   * {@link A11y#toggleEnabled toggleEnabled()} to set `aria-hidden` and `disabled` attributes together.
   * Useful for hiding disabled interactive elements from both keyboard and screen reader users.
   * @param {jQuery|string|HTMLElement|Array} $elements - Elements to toggle
   * @param {boolean} [isAccessibleEnabled=true] - If true, enables access and interaction;
   *                                               if false, disables both
   * @returns {A11y} Chainable
   * @see {@link A11y#toggleAccessible toggleAccessible()}
   * @see {@link A11y#toggleEnabled toggleEnabled()}
   */
  toggleAccessibleEnabled($elements, isAccessibleEnabled) {
    this.toggleAccessible($elements, isAccessibleEnabled);
    this.toggleEnabled($elements, isAccessibleEnabled);
    return this;
  }

  /**
   * Toggles screen reader visibility by managing `aria-hidden` and `tabindex` attributes.
   * Controls whether elements are visible to assistive technology and keyboard navigation.
   * When hidden, sets `tabindex="-1"` and `aria-hidden="true"`, removing from both navigation
   * and screen reader announcement. Also removes `aria-hidden` from parent elements configured
   * in `_ariaHiddenExcludes` when re-enabling.
   * @param {jQuery|string|HTMLElement|Array} $elements - Elements to toggle
   * @param {boolean} [isReadable=true] - If true, makes element accessible to screen readers
   *                                      and keyboard; if false, hides from both
   * @returns {A11y} Chainable
   */
  toggleAccessible($elements, isReadable = true) {
    $elements = $($elements);
    const config = this.config;
    if (!config._isEnabled || !config._options._isAriaHiddenManagementEnabled || $elements.length === 0) {
      return this;
    }
    if (!isReadable) {
      $elements.attr({
        tabindex: '-1',
        'aria-hidden': 'true'
      }).addClass('aria-hidden');
    } else {
      $elements.removeAttr('aria-hidden tabindex').removeClass('aria-hidden');
      $elements.parents(config._options._ariaHiddenExcludes).removeAttr('aria-hidden').removeClass('aria-hidden');
    }
    return this;
  }

  /**
   * Toggles the disabled state on elements using `aria-disabled` attribute and `is-disabled` class.
   * Manages the visual and programmatic disabled state of interactive elements. Sets
   * `aria-disabled="true"` and applies the `is-disabled` CSS class when disabled.
   * This approach allows styling disabled elements while preserving focusability for
   * keyboard and screen reader users (who get "disabled" announcements via aria-disabled).
   * @param {jQuery|string|HTMLElement|Array} $elements - Elements to toggle
   * @param {boolean} [isEnabled=true] - If true, enables interaction;
   *                                     if false, marks as disabled
   * @returns {A11y} Chainable
   */
  toggleEnabled($elements, isEnabled = true) {
    $elements = $($elements);
    if ($elements.length === 0) {
      return this;
    }
    if (!isEnabled) {
      $elements.attr({
        'aria-disabled': 'true'
      }).addClass('is-disabled');
    } else {
      $elements.removeAttr('aria-disabled').removeClass('is-disabled');
    }
    return this;
  }

  /**
   * Toggles keyboard tab focus on all tabbable descendant elements.
   * Manages `tabindex` attributes on all descendants with tab capability. When hiding,
   * stores the original `tabindex` value and sets to -1, marking elements with
   * `isAdaptTabHidden` flag to avoid multiple hiding. When showing, restores original
   * tabindex values. Useful for managing focus scope in modals or collapsed regions.
   * @param {jQuery|string|HTMLElement|Array} $element - Parent element containing tabbable descendants
   * @param {boolean} [isTabbable=true] - If true, restores keyboard focus; if false, removes from tab order
   * @returns {A11y} Chainable
   */
  toggleTabbableDescendants($element, isTabbable = true) {
    const $tabbable = this.findTabbable($element);
    if (!isTabbable) {
      $tabbable.each((index, element) => {
        if (element.isAdaptTabHidden) return;
        const $element = $(element);
        element.isAdaptTabHidden = true;
        element.adaptPreviousTabIndex = $element.attr('tabindex') ?? null;
        $element.attr('tabindex', -1);
      });
      return this;
    }
    $tabbable.each((index, element) => {
      if (!element.isAdaptTabHidden) return;
      const $element = $(element);
      if (element.adaptPreviousTabIndex === null) $element.removeAttr('tabindex');
      else $element.attr('tabindex', element.adaptPreviousTabIndex);
      delete element.isAdaptTabHidden;
      delete element.adaptPreviousTabIndex;
    });
    return this;
  }

  /**
   * Find the first tabbable element after the specified element.
   * Searches forward from the specified element and its descendants using depth-first
   * tree traversal to locate the first element that passes the `isTabbable()` check.
   * Returns a jQuery object (empty if no tabbable element found). Used by {@link A11y#focusNext focusNext()}
   * to navigate to the next keyboard-accessible element.
   * @param {jQuery|string|HTMLElement|Array} $element - Starting element to search from
   * @returns {jQuery} jQuery object containing the first tabbable element, or empty jQuery if not found
   * @see {@link A11y#isTabbable isTabbable()}  for definition of keyboard tabbable
   */
  findFirstTabbable($element) {
    $element = $($element).first();
    return this._findFirstForward($element, this.isTabbable);
  }

  /**
   * Finds the first readable element after the specified element.
   * Searches forward from the specified element using depth-first traversal to find
   * the first element where `isReadable()` returns true. A readable element is not hidden
   * from screen readers (`aria-hidden` attribute absent/false). Used for screen reader
   * navigation when keyboard tabbability isn't required.
   * @param {jQuery|string|HTMLElement|Array} $element - Starting element to search from
   * @returns {jQuery} jQuery object containing the first readable element, or empty jQuery if not found
   * @see {@link A11y#isReadable isReadable()}  for screen reader visibility rules
   */
  findFirstReadable($element) {
    $element = $($element).first();
    return this._findFirstForward($element, this.isReadable);
  }

  /**
   * Finds the first element that is both keyboard tabbable and screen-reader accessible.
   * Searches forward using tree traversal for the first element where `isFocusable()`
   * returns true (must pass both `isTabbable()` and `isReadable()` checks). Most restrictive
   * of the first* find methods. Primary method used by {@link A11y#focusFirst focusFirst()} for focus management.
   * @param {jQuery|string|HTMLElement|Array} $element - Starting element to search from
   * @returns {jQuery} jQuery object containing the first focusable element, or empty jQuery if not found
   * @see {@link A11y#isFocusable isFocusable()}  for complete focusability criteria
   */
  findFirstFocusable($element) {
    $element = $($element).first();
    return this._findFirstForward($element, this.isFocusable);
  }

  /**
   * Find all tabbable elements within the specified element.
   * Returns all descendants that are keyboard navigable (pass `isTabbable()` check).
   * Uses selector based filtering rather than tree traversal for efficiency when you need
   * all tabbable elements. Common use in {@link A11y#toggleTabbableDescendants toggleTabbableDescendants()}
   * to manage focus trap scope in modals.
   * @param {jQuery|string|HTMLElement|Array} $element - Container element to search within
   * @returns {jQuery} jQuery collection of all tabbable descendants
   */
  findTabbable($element) {
    const config = this.config;
    return $($element).find(config._options._tabbableElements).filter(config._options._tabbableElementsExcludes);
  }

  /**
   * Finds all readable elements within the specified element.
   * Returns all descendants that are visible to assistive technology (not hidden via
   * `aria-hidden="true"`). Uses full DOM traversal with `isReadable()` filter. More comprehensive
   * than findTabbable but includes non-interactive content. Useful for screen reader
   * content analysis and accessibility auditing.
   * @param {jQuery|string|HTMLElement|Array} $element - Container element to search within
   * @returns {jQuery} jQuery collection of all readable descendants
   */
  findReadable($element) {
    return $($element).find('*').filter((index, element) => this.isReadable(element));
  }

  /**
   * Finds all focusable elements within the specified element.
   * Returns descendants where both `isTabbable()` and `isReadable()` are true. Most restrictive
   * collection method. Useful for analyzing interactive and accessible elements in a region.
   * @param {jQuery|string|HTMLElement|Array} $element - Container element to search within
   * @returns {jQuery} jQuery collection of all focusable descendants
   */
  findFocusable($element) {
    return $($element).find('*').filter((index, element) => this.isFocusable(element));
  }

  /**
   * Checks if the element is natively or explicitly tabbable.
   * Tests whether an element matches the configured `_tabbableElements` selector
   * and doesn't match the `_tabbableElementsExcludes` selector. Used by tree traversal
   * methods to determine keyboard navigation order.
   * @param {jQuery|string|HTMLElement|Array} $element - Element to test
   * @returns {boolean|null} Returns true if tabbable, false if explicitly excluded,
   *                         or null ("keep descending") if not directly tabbable but may have tabbable children
   * @see {@link A11y#_findFirstForward _findFirstForward()} for tree traversal behavior
   */
  isTabbable($element) {
    const config = this.config;
    const value = $($element).is(config._options._tabbableElements).is(config._options._tabbableElementsExcludes);
    if (!value) {
      return null; // Allow _findForward to descend
    }
    return value;
  }

  /**
   * Checks if the element is visible and readable by screen reader software.
   * Comprehensive visibility check examining display, visibility, aria-hidden properties,
   * and content presence. Returns true if element is in DOM, has screen readable content
   * (text nodes, `aria-label`, `aria-labelledby`, or input with value), and is not hidden.
   * Returns null ("continue descending") if element has no readable content itself but might
   * have readable children (for tree traversal algorithms). Special handling for popups:
   * returns null if outside open popup (signals to skip but continue searching).
   * @param {jQuery|string|HTMLElement|Array} $element - Element to test
   * @param {boolean} [checkParents=true] - If true, also checks parent chain for hidden/removed states;
   *                                        if false, only checks the element itself
   * @returns {boolean|null} Returns true if screen reader accessible, false if hidden,
   *                         or null to allow tree traversal to descend and continue searching
   * @see {@link A11y#_findFirstForward _findFirstForward()} for tree traversal behavior
   */
  isReadable($element, checkParents = true) {
    const config = this.config;
    $element = $($element).first();

    const isInDOM = Boolean($element.parents('body').length);
    if (!isInDOM) return false;

    const isOutsideOpenPopup = this.isPopupOpen && !this.popupStack?.lastItem[0]?.contains($element[0]);
    if (isOutsideOpenPopup) return null;

    const $branch = checkParents
      ? $element.add($element.parents())
      : $element;

    const isNotVisible = $branch.toArray().some(item => {
      const style = window.getComputedStyle(item);
      // make sure item is not explicitly invisible
      return style.display === 'none' ||
        style.visibility === 'hidden' ||
        item.getAttribute('aria-hidden') === 'true';
    });
    if (isNotVisible) {
      return false;
    }

    // check that the component is natively tabbable or
    // will be knowingly read by a screen reader
    const hasReadableContent = (!/^\s*$/.test($element.text()) ||
      !/^\s*$/.test($element.attr('aria-label') ?? '') ||
      !/^\s*$/.test($element.attr('aria-labelledby') ?? ''));
    const hasNativeFocusOrIsScreenReadable = ($element.is(config._options._focusableElements) ||
      $element.is(config._options._readableElements)) && hasReadableContent;
    if (hasNativeFocusOrIsScreenReadable) {
      return true;
    }
    const childNodes = $element[0].childNodes;
    for (let c = 0, cl = childNodes.length; c < cl; c++) {
      const childNode = childNodes[c];
      const isTextNode = (childNode.nodeType === 3);
      if (!isTextNode) {
        continue;
      }
      const isOnlyWhiteSpace = /^\s*$/.test(childNode.nodeValue);
      if (isOnlyWhiteSpace) {
        continue;
      }
      return true;
    }
    return null; // Allows _findForward to decend.
  }

  /**
   * Checks if the element is both keyboard tabbable and screen reader accessible.
   * Combines `isTabbable()` (keyboard focus capability) with `isReadable()` (screen reader visibility)
   * checks. First validates that element doesn't match `_focusForwardElementsExcludes` (returns null if excluded,
   * allowing tree traversal to skip this item but continue with siblings), then checks readability.
   * Used by {@link A11y#focusFirst focusFirst()} and related focus methods as the definitive
   * test for whether an element should receive programmatic or user focus.
   * @param {jQuery|string|HTMLElement|Array} $element - Element to test
   * @param {boolean} [checkParents=true] - If true, checks parent chain visibility;
   *                                        if false, only checks element itself
   * @returns {boolean|null} Returns true if fully focusable, false if not readable,
   *                         or null if excluded from focus traversal (allows descending)
   * @see {@link A11y#isTabbable isTabbable()}
   * @see {@link A11y#isReadable isReadable()}
   * @see {@link A11y#_findFirstForward _findFirstForward()} for tree traversal usage
   */
  isFocusable($element, checkParents = true) {
    const config = this.config;
    $element = $($element).first();
    if (!$element.is(config._options._focusForwardElementsExcludes)) return null;
    return this.isReadable($element, checkParents);
  }

  /**
   * Checks if the first element uses arrow keys for keyboard interactions.
   * Tests whether element matches the `_arrowElements` selector, typically used for composite
   * widgets like toolbars, menus, and tabs that respond to arrow key navigation. Used to
   * suppress tab navigation and enable arrow key handling.
   * @param {jQuery|string|HTMLElement|Array} $element - Element to test
   * @returns {boolean} True if element supports arrow key navigation, false otherwise
   */
  isArrowable($element) {
    const config = this.config;
    $element = $($element).first();
    return $element.is(config._options._arrowElements);
  }

  /**
   * Core algorithm used by all find methods for depth-first DOM traversal.
   * Searches forward from an element through descendants, then siblings, then ancestor siblings, recursively
   * checking each branch. Supports function based iteration with special return value semantics:
   * - true: Found match, return immediately
   * - false: Skip this branch, don't descend into children
   * - undefined/null: No match at this node, but descend into children for further searching
   *
   * The iterator function can be:
   * - A string CSS selector (converted to equality test via jQuery.is())
   * - A function taking jQuery element and returning true/false/undefined
   * - Undefined (matches first element found)
   * @private
   * @param {jQuery|HTMLElement} $element - Starting element for forward search
   * @param {string|Function|undefined} selector - Selector logic: string selector, iterator function,
   *                                               or undefined for "find any element"
   * @returns {jQuery} jQuery object containing matched element, or empty jQuery if not found
   * @see {@link A11y#_findFirstForwardDescendant _findFirstForwardDescendant()} for descendant traversal
   * @see {@link A11y#findFirstFocusable findFirstFocusable()}, {@link A11y#findFirstReadable findFirstReadable()}\n   * for public APIs using this algorithm
   */
  _findFirstForward($element, selector) {
    $element = $($element).first();

    // make sure iterator is correct, use boolean or selector comparison
    // appropriately
    let iterator;
    switch (typeof selector) {
      case 'string':
        // make selector iterator
        iterator = function($tag) {
          return $tag.is(selector) || undefined;
        };
        break;
      case 'function':
        iterator = selector;
        break;
      case 'undefined':
        // find first next element
        iterator = Boolean;
    }

    if ($element.length === 0) {
      return $element.not('*');
    }

    // check children by walking the tree
    let $found = this._findFirstForwardDescendant($element, iterator);
    if ($found.length) {
      return $found;
    }

    // check subsequent siblings
    $element.nextAll().toArray().some(sibling => {
      const $sibling = $(sibling);
      const value = iterator($sibling);

      // skip this sibling if explicitly instructed
      if (value === false) {
        return false;
      }

      if (value) {
        // sibling matched
        $found = $sibling;
        return true;
      }

      // check parent sibling children by walking the tree
      $found = this._findFirstForwardDescendant($sibling, iterator);
      return Boolean($found.length);
    });
    if ($found.length) {
      return $found;
    }

    // move through parents towards the body element
    $element.add($element.parents()).toArray().reverse().some(parent => {
      const $parent = $(parent);
      if (iterator($parent) === false) {
        // skip this parent if explicitly instructed
        return false;
      }

      // move through parents nextAll siblings
      return $parent.nextAll().toArray().some(sibling => {
        const $sibling = $(sibling);
        const value = iterator($sibling);

        // skip this sibling if explicitly instructed
        if (value === false) {
          return false;
        }

        if (value) {
          // sibling matched
          $found = $sibling;
          return true;
        }

        // check parent sibling children by walking the tree
        $found = this._findFirstForwardDescendant($sibling, iterator);
        return Boolean($found.length);
      });
    });

    if (!$found.length) {
      return $element.not('*');
    }
    return $found;
  }

  /**
   * Descendant-only tree traversal for finding matched elements.
   * Worker method called by {@link A11y#_findFirstForward _findFirstForward()} to search
   * within an element's entire subtree (current element, then all children/descendants).
   * Uses depth-first traversal with an explicit stack to avoid excessive recursion.
   * Children are injected at the correct position in the stack to maintain depth-first
   * order, checking parents before their children's siblings.
   * Iterator function return values:
   * - true: Element matches, return it immediately
   * - false: Element explicitly excluded, skip it and its descendants
   * - undefined: Element doesn't match, but descend into its children
   * @private
   * @param {jQuery|HTMLElement} $element - Root element to search within
   * @param {string|Function|undefined} selector - Selector logic (same semantics as _findFirstForward)
   * @returns {jQuery} jQuery object containing matched element, or empty jQuery if not found
   * @see {@link A11y#_findFirstForward _findFirstForward()} for the main traversal algorithm
   */
  _findFirstForwardDescendant($element, selector) {
    $element = $($element).first();

    // make sure iterator is correct, use boolean or selector comparison
    // appropriately
    let iterator;
    switch (typeof selector) {
      case 'string':
        // make selector iterator
        iterator = function($tag) {
          return $tag.is(selector) || undefined;
        };
        break;
      case 'function':
        iterator = selector;
        break;
      case 'undefined':
        // find first next element
        iterator = Boolean;
    }

    const $notFound = $element.not('*');
    if ($element.length === 0) {
      return $notFound;
    }

    // keep walked+passed children in a stack
    const stack = [{
      item: $element[0],
      value: undefined
    }];
    let stackIndexPosition = 0;
    let childIndexPosition = stackIndexPosition + 1;
    do {

      const stackEntry = stack[stackIndexPosition];
      const $stackItem = $(stackEntry.item);

      // check current item
      switch (stackEntry.value) {
        case true:
          return $stackItem;
        case false:
          return $notFound;
      }

      // get i stack children
      $stackItem.children().toArray().forEach(item => {
        const $item = $(item);
        const value = iterator($item);

        // item explicitly not allowed, don't add to stack,
        // skip children
        if (value === false) {
          return;
        }

        // item passed or readable, add to stack before any parent
        // siblings
        stack.splice(childIndexPosition++, 0, {
          item,
          value
        });
      });

      // move to next stack item
      stackIndexPosition++;
      // keep place to inject children
      childIndexPosition = stackIndexPosition + 1;
    } while (stackIndexPosition < stack.length);

    return $notFound;
  }

  /**
   * Assigns focus to the next focusable element after the specified element.
   * Searches forward from the supplied element for the first focusable descendant or
   * sibling, then assigns focus to it. Useful for implementing custom focus navigation
   * after interactive element changes. Respects FocusOptions for deferred focus and
   * scroll prevention (important for Safari, Edge, IE11 where preventScroll isn't fully supported).
   * @param {jQuery|string|HTMLElement|Array} $element - Starting element for forward search
   * @param {FocusOptions|Object} [options] - Focus assignment options
   * @param {boolean} [options.defer=false] - Defer focus assignment to next event loop
   * @param {boolean} [options.preventScroll=false] - Prevent automatic scroll to focused element
   * @returns {A11y} Chainable
   */
  focusNext($element, options) {
    options = new FocusOptions(options);
    $element = $($element).first();
    $element = this.findFirstFocusable($element);
    this.focus($element, options);
    return this;
  }

  /**
   * Assigns focus to the specified element or the next readable element.
   * Checks if the supplied element is readable; if so, focuses it directly. Otherwise,
   * finds and focuses the first readable element within. Special case: when element is
   * document.body, forces focus to the top of content for keyboard navigation restart.
   * Critical for menu and page navigation to work correctly with keyboard and
   * screen reader users.
   * @param {jQuery|string|HTMLElement|Array} $element - Element to focus or search within
   * @param {FocusOptions|Object} [options] - Focus assignment options
   * @param {boolean} [options.defer=false] - Defer focus assignment to next event loop
   * @param {boolean} [options.preventScroll=false] - Prevent automatic scroll to focused element
   * @returns {jQuery|A11y} Element that received focus, or chainable if deferred
   */
  focusFirst($element, options) {
    options = new FocusOptions(options);
    $element = $($element).first();
    const isBodyFocus = ($element[0] === document.body);
    if (isBodyFocus) {
      // force focus to the body, effectively starting the tab cursor from the top
      this.focus(document.body, options);
      return;
    }
    if (this.isReadable($element)) {
      this.focus($element, options);
      return $element;
    }
    $element = this.findFirstFocusable($element);
    this.focus($element, options);
    return $element;
  }

  /**
   * Force focus to the specified element with optional defer and scroll control.
   * Directly sets focus on an element, bypassing normal focus capture events by setting
   * the `_isForcedFocus` flag. This allows distinguishing between user triggered focus
   * (keyboard/click) and programmatic focus. Sets `tabindex="0"` and `data-a11y-force-focus="true"`
   * attributes on the element. Handles cross-browser `preventScroll` behavior (Safari, Edge, IE11
   * require manual scroll position restoration). When element is document.body, focuses the
   * top-of-content object instead for proper screen reader announcements.
   * @param {jQuery|string|HTMLElement|Array} $element - Element to receive focus
   * @param {FocusOptions|Object} [options] - Focus control options
   * @param {boolean} [options.defer=false] - If true, uses _.defer() to delay focus assignment
   *                                          to next event loop iteration
   * @param {boolean} [options.preventScroll=false] - Prevent viewport scroll to focused element
   *                                                  (shim for Safari, Edge, IE11 limitations)
   * @returns {A11y} Chainable
   */
  focus($element, options) {
    options = new FocusOptions(options);
    $element = $($element).first();
    const config = this.config;
    if (!config._isEnabled || !config._options._isFocusAssignmentEnabled || $element.length === 0) {
      return this;
    }
    const isBodyFocus = ($element[0] === document.body);
    if (isBodyFocus) {
      this._topOfContentObject.goto();
      return;
    }
    const perform = () => {
      if ($element.attr('tabindex') === undefined) {
        $element.attr({
          // JAWS reads better with 0, do not use -1
          tabindex: '0',
          'data-a11y-force-focus': 'true'
        });
      }
      if (options.preventScroll) {
        const y = $(window).scrollTop();
        try {
          this._isForcedFocus = true;
          $element[0].focus({
            preventScroll: true
          });
          this._isForcedFocus = false;
        } catch (e) {
          // Drop focus errors as only happens when the element
          // isn't attached to the DOM.
        }
        switch (device.browser) {
          case 'internet explorer':
          case 'microsoft edge':
          case 'safari':
            // return to previous scroll position due to no support for preventScroll
            window.scrollTo(null, y);
        }
      } else {
        this._isForcedFocus = true;
        $element[0].focus();
        this._isForcedFocus = false;
      }
    };
    if (options.defer) {
      _.defer(perform);
    } else {
      perform();
    }
    return this;
  }

  /**
   * Restores focus to the previously active element before the current focus change.
   * Useful for returning focus after dismissing modals, notifications, or popups.
   * Maintains a stack of active elements to support nested interactions. Falls back to
   * focusing the navigation menu if no previous active element exists.
   * @returns {void}
   */
  gotoPreviousActiveElement() {
    if (!this.previousActiveElement) return a11y.focusFirst(Adapt.navigation);
    a11y.focusFirst(this.previousActiveElement);
  }

  /**
   * Returns true if focus was assigned by a11y and not user-interaction
   */
  get isForcedFocus() {
    return this._isForcedFocus;
  }

  /**
   * Converts HTML to plain text suitable for aria-labels and screen reader announcements.
   * Strips all HTML tags and converts HTML entities (like &apos;, &quot;) to their textual
   * equivalents. Uses a temporary DOM element to parse HTML, then removes encoded characters
   * using regex. Accepts multiple arguments (like sprintf) which are filtered and joined with spaces.
   * Essential for converting rich content HTML into accessible text announcements.
   * @param {...string} htmls - One or more HTML strings to normalize
   * @returns {string} Plain text without markup or encoded HTML entities
   */
  normalize(htmls) {
    htmls = [...arguments].filter(Boolean).filter(_.isString).join(' ');
    const text = $('<div>' + htmls + '</div>').text();
    // Remove all html encoded characters, such as &apos;
    return text.replace(this._htmlCharRegex, '');
  }

  /**
   * Removes block-level and semantic HTML tags while preserving inline stylistic elements.
   * Filters out tags that would cause screen readers to pause (like div, p, br, h1-h6),
   * but preserves semantic styling (b, strong, em, i, span, etc. as configured in `_wrapStyleElements`).
   * Critical for converting structured content into uninterrupted screen reader announcements.
   * Uses recursive DOM traversal to collect text nodes and style-safe elements, then reconstructs
   * as continuous HTML. Accepts multiple arguments which are joined before processing.
   * @param {...string} htmls - One or more HTML strings to process
   * @returns {string} HTML string with pause-causing tags removed, preserving semantic formatting
   */
  removeBreaks(htmls) {
    htmls = [...arguments].filter(Boolean).filter(_.isString).join(' ');
    const $div = $('<div>' + htmls + '</div>');
    const stack = [ $div[0] ];
    let stackIndex = 0;
    const outputs = [];
    do {
      if (stack[stackIndex].childNodes.length) {
        const nodes = stack[stackIndex].childNodes;
        const usable = nodes.filter(node => {
          const isTextNode = (node.nodeType === 3);
          if (isTextNode) {
            return true;
          }
          const isStyleElement = $(node).is(this.config._options._wrapStyleElements);
          if (isStyleElement) {
            return true;
          }
          return false;
        });
        outputs.push.apply(outputs, usable);
        stack.push.apply(stack, nodes);
      }
      stackIndex++;
    } while (stackIndex < stack.length);
    let rtnText = '';
    outputs.forEach(function(item) {
      rtnText += item.outerHTML || item.textContent;
    });
    return rtnText;
  }

  /**
   * Enables scroll event handling on the specified elements.
   * Delegates to the internal {@link Scroll} controller to allow normal scroll
   * behavior on previously scroll-blocked elements. Re-enables touch, wheel, and keyboard
   * scroll events. Used when exiting modals or popups that should trap scroll.
   * @param {jQuery|string|HTMLElement|Array} $elements - Elements to enable scrolling on
   * @returns {A11y} Chainable
   * @see {@link A11y#scrollDisable scrollDisable()}
   * @see {@link Scroll} controller for detailed scroll management
   */
  scrollEnable($elements) {
    this._scroll.enable($elements);
    return this;
  }

  /**
   * Disables scroll event handling on the specified elements.
   * Delegates to the internal {@link Scroll} controller to prevent scrolling via touch,
   * mouse wheel, or keyboard (spacebar, page down, arrow keys) on specified elements.
   * Essential for implementing modal and popup scroll traps to prevent inadvertent scrolling
   * of background content while a modal is open.
   * @param {jQuery|string|HTMLElement|Array} $elements - Elements to disable scrolling on
   * @returns {A11y} Chainable
   * @see {@link A11y#scrollEnable scrollEnable()}
   * @see {@link Scroll} controller for detailed scroll blocking mechanism
   */
  scrollDisable($elements) {
    this._scroll.disable($elements);
    return this;
  }

  /**
   * Applies accessibility isolation to a popup element and manages focus trapping.
   * Delegates to the internal {@link Popup} controller to apply accessibility handling
   * to a popup/modal: sets aria-hidden on background, manages focus trap, disables background
   * scrolling, manages return focus on close targets. Should be called immediately when popup
   * becomes visible to users.
   * @param {jQuery|HTMLElement|string} $popupElement - Root element of the popup to isolate
   * @returns {A11y} Chainable
   * @see {@link A11y#popupClosed popupClosed()}
   * @see {@link A11y#setPopupCloseTo setPopupCloseTo()}
   * @see {@link Popup} controller for detailed popup accessibility management
   */
  popupOpened($popupElement) {
    this._popup.opened($popupElement);
    return this;
  }

  /**
   * Removes accessibility isolation from a popup and restores focus to background.
   * Delegates to the internal {@link Popup} controller to reverse the effects of
   * {@link A11y#popupOpened popupOpened()}: removes `aria-hidden` from background,
   * ends focus trap, re-enables background scrolling, optionally refocuses a specific element
   * (or the element configured via {@link A11y#setPopupCloseTo setPopupCloseTo()}).
   * Should be called when popup is hidden from users.
   * @param {jQuery|HTMLElement|string} [$focusElement] - Optional element to focus after closing;
   *                                                      if omitted, uses element set via setPopupCloseTo()
   * @returns {A11y} Chainable
   * @see {@link A11y#popupOpened popupOpened()}
   * @see {@link A11y#setPopupCloseTo setPopupCloseTo()}
   * @see {@link Popup} controller for detailed popup accessibility management
   */
  popupClosed($focusElement) {
    this._popup.closed($focusElement);
    return this;
  }

  /**
   * Sets the element that should receive focus when the current popup closes.
   * Stores focus-return target while popup is open, useful when the element that
   * triggered the popup has been removed or relocated. Delegates to the internal
   * {@link Popup} controller. If not called, focus returns to whatever element
   * was active before {@link A11y#popupOpened popupOpened()} was called.
   * @param {jQuery|HTMLElement|string} $focusElement - Element to receive focus on close
   * @returns {jQuery|null} Previously set focus element, or null if none was set
   * @see {@link A11y#popupOpened popupOpened()}
   * @see {@link A11y#popupClosed popupClosed()}
   */
  setPopupCloseTo($focusElement) {
    return this._popup.setCloseTo($focusElement);
  }

  /**
   * Checks if a popup is currently open and has isolation applied.
   * Queries the internal {@link Popup} controller to determine if any popup is actively
   * managing focus trap, aria-hidden, and scroll restrictions. Used to validate whether
   * elements should be included in focus traversal or hidden from screen readers.
   * @type {boolean}
   * @readonly
   * @returns {boolean} True if popup isolation is active, false otherwise
   * @see {@link A11y#popupOpened popupOpened()}
   * @see {@link A11y#popupClosed popupClosed()}
   */
  get isPopupOpen() {
    return this._popup.isOpen;
  }

  /**
   * Gets the internal popup stack tracking all nested popups.
   * Returns reference to the {@link Popup} controller's internal stack data structure
   * that tracks the hierarchy of nested/stacked popups. Used for inspecting current
   * popup state and determining focus containment boundaries.
   * @type {Stack|undefined}
   * @readonly
   * @returns {Stack|undefined} Stack data structure with lastItem property tracking topmost popup,
   *                           or undefined if no popups are open
   * @see {@link A11y#isPopupOpen isPopupOpen()}
   */
  get popupStack() {
    return this._popup.stack;
  }

}

const a11y = new A11y();
export default a11y;
