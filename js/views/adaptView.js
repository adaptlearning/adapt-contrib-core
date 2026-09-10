/**
 * @file AdaptView - Base Backbone view for all Adapt content
 * @module core/js/views/adaptView
 * @description Base view class for every rendered content item in the Adapt Framework.
 * Handles both Handlebars and JSX template rendering, child view lifecycle
 * management, on-screen animation, visibility toggling, and completion/ready
 * state delegation to the model.
 *
 * **Key Responsibilities:**
 * - Template rendering (Handlebars and React/JSX)
 * - Child view creation and hierarchical addition (`addChildren`, `addChildView`)
 * - View lifecycle events: `preRemove`, `remove`, `postRemove`
 * - On-screen animation via `_onScreen` model config
 * - Visibility and display toggling
 * - Priority label calculation
 *
 * **Public Events Triggered:**
 * - `{type}View:preRender view:preRender` - Before template is rendered
 * - `{type}View:render view:render` - During render
 * - `{type}View:postRender view:postRender` - After render and children added
 * - `{type}View:addChild view:addChild` - Before a child view is created
 * - `{type}View:childAdded view:childAdded` - After a child view is appended
 * - `{type}View:preRemove view:preRemove` - Before removal begins
 * - `{type}View:remove view:remove` - During removal
 * - `{type}View:postRemove view:postRemove` - After removal completes
 * - `{type}View:animationStart view:animationStart` - On-screen animation triggered
 */
import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import components from 'core/js/components';
import ChildEvent from 'core/js/childEvent';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';
import location from 'core/js/location';
import logging from 'core/js/logging';
import PRIORITY_LABEL_SUPPORTED_TYPE from 'core/js/enums/priorityLabelSupportedType';
/**
 * @class AdaptView
 * @classdesc Base Backbone view for all Adapt content items. Manages template
 * rendering (Handlebars and JSX), child view hierarchy, on-screen animations,
 * and visibility state. Subclassed by menu, page, article, block, and component
 * views.
 * @extends {Backbone.View}
 */
class AdaptView extends Backbone.View {

  attributes() {
    return {
      'data-adapt-id': this.model.get('_id'),
      role: 'presentation'
    };
  }

  initialize() {
    this._jsxIgnoreChanges = 0;
    this.listenTo(this.model, {
      'change:_isVisible': this.toggleVisibility,
      'change:_isHidden': this.toggleHidden,
      'change:_isComplete': this.onIsCompleteChange
    });
    this.isJSX = (this.template || this.constructor.template || '').includes('.jsx');
    if (this.isJSX) {
      this._classSet = new Set(_.result(this, 'className').trim().split(/\s+/));
      this.listenTo(this.model, 'change', this.changed);
      const children = this.model?.getChildren?.();
      children && this.listenTo(children, 'change', this.changed);
      // Facilitate adaptive react views
      this.listenTo(Adapt, 'device:changed', this.changed);
    }
    this.model.set({
      _globals: Adapt.course.get('_globals'),
      _isReady: false
    });

    this.setPriorityLabels();

    this._isRemoved = false;

    if (location._currentId === this.model.get('_id')) {
      Adapt.parentView = this;
    }

    this.preRender();
    this.render();
    this.setupOnScreenHandler();
  }

  preRender() {}

  async postRender() {
    await this.addChildren();
  }

  /**
   * Renders the Handlebars or JSX template into the root element and fires
   * lifecycle events. Defers `postRender` to allow the browser to paint first.
   * @fires {type}View:preRender
   * @fires view:preRender
   * @fires {type}View:render
   * @fires view:render
   * @fires {type}View:postRender
   * @fires view:postRender
   * @returns {AdaptView} Returns this for chaining
   */
  render() {
    const type = this.constructor.type;
    Adapt.trigger(`${type}View:preRender view:preRender`, this);

    if (this.isJSX) {
      this.changed();
    } else {
      const data = this.model.toJSON();
      data.view = this;
      const template = Handlebars.templates[this.constructor.template];
      this.$el.html(template(data));
    }

    Adapt.trigger(`${type}View:render view:render`, this);

    _.defer(async () => {
      // don't call postRender after remove
      if (this._isRemoved) return;

      await this.postRender();
      Adapt.trigger(`${type}View:postRender view:postRender`, this);
    });

    return this;
  }

  /**
   * Re-renders the JSX template in response to model or device changes.
   * @param {string} [eventName=null] Backbone change event name; bubbling events are ignored
   */
  changed(eventName = null) {
    if (this._jsxIgnoreChanges !== 0) return;
    if (!this.isJSX) return;
    if (typeof eventName === 'string' && eventName.startsWith('bubble')) {
      // Ignore bubbling events as they are outside of this view's scope
      return;
    }
    if (!this.model.get('_isRendered')) return;
    const props = {
      // Add view own properties, bound functions etc
      ...this,
      // Add model json data
      ...this.model.toJSON(),
      // Add globals
      _globals: Adapt.course.get('_globals')
    };
    const Template = templates[(this.template || this.constructor.template).replace('.jsx', '')];
    this.updateViewProperties();
    ReactDOM.render(<Template {...props} />, this.el);
  }

  /**
   * Pauses JSX re-renders. Increments a counter; call `startRendering` to
   * resume. Useful when making multiple model changes that should only
   * result in a single render pass.
   */
  stopRendering() {
    this._jsxIgnoreChanges++;
  }

  /**
   * Resumes JSX re-renders after a `stopRendering` call.
   * Decrements the pause counter; rendering resumes when the counter reaches zero.
   */
  startRendering() {
    this._jsxIgnoreChanges--;
    if (this._jsxIgnoreChanges < 0) {
      this._jsxIgnoreChanges = 0;
    }
  }

  /**
   * Synchronises the DOM element's class list and attributes with the current
   * Backbone `className` and `attributes` results. Called by `changed` before
   * each JSX render to ensure the element stays up to date.
   */
  updateViewProperties() {
    const classesToAdd = _.result(this, 'className').trim().split(/\s+/);
    classesToAdd.forEach(i => this._classSet.add(i));
    const classesToRemove = [ ...this._classSet ].filter(i => !classesToAdd.includes(i));
    classesToRemove.forEach(i => this._classSet.delete(i));
    this._setAttributes({ ..._.result(this, 'attributes'), id: _.result(this, 'id') });
    this.$el.removeClass(classesToRemove).addClass(classesToAdd);
  }

  /**
   * Attaches an `onscreen` CSS animation handler when `_onScreen._isEnabled` is
   * set on the model. Adds the before-animation class immediately, then switches
   * to the after-animation class once the element enters the viewport beyond the
   * configured vertical threshold.
   * @fires {type}View:animationStart
   * @fires view:animationStart
   */
  setupOnScreenHandler() {
    const onscreen = this.model.get('_onScreen');

    if (!onscreen?._isEnabled) return;

    this.$el.addClass(`has-animation ${onscreen._classes}-before`);
    this.$el.on('onscreen.adaptView', (e, m) => {
      if (!m.onscreen) return;
      const minVerticalInview = onscreen._percentInviewVertical || 33;
      if (m.percentInviewVertical < minVerticalInview) return;
      this.$el.addClass(`${onscreen._classes}-after`).off('onscreen.adaptView');
      const type = this.model.get('_type');
      Adapt.trigger(`${type}View:animationStart view:animationStart`, this);
    });
  }

  /**
   * Add children and descendant views, first-child-first. Wait until all possible
   * views are added before resolving asynchronously.
   * Will trigger 'view:addChild'(ChildEvent), 'view:requestChild'(ChildEvent)
   * and 'view:childAdded'(ParentView, ChildView) accordingly.
   * @param {object} [options]
   * @param {boolean} [options.returnNewDescendants=false]
   * @returns {number|AdaptView[]} Count of views added or a list of the views
   */
  async addChildren({ returnNewDescendants = false } = {}) {
    const newChildren = [];
    this.nthChild = this.nthChild || 0;
    // Check descendants first
    let addedCount = 0;
    // addDescendants may return either an array or an integer
    // Due to backward compatibility, it should processed accordingly
    const result = await this.addDescendants({ returnNewDescendants });
    if (Array.isArray(result)) {
      addedCount = result.length;
      newChildren.push(...result);
    } else {
      addedCount = result;
    }
    // Iterate through existing available children and/or request new children
    // if required and allowed
    while (true) {
      const models = this.model.getAvailableChildModels();
      const event = this._getAddChildEvent(models[this.nthChild]);
      if (!event) {
        break;
      }
      if (event.isForced) {
        event.reset();
      }
      if (event.isStoppedImmediate || !event.model) {
        // If addChild has been stopped before it is added then
        // set all subsequent models and their children as not rendered
        const subsequentModels = models.slice(this.nthChild);
        subsequentModels.forEach(model => model.setOnChildren('_isRendered', false));
        break;
      }
      // Set model state
      const model = event.model;
      model.set({
        _isRendered: true,
        _nthChild: ++this.nthChild
      });
      // Create child view
      const ChildView = this.constructor.childView || components.getViewClass(model);
      if (!ChildView) {
        throw new Error(`The component '${model.attributes._id}' ('${model.attributes._component}') has not been installed, and so is not available in your project.`);
      }
      const childView = new ChildView({ model });
      newChildren.push(childView);
      this.addChildView(childView);
      addedCount++;
      if (event.isStoppedNext) {
        break;
      }
    }

    if (!addedCount) {
      return returnNewDescendants ? [] : addedCount;
    }

    // Children were added, unset _isReady
    this.model.set('_isReady', false);
    return returnNewDescendants ? newChildren : addedCount;
  }

  /**
   * Child views can be added with '_renderPosition': 'outer-append' or
   * 'inner-append' (default). Each child view will trigger a
   * 'view:childAdded'(ParentView, ChildView) event and be added to the
   * this.getChildViews() array on this parent.
   * @param {AdaptView} childView
   * @returns {AdaptView} Returns this childView
   */
  addChildView(childView) {
    const childModel = childView.model;
    const type = childModel.get('_type');
    const childViews = this.getChildViews() || [];
    childViews.push(childView);
    this.setChildViews(childViews);
    const $parentContainer = this.$(this.constructor.childContainer);
    switch (childModel.get('_renderPosition')) {
      case 'outer-append':
        // Useful for trickle buttons, inline feedback etc
        this.$el.append(childView.$el);
        break;
      case 'inner-append':
      default:
        $parentContainer.append(childView.$el);
        break;
    }
    // Signify that a child has been added to the view to enable updates to status bars
    Adapt.trigger(`${type}View:childAdded view:childAdded`, this, childView);
    return childView;
  }

  /**
   * Iterates through existing childViews and runs addChildren on them, resolving
   * the total count of views added asynchronously.
   * @param {object} [options]
   * @param {boolean} [options.returnNewDescendants=false]
   * @returns {number|[AdaptView]} Count of views added or a list of the views
   */
  async addDescendants({ returnNewDescendants = false } = {}) {
    let addedDescendantCount = 0;
    const childViews = this.getChildViews();
    if (!childViews) {
      return returnNewDescendants
        ? []
        : addedDescendantCount;
    }
    const newDescendants = [];
    for (let i = 0, l = childViews.length; i < l; i++) {
      const view = childViews[i];
      // addChildren may return either an array or an integer
      // Due to backward compatibility, it should be processed accordingly
      const result = view.addChildren
        ? await view.addChildren({ returnNewDescendants: true })
        : 0;
      if (Array.isArray(result)) {
        addedDescendantCount += result.length;
        newDescendants.push(...result);
      } else {
        addedDescendantCount += result;
      }
      if (addedDescendantCount) {
        break;
      }
    }
    if (!addedDescendantCount) {
      this.model.checkReadyStatus();
      return returnNewDescendants ? [] : addedDescendantCount;
    }
    // Descendants were added, unset _isReady
    this.model.set('_isReady', false);
    return returnNewDescendants ? newDescendants : addedDescendantCount;
  }

  /**
   * Resolves after outstanding asynchronous view additions are finished
   * and ready.
   */
  async whenReady() {
    if (this.model.get('_isReady')) return;
    return new Promise(resolve => {
      const onReadyChange = (model, value) => {
        if (!value) return;
        this.stopListening(this.model, 'change:_isReady', onReadyChange);
        resolve();
      };
      this.listenTo(this.model, 'change:_isReady', onReadyChange);
      this.model.checkReadyStatus();
    });
  }

  /**
   * Triggers and returns a new ChildEvent object for render control.
   * This function is used by addChildren to manage event triggering.
   * @param {AdaptModel} model
   * @returns {ChildEvent}
   */
  _getAddChildEvent(model) {
    const isRequestChild = (!model);
    const event = new ChildEvent(null, this, model);
    if (isRequestChild) {
      // No model has been supplied, we are at the end of the available child list
      const canRequestChild = this.model.get('_canRequestChild');
      if (!canRequestChild) {
        // This model cannot request children
        return;
      }
      event.type = 'requestChild';
      // Send a request asking for a new model
      Adapt.trigger('view:requestChild', event);
      if (!event.hasRequestChild) {
        // No new model was supplied
        // Close the event so that the final state can be scrutinized
        event.close();
        return;
      }
      // A new model has been supplied for the end of the list.
      model = event.model;
    }
    const type = model.get('_type');
    // Trigger an event to signify that a new model is to be added
    event.type = 'addChild';
    Adapt.trigger(`${type}View:addChild view:addChild`, event);
    // Close the event so that the final state can be scrutinized
    event.close();
    return event;
  }

  /**
   * Return an array of all child and descendant views.
   * @param {boolean} [isParentFirst=false] Array returns with parents before children
   * @returns {[AdaptView]}
   */
  findDescendantViews(isParentFirst) {
    const descendants = [];
    const childViews = this.getChildViews();
    childViews?.forEach(view => {
      if (isParentFirst) descendants.push(view);
      const children = view.findDescendantViews?.(isParentFirst);
      if (children) descendants.push(...children);
      if (!isParentFirst) descendants.push(view);
    });
    return descendants;
  }

  setReadyStatus() {
    this.model.setReadyStatus();
  }

  setCompletionStatus() {
    this.model.setCompletionStatus();
  }

  /**
   * Resets completion state on this view's model or all its descendant components.
   * Has no effect if the model's `_canReset` is `false`.
   * @param {string} type - Reset type: `'hard'` resets `_isComplete` and
   * `_isInteractionComplete`; `'soft'` resets `_isInteractionComplete` only
   */
  resetCompletionStatus(type) {
    if (!this.model.get('_canReset')) return;

    const descendantComponents = this.model.findDescendantModels('component');
    if (descendantComponents.length === 0) {
      this.model.reset(type);
    } else {
      descendantComponents.forEach(model => model.reset(type));
    }
  }

  /**
   * Triggers `preRemove` lifecycle events on Adapt and this view.
   * Called automatically by `remove` before teardown begins.
   * @fires {type}View:preRemove
   * @fires view:preRemove
   */
  preRemove() {
    const type = this.constructor.type;
    Adapt.trigger(`${type}View:preRemove view:preRemove`, this);
    this.trigger('preRemove');
  }

  /**
   * Removes the view from the DOM, unmounts any React tree, and triggers
   * lifecycle events. Stops all listeners and defers a `postRemove` event.
   * @override
   * @returns {AdaptView} Returns this for chaining
   * @fires {type}View:preRemove
   * @fires {type}View:remove
   * @fires {type}View:postRemove
   */
  remove() {
    const type = this.constructor.type;
    this.preRemove();
    Adapt.trigger(`${type}View:remove view:remove`, this);
    this.trigger('remove');
    this._isRemoved = true;
    this.stopListening();

    wait.for(end => {
      if (this.isJSX) {
        ReactDOM.unmountComponentAtNode(this.el);
      }
      this.$el.off('onscreen.adaptView');
      super.remove();
      _.defer(() => {
        Adapt.trigger(`${type}View:postRemove view:postRemove`, this);
        this.trigger('postRemove');
      });
      end();
    });

    return this;
  }

  /**
   * Returns the CSS class to apply for the current `_isVisible` state.
   * Used in Handlebars templates to set initial visibility.
   * @returns {string} `'u-visibility-hidden'` when hidden, otherwise `''`
   */
  setVisibility() {
    return this.model.get('_isVisible') ? '' : 'u-visibility-hidden';
  }

  toggleVisibility() {
    this.$el.toggleClass('u-visibility-hidden', !this.model.get('_isVisible'));
  }

  /**
   * Returns the CSS class to apply for the current `_isHidden` state.
   * Used in Handlebars templates to set initial display state.
   * @returns {string} `'u-display-none'` when hidden, otherwise `''`
   */
  setHidden() {
    return this.model.get('_isHidden') ? 'u-display-none' : '';
  }

  toggleHidden() {
    this.$el.toggleClass('u-display-none', this.model.get('_isHidden'));
  }

  /**
   * Calculate and set priority label data on the model based on configuration.
   * Supports per-element override via model's _priorityLabels with _isOverride: true.
   * Handles all the logic internally: checks type, gets config, and sets model data.
   */
  setPriorityLabels() {
    const type = this.constructor.type;
    if (!PRIORITY_LABEL_SUPPORTED_TYPE.includes(type)) return;

    const _globals = Adapt.course.get('_globals');
    const globalConfig = _globals?._priorityLabels;
    const localConfig = this.model.get('_priorityLabels');

    // Use local override if _isOverride is explicitly true
    const isLocalOverride = localConfig?._isOverride === true;
    const typeConfig = isLocalOverride
      ? localConfig
      : globalConfig?.[`_${type}`];

    if (!typeConfig) return;

    const _isOptional = this.model.get('_isOptional');
    const optionalLabel = _globals?._accessibility?._ariaLabels?.optional;
    const requiredLabel = _globals?._accessibility?._ariaLabels?.required;

    const showWhenOptional = typeConfig._showWhenOptional && _isOptional && optionalLabel;
    const showWhenRequired = typeConfig._showWhenRequired && !_isOptional && requiredLabel;

    if (!showWhenOptional && !showWhenRequired) return;

    // Icon classes always come from global config
    const _iconClassOptional = globalConfig?._iconClassOptional ?? '';
    const _iconClassRequired = globalConfig?._iconClassRequired ?? '';

    this.model.set({
      _priorityClass: _isOptional ? 'is-optional' : 'is-required',
      _priorityIconClass: _isOptional ? _iconClassOptional : _iconClassRequired,
      priorityLabel: _isOptional ? optionalLabel : requiredLabel
    });
  }

  /**
   * Reacts to `change:_isComplete` on the model by toggling the
   * `is-complete` CSS class on the root element.
   * @param {AdaptModel} model - The model that changed
   * @param {boolean} isComplete - New completion state
   */
  onIsCompleteChange(model, isComplete) {
    this.$el.toggleClass('is-complete', isComplete);
  }

  /**
   * Returns an array of direct child views.
   * @returns {Array<AdaptView>|null} Child views, or `null` if none have been added
   */
  getChildViews() {
    if (!this._childViews) return null;
    // Allow both a deprecated id/view map or a new array of child views
    return Object.entries(this._childViews).map(([key, value]) => value);
  }

  setChildViews(value) {
    this._childViews = value;
  }

  /**
   * Returns an indexed by id list of child views.
   * @deprecated since 5.7.0
   * @returns {{<string, AdaptView}}
   */
  get childViews() {
    logging.deprecated('view.childViews use view.getChildViews() and view.setChildViews([])');
    if (Array.isArray(this._childViews)) {
      return _.indexBy(this._childViews, view => view.model.get('_id'));
    }
    return this._childViews;
  }

  /**
   * Sets an indexed by id list of child views.
   * @deprecated since 5.7.0
   */
  set childViews(value) {
    logging.deprecated('view.childViews use view.getChildViews() and view.setChildViews([])');
    this.setChildViews(value);
  }

}

AdaptView.className = '';

export default AdaptView;
