/**
 * @file Popup - Popup accessibility manager
 * @module core/js/a11y/popup
 * @description Manages focus containment, tabindex and aria-hidden attributes for
 * modal popups. Supports native dialog elements and custom popup implementations,
 * preserving and restoring accessibility attributes when popups are opened and closed.
 *
 * **Features:**
 * - Stack-based management for multiple nested popups
 * - Automatic focus restoration to previously active element
 * - Supports native HTML dialog elements with showModal()
 * - Provides unique identifiers for DOM elements to track attribute state
 * - Backward compatibility with legacy 'popup:opened' and 'popup:closed' events
 */

import Adapt from 'core/js/adapt';
import logging from '../logging';
import wait from 'core/js/wait';

/**
 * @class Popup
 * @classdesc Manages accessibility for modal popups, including focus containment and attribute management.
 * @extends Backbone.Controller
 */
export default class Popup extends Backbone.Controller {

  /**
   * Initializes the Popup controller with accessibility configuration.
   * Sets up the stack-based system for managing popups, including focus tracking,
   * tabindex management, and aria-hidden state preservation.
   * Listens to legacy 'popup:opened' and 'popup:closed' events for backward compatibility,
   * logging deprecation warnings when used.
   * @param {Object} options - Configuration options
   * @param {Object} options.a11y - The accessibility module instance
   *
   * @returns {void}
   */
  initialize({ a11y }) {
    this.a11y = a11y;
    /**
     * List of elements which form the base at which elements are generally tabbable
     * and aria-hidden='false'.
     * @type {Array<Object>}
     */
    this._floorStack = [$('body')];
    /**
     * List of elements to return the focus to once leaving each stack.
     * @type {Array<Object>}
     */
    this._focusStack = [];
    /**
     * Hash of tabindex states for each tabbable element in the popup stack.
     * @type {Object}
     */
    this._tabIndexes = {};
    /**
     * Hash of aria-hidden states for each tabbable element in the popup stack.
     * @type {Object}
     */
    this._ariaHiddens = {};
    /**
     * Incremented unique ids for elements belonging to a popup stack with saved
     * states.
     * @type {number}
     */
    this._elementUIDIndex = 0;
    this.listenTo(Adapt, {
      'popup:opened'($element, ignoreInternalTrigger) {
        if (ignoreInternalTrigger) {
          return;
        }
        this.a11y.log.deprecated('Adapt.trigger("popup:opened", $element) is replaced with a11y.popupOpened($element);');
        this.opened($element, true);
      },
      'popup:closed'($target, ignoreInternalTrigger) {
        if (ignoreInternalTrigger) {
          return;
        }
        this.a11y.log.deprecated('Adapt.trigger("popup:closed", $target) is replaced with a11y.popupClosed($target);');
        this.closed($target, true);
      }
    });
  }

  get isOpen() {
    return (this._floorStack.length > 1);
  }

  get stack() {
    return this._floorStack.slice(1);
  }

  /**
   * Opens a popup and reorganizes tabindex and aria-hidden attributes to
   * restrict user interaction to the specified element.
   * Adds the popup to the stack, saves the currently active element for later focus
   * restoration, and triggers a global 'popup:opened' event (unless silent mode is enabled).
   * @param {jQuery|HTMLElement} [$popupElement] - Element encapsulating the popup.
   *                                               Defaults to the currently active element.
   * @param {boolean} [silent=false] - If true, suppresses the 'popup:opened' event trigger.
   * @returns {Popup} Returns this for method chaining.
   */
  opened($popupElement, silent) {
    $popupElement = $popupElement || $(document.activeElement);
    this._addPopupLayer($popupElement);
    if (!silent) {
      Adapt.trigger('popup:opened', $popupElement, true);
    }
    return this;
  }

  /**
   * Restricts tabbing and screen reader access to the specified popup element.
   * Adds a new layer to the popup stack and saves the current focus. For HTML dialog
   * elements, directly uses the native showModal() API. For other elements, manages
   * tabindex and aria-hidden attributes on sibling and ancestor elements to isolate
   * the popup from the rest of the document.
   * Stores original attribute values using unique element IDs for restoration when
   * the popup is closed.
   * @private
   * @param {jQuery|HTMLElement} $popupElement - Element encapsulating the popup.
   * @returns {jQuery} Returns the popup element as a jQuery object.
   */
  _addPopupLayer($popupElement) {
    $popupElement = $($popupElement);
    this._floorStack.push($popupElement);
    this._focusStack.push($(document.activeElement));
    if ($popupElement.is('dialog')) {
      $popupElement[0].addEventListener('cancel', event => event.preventDefault());
      $popupElement[0].showModal();
      return;
    }
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled || $popupElement.length === 0) {
      return $popupElement;
    }
    logging.deprecated('a11y/popup opened: Use native dialog tag for', $popupElement);
    let $elements = $(config._options._tabbableElements).filter(config._options._tabbableElementsExcludes);
    const $branch = $popupElement.add($popupElement.parents());
    const $siblings = $branch.siblings().filter(config._options._tabbableElementsExcludes);
    $elements = $elements.add($siblings);
    $elements.each((index, item) => {
      const $item = $(item);
      if (typeof item.a11y_uid === 'undefined') {
        item.a11y_uid = 'UID' + ++this._elementUIDIndex;
      }
      const elementUID = item.a11y_uid;
      if (this._tabIndexes[elementUID] === undefined) {
        this._tabIndexes[elementUID] = [];
      }
      if (this._ariaHiddens[elementUID] === undefined) {
        this._ariaHiddens[elementUID] = [];
      }
      const tabindex = $item.attr('tabindex');
      const ariaHidden = $item.attr('aria-hidden');
      this._tabIndexes[elementUID].push(tabindex === undefined ? '' : tabindex);
      this._ariaHiddens[elementUID].push(ariaHidden === undefined ? '' : ariaHidden);
      if (config._options._isPopupTabIndexManagementEnabled) {
        $item.attr('tabindex', -1);
      }
      if (config._options._isPopupAriaHiddenManagementEnabled) {
        $item.attr('aria-hidden', true);
      }
    });
    const $items = $popupElement.find(config._options._tabbableElements).filter(config._options._tabbableElementsExcludes);
    if (config._options._isPopupTabIndexManagementEnabled) {
      $items.attr('tabindex', 0);
    }
    if (config._options._isPopupAriaHiddenManagementEnabled) {
      $items
        .removeAttr('aria-hidden')
        .removeClass('aria-hidden')
        .parents(config._options._ariaHiddenExcludes)
        .removeAttr('aria-hidden')
        .removeClass('aria-hidden');
    }
  }

  /**
   * Closes the last popup on the stack and restores tabindex and aria-hidden attributes
   * to the specified element or the previously active element.
   * Triggers 'popup:closing' and 'popup:closed' events (unless silent mode is enabled).
   * @async
   * @param {jQuery|HTMLElement} [$forceFocusElement] - Element to receive focus after popup closes.
   *                                                    Defaults to the previously focused element.
   * @param {boolean} [silent=false] - If true, suppresses the 'popup:closing' and 'popup:closed' event triggers.
   * @returns {Promise<Popup>} Returns a promise that resolves to this for method chaining.
   */
  async closed($forceFocusElement, silent) {
    if (!silent) {
      Adapt.trigger('popup:closing');
      await wait.queue();
    }
    const $previousFocusElement = this._removeLastPopupLayer();
    const $focusElement = $forceFocusElement || $previousFocusElement || $('body');
    if (!silent) {
      Adapt.trigger('popup:closed', $focusElement, true);
    }
    this.a11y.focusFirst($($focusElement), { preventScroll: true });
    return this;
  }

  /**
   * Restores tabbing and screen reader access to the state before the last
   * `_addPopupLayer` call.
   * Removes the topmost popup from the stack and restores the original tabindex and
   * aria-hidden attribute values for all affected elements. For native dialog elements,
   * closes them using the dialog.close() API.
   * @private
   * @returns {jQuery|undefined} Returns the previously active element as a jQuery object,
   *                            or undefined if no popup was open.
   */
  _removeLastPopupLayer() {
    // the body layer is the first element and must always exist
    if (this._floorStack.length <= 1) {
      return;
    }
    const $popupElement = this._floorStack.pop();
    if ($popupElement.is('dialog')) {
      $popupElement[0].close();
      return this._focusStack.pop();
    }
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) {
      return $(document.activeElement);
    }
    $(config._options._tabbableElements).filter(config._options._tabbableElementsExcludes).each((index, item) => {
      const $item = $(item);
      let previousTabIndex = '';
      let previousAriaHidden = '';
      if (typeof item.a11y_uid === 'undefined') {
        // assign element a unique id
        item.a11y_uid = 'UID' + ++this._elementUIDIndex;
      }
      const elementUID = item.a11y_uid;
      if (this._tabIndexes[elementUID]?.length) {
        // get previous tabindex if saved
        previousTabIndex = this._tabIndexes[elementUID].pop();
        previousAriaHidden = this._ariaHiddens[elementUID].pop();
      }
      if (this._tabIndexes[elementUID]?.length) {
        // delete element tabindex store if empty
        delete this._tabIndexes[elementUID];
        delete this._ariaHiddens[elementUID];
      }
      if (config._options._isPopupTabIndexManagementEnabled) {
        if (previousTabIndex === '') {
          $item.removeAttr('tabindex');
        } else {
          $item.attr({
            tabindex: previousTabIndex
          });
        }
      }
      if (config._options._isPopupAriaHiddenManagementEnabled) {
        if (previousAriaHidden === '') {
          $item.removeAttr('aria-hidden');
        } else {
          $item.attr({
            'aria-hidden': previousAriaHidden
          });
        }
      }
    });
    return this._focusStack.pop();
  }

  /**
   * Changes which element should receive focus when the current popup is closed.
   * @param {jQuery|HTMLElement} $focusElement - Element that should receive focus when closing.
   * @returns {jQuery|undefined} Returns the previously set focus element,
   *                            or undefined if no popup was open.
   */
  setCloseTo($focusElement) {
    const $original = this._focusStack.pop();
    this._focusStack.push($focusElement);
    return $original;
  }

}
