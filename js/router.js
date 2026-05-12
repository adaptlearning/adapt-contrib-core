/**
 * @file Router Service - Core navigation controller for the Adapt Learning Framework
 * @module core/js/router
 * @description Singleton service managing all navigation, routing, and content rendering
 * for the Adapt Learning Framework. Handles URL routing, content object rendering,
 * view lifecycle management, loading states, and navigation history.
 *
 * **Architecture:**
 * - Singleton controller extending Backbone.Router
 * - Manages four route patterns: home, id-based, preview, and plugin routes
 * - Coordinates with location service for state management
 * - Coordinates with data service for model lookups
 * - Controls navigation protection during rendering (_canNavigate flag)
 * - Handles circular navigation protection to prevent infinite loops
 *
 * **Route Patterns:**
 * - `#/` - Navigate to root content object (course/menu)
 * - `#/id/:id` - Navigate to specific content object or sub-content by ID
 * - `#/preview/:id` - Navigate to preview mode for content (creates containers)
 * - `#/:pluginName/*location/*action` - Navigate to plugin-specific routes
 *
 * **Navigation Flow:**
 * 1. Route triggered (URL change or programmatic navigation)
 * 2. `handleRoute()` checks `_canNavigate` flag and circular navigation protection
 * 3. Triggers `router:navigate` event (extensions can cancel navigation)
 * 4. Sets `_canNavigate` to false (prevents navigation during rendering)
 * 5. Calls appropriate handler (handleId, handleIdPreview, handlePluginRouter)
 * 6. Updates location service state
 * 7. Removes previous view and renders new view
 * 8. Sets `_canNavigate` to true (allows navigation again)
 *
 * **Circular Navigation Protection:**
 * - Prevents infinite loops when URL changes while `_canNavigate` is false
 * - Uses `_isCircularNavigationInProgress` flag to track redirection attempts
 * - Automatically corrects URL back to current location if navigation blocked
 *
 * **Public Events Triggered:**
 * - `router:navigate` - Before navigation begins (can be canceled)
 * - `router:navigationCancelled` - Navigation was blocked by `_canNavigate`
 * - `router:location` - Location has changed (after state update)
 * - `router:contentObject` - Content object will be rendered
 * - `router:{type}` - Specific content type will be rendered (router:menu, router:page)
 * - `router:plugin` - Plugin route handler called
 * - `router:plugin:{pluginName}` - Specific plugin route handler called
 * - `{type}:scrollTo` - Before scrolling to element
 * - `{type}:scrolledTo` - After scrolling to element completed
 *
 * **State Management:**
 * - Uses `router.model` (RouterModel) to track `_canNavigate` and `_shouldNavigateFocus`
 * - Updates `location` service with current/previous model and ID
 * - Manages loading visibility via HTML classes and DOM elements
 * - Tracks backward navigation for history correction
 *
 * **Preview Mode:**
 * - Creates temporary container models (page, article, block) for component preview
 * - Clones content models to prevent modification of original data
 * - Marks preview content with `_isPreview` flag for cleanup
 * - Syncs preview state changes back to original models
 *
 * @example
 * import router from 'core/js/router';
 *
 * router.navigateToElement('.c-05');
 *
 * @example
 * router.navigate('#/id/co-05', { trigger: true });
 *
 * @example
 * router.navigateToParent();
 *
 * @example
 * Adapt.on('router:location', (location) => {
 *   console.log('Navigated to:', location._currentId);
 * });
 */

import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import components from 'core/js/components';
import data from 'core/js/data';
import a11y from 'core/js/a11y';
import RouterModel from 'core/js/models/routerModel';
import logging from 'core/js/logging';
import location from 'core/js/location';

/**
 * @class Router
 * @classdesc Core navigation controller managing routing, content rendering, and navigation state.
 * Singleton instance exported as `router`. Do not instantiate directly.
 * @extends {Backbone.Router}
 */
class Router extends Backbone.Router {

  /**
   * Defines URL route patterns and their handler methods.
   * Called by Backbone.Router during initialization.
   *
   * **Route Patterns:**
   * - `''` - Root route (navigates to course or root content object)
   * - `'id/:id'` - Navigate to content by ID
   * - `'preview/:id'` - Preview mode navigation (creates container models)
   * - `':pluginName(/*location)(/*action)'` - Plugin-specific routes
   *
   * @returns {Object} Route configuration mapping patterns to handler method names
   * @private
   */
  routes() {
    return {
      '': 'handleRoute',
      'id/:id': 'handleRoute',
      'preview/:id': 'handlePreview',
      ':pluginName(/*location)(/*action)': 'handleRoute'
    };
  }

  initialize({ model }) {
    this.navigateToElement = this.navigateToElement.bind(this);
    this.model = model;
    this._navigationRoot = null;
    this._isBackward = false;
    this._isInNavigateTo = false;
    this._shouldIgnoreNextRouteAction = false;
    // Flag to indicate if the router has tried to redirect to the current location.
    this._isCircularNavigationInProgress = false;
    this.isPreviewMode = false;
    this.showLoading();
    // Store #wrapper element and html to cache for later use.
    this.$wrapper = $('#wrapper');
    this.$html = $('html');
    this.listenToOnce(Adapt, 'app:dataReady', this.setDocumentTitle);
    this.listenTo(Adapt, 'router:navigateTo', this.navigateToArguments);
    this.listenToOnce(Adapt, 'configModel:dataLoaded', this.onConfigLoaded);
  }

  /**
   * Gets the root navigation model (navigation starting point).
   * Returns custom root if set via setter, otherwise returns Adapt.course.
   * Used by role selector and other extensions to change navigation hierarchy.
   *
   * @returns {AdaptModel} Root content object model for navigation
   * @example
   * const root = router.rootModel;
   */
  get rootModel() {
    return this._navigationRoot || Adapt.course;
  }

  /**
   * Sets a custom root navigation model.
   * Allows extensions to override the default course root for navigation.
   *
   * @param {AdaptModel} model - New root content object for navigation
   * @example
   * router.rootModel = roleBasedStartPage;
   */
  set rootModel(model) {
    this._navigationRoot = model;
  }

  /**
   * Shows the loading screen.
   * Adds `is-loading-visible` class to html element and displays `.js-loading` element.
   * Called automatically during content object navigation.
   */
  showLoading() {
    $('html').removeClass('is-loading-hidden').addClass('is-loading-visible');
    $('.js-loading').show();
  }

  /**
   * Hides the loading screen.
   * Adds `is-loading-hidden` class to html element and hides `.js-loading` element.
   * Called automatically after content object rendering completes.
   */
  hideLoading() {
    $('html').addClass('is-loading-hidden').removeClass('is-loading-visible');
    $('.js-loading').hide();
  }

  /**
   * Sets the browser document title based on current location.
   * Combines root model title with current model title if available.
   * Updates on next `contentObjectView:preRender` event.
   *
   * **Title Format:**
   * - Root only: "Course Title"
   * - With sub-content: "Course Title | Page Title"
   *
   * @private
   */
  setDocumentTitle() {
    const currentModel = location._currentModel;
    const hasSubTitle = (currentModel && currentModel !== router.rootModel && currentModel.get('title'));
    const title = [
      this.rootModel.get('title'),
      hasSubTitle && currentModel.get('title')
    ].filter(Boolean).join(' | ');
    this.listenToOnce(Adapt, 'contentObjectView:preRender', () => {
      const escapedTitle = $(`<div>${title}</div>`).text();
      document.title = escapedTitle;
    });
  }

  /**
   * Handles navigation triggered by legacy `Adapt.trigger('router:navigateTo')` pattern.
   * Converts arguments to appropriate URL format and calls navigate().
   *
   * **Argument Patterns:**
   * - Single ID: Converts to `#/id/:id` route
   * - Multiple args (≤3): Joins as `#/arg1/arg2/arg3`
   * - More than 3: Falls back to direct `handleRoute()` call (deprecated)
   *
   * @param {Array} args - Navigation arguments from event trigger
   * @private
   * @deprecated Prefer using Backbone.history.navigate or window.location.href
   */
  navigateToArguments(args) {
    args = args.filter(v => v !== null);
    const options = { trigger: false, replace: false };
    if (args.length === 1 && data.findById(args[0])) {
      this.navigate('#/id/' + args[0], options);
      return;
    }
    if (args.length <= 3) {
      this.navigate('#/' + args.join('/'), options);
      return;
    }
    logging.deprecated('Use Backbone.history.navigate or window.location.href instead of Adapt.trigger(\'router:navigateTo\')');
    this.handleRoute(...args);
  }

  /**
   * Handles preview route pattern (`#/preview/:id`).
   * Sets preview mode flag and delegates to `handleRoute()`.
   *
   * @param {...string} args - Route parameters (id, optional additional params)
   * @private
   */
  handlePreview(...args) {
    this.isPreviewMode = true;
    this.handleRoute(...args);
  }

  /**
   * Primary route handler for all navigation.
   * Coordinates navigation protection, circular navigation detection, and routing delegation.
   * Called automatically when URL changes or navigation is triggered programmatically.
   *
   * **Navigation Protection:**
   * - Checks `_canNavigate` flag to prevent navigation during rendering
   * - If blocked, triggers `router:navigationCancelled` and corrects URL
   * - Uses `_isCircularNavigationInProgress` to prevent infinite redirect loops
   *
   * **Route Delegation:**
   * - 0-1 args: Calls `handleId()` or `handleIdPreview()` (content object navigation)
   * - 2+ args: Calls `handlePluginRouter()` (plugin-specific routes)
   *
   * @param {...string} args - Route parameters extracted from URL
   * @fires router:navigate
   * @fires router:navigationCancelled
   * @private
   */
  handleRoute(...args) {
    if (this._shouldIgnoreNextRouteAction) {
      this._shouldIgnoreNextRouteAction = false;
      return;
    }
    args = args.filter(v => v !== null);

    if (this.model.get('_canNavigate')) {
      // Reset _isCircularNavigationInProgress protection as code is allowed to navigate away.
      this._isCircularNavigationInProgress = false;
    }

    // Check if the current page is in the process of navigating to itself.
    // It will redirect to itself if the URL was changed and _canNavigate is false.
    if (this._isCircularNavigationInProgress === false) {
      // Trigger an event pre 'router:location' to allow extensions to stop routing.
      Adapt.trigger('router:navigate', args);
    }

    // Re-check as _canNavigate can be set to false on 'router:navigate' event.
    if (this.model.get('_canNavigate')) {
      // Disable navigation whilst rendering.
      this.model.set('_canNavigate', false, { pluginName: 'adapt' });
      this._isBackward = false;
      if (args.length <= 1) {
        if (this.isPreviewMode) {
          return this.handleIdPreview(...args);
        }
        return this.handleId(...args);
      }
      return this.handlePluginRouter(...args);
    }

    if (this._isCircularNavigationInProgress) {
      // Navigation correction finished.
      // Router has successfully re-navigated to the current _id as the URL was changed
      // while _canNavigate: false
      this._isCircularNavigationInProgress = false;
      return;
    }

    // Cancel navigation to stay at the current location.
    this._isCircularNavigationInProgress = true;
    Adapt.trigger('router:navigationCancelled', args);

    // Reset URL to the current one.
    // https://github.com/adaptlearning/adapt_framework/issues/3061
    Backbone.history.history[this._isBackward ? 'forward' : 'back']();
    this._isBackward = false;
  }

  /**
   * Handles plugin-specific routes (`#/:pluginName/*location/*action`).
   * Updates location service and triggers plugin-specific events.
   * Allows plugins to manage their own routing and rendering.
   *
   * **Plugin Events:**
   * - `router:plugin:{pluginName}` - Specific plugin route triggered
   * - `router:plugin` - Generic plugin route triggered
   *
   * @param {string} pluginName - Name of the plugin handling the route
   * @param {string} [location] - Plugin-specific location parameter
   * @param {string} [action] - Plugin-specific action parameter
   * @async
   * @fires router:plugin:{pluginName}
   * @fires router:plugin
   * @private
   */
  async handlePluginRouter(pluginName, location, action) {
    const pluginLocation = [
      pluginName,
      location && `-${location}`,
      action && `-${action}`
    ].filter(Boolean).join('');
    await this.updateLocation(pluginLocation, null, null, null);

    Adapt.trigger('router:plugin:' + pluginName, pluginName, location, action);
    Adapt.trigger('router:plugin', pluginName, location, action);
    this.model.set('_canNavigate', true, { pluginName: 'adapt' });
  }

  /**
   * Handles navigation to content objects by ID.
   * Primary navigation method for rendering course content (menus and pages).
   *
   * **Navigation Logic:**
   * 1. Validates ID and finds model in data collection
   * 2. Checks for content locking and start controller restrictions
   * 3. If navigating to sub-content (article/block/component), scrolls without re-rendering
   * 4. For content objects, removes current view and renders new view
   * 5. Updates location service and triggers appropriate events
   * 6. Waits for view ready before allowing further navigation
   *
   * **Sub-Content Navigation:**
   * - If target is within current content object, scrolls to element instead of re-rendering
   * - Preserves view state and improves performance
   *
   * **Locking:**
   * - Respects `_isLocked` property when `_forceRouteLocking` config is enabled
   * - Navigates back or to home if attempting to access locked content
   *
   * @param {string} [id] - Content object ID to navigate to (undefined navigates to root)
   * @async
   * @fires router:{type}
   * @fires router:contentObject
   * @private
   */
  async handleId(id) {
    const rootModel = router.rootModel;
    let model = (!id) ? rootModel : data.findById(id);

    if (!model) {
      // Bad id
      this.model.set('_canNavigate', true, { pluginName: 'adapt' });
      return;
    }

    // Keep the routed id incase it needs to be scrolled to later
    const isContentObject = model.isTypeGroup?.('contentobject') && !model.isTypeGroup?.('group');
    const navigateToId = model.get('_id');

    // Ensure that the router is rendering a contentobject
    model = isContentObject ? model : model.findAncestor('contentobject');
    id = model.get('_id');

    const isRoot = (model === rootModel);
    if (isRoot && Adapt.course.has('_start')) {
      // Do not allow access to the menu when the start controller is enabled.
      const startController = Adapt.course.get('_start');
      if (startController._isEnabled === true && startController._isMenuDisabled === true) {
        return;
      }
    }

    if (model.get('_isLocked') && Adapt.config.get('_forceRouteLocking')) {
      // Locked id
      logging.warn('Unable to navigate to locked id: ' + id);
      this.model.set('_canNavigate', true, { pluginName: 'adapt' });
      if (location._previousId === undefined) {
        return this.navigate('#/', { trigger: true, replace: true });
      }
      return this.navigateBack();
    }

    const isNavigateToSubContent = (model === location._currentModel && !isContentObject);
    if (isNavigateToSubContent) {
      this.model.set('_canNavigate', true, { pluginName: 'adapt' });
      await this.navigateToElement('.' + navigateToId, { replace: true, duration: 400 });
      return;
    }

    // Move to a content object
    this.showLoading();
    await Adapt.remove();
    await this.removePreviews();

    /**
     * TODO:
     * As the course object has separate location and type rules,
     * it makes it more difficult to update the location object
     * should stop doing this.
     */
    const isCourse = model.isTypeGroup?.('course');
    const type = isCourse ? 'menu' : model.get('_type');
    const newLocation = isCourse ? 'course' : `${type}-${id}`;

    model.set({
      _isVisited: true,
      _isRendered: true
    });
    await this.updateLocation(newLocation, type, id, model);

    Adapt.trigger(`router:${type} router:contentObject`, model);

    const ViewClass = components.getViewClass(model);
    const isMenu = model.isTypeGroup?.('menu');
    if (!ViewClass && isMenu) {
      logging.deprecated(`Using event based menu view instantiation for '${components.getViewName(model)}'`);
      return;
    }

    if (!isMenu) {
      // checkIfResetOnRevisit where exists on descendant models before render
      _.invoke(model.getAllDescendantModels(), 'checkIfResetOnRevisit');
      // wait for completion to settle
      await Adapt.deferUntilCompletionChecked();
    }

    this.$wrapper.append(new ViewClass({ model }).$el);

    await new Promise(resolve => Adapt.once('contentObjectView:ready', resolve));

    // Allow navigation.
    this.model.set('_canNavigate', true, { pluginName: 'adapt' });
    if (this._isInNavigateTo || this._isInScroll) return;
    if (!isContentObject) {
      // Scroll to element if not a content object or not already trying to
      await this.navigateToElement('.' + navigateToId, { replace: true, duration: 400 });
      return;
    }
    this.handleNavigationFocus();

  }

  /**
   * Handles preview mode navigation for content.
   * Creates temporary container models (page, article, block) if previewing non-content-object.
   * Clones the target content to prevent modification of original data.
   *
   * **Preview Container Generation:**
   * - If previewing component: Creates page > article > block > component hierarchy
   * - If previewing block: Creates page > article > block hierarchy
   * - If previewing article: Creates page > article hierarchy
   * - All preview containers marked with `_isPreview: true`
   *
   * **Content Cloning:**
   * - Deep clones target content to create isolated preview instance
   * - Makes content available and unlocked regardless of original state
   * - Syncs preview state changes back to original model
   *
   * @param {string} [id] - Content ID to preview (undefined previews root)
   * @async
   * @fires router:{type}
   * @fires router:contentObject
   * @private
   */
  async handleIdPreview(id) {
    const rootModel = router.rootModel;
    let model = (!id) ? rootModel : data.findById(id);

    if (!model) {
      // Bad id
      this.model.set('_canNavigate', true, { pluginName: 'adapt' });
      return;
    }

    // Move to a content object
    this.showLoading();
    await Adapt.remove();
    await this.removePreviews();

    let isContentObject = model.isTypeGroup?.('contentobject');
    if (!isContentObject) {
      // If the preview id is not a content object then make
      // some containers to put it in
      const types = ['page', 'article', 'block', 'component'];
      const type = model.get('_type');
      const buildTypes = types.slice(0, types.indexOf(type));
      let parentModel = Adapt.course;
      let _parentId = parentModel.get('_id');
      const built = buildTypes.map((_type, index) => {
        const ModelClass = components.getModelClass({ _type });
        const _id = `preview-${_type}`;
        const builtModel = new ModelClass({
          _type,
          _id,
          _parentId,
          _isPreview: true
        });
        if (index) parentModel.getChildren().add(builtModel);
        data.add(builtModel);
        parentModel = builtModel;
        _parentId = _id;
        return builtModel;
      });
      // Clone the requested content to sanitise
      model.deepClone((clone, orig) => {
        // Make the cloned item available and unlocked
        clone.set({
          _isAvailable: true,
          _isLocked: false
        });
        clone.on('change', function () {
          // Sync the cloned item with the original
          const state = this.getAttemptObject
            ? this.getAttemptObject()
            : this.getTrackableState();
          delete state._id;
          delete state._isAvailable;
          delete state._isLocked;
          if (this.getAttemptObject) orig.setAttemptObject(state);
          else orig.set(state);
        });
        if (orig !== model) return;
        // Relocate the cloned item into the preview containers
        clone.set({
          _parentId
        });
      });
      built.forEach(model => model.setupModel());
      isContentObject = true;
      model = built[0];
      model.setOnChildren({ _isPreview: true });
    }

    const navigateToId = model.get('_id');

    // Ensure that the router is rendering a contentobject
    model = isContentObject ? model : model.findAncestor('contentobject');
    id = navigateToId;

    /**
     * TODO:
     * As the course object has separate location and type rules,
     * it makes it more difficult to update the location object
     * should stop doing this.
     */
    const isCourse = model.isTypeGroup?.('course');
    const type = isCourse ? 'menu' : model.get('_type');
    const newLocation = isCourse ? 'course' : `${type}-${id}`;

    model.set({
      _isVisited: true,
      _isRendered: true
    });
    await this.updateLocation(newLocation, type, id, model);

    Adapt.once('contentObjectView:ready', () => {
      // Allow navigation.
      this.model.set('_canNavigate', true, { pluginName: 'adapt' });
      this.handleNavigationFocus();
    });
    Adapt.trigger(`router:${type} router:contentObject`, model);

    const ViewClass = components.getViewClass(model);
    const isMenu = model.isTypeGroup?.('menu');
    if (!ViewClass && isMenu) {
      logging.deprecated(`Using event based menu view instantiation for '${components.getViewName(model)}'`);
      return;
    }

    if (!isMenu) {
      // checkIfResetOnRevisit where exists on descendant models before render
      _.invoke(model.getAllDescendantModels(), 'checkIfResetOnRevisit');
      // wait for completion to settle
      await Adapt.deferUntilCompletionChecked();
    }

    this.$wrapper.append(new ViewClass({ model }).$el);

  }

  /**
   * Removes all preview content from data collection.
   * Cleans up temporary models created by `handleIdPreview()`.
   * Called before rendering new content to prevent preview model accumulation.
   *
   * @async
   * @private
   */
  async removePreviews() {
    const previews = data.filter(model => model.get('_isPreview'));
    previews.forEach(model => data.remove(model));
  }

  /**
   * Updates the location service state with new navigation context.
   * Stores previous location for navigation history and triggers location change event.
   *
   * **Location Properties Updated:**
   * - `_previousModel` / `_currentModel` - Model references
   * - `_previousId` / `_currentId` - Content IDs
   * - `_previousContentType` / `_contentType` - Content types (menu/page)
   * - `_currentLocation` - Location string (e.g., "page-co-05", "course")
   * - `_lastVisitedType` / `_lastVisitedMenu` / `_lastVisitedPage` - History tracking
   *
   * **Side Effects:**
   * - Updates document title via `setDocumentTitle()`
   * - Updates HTML/wrapper classes via `setGlobalClasses()`
   * - Triggers `router:location` event
   * - Waits for async operations via `wait.queue()`
   *
   * @param {string} currentLocation - Location identifier (e.g., "page-co-05")
   * @param {string} type - Content type ("menu", "page", or null for plugin routes)
   * @param {string} id - Content object ID (or null for plugin routes)
   * @param {AdaptModel} currentModel - Current content model (or null for plugin routes)
   * @async
   * @fires router:location
   * @private
   */
  async updateLocation(currentLocation, type, id, currentModel) {
    if (location._currentId === id && id === null) return;

    // Handles updating the location.
    location._previousModel = location._currentModel;
    location._previousId = location._currentId;
    location._previousContentType = location._contentType;

    location._currentModel = currentModel;
    location._currentId = id;
    location._contentType = type;
    location._currentLocation = currentLocation;

    /**
     * TODO:
     * this if block should be removed,
     * these properties are unused in the framework
     */
    if (type === 'menu') {
      location._lastVisitedType = 'menu';
      location._lastVisitedMenu = id;
    } else if (type === 'page') {
      location._lastVisitedType = 'page';
      location._lastVisitedPage = id;
    }

    this.setDocumentTitle();
    this.setGlobalClasses();

    // Trigger event when location changes.
    Adapt.trigger('router:location', location);

    await wait.queue();
  }

  /**
   * Applies CSS classes to HTML and wrapper elements based on current location.
   * Adds location-type and location-id classes for CSS targeting.
   * Removes previous classes to prevent accumulation.
   *
   * **Applied Classes:**
   * - `location-{type}` - Content type (location-menu, location-page)
   * - `location-id-{id}` - Content ID (location-id-co-05)
   * - `location-{currentLocation}` - For plugin routes
   * - Model's `_htmlClasses` - Custom classes from content
   *
   * **Applied Attributes:**
   * - `data-location` - Current location string
   *
   * @private
   */
  setGlobalClasses() {
    const currentModel = location._currentModel;

    const htmlClasses = currentModel?.get('_htmlClasses') || '';
    const classes = (location._currentId) ?
      `location-${location._contentType} location-id-${location._currentId}` :
      `location-${location._currentLocation}`;
    const currentClasses = `${classes} ${htmlClasses}`;

    this.$html
      .removeClass(location._previousClasses)
      .addClass(currentClasses)
      .attr('data-location', location._currentLocation);

    this.$wrapper
      .removeClass()
      .addClass(classes)
      .attr('data-location', location._currentLocation);

    location._previousClasses = currentClasses;
  }

  /**
   * Sets accessibility focus to body element after navigation.
   * Forces screen readers to start reading from the top of the new content.
   * Only applies if `_shouldNavigateFocus` flag is true in router model.
   *
   * @private
   */
  handleNavigationFocus() {
    if (!this.model.get('_shouldNavigateFocus')) return;
    // Body will be forced to accept focus to start the
    // screen reader reading the page.
    a11y.focus('body');
  }

  /**
   * Navigates backward in browser history.
   * Sets `_isBackward` flag to support URL correction during circular navigation protection.
   */
  navigateBack() {
    this._isBackward = true;
    Backbone.history.history.back();
  }

  /**
   * Re-navigates to the current content object.
   * Useful for refreshing content or correcting navigation state.
   *
   * @param {boolean} [force=false] - If true, bypasses `_canNavigate` check
   * @example
   * router.navigateToCurrentRoute();
   */
  navigateToCurrentRoute(force) {
    if (!this.model.get('_canNavigate') && !force) {
      return;
    }
    if (!location._currentId) {
      return;
    }
    const currentId = location._currentModel.get('_id');
    const isRoot = (location._currentModel === this.rootModel);
    const route = isRoot ? '#/' : '#/id/' + currentId;
    this.navigate(route, { trigger: true, replace: true });
  }

  /**
   * Navigates to the previous route in history.
   * Intelligent navigation that handles different content types appropriately.
   *
   * **Navigation Logic:**
   * - If no current model: Calls browser back
   * - If current is menu: Navigates to parent
   * - If previous model exists: Calls browser back
   * - Otherwise: Navigates to parent
   *
   * @param {boolean} [force=false] - If true, bypasses `_canNavigate` check
   * @example
   * router.navigateToPreviousRoute();
   */
  navigateToPreviousRoute(force) {
    // Sometimes a plugin might want to stop the default navigation.
    // Check whether default navigation has changed.
    if (!this.model.get('_canNavigate') && !force) {
      return;
    }
    const currentModel = location._currentModel;
    const previousModel = location._previousModel;
    if (!currentModel) {
      return this.navigateBack();
    }
    if (location._currentModel?.isTypeGroup('menu')) {
      return this.navigateToParent();
    }
    if (previousModel) {
      return this.navigateBack();
    }
    this.navigateToParent();
  }

  /**
   * Navigates to the parent content object of the current location.
   * If parent is root, navigates to home route.
   *
   * @param {boolean} [force=false] - If true, bypasses `_canNavigate` check
   * @example
   * router.navigateToParent();
   */
  navigateToParent(force) {
    if (!this.model.get('_canNavigate') && !force) {
      return;
    }
    const parentId = location._currentModel.get('_parentId');
    const parentModel = data.findById(parentId);
    const isRoot = (parentModel === this.rootModel);
    const route = isRoot ? '#/' : '#/id/' + parentId;
    this.navigate(route, { trigger: true });
  }

  /**
   * Navigates to the home route (root content object).
   *
   * @param {boolean} [force=false] - If true, bypasses `_canNavigate` check
   * @example
   * router.navigateToHomeRoute();
   */
  navigateToHomeRoute(force) {
    if (!this.model.get('_canNavigate') && !force) {
      return;
    }
    this.navigate('#/', { trigger: true });
  }

  /**
   * Navigates to and scrolls to a specific element in the course.
   * Most versatile navigation method supporting content objects, sub-content, and CSS selectors.
   * Handles cross-content-object navigation, rendering, scrolling, and accessibility focus.
   *
   * **Navigation Modes:**
   * - Content object not rendered: Navigates to content object and renders
   * - Sub-content not rendered: Renders sub-content then scrolls
   * - Element exists: Scrolls to element
   *
   * **Selector Resolution:**
   * - Accepts model ID ("co-05") or CSS selector (".co-05")
   * - Converts pure IDs to CSS class selectors automatically
   * - Validates selector exists in DOM before scrolling
   *
   * **History Management:**
   * - `addSubContentRouteToHistory`: Adds sub-content URL to browser history
   * - `replace`: Updates URL without creating history entry
   *
   * **Scroll Behavior:**
   * - Respects `_disableAnimation` config for instant scrolling
   * - Calculates offset from wrapper padding and aria-label height
   * - Waits for scroll animation before resolving
   * - Sets accessibility focus after scroll completes
   *
   * **Events:**
   * - Triggers `{type}:scrollTo` before scrolling
   * - Triggers `{type}:scrolledTo` after scrolling completes
   *
   * @param {jQuery|string} selector - CSS selector or model ID to navigate to
   * @param {Object} [settings={}] - Navigation and scroll configuration
   * @param {boolean} [settings.addSubContentRouteToHistory=false] - Add sub-content route to browser history
   * @param {boolean} [settings.replace=false] - Update URL without creating history entry
   * @param {number} [settings.duration] - Scroll animation duration in milliseconds
   * @param {Object} [settings.offset] - Scroll offset configuration
   * @param {number} [settings.offset.top] - Top offset in pixels
   * @param {number} [settings.offset.left] - Left offset in pixels
   * @async
   * @fires {type}:scrollTo
   * @fires {type}:scrolledTo
   * @example
   * await router.navigateToElement('.c-05');
   *
   * @example
   * await router.navigateToElement('c-05', {
   *   duration: 600,
   *   replace: true
   * });
   *
   * @example
   * await router.navigateToElement('.b-10', {
   *   addSubContentRouteToHistory: true
   * });
   *
   * @example
   * await router.navigateToElement('.component', {
   *   offset: { top: -100, left: 0 }
   * });
   */
  async navigateToElement(selector, settings = {}) {
    const currentModelId = typeof selector === 'string' && selector.replace(/\./g, '').split(' ')[0];
    const isSelectorAnId = data.hasId(currentModelId);
    let currentModel;

    if (isSelectorAnId) {
      currentModel = data.findById(currentModelId);
      const contentObject = currentModel.isTypeGroup?.('contentobject') && !currentModel.isTypeGroup?.('group')
        ? currentModel
        : currentModel.findAncestor('contentobject');
      const contentObjectId = contentObject.get('_id');
      const isInCurrentContentObject = (contentObjectId === location._currentId);

      if (currentModel && (!currentModel.get('_isRendered') || !currentModel.get('_isReady') || !isInCurrentContentObject)) {
        const shouldReplace = settings.replace || false;
        if (!isInCurrentContentObject) {
          this._isInNavigateTo = true;
          this.navigate(`#/id/${currentModelId}`, { trigger: true, replace: shouldReplace });
          this.model.set('_shouldNavigateFocus', false, { pluginName: 'adapt' });
          await new Promise(resolve => Adapt.once('contentObjectView:ready', _.debounce(() => {
            this.model.set('_shouldNavigateFocus', true, { pluginName: 'adapt' });
            resolve();
          }, 1)));
          this._isInNavigateTo = false;
          const shouldFocusOnBody = (location._currentId === currentModelId);
          if (shouldFocusOnBody) {
            a11y.focusFirst(document.body);
            return;
          }
        }
        await Adapt.parentView.renderTo(currentModelId);
      }

      // Correct selector when passed a pure id
      if (currentModel && selector === currentModel.get('_id')) {
        selector = `.${selector}`;
      }
    }

    const isElementUnavailable = !$(selector).length;
    if (isElementUnavailable) {
      logging.warn(`router.navigateToElement, selector not found in document: ${selector}`);
      return;
    }

    const isSubContent = currentModel && (!currentModel.isTypeGroup('contentobject') || currentModel.isTypeGroup('group'));
    const addSubContentRouteToHistory = (settings?.addSubContentRouteToHistory && isSubContent);
    if (addSubContentRouteToHistory) {
      this.addRouteToHistory(`#/id/${currentModelId}`);
    }

    // Get the current location - this is set in the router
    const newLocation = (location._contentType)
      ? location._contentType
      : location._currentLocation;
    // Trigger initial scrollTo event
    this._isInScroll = true;
    Adapt.trigger(`${newLocation}:scrollTo`, selector);
    // Setup duration variable
    const disableScrollToAnimation = Adapt.config.has('_disableAnimation') ? Adapt.config.get('_disableAnimation') : false;
    if (disableScrollToAnimation) {
      settings.duration = 0;
    } else if (!settings.duration) {
      settings.duration = $.scrollTo.defaults.duration;
    }

    const $wrapper = $('#wrapper');
    // Work out offset from the top of the wrapper rather than the height of the navigation bar
    let offsetTop = -parseInt($wrapper.css('padding-top'));
    // Prevent scroll issue when component description aria-label coincident with top of component
    if ($(selector).hasClass('component')) {
      offsetTop -= $(selector).find('.aria-label').height() || 0;
    }

    if (!settings.offset) settings.offset = { top: offsetTop, left: 0 };
    if (settings.offset.top === undefined) settings.offset.top = offsetTop;
    if (settings.offset.left === undefined) settings.offset.left = 0;

    if (settings.offset.left === 0) settings.axis = 'y';

    if (Adapt.get('_canScroll') !== false) {
      // Trigger scrollTo plugin
      $.scrollTo(selector, settings);
    }

    // Trigger an event after animation
    // 300 milliseconds added to make sure queue has finished
    await new Promise(resolve => {
      _.delay(() => {
        a11y.focusNext(selector);
        Adapt.trigger(`${newLocation}:scrolledTo`, selector);
        this._isInScroll = false;
        resolve();
      }, settings.duration + 300);
    });
  }

  /**
   * Adds a route to browser history without triggering navigation.
   * Used for sub-content navigation to update URL while staying on same content object.
   * Prevents duplicate history entries if already at target route.
   *
   * @param {string} hash - URL hash to add to history (e.g., "#/id/co-05")
   * @private
   */
  addRouteToHistory(hash) {
    const isCurrentRoute = (window.location.hash === hash);
    if (isCurrentRoute) return;
    // Add the route to the browser history without causing a change of content
    this._shouldIgnoreNextRouteAction = true;
    this.navigate(hash, {
      trigger: false,
      replace: false
    });
  }

  /**
   * Gets a property from the router model.
   * @param {...*} args - Arguments passed to router.model.get()
   * @returns {*} Property value from router model
   * @deprecated Please use router.model.get() instead
   */
  get(...args) {
    logging.deprecated('router.get, please use router.model.get');
    return this.model.get(...args);
  }

  /**
   * Sets a property on the router model.
   * @param {...*} args - Arguments passed to router.model.set()
   * @returns {RouterModel} Router model for chaining
   * @deprecated Please use router.model.set() instead
   */
  set(...args) {
    logging.deprecated('router.set, please use router.model.set');
    return this.model.set(...args);
  }

  onConfigLoaded() {
    this.listenTo(Adapt.config, 'change:_activeLanguage', this.onLanguageChange);
  }

  onLanguageChange() {
    this.updateLocation(null, null, null, null);
  }

}

const router = new Router({
  model: new RouterModel(null, { reset: true })
});
export default router;
