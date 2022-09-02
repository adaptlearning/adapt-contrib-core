import wait from 'core/js/wait';
import LockingModel from 'core/js/models/lockingModel';

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
   * call when entering an asynchronous completion check
   */
  checkingCompletion() {
    const outstandingChecks = this.get('_outstandingCompletionChecks');
    this.set('_outstandingCompletionChecks', outstandingChecks + 1);
  }

  /**
   * call when exiting an asynchronous completion check
   */
  checkedCompletion() {
    const outstandingChecks = this.get('_outstandingCompletionChecks');
    this.set('_outstandingCompletionChecks', outstandingChecks - 1);
  }

  /**
   * wait until there are no outstanding completion checks
   * @param {Function} [callback] Function to be called after all completion checks have been completed
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

  isWaitingForPlugins() {
    this.log.deprecated('Use wait.isWaiting() as Adapt.isWaitingForPlugins() will be removed in the future');
    return wait.isWaiting();
  }

  checkPluginsReady() {
    this.log.deprecated('Use wait.isWaiting() as Adapt.checkPluginsReady() will be removed in the future');
    if (this.isWaitingForPlugins()) {
      return;
    }
    this.trigger('plugins:ready');
  }

  /**
   * Relative strings describe the number and type of hops in the model hierarchy
   * @param {string} relativeString
   * Trickle uses this function to determine where it should scrollTo after it unlocks.
   * Branching uses this function to determine where it should branch to.
   * This function would return the following for a single offset directive:
   * {
   *     type: "component",
   *     offset: 1,
   *     inset: null
   * }
   * "@component+1" returns the next component outside this container, or undefined
   * "@component-1" returns the previous component outside of this container, or undefined
   * "@block+0" or "@block" returns this block, the first ancestor block, or undefined
   * "@type+0" or "@type" returns this of type, the first ancestor of type, or undefined
   * This function would return the following for a single inset directive:
   * {
   *     type: "component",
   *     offset: null,
   *     inset: 0
   * }
   * "@article=0" returns the first article inside this container, or undefined
   * "@article=-1" returns the last article inside this container, or undefined
   * "@type=n" returns the relatively positioned of type inside this container, or undefined
   * This function would return the following for multiple inset and offset directives:
   * [
   *   {
   *     type: "block",
   *     offset: 2,
   *     inset: null
   *   },
   *   {
   *     type: "component",
   *     offset: null,
   *     inset: 0
   *   }
   * ]
   * "@block+2 @component=0" move two blocks forward and return its first component
   * "@block-1 @component=-2" move one block backward and return its second to last component
   * "@article+2 @block=1 @component=-1" move two articles forward, find the second block and return its last component
   * "@article @component=-1" find the first ancestor article and return its last component
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

  addDirection() {
    const defaultDirection = this.config.get('_defaultDirection');

    $('html')
      .addClass('dir-' + defaultDirection)
      .attr('dir', defaultDirection);
  }

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
   */
  get a11y() {}

  /**
   * @deprecated Please use core/js/components instead
   */
  get componentStore() {}

  /**
   * @deprecated Please use core/js/data instead
   */
  get data() {}

  /**
   * @deprecated Please use core/js/device instead
   */
  get device() {}

  /**
   * @deprecated Please use core/js/drawer instead
   */
  get drawer() {}

  /**
   * @deprecated Please use core/js/location instead
   */
  get location() {}

  /**
   * @deprecated Please use core/js/notify instead
   */
  get notify() {}

  /**
   * @deprecated Please use core/js/offlineStorage instead
   */
  get offlineStorage() {}

  /**
   * @deprecated Please use core/js/router instead
   */
  get router() {}

  /**
   * @deprecated Please use core/js/scrolling instead
   */
  get scrolling() {}

  /**
   * @deprecated Please use core/js/startController instead
   */
  get startController() {}

  /**
   * @deprecated Please use core/js/components instead
   */
  get store() {}

  /**
   * @deprecated Please use core/js/tracking instead
   */
  get tracking() {}

  /**
   * @deprecated Please use core/js/wait instead
   */
  get wait() {}

  /**
   * Allows a selector to be passed in and Adapt will navigate to this element. Resolves
   * asynchronously when the element has been navigated to.  /**
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
