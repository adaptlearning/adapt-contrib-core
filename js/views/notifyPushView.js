import Adapt from 'core/js/adapt';
import {
  transitionsEnded
} from '../transitions';

export default class NotifyPushView extends Backbone.View {

  tagName() {
    return 'dialog';
  }

  className() {
    const classes = [
      'notify-push',
      this.model.get('_classes'),
      this.model.get('_type') === 'a11y-push' && 'aria-label'
    ].filter(Boolean).join(' ');
    return classes;
  }

  attributes() {
    return {
      'aria-labelledby': 'notify-push-heading',
      'aria-modal': 'false'
    };
  }

  initialize() {
    _.bindAll(this, 'onKeyDown');
    this.listenTo(Adapt, {
      'notify:pushShown notify:pushRemoved': this.updateIndexPosition,
      remove: this.remove
    });
    this.listenTo(this.model.collection, {
      remove: this.updateIndexPosition,
      'change:_index': this.updatePushPosition
    });
    this.setupEscapeKey();
    this.preRender();
    this.render();
  }

  setupEscapeKey() {
    $(window).on('keydown', this.onKeyDown);
  }

  onKeyDown(event) {
    if (event.which !== 27) return;
    const isFocusInPopup = Boolean($(document.activeElement).closest(this.$el).length);
    if (!isFocusInPopup) return;
    event.preventDefault();
    this.closePush();
  }

  events() {
    return {
      'click .js-notify-push-close-btn': 'closePush',
      'click .js-notify-push-inner': 'triggerEvent'
    };
  }

  preRender() {
    this.hasBeenRemoved = false;
  }

  render() {
    const data = this.model.toJSON();
    const template = Handlebars.templates.notifyPush;
    this.$el.html(template(data)).appendTo('.notify__push-container');

    _.defer(this.postRender.bind(this));

    return this;
  }

  postRender() {
    this.$el[0].show();
    this.$el.addClass('is-active');

    _.delay(this.closePush.bind(this), this.model.get('_timeout'));

    Adapt.trigger('notify:pushShown');
  }

  async closePush(event) {
    if (event) {
      event.preventDefault();
    }

    // Check whether this view has been removed in case called multiple times whilst closing
    if (this.hasBeenRemoved === false) {
      this.hasBeenRemoved = true;
      this.$el.removeClass('is-active');
      await transitionsEnded(this.$el);
      this.$el[0].close();
      this.model.collection.remove(this.model);
      Adapt.trigger('notify:pushRemoved', this);
      this.remove();
    }
  }

  triggerEvent(event) {
    Adapt.trigger(this.model.get('_callbackEvent'));
    this.closePush();
  }

  updateIndexPosition() {
    if (this.hasBeenRemoved) return;
    const models = this.model.collection.models;
    models.forEach((model, index) => {
      if (!model.get('_isActive')) return;
      model.set('_index', index);
      this.updatePushPosition();
    });
  }

  updatePushPosition() {
    if (this.hasBeenRemoved) {
      return;
    }

    if (typeof this.model.get('_index') !== 'undefined') {
      const elementHeight = this.$el.height();
      const offset = 20;
      const navigationHeight = $('.nav').height();
      const currentIndex = this.model.get('_index');
      let flippedIndex = (currentIndex === 0) ? 1 : 0;

      if (this.model.collection.where({ _isActive: true }).length === 1) {
        flippedIndex = 0;
      }

      const positionLowerPush = (elementHeight + offset) * flippedIndex + navigationHeight + offset;
      this.$el.css('top', positionLowerPush);
    }
  }

  remove(...args) {
    $(window).off('keydown', this.onKeyDown);
    super.remove(...args);
  }
}
