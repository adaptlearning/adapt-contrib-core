/**
 * @file Content Object View - Base view for page and menu content objects
 * @module core/js/views/contentObjectView
 * @description Renders top-level Adapt content objects (pages and menus). Manages the
 * async ready lifecycle, animated fade-in, scroll position reset on load, and the
 * full hierarchy of child article/block/component views. Fires prefixed events for
 * both the concrete type (e.g. `pageView:ready`) and the base type
 * (`contentObjectView:ready`) so plugins can target either level.
 */
import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import AdaptView from 'core/js/views/adaptView';
import ReactDOM from 'react-dom';
import data from 'core/js/data';
import router from 'core/js/router';

/**
 * @class ContentObjectView
 * @classdesc Base view for Adapt content objects. Handles the full render lifecycle:
 * template or JSX rendering, async ready state (triggered by `model.change:_isReady`),
 * scroll-to-top, velocity fade-in animation, and recursive child-view removal via
 * ReactDOM or standard DOM cleanup. Subclassed by {@link module:core/js/views/pageView~PageView}
 * and menu views.
 * @extends AdaptView
 * @fires contentObjectView:preRender
 * @fires contentObjectView:render
 * @fires contentObjectView:postRender
 * @fires contentObjectView:preReady
 * @fires contentObjectView:ready
 * @fires contentObjectView:postReady
 * @fires contentObjectView:preRemove
 * @fires contentObjectView:remove
 * @fires contentObjectView:postRemove
 */
export default class ContentObjectView extends AdaptView {

  attributes() {
    return AdaptView.resultExtend('attributes', {
      role: 'main'
    }, this);
  }

  className() {
    return [
      this.constructor.type,
      'contentobject',
      this.constructor.className,
      this.model.get('_id'),
      this.model.get('_classes'),
      this.setVisibility(),
      (this.model.get('_isComplete') ? 'is-complete' : ''),
      (this.model.get('_isOptional') ? 'is-optional' : '')
    ].filter(Boolean).join(' ');
  }

  preRender() {
    $.inview.lock(this.constructor.type + 'View');
    this.disableAnimation = Adapt.config.has('_disableAnimation') ? Adapt.config.get('_disableAnimation') : false;
    this.$el.css('opacity', 0);
    this.listenTo(this.model, 'change:_isReady', this.isReady);
    this._loadingErrorTimeout = setTimeout(() => data.logReadyError(this), 10000);
  }

  /**
   * Renders the view using either a JSX template (via `this.changed()`) or a
   * Handlebars template, then defers a `postRender` call. Fires the
   * `preRender`, `render`, and `postRender` lifecycle events for both the
   * concrete type (e.g. `pageView:render`) and `contentObjectView:render`.
   * @returns {ContentObjectView} This view instance
   */
  render() {
    const type = this.constructor.type;
    Adapt.trigger(`${type}View:preRender contentObjectView:preRender view:preRender`, this);

    if (this.isJSX) {
      this.changed();
    } else {
      const data = this.model.toJSON();
      data.view = this;
      const template = Handlebars.templates[this.constructor.template];
      this.$el.html(template(data));
    }

    Adapt.trigger(`${type}View:render contentObjectView:render view:render`, this);

    _.defer(() => {
      // don't call postRender after remove
      if (this._isRemoved) return;

      this.postRender();
      Adapt.trigger(`${type}View:postRender contentObjectView:postRender view:postRender`, this);
    });

    return this;
  }

  async isReady() {
    if (!this.model.get('_isReady') || this._isTriggeredReady) return;
    this._isTriggeredReady = true;
    clearTimeout(this._loadingErrorTimeout);
    delete this._loadingErrorTimeout;
    const type = this.constructor.type;
    const performIsReady = async () => {
      Adapt.trigger(`${type}View:preReady contentObjectView:preReady view:preReady`, this);
      await wait.queue();
      router.hideLoading();
      if (Adapt.get('_shouldContentObjectScrollTop') !== false) {
        $(window).scrollTop(0);
      }
      Adapt.trigger(`${type}View:ready contentObjectView:ready view:ready`, this);
      const styleOptions = { opacity: 1 };
      if (this.disableAnimation) {
        this.$el.css(styleOptions);
        $.inview.unlock(`${type}View`);
        _.defer(() => {
          Adapt.trigger(`${type}View:postReady contentObjectView:postReady view:postReady`, this);
        });
      } else {
        this.$el.velocity(styleOptions, {
          duration: 'fast',
          complete: () => {
            $.inview.unlock(`${type}View`);
            Adapt.trigger(`${type}View:postReady contentObjectView:postReady view:postReady`, this);
          }
        });
      }
      $(window).scroll();
    };

    _.defer(performIsReady);
  }

  /**
   * Force-renders descendant views down to the specified model ID. All models
   * between the content object root and `id` (inclusive) are forced to render
   * even when lazy-rendering would normally skip them.
   * @param {string} id - The `_id` of the target descendant model
   * @returns {Promise<void>} Resolves once the target view is rendered and ready
   * @throws {Error} If `id` is not a descendant of this content object
   * @throws {Error} If any model up to `id` is locked
   * @throws {Error} If the target view fails to reach a rendered and ready state
   */
  async renderTo(id) {
    const isRenderToSelf = (id === this.model.get('_id'));
    if (isRenderToSelf) return;
    let models = this.model.getAllDescendantModels(true).filter(model => model.get('_isAvailable'));
    const index = models.findIndex(model => model.get('_id') === id);
    if (index === -1) {
      throw new Error(`Cannot renderTo "${id}" as it isn't a descendant.`);
    }
    // Return early if the model is already rendered and ready
    const model = models[index];
    if (model.get('_isRendered') && model.get('_isReady')) {
      return;
    }
    // Force all models up until the id to render
    models = models.slice(0, index + 1);
    const isLocked = models.some(model => model.get('_isLocked'));
    if (isLocked) throw new Error(`Cannot renderTo ${id} as it is preceded by locked content`);
    const ids = _.indexBy(models, (model) => model.get('_id'));
    const forceUntilId = (event) => {
      const addingId = event.model.get('_id');
      if (!ids[addingId]) return;
      event.force();
      if (addingId !== id) return;
      Adapt.off('view:addChild', forceUntilId);
    };
    Adapt.on('view:addChild', forceUntilId);
    // Trigger addChildren cascade
    await this.addChildren();
    await this.whenReady();
    // Error if model isn't rendered and ready
    if (!model.get('_isRendered') || !model.get('_isReady')) {
      throw new Error(`Cannot renderTo "${id}".`);
    }
  }

  preRemove() {
    const type = this.constructor.type;
    Adapt.trigger(`${type}View:preRemove contentObjectView:preRemove view:preRemove`, this);
    this.trigger('preRemove');
  }

  /**
   * Removes the view and all descendant views from the DOM. Unmounts React
   * components via `ReactDOM.unmountComponentAtNode` when JSX is in use,
   * otherwise removes descendant views in reverse order. Fires the `remove`
   * and deferred `postRemove` lifecycle events. Uses {@link module:core/js/wait}
   * to ensure removal completes before the next queued operation.
   * @returns {ContentObjectView} This view instance
   */
  remove() {
    const type = this.constructor.type;
    this.preRemove();
    Adapt.trigger(`${type}View:remove contentObjectView:remove view:remove`, this);
    this.trigger('remove');
    this._isRemoved = true;

    wait.for(end => {
      if (this.isJSX) {
        ReactDOM.unmountComponentAtNode(this.el);
      }
      this.$el.off('onscreen.adaptView');
      this.findDescendantViews().reverse().forEach(view => {
        view.remove();
      });
      this.setChildViews(null);
      super.remove();
      _.defer(() => {
        Adapt.trigger(`${type}View:postRemove contentObjectView:postRemove view:postRemove`, this);
        this.trigger('postRemove');
      });
      end();
    });

    return this;
  }

  destroy() {
    this.remove();
    if (Adapt.parentView === this) {
      Adapt.parentView = null;
    }
  }

}
