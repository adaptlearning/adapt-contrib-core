/**
 * @file Adapt Singleton - Core framework controller and event bus
 * @module core/js/adapt
 * @description The Adapt singleton is the central controller for the Adapt Learning Framework.
 * It extends {@link LockingModel} to provide state management, event coordination, and lifecycle
 * control for the entire course.
 *
 * **Architecture:**
 * - Singleton instance (only one exists per course)
 * - Global event bus (all framework events flow through Adapt.trigger/on/off)
 * - Lifecycle coordinator (initialization, routing, teardown)
 * - State manager (_canScroll, _isStarted, completion state)
 * - Plugin coordination (manages plugin wait queues and readiness)
 *
 * **Key Responsibilities:**
 * - Framework initialization and startup sequence
 * - Completion checking coordination across components
 * - View lifecycle management (create/remove)
 * - RTL/LTR direction handling
 * - Animation control
 * - Relative string parsing for routing
 *
 * **Public Events Triggered:**
 * - `adapt:preInitialize` - Before initialization begins
 * - `adapt:start` - Framework starting
 * - `adapt:initialize` - Framework initialized and ready
 * - `preRemove` - Before view removal
 * - `remove` - During view removal
 * - `postRemove` - After view removal
 * - `plugins:ready` - All plugins loaded (deprecated)
 *
 * **Important:** Many properties have been moved to dedicated modules.
 * Use `import module from 'core/js/module'` instead of `Adapt.module`.
 */

import wait from 'core/js/wait';
import LockingModel from 'core/js/models/lockingModel';

/**
 * A single hop in the model hierarchy, parsed from a relative string.
 * Exactly one of `offset` or `inset` is set; the other is `null`.
 * @typedef {Object} ParsedDirective
 * @property {string} type - Content type (component, block, article, page, menu)
 * @property {number|null} offset - Siblings to move (+/-), or `null` for an inset directive
 * @property {number|null} inset - Child index to select (0-indexed, -1 for last), or `null` for an offset directive
 */

/**
 * @class AdaptSingleton
 * @classdesc Core framework singleton managing lifecycle, state, and event coordination.
 * Exported as single instance. Do not instantiate directly.
 * @extends {LockingModel}
 */
class AdaptSingleton extends LockingModel {

  initialize() {
    this.loadScript = window.__loadScript;
  }

  defaults() {
    return {
      _canScroll: true, // to stop scrollTo behaviour,
      _outstandingCompletionChecks: 0,
      _pluginWaitCount: 0,
      _isStarted: false,
      _shouldDestroyContentObjects: true
    };
  }

  lockedAttributes() {
    return {
      _canScroll: false
    };
  }

  /**
   * Initializes the Adapt framework.
   * Orchestrates the complete startup sequence: direction setup, animation config,
   * plugin loading, and history initialization.
   *
   * **Initialization Sequence:**
   * 1. Apply RTL/LTR direction to DOM
   * 2. Configure animation settings
   * 3. Trigger `adapt:preInitialize` event
   * 4. Wait for all async operations
   * 5. Wait for completion checks to finish
   * 6. Trigger `adapt:start` event
   * 7. Start Backbone history (routing)
   * 8. Mark as started
   * 9. Trigger `adapt:initialize` event
   *
   * @async
   * @fires adapt:preInitialize
   * @fires adapt:start
   * @fires adapt:initialize
   */
  async init() {
    this.addDirection();
    this.disableAnimation();
    this.trigger('adapt:preInitialize');
    await wait.queue();

    // wait until no more completion checking
    this.deferUntilCompletionChecked(async () => {

      // start adapt in a full restored state
      this.trigger('adapt:start');
      await wait.queue();

      if (!Backbone.History.started) {
        Backbone.history.start();
      }

      this.set('_isStarted', true);

      this.trigger('adapt:initialize');
      await wait.queue();

    });
  }

  /**
   * Increments the outstanding completion check counter.
   * Call when entering an asynchronous completion check to prevent framework
   * initialization from proceeding until the check completes.
   * @example
   * Adapt.checkingCompletion();
   * await someAsyncCompletionCheck();
   * Adapt.checkedCompletion();
   */
  checkingCompletion() {
    const outstandingChecks = this.get('_outstandingCompletionChecks');
    this.set('_outstandingCompletionChecks', outstandingChecks + 1);
  }

  /**
   * Decrements the outstanding completion check counter.
   * Call when exiting an asynchronous completion check.
   * When counter reaches zero, initialization can proceed.
   */
  checkedCompletion() {
    const outstandingChecks = this.get('_outstandingCompletionChecks');
    this.set('_outstandingCompletionChecks', outstandingChecks - 1);
  }

  /**
   * Waits until all outstanding completion checks have finished.
   * Used internally during initialization to ensure all async completion
   * checks complete before framework starts.
   * @async
   * @param {Function} [callback=() => {}] - Callback invoked when all checks complete
   * @returns {Promise<void>} Resolves when all completion checks finished
   * @example
   * await Adapt.deferUntilCompletionChecked(() => {
   *   Adapt.trigger('adapt:start');
   * });
   */
  async deferUntilCompletionChecked(callback = () => {}) {
    if (this.get('_outstandingCompletionChecks') === 0) return callback();
    return new Promise(resolve => {
      const checkIfAnyChecksOutstanding = (model, outstandingChecks) => {
        if (outstandingChecks !== 0) return;
        this.off('change:_outstandingCompletionChecks', checkIfAnyChecksOutstanding);
        callback();
        resolve();
      };
      this.on('change:_outstandingCompletionChecks', checkIfAnyChecksOutstanding);
    });
  }

  /**
   * @deprecated Use wait.isWaiting() instead
   * @returns {boolean} True if waiting for plugins
   */
  isWaitingForPlugins() {
    this.log.deprecated('Use wait.isWaiting() as Adapt.isWaitingForPlugins() will be removed in the future');
    return wait.isWaiting();
  }

  /**
   * @deprecated Use wait.isWaiting() instead
   * @returns {void}
   */
  checkPluginsReady() {
    this.log.deprecated('Use wait.isWaiting() as Adapt.checkPluginsReady() will be removed in the future');
    if (this.isWaitingForPlugins()) {
      return;
    }
    this.trigger('plugins:ready');
  }

  /**
   * Parses relative routing strings into structured directives.
   * Used by Trickle to determine scroll targets and by Branching to resolve routing paths.
   *
   * **Syntax:**
   * - **Offset directives**: `@type+n` or `@type-n` (move n steps forward/back)
   * - **Inset directives**: `@type=n` (select nth child, 0-indexed, -1 for last)
   * - **Multiple directives**: Space-separated for nested routing
   *
   * **Directive Behavior:**
   * - Offset (`+`/`-`): Navigate to ancestor or sibling
   * - Inset (`=`): Navigate to descendant
   * - Omit number: Defaults to 0 (current/first)
   *
   * **What each directive resolves to:**
   * - `@component+1` - the next component outside this container, or `undefined`
   * - `@component-1` - the previous component outside this container, or `undefined`
   * - `@block+0` or `@block` - this block, the first ancestor block, or `undefined`
   * - `@type+0` or `@type` - this of type, the first ancestor of type, or `undefined`
   * - `@article=0` - the first article inside this container, or `undefined`
   * - `@article=-1` - the last article inside this container, or `undefined`
   * - `@type=n` - the relatively positioned of type inside this container, or `undefined`
   * - `@block+2 @component=0` - move two blocks forward and return its first component
   * - `@block-1 @component=-2` - move one block backward and return its second to last component
   * - `@article+2 @block=1 @component=-1` - move two articles forward, find the second block and return its last component
   * - `@article @component=-1` - find the first ancestor article and return its last component
   *
   * @param {string} relativeString - One or more space-separated relative references
   * @returns {ParsedDirective|Array<ParsedDirective>} A single directive, or an array when
   * the string contains multiple space-separated references
   * @example
   * const directive = Adapt.parseRelativeString('@component+1');
   * // { type: 'component', offset: 1, inset: null }
   *
   * @example
   * const directive = Adapt.parseRelativeString('@article=0');
   * // { type: 'article', offset: null, inset: 0 }
   *
   * @example
   * const directives = Adapt.parseRelativeString('@block+2 @component=0');
   * // [
   * //   { type: 'block', offset: 2, inset: null },
   * //   { type: 'component', offset: null, inset: 0 }
   * // ]
   */
  parseRelativeString(relativeString) {
    const parts = relativeString
      .replace(/\s*([+\-=]+\d+){1}/g, '$1') // Remove whitespace before symbol +/-/=
      .split(/[@ ]/) // Find all sections
      .filter(Boolean); // Remove empty sections
    const parsed = parts.map(part => {
      let splitIndex = part.search(/[+\-=\d]{1}/);
      if (splitIndex === -1) splitIndex = part.length;
      const symbol = part.slice(splitIndex, splitIndex + 1);
      const type = part.slice(0, splitIndex).replace(/^@/, '');
      let offset = null;
      let inset = null;
      switch (symbol) {
        case '=':
          inset = parseInt(part.slice(splitIndex + 1).trim() || 0);
          break;
        default:
          offset = parseInt(part.slice(splitIndex).trim() || 0);
          break;
      }
      return {
        type,
        offset,
        inset
      };
    });
    return parsed.length === 1
      ? parsed[0]
      : parsed;
  }

  /**
   * Applies text direction (LTR/RTL) to the DOM.
   * Sets `dir` attribute and CSS class on `<html>` element based on config.
   * Called during initialization.
   * @private
   */
  addDirection() {
    const defaultDirection = this.config.get('_defaultDirection');

    $('html')
      .addClass('dir-' + defaultDirection)
      .attr('dir', defaultDirection);
  }

  /**
   * Configures animation settings from config.
   *
   * When `_disableAnimationFor` is set, each of its CSS selectors is tested against
   * `<html>`; a match sets `_disableAnimation` and adds the `disable-animation` class.
   * **The method then returns**, so the `_disableAnimation` fallback below is skipped
   * entirely whenever `_disableAnimationFor` is present — even if no selector matched.
   *
   * Only when `_disableAnimationFor` is absent is `disable-animation` toggled from
   * the `_disableAnimation` config value.
   *
   * Called during initialization.
   * @private
   */
  disableAnimation() {
    const disableAnimationArray = this.config.get('_disableAnimationFor');
    const disableAnimation = this.config.get('_disableAnimation');

    // Check if animations should be disabled
    if (disableAnimationArray) {
      for (let i = 0, l = disableAnimationArray.length; i < l; i++) {
        if (!$('html').is(disableAnimationArray[i])) continue;
        this.config.set('_disableAnimation', true);
        $('html').addClass('disable-animation');
        console.log('Animation disabled.');
      }
      return;
    }

    $('html').toggleClass('disable-animation', (disableAnimation === true));
  }

  /**
   * Removes the current view and resets child state.
   * Called during routing to clean up previous content before rendering new content.
   * Triggers lifecycle events for view teardown coordination.
   *
   * **Removal Sequence:**
   * 1. Mark children as not ready/rendered
   * 2. Trigger `preRemove` event
   * 3. Wait for async operations
   * 4. Destroy view if `_shouldDestroyContentObjects` is true
   * 5. Trigger `remove` event
   * 6. Trigger `postRemove` event (deferred)
   *
   * @async
   * @fires preRemove
   * @fires remove
   * @fires postRemove
   */
  async remove() {
    const currentView = this.parentView;
    if (currentView) {
      currentView.model.setOnChildren({
        _isReady: false,
        _isRendered: false
      });
    }
    this.trigger('preRemove', currentView);
    await wait.queue();
    // Facilitate contentObject transitions
    if (currentView && this.get('_shouldDestroyContentObjects')) {
      currentView.destroy();
    }
    this.trigger('remove', currentView);
    _.defer(this.trigger.bind(this), 'postRemove', currentView);
  }

  /**
   * @deprecated Please use core/js/a11y instead
   * @see module:core/js/a11y
   */
  get a11y() {}

  /**
   * @deprecated Please use core/js/components instead
   * @see module:core/js/components
   */
  get componentStore() {}

  /**
   * @deprecated Please use core/js/data instead
   * @see module:core/js/data
   */
  get data() {}

  /**
   * @deprecated Please use core/js/device instead
   * @see module:core/js/device
   */
  get device() {}

  /**
   * @deprecated Please use core/js/drawer instead
   * @see module:core/js/drawer
   */
  get drawer() {}

  /**
   * @deprecated Please use core/js/location instead
   * @see module:core/js/location
   */
  get location() {}

  /**
   * @deprecated Please use core/js/notify instead
   * @see module:core/js/notify
   */
  get notify() {}

  /**
   * @deprecated Please use core/js/offlineStorage instead
   * @see module:core/js/offlineStorage
   */
  get offlineStorage() {}

  /**
   * @deprecated Please use core/js/router instead
   * @see module:core/js/router
   */
  get router() {}

  /**
   * @deprecated Please use core/js/scrolling instead
   * @see module:core/js/scrolling
   */
  get scrolling() {}

  /**
   * @deprecated Please use core/js/startController instead
   * @see module:core/js/startController
   */
  get startController() {}

  /**
   * @deprecated Please use core/js/components instead
   * @see module:core/js/components
   */
  get store() {}

  /**
   * @deprecated Please use core/js/tracking instead
   * @see module:core/js/tracking
   */
  get tracking() {}

  /**
   * @deprecated Please use core/js/wait instead
   * @see module:core/js/wait
   */
  get wait() {}

  /**
   * Allows a selector to be passed in and Adapt will navigate to this element.
   * Resolves asynchronously when the element has been navigated to.
   * @deprecated Please use router.navigateToElement instead.
   * @param {string} selector CSS selector of the Adapt element you want to navigate to e.g. `".co-05"`
   * @param {Object} [settings] The settings for the `$.scrollTo` function (See https://github.com/flesler/jquery.scrollTo#settings).
   * @param {Object} [settings.replace=false] Set to `true` if you want to update the URL without creating an entry in the browser's history.
   */
  async navigateToElement() {}

  /**
   * Allows a selector to be passed in and Adapt will scroll to this element. Resolves
   * asynchronously when the element has been navigated/scrolled to.
   * @deprecated Please use router.navigateToElement instead.
   * @param {string} selector CSS selector of the Adapt element you want to navigate to e.g. `".co-05"`
   * @param {Object} [settings={}] The settings for the `$.scrollTo` function (See https://github.com/flesler/jquery.scrollTo#settings).
   * @param {Object} [settings.replace=false] Set to `true` if you want to update the URL without creating an entry in the browser's history.
   */
  async scrollTo() {}

  /**
   * Used to register models and views with `store`
   * @deprecated Please use components.register instead.
   * @param {string|Array} name The name(s) of the model/view to be registered
   * @param {object} object Object containing properties `model` and `view` or (legacy) an object representing the view
   */
  register(name, object) {}

  /**
   * Parses a view class name.
   * @deprecated Please use components.getViewName instead.
   * @param {string|Backbone.Model|Backbone.View|object} nameModelViewOrData The name of the view class you want to fetch e.g. `"hotgraphic"` or its model or its json data
   */
  getViewName() {}

  /**
   * Fetches a view class from the store. For a usage example, see either HotGraphic or Narrative
   * @deprecated Please use components.getViewClass instead.
   * @param {string|Backbone.Model|Backbone.View|object} nameModelViewOrData The name of the view class you want to fetch e.g. `"hotgraphic"` or its model or its json data
   * @returns {Backbone.View} Reference to the view class
   */
  getViewClass() {}

  /**
   * Parses a model class name.
   * @deprecated Please use components.getModelName instead.
   * @param {string|Backbone.Model|object} name The name of the model you want to fetch e.g. `"hotgraphic"`, the model to process or its json data
   */
  getModelName() {}

  /**
   * Fetches a model class from the store. For a usage example, see either HotGraphic or Narrative
   * @deprecated Please use components.getModelClass instead.
   * @param {string|Backbone.Model|object} name The name of the model you want to fetch e.g. `"hotgraphic"` or its json data
   * @returns {Backbone.Model} Reference to the view class
   */
  getModelClass() {}

  /**
   * Looks up a model by its `_id` property
   * @deprecated Please use data.findById instead.
   * @param {string} id The id of the item e.g. "co-05"
   * @return {Backbone.Model}
   */
  findById() {}

  /**
   * Looks up a view by its model `_id` property
   * @deprecated Please use data.findViewByModelId instead.
   * @param {string} id The id of the item e.g. "co-05"
   * @return {Backbone.View}
   */
  findViewByModelId() {}

  /**
   * Returns the model represented by the trackingPosition.
   * @deprecated Please use data.findByTrackingPosition instead.
   * @param {Array<Number, Number>} trackingPosition Represents the relative location of a model to a _trackingId
   * @returns {Backbone.Model}
   */
  findByTrackingPosition() {}

}

const Adapt = new AdaptSingleton();

export default Adapt;
