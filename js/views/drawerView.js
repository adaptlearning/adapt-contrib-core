import Adapt from 'core/js/adapt';
import a11y from 'core/js/a11y';
import DrawerItemView from 'core/js/views/drawerItemView';
import Backbone from 'backbone';

class DrawerView extends Backbone.View {

  className() {
    return [
      'drawer',
      'u-display-none'
    ].filter(Boolean).join(' ');
  }

  attributes() {
    return {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'drawer-heading',
      'aria-hidden': 'true',
      'aria-expanded': 'false'
    };
  }

  events() {
    return {
      'click .drawer__back': 'onBackButtonClicked',
      'click .drawer__close': 'onCloseClicked'
    };
  }

  initialize() {
    this._isVisible = false;
    this.disableAnimation = Adapt.config.has('_disableAnimation') ? Adapt.config.get('_disableAnimation') : false;
    this._globalDrawerPosition = Adapt.config.get('_drawer')?._position ?? 'auto';
    this.drawerDuration = Adapt.config.get('_drawer')?._duration ?? 400;
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.onKeyUp = this.onKeyUp.bind(this);
    $(window).on('keyup', this.onKeyUp);
  }

  onKeyUp(event) {
    if (event.which !== 27) return;
    event.preventDefault();
    this.hideDrawer();
  }

  render() {
    const template = Handlebars.templates.drawer;
    $(this.el).html(template({ _globals: Adapt.course.get('_globals') })).prependTo('body');
    const shadowTemplate = Handlebars.templates.shadow;
    $(shadowTemplate()).prependTo('body');
    _.defer(this.postRender.bind(this));
    return this;
  }

  postRender() {
    this.$('a, button, input, select, textarea').attr('tabindex', -1);

    this.checkIfDrawerIsAvailable();
  }

  setDrawerPosition(position) {
    if (this._useMenuPosition) position = null;
    const isGlobalPositionAuto = this._globalDrawerPosition === 'auto';
    const isRTL = Adapt.config.get('_defaultDirection') === 'rtl';
    if (position && isGlobalPositionAuto && isRTL) position = (position === 'left') ? 'right' : 'left';
    if (!isGlobalPositionAuto || !position) position = this._globalDrawerPosition;
    this.$el
      .removeClass(`is-position-${this.drawerPosition}`)
      .addClass(`is-position-${position}`);
    this.drawerPosition = position;
    this.drawerAnimationDir = (position === 'auto') ? (isRTL ? 'left' : 'right') : position;
  }

  openCustomView(view, hasBackButton = true, position) {
    this.$('.js-drawer-holder').removeAttr('role');
    this._hasBackButton = hasBackButton;
    this._isCustomViewVisible = true;
    this._customView = view;
    Adapt.trigger('drawer:empty');
    this.showDrawer(null, position);
    this.$('.drawer__holder').html(view instanceof Backbone.View ? view.$el : view);
  }

  checkIfDrawerIsAvailable() {
    const isEmptyDrawer = (this.collection.length === 0);
    $('.js-nav-drawer-btn').toggleClass('u-display-none', isEmptyDrawer);
    if (isEmptyDrawer) {
      Adapt.trigger('drawer:noItems');
    }
  }

  onBackButtonClicked(event) {
    event.preventDefault();
    this.showDrawer(true);
  }

  onCloseClicked(event) {
    event.preventDefault();
    this.hideDrawer();
  }

  get isOpen() {
    return (this._isVisible && this._isCustomViewVisible === false);
  }

  showDrawer(emptyDrawer, position = null) {
    this.setDrawerPosition(position);
    this.$el
      .removeClass('u-display-none')
      .attr('aria-hidden', 'false')
      .attr('aria-expanded', 'true');
    // Only trigger popup:opened if drawer is visible, pass popup manager drawer element
    if (!this._isVisible) {
      a11y.popupOpened(this.$el);
      a11y.scrollDisable('body');
      this._isVisible = true;
    }

    // Sets tab index to 0 for all tabbable elements in Drawer
    this.$('a, button, input, select, textarea').attr('tabindex', 0);

    if (emptyDrawer) {
      this.$('.drawer__back').addClass('u-display-none');
      this._isCustomViewVisible = false;
      this.emptyDrawer();
      if (this.collection.models.length === 1) {
        // This callback triggers openCustomView() and sets
        // _isCustomViewVisible to true, causing toggleDrawer()
        // to re-render the drawer on every toggle button press
        Adapt.trigger(this.collection.models[0].get('eventCallback'));
        // Set _isCustomViewVisible to false to prevent re-rendering
        // the drawer and fix the toggle functionality on toggle button press
        this._isCustomViewVisible = false;
      } else {
        this._useMenuPosition = true;
        this.renderItems();
        Adapt.trigger('drawer:openedItemView');
      }
    } else {
      const hideDrawerBackButton = (!this._hasBackButton || this.collection.models.length <= 1);
      this.$('.drawer__back').toggleClass('u-display-none', hideDrawerBackButton);
      Adapt.trigger('drawer:openedCustomView');
    }

    $('.js-shadow').removeClass('u-display-none');
    $('.js-drawer-holder').scrollTop(0);
    const direction = {};
    direction[this.drawerAnimationDir] = 0;

    const complete = () => {
      this.addShadowEvent();
      $('.js-nav-drawer-btn').attr('aria-expanded', true);
      Adapt.trigger('drawer:opened');
      // focus on first tabbable element in drawer
      a11y.focusFirst(this.$el, { defer: true });
    };

    // delay drawer animation until after background fadeout animation is complete
    if (this.disableAnimation) {
      this.$el.css(direction);
      complete();
    } else {
      const easing = Adapt.config.get('_drawer')?._showEasing || 'easeOutQuart';
      this.$el.velocity(direction, this.drawerDuration, easing);

      $('.js-shadow').velocity({ opacity: 1 }, {
        duration: this.drawerDuration,
        begin: () => {
          complete();
        }
      });
    }
  }

  emptyDrawer() {
    this.$('.drawer__holder').empty();
  }

  renderItems() {
    Adapt.trigger('drawer:empty');
    this.emptyDrawer();
    const isList = (this.collection.length > 1);
    if (isList) this.$('.js-drawer-holder').attr('role', 'list');
    else this.$('.js-drawer-holder').removeAttr('role');
    this.collection.forEach(model => new DrawerItemView({ model }));
  }

  hideDrawer($toElement) {
    if (!this._isVisible) return;
    this._useMenuPosition = false;
    const direction = {};
    a11y.popupClosed($toElement);
    this._isVisible = false;
    a11y.scrollEnable('body');
    direction[this.drawerAnimationDir] = -this.$el.width();

    const complete = () => {
      this.$el
        .removeAttr('style')
        .addClass('u-display-none')
        .attr('aria-hidden', 'true')
        .attr('aria-expanded', 'false');
      this.$('.js-drawer-holder').removeAttr('role');
      this._customView = null;
      $('.js-nav-drawer-btn').attr('aria-expanded', false);
      Adapt.trigger('drawer:closed');
      this.setDrawerPosition(this._globalDrawerPosition);
    };

    if (this.disableAnimation) {
      this.$el.css(direction);
      $('.js-shadow').addClass('u-display-none');
      complete();
    } else {
      const easing = Adapt.config.get('_drawer')?._hideEasing || 'easeInQuart';
      this.$el.velocity(direction, this.drawerDuration, easing, () => {
        complete();
      });

      $('.js-shadow').velocity({ opacity: 0 }, {
        duration: this.drawerDuration,
        complete() {
          $('.js-shadow').addClass('u-display-none');
        }
      });
    }

    this._isCustomViewVisible = false;
    this.removeShadowEvent();
  }

  addShadowEvent() {
    $('.js-shadow').one('click touchstart', () => this.hideDrawer());
  }

  removeShadowEvent() {
    $('.js-shadow').off('click touchstart');
  }

  remove() {
    this.hideDrawer();
    super.remove();
    $(window).off('keyup', this.onKeyUp);
    Adapt.trigger('drawer:empty');
    this.collection.reset();
    $('.js-shadow').remove();
  }

}

Object.assign(DrawerView, {
  childContainer: '.js-drawer-holder',
  childView: DrawerItemView
});

export default DrawerView;
