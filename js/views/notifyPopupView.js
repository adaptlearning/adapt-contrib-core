import Adapt from 'core/js/adapt';
import components from 'core/js/components';
import data from 'core/js/data';
import a11y from 'core/js/a11y';
import AdaptView from 'core/js/views/adaptView';
import Backbone from 'backbone';
import { transitionNextFrame, transitionsEnded } from '../transitions';

export default class NotifyPopupView extends Backbone.View {

  className() {
    return `notify ${this.model.get('_classes') || ''}`;
  }

  attributes() {
    return this.model.get('_attributes');
  }

  events() {
    return {
      'click .js-notify-btn-alert': 'onAlertButtonClicked',
      'click .js-notify-btn-prompt': 'onPromptButtonClicked',
      'click .js-notify-close-btn': 'onCloseButtonClicked'
    };
  }

  initialize({ notify }) {
    this.notify = notify;
    _.bindAll(this, 'onShadowClicked', 'resetNotifySize', 'onKeyUp');
    this.disableAnimation = Adapt.config.get('_disableAnimation') ?? false;
    this.$el.toggleClass('disable-animation', Boolean(this.disableAnimation));
    this.isOpen = false;
    this.hasOpened = false;
    this.setupEventListeners();
    this.render();
    const dialog = this.$('.notify__popup')[0];
    dialog.addEventListener('click', this.onShadowClicked, { capture: true });
  }

  setupEventListeners() {
    this.listenTo(Adapt, {
      remove: this.closeNotify,
      'notify:resize device:resize': this.resetNotifySize,
      'notify:cancel': this.cancelNotify,
      'notify:close': this.closeNotify
    });
    this.setupEscapeKey();
  }

  setupEscapeKey() {
    $(window).on('keyup', this.onKeyUp);
  }

  onKeyUp(event) {
    if (event.which !== 27) return;
    event.preventDefault();
    this.cancelNotify();
  }

  render() {
    const data = this.model.toJSON();
    const template = Handlebars.templates.notifyPopup;
    this.$el.html(template(data)).appendTo('.notify__popup-container');
    this.showNotify();
    return this;
  }

  onAlertButtonClicked(event) {
    event.preventDefault();
    // tab index preservation, notify must close before subsequent callback is triggered
    this.closeNotify();
    Adapt.trigger(this.model.get('_callbackEvent'), this);
  }

  onPromptButtonClicked(event) {
    event.preventDefault();
    // tab index preservation, notify must close before subsequent callback is triggered
    this.closeNotify();
    Adapt.trigger($(event.currentTarget).attr('data-event'), this);
  }

  onCloseButtonClicked(event) {
    event.preventDefault();
    // tab index preservation, notify must close before subsequent callback is triggered
    this.cancelNotify();
  }

  onShadowClicked(event) {
    const dialog = this.$('.notify__popup')[0];
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
    if (isInDialog) return;
    event.preventDefault();
    if (this.model.get('_closeOnShadowClick') === false) return;
    this.cancelNotify();
  }

  cancelNotify() {
    if (this.model.get('_isCancellable') === false) return;
    // tab index preservation, notify must close before subsequent callback is triggered
    this.closeNotify();
    Adapt.trigger('notify:cancelled', this);
  }

  resetNotifySize() {
    if (!this.hasOpened) return;
    this.resizeNotify();
  }

  resizeNotify() {
    const windowHeight = $(window).height();
    const notifyHeight = this.$('.notify__popup-inner').outerHeight();
    const isFullWindow = (notifyHeight >= windowHeight);
    this.$('.notify__popup').css({
      height: isFullWindow ? '100%' : notifyHeight,
      'overflow-y': isFullWindow ? 'scroll' : '',
      '-webkit-overflow-scrolling': isFullWindow ? 'touch' : ''
    });
  }

  async showNotify() {
    this.isOpen = true;
    await this.addSubView();
    // Add to the list of open popups
    this.notify.stack.push(this);
    // Keep focus from previous action
    this.$previousActiveElement = $(document.activeElement);
    Adapt.trigger('notify:opened', this);
    this.$el.imageready(this.onLoaded.bind(this));
  }

  async onLoaded() {
    this.hasOpened = true;
    // Allows popup manager to control focus
    a11y.popupOpened(this.$('.notify__popup'));
    a11y.scrollDisable('body');
    $('html').addClass('notify');

    this.$el.addClass('anim-open-before');
    await transitionNextFrame();
    this.resetNotifySize();
    await transitionNextFrame();
    this.$el.addClass('anim-open-after');
    await transitionsEnded(this.$('.notify__popup, .notify__shadow'));
  }

  async addSubView() {
    this.subView = this.model.get('_view');
    if (this.model.get('_shouldRenderId') && this.model.get('_id')) {
      // Automatically render the specified id
      const model = data.findById(this.model.get('_id'));
      const View = components.getViewClass(model);
      this.subView = new View({ model });
    }
    if (!this.subView) return;
    this.subView.$el.on('resize', this.resetNotifySize);
    this.$('.notify__content-inner').append(this.subView.$el);
    if (!(this.subView instanceof AdaptView) || this.subView.model.get('_isReady')) return;
    // Wait for the AdaptView subview to be ready
    return new Promise(resolve => {
      const check = (model, value) => {
        if (!value) return;
        this.subView.model.off('change:_isReady', check);
        resolve();
      };
      this.subView.model.on('change:_isReady', check);
    });
  }

  closeNotify() {
    // Make sure that only the top most notify is closed
    const stackItem = this.notify.stack[this.notify.stack.length - 1];
    if (this !== stackItem) return;
    this.notify.stack.pop();
    // Prevent from being invoked multiple times - see https://github.com/adaptlearning/adapt_framework/issues/1659
    if (!this.isOpen) return;
    this.isOpen = false;
    // If closeNotify is called before showNotify has finished then wait
    // until it's open.
    if (this.hasOpened) {
      this.onCloseReady();
      return;
    }
    this.listenToOnce(Adapt, 'popup:opened', () => {
      // Wait for popup:opened to finish processing
      _.defer(this.onCloseReady.bind(this));
    });
  }

  async onCloseReady() {
    this.$el.addClass('anim-close-before');
    await transitionNextFrame();
    this.$el.addClass('anim-close-after');
    await transitionsEnded(this.$('.notify__popup, .notify__shadow'));

    this.remove();

    a11y.scrollEnable('body');
    $('html').removeClass('notify');
    // Return focus to previous active element
    a11y.popupClosed(this.$previousActiveElement);
    // Return reference to the notify view
    Adapt.trigger('notify:closed', this);
  }

  remove(...args) {
    this.removeSubView();
    $(window).off('keyup', this.onKeyUp);
    super.remove(...args);
  }

  removeSubView() {
    if (!this.subView) return;
    this.subView.$el.off('resize', this.resetNotifySize);
    if (this.subView instanceof AdaptView) {
      // Clear up nested views and models
      const views = [...this.subView.findDescendantViews(), this.subView];
      views.forEach(view => {
        view.model.set('_isReady', false);
        view.remove();
      });
    } else {
      this.subView.remove();
    }
    this.subView = null;
  }

}
