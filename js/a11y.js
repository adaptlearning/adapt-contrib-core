import Adapt from 'core/js/adapt';
import offlineStorage from 'core/js/offlineStorage';
import device from 'core/js/device';
import location from 'core/js/location';
import BrowserFocus from 'core/js/a11y/browserFocus';
import FocusOptions from 'core/js/a11y/focusOptions';
import KeyboardFocusOutline from 'core/js/a11y/keyboardFocusOutline';
import Log from 'core/js/a11y/log';
import Scroll from 'core/js/a11y/scroll';
import WrapFocus from 'core/js/a11y/wrapFocus';
import Popup from 'core/js/a11y/popup';
import defaultAriaLevels from 'core/js/enums/defaultAriaLevels';
import deprecated from 'core/js/a11y/deprecated';
import logging from 'core/js/logging';
import data from './data';

class A11y extends Backbone.Controller {

  defaults() {
    return {
      _isFocusOutlineKeyboardOnlyEnabled: true,
      /**
       * `_isFocusOutlineDisabled` ignores `_isEnabled` and can be used when all other
       * accessibility features have been disabled.
       */
      _isFocusOutlineDisabled: false,
      _isFocusAssignmentEnabled: true,
      _isFocusOnClickEnabled: true,
      _isFocusNextOnDisabled: true,
      _isScrollDisableEnabled: true,
      _isAriaHiddenManagementEnabled: true,
      _isPopupManagementEnabled: true,
      _isPopupWrapFocusEnabled: true,
      _isPopupAriaHiddenManagementEnabled: true,
      _isPopupTabIndexManagementEnabled: true,
      /**
       * Do not change aria-hidden on these elements.
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
    this._browserFocus = new BrowserFocus({ a11y: this });
    this._keyboardFocusOutline = new KeyboardFocusOutline({ a11y: this });
    this._wrapFocus = new WrapFocus({ a11y: this });
    this._popup = new Popup({ a11y: this });
    this._scroll = new Scroll({ a11y: this });
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
  }

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

  _setupNoSelect() {
    if (!this.config?._disableTextSelectOnClasses) {
      return;
    }
    const classes = this.config._disableTextSelectOnClasses.split(' ');
    const isMatch = classes.some(className => this.$html.is(className));
    this.$html.toggleClass('u-no-select', isMatch);
  }

  _addFocuserDiv() {
    if ($('#a11y-focuser').length) {
      return;
    }
    $('body').append($('<div id="a11y-focuser" class="a11y-ignore" tabindex="-1">&nbsp;</div>'));
  }

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

  _onNavigationStart() {
    if (!this.isEnabled()) {
      return;
    }
    // Stop document reading
    _.defer(() => this.toggleHidden('.contentobject', true));
  }

  _onNavigationEnd(view) {
    // Prevent sub-menu items provoking behaviour
    if ((view?.model?.get('_id') !== location._currentId) || !this.isEnabled()) {
      return;
    }
    // Allow document to be read
    this.toggleHidden('.contentobject', false);
  }

  isActive() {
    this.log.removed('Accessibility is now always active when enabled. Please unify your user experiences.');
    return false;
  }

  isEnabled() {
    return this.config?._isEnabled;
  }

  /**
   * Calculate the aria level for a heading
   * @param {object} [options]
   * @param {string|number} [options.id] Used to automate the heading level when relative increments are used
   * @param {string|number} [options.level] Specify a default level, "component" / "menu" / "componentItem" etc
   * @param {string|number} [options.override] Override with a default level, an absolute value or a relative increment
   * @returns {number}
   * @notes
   * Default levels come from config.json:_accessibility._ariaLevels attribute names, they are:
   *  "menu", "menuGroup", "menuItem", "page", "article", "block", "component", "componentItem" and "notify"
   * An absolute value would be "1" or "2" etc.
   * A relative increment would be "@page+1" or "@block+1". They are calculated from ancestor values,
   * respecting both _ariaLevel overrides and not incrementing for missing displayTitle values.
   */
  ariaLevel({
    id = null,
    level = '1',
    override = null
  } = {}) {
    if (arguments.length === 2) {
      // backward compatibility
      level = arguments[0];
      override = arguments[1];
      id = null;
    }
    // get the global configuration from config.json
    const ariaLevels = Adapt.config.get('_accessibility')?._ariaLevels ?? defaultAriaLevels;
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
      const hasNextTitle = Boolean(nextModel.get('displayTitle'));
      const nextModelOverride = nextModel.get('_ariaLevel');
      const accumulatedOffset = offset + (hasNextTitle ? relativeDescriptor.offset : 0);
      const resolvedLevel = nextModelOverride ?? nextLevel;
      // move towards the parents until an absolute value is found
      return calculateLevel(nextModelId, resolvedLevel, accumulatedOffset);
    }
    return calculateLevel(id, override ?? level);
  }

  /**
   * Adds or removes `aria-hidden` attribute to elements.
   *
   * @param {Object|string|Array} $elements
   * @param {boolean} [isHidden=true]
   * @returns {Object} Chainable
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
   * Adds or removes `aria-hidden` and `disabled` attributes and `disabled`
   * classes to elements.
   *
   * @param {Object|string|Array} $elements
   * @param {boolean} [isHidden=true]
   * @returns {Object} Chainable
   */
  toggleAccessibleEnabled($elements, isAccessibleEnabled) {
    this.toggleAccessible($elements, isAccessibleEnabled);
    this.toggleEnabled($elements, isAccessibleEnabled);
    return this;
  }

  /**
   * Adds or removes `aria-hidden` attribute and disables `tabindex` on elements.
   *
   * @param {Object|string|Array} $elements
   * @param {boolean} [isReadable=true]
   * @returns {Object} Chainable
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
   * Adds or removes `disabled` attribute and `disabled` class.
   *
   * @param {Object|string|Array} $elements
   * @param {boolean} [isEnabled=true]
   * @returns {Object} Chainable
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
   * Toggles tabindexes off and on all tabbable descendants.
   * @param {Object|string|Array} $element
   * @param {boolean} isTabbable
   * @returns {Object} Chainable
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
   *
   * @param {Object|string|Array} $element
   * @returns {Object}
   */
  findFirstTabbable($element) {
    $element = $($element).first();
    return this._findFirstForward($element, this.isTabbable);
  }

  /**
   * Find the first readable element after the specified element.
   *
   * @param {Object|string|Array} $element
   * @returns {Object}
   */
  findFirstReadable($element) {
    $element = $($element).first();
    return this._findFirstForward($element, this.isReadable);
  }

  /**
   * Find the first focusable element after the specified element.
   *
   * @param {Object|string|Array} $element
   * @returns {Object}
   */
  findFirstFocusable($element) {
    $element = $($element).first();
    return this._findFirstForward($element, this.isFocusable);
  }

  /**
   * Find all tabbable elements in the specified element.
   *
   * @param {Object|string|Array} $element
   * @returns {Object}
   */
  findTabbable($element) {
    const config = this.config;
    return $($element).find(config._options._tabbableElements).filter(config._options._tabbableElementsExcludes);
  }

  /**
   * Find all readable elements in the specified element.
   *
   * @param {Object|string|Array} $element
   */
  findReadable($element) {
    return $($element).find('*').filter((index, element) => this.isReadable(element));
  }

  /**
   * Find all focusable elements in the specified element.
   *
   * @param {Object|string|Array} $element
   */
  findFocusable($element) {
    return $($element).find('*').filter((index, element) => this.isFocusable(element));
  }

  /**
   * Check if the element is natively or explicitly tabbable.
   *
   * @param {Object|string|Array} $element
   * @returns {boolean|undefined}
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
   * Check if the first item is readable by a screen reader.
   *
   * @param {Object|string|Array} $element
   * @param {boolean} [checkParents=true] Check if parents are inaccessible.
   * @returns {boolean}
   */
  isReadable($element, checkParents = true) {
    const config = this.config;
    $element = $($element).first();

    const $branch = checkParents
      ? $element.add($element.parents())
      : $element;

    const isNotVisible = $branch.toArray().some(item => {
      const $item = $(item);
      // make sure item is not explicitly invisible
      return $item.css('display') === 'none' ||
        $item.css('visibility') === 'hidden' ||
        $item.attr('aria-hidden') === 'true';
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
   * Check if the first item is readable by a screen reader.
   *
   * @param {Object|string|Array} $element
   * @param {boolean} [checkParents=true] Check if parents are inaccessible.
   * @returns {boolean}
   */
  isFocusable($element, checkParents = true) {
    const config = this.config;
    $element = $($element).first();
    if (!$element.is(config._options._focusForwardElementsExcludes)) return null;
    return this.isReadable($element, checkParents);
  }

  /**
   * Find forward in the DOM, descending and ascending to move forward
   * as appropriate.
   *
   * If the selector is a function it should returns true, false or undefined.
   * Returning true matches the item and returns it. Returning false means do
   * not match or descend into this item, returning undefined means do not match,
   * but descend into this item.
   *
   * @param {Object|string|Array} $element
   * @param {string|function|undefined} selector
   * @returns {Object} Returns found descendant.
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
   * Find descendant in a DOM tree, work from selected to branch-end, through allowed
   * branch structures in hierarchy order
   *
   * If the selector is a function it should returns true, false or undefined.
   * Returning true matches the item and returns it. Returning false means do
   * not match or descend into this item, returning undefined means do not match,
   * but descend into this item.
   *
   * @param {Object|string|Array} $element jQuery element to start from.
   * @param {string|function|undefined} selector
   * @returns {Object} Returns found descendant.
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
   * Assign focus to the next readable element.
   *
   * @param {Object|string|Array} $element
   * @param {FocusOptions} options
   * @returns {Object} Chainable
   */
  focusNext($element, options) {
    options = new FocusOptions(options);
    $element = $($element).first();
    $element = this.findFirstFocusable($element);
    this.focus($element, options);
    return this;
  }

  /**
   * Assign focus to either the specified element if it is readable or the
   * next readable element.
   *
   * @param {Object|string|Array} $element
   * @param {FocusOptions} options
   * @returns {Object}
   */
  focusFirst($element, options) {
    options = new FocusOptions(options);
    $element = $($element).first();
    if (this.isReadable($element)) {
      this.focus($element, options);
      return $element;
    }
    $element = this.findFirstFocusable($element);
    this.focus($element, options);
    return $element;
  }

  /**
   * Force focus to the specified element with/without a defer or scroll.
   *
   * @param {Object|string|Array} $element
   * @param {FocusOptions} options
   * @returns {Object} Chainable
   */
  focus($element, options) {
    options = new FocusOptions(options);
    $element = $($element).first();
    const config = this.config;
    if (!config._isEnabled || !config._options._isFocusAssignmentEnabled || $element.length === 0) {
      return this;
    }
    function perform() {
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
          $element[0].focus({
            preventScroll: true
          });
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
        $element[0].focus();
      }
    }
    if (options.defer) {
      _.defer(perform);
    } else {
      perform();
    }
    return this;
  }

  /**
   * Used to convert html to text aria-labels.
   *
   * @param {string} htmls Any html strings.
   * @returns {string} Returns text without markup or html encoded characters.
   */
  normalize(htmls) {
    htmls = [...arguments].filter(Boolean).filter(_.isString).join(' ');
    const text = $('<div>' + htmls + '</div>').text();
    // Remove all html encoded characters, such as &apos;
    return text.replace(this._htmlCharRegex, '');
  }

  /**
   * Removes all html tags except stylistic elements.
   * Useful for producing uninterrupted text for screen readers from
   * any html.
   *
   * @param  {string} htmls Any html strings.
   * @return {string} Returns html string without markup which would cause screen reader to pause.
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
   * @param {Object|string|Array} $elements
   * @returns {Object} Chainable
   */
  scrollEnable($elements) {
    this._scroll.enable($elements);
    return this;
  }

  /**
   * @param {Object|string|Array} $elements
   * @returns {Object} Chainable
   */
  scrollDisable($elements) {
    this._scroll.disable($elements);
    return this;
  }

  /**
   * To apply accessibilty handling to a tag, isolating the user.
   *
   * @param {Object} $popupElement Element encapsulating the popup.
   * @returns {Object} Chainable
   */
  popupOpened($popupElement) {
    this._popup.opened($popupElement);
    return this;
  }

  /**
   * Remove the isolation applied with a call to `popupOpened`.
   *
   * @param {Object} [$focusElement] Element to move focus to.
   * @returns {Object} Chainable
   */
  popupClosed($focusElement) {
    this._popup.closed($focusElement);
    return this;
  }

  /**
   * When a popup is open, this function makes it possible to swap the element
   * that should receive focus on popup close.
   *
   * @param {Object} $focusElement Set a new element to focus on.
   * @returns {Object} Returns previously set focus element.
   */
  setPopupCloseTo($focusElement) {
    return this._popup.setCloseTo($focusElement);
  }

}

const a11y = new A11y();
export default a11y;
