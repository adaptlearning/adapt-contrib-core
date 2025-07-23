import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import components from 'core/js/components';
import data from 'core/js/data';
import a11y from 'core/js/a11y';
import RouterModel from 'core/js/models/routerModel';
import logging from 'core/js/logging';
import location from 'core/js/location';

class Router extends Backbone.Router {

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

  get rootModel() {
    return this._navigationRoot || Adapt.course;
  }

  set rootModel(model) {
    this._navigationRoot = model;
  }

  showLoading() {
    $('html').removeClass('is-loading-hidden').addClass('is-loading-visible');
    $('.js-loading').show();
  }

  hideLoading() {
    $('html').addClass('is-loading-hidden').removeClass('is-loading-visible');
    $('.js-loading').hide();
  }

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

  handlePreview(...args) {
    this.isPreviewMode = true;
    this.handleRoute(...args);
  }

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

  async removePreviews() {
    const previews = data.filter(model => model.get('_isPreview'));
    previews.forEach(model => data.remove(model));
  }

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

  handleNavigationFocus() {
    if (!this.model.get('_shouldNavigateFocus')) return;
    // Body will be forced to accept focus to start the
    // screen reader reading the page.
    a11y.focus('body');
  }

  navigateBack() {
    this._isBackward = true;
    Backbone.history.history.back();
  }

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

  navigateToHomeRoute(force) {
    if (!this.model.get('_canNavigate') && !force) {
      return;
    }
    this.navigate('#/', { trigger: true });
  }

  /**
   * Allows a selector or id to be passed in and Adapt will navigate to this element. Resolves
   * asynchronously when the element has been navigated to.
   * @param {JQuery|string} selector CSS selector or id of the Adapt element you want to navigate to e.g. `".co-05"` or `"co-05"`
   * @param {Object} [settings] The settings for the `$.scrollTo` function (See https://github.com/flesler/jquery.scrollTo#settings).
   * @param {boolean} [settings.addSubContentRouteToHistory=false] Set to `true` if you want to add a sub content route to the browser's history.
   * @param {boolean} [settings.replace=false] Set to `true` if you want to update the URL without creating an entry in the browser's history.
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

  get(...args) {
    logging.deprecated('router.get, please use router.model.get');
    return this.model.get(...args);
  }

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
