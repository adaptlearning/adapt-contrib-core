import Adapt from 'core/js/adapt';
import device from 'core/js/device';
import tooltips from '../tooltips';
import _ from 'underscore';
import NavigationButtonView from './NavigationButtonView';
import NavigationButtonModel from '../models/NavigationButtonModel';

class NavigationView extends Backbone.View {

  className() {
    return [
      'nav',
      this.model?.get('_showLabel') === true ? 'show-label' : 'hide-label',
      `show-label-${this.model?.get('_showLabelAtWidth') || 'medium'}`,
      `has-label-${this.model?.get('_labelPosition') || 'auto'}`
    ].filter(Boolean).join(' ');
  }

  attributes() {
    return {
      role: 'navigation'
    };
  }

  get buttons() {
    return (this._buttons = this._buttons || []);
  }

  set buttons(value) {
    this._buttons = value;
  }

  initialize() {
    _.bindAll(this, 'sortNavigationButtons');
    this._classSet = new Set(_.result(this, 'className').trim().split(/\s+/));
  }

  start(model) {
    tooltips.register({
      _id: 'back',
      ...Adapt.course.get('_globals')?._extensions?._navigation?._backNavTooltip || {}
    });
    this.model = model;
    this.listenTo(model, 'change', this.update);
    this.listenToOnce(Adapt, 'courseModel:dataLoading', this.remove);
    this.listenTo(Adapt, {
      'router:contentObject': this.hideNavigationButton,
      'adapt:preInitialize device:resize': this.onDeviceResize
    });
    this.update();
    this.preRender();
  }

  update() {
    this.updateViewProperties();
    this.onDeviceResize();
  }

  onDeviceResize() {
    let {
      _navigationAlignment = 'top',
      _isBottomOnTouchDevices = false
    } = this.model.toJSON();
    const $html = $('html');
    const isBottomOnTouchDevices = (device.touch && _isBottomOnTouchDevices);
    if (isBottomOnTouchDevices) _navigationAlignment = 'bottom';
    $html
      .removeClass('is-nav-top is-nav-bottom')
      .addClass('is-nav-' + _navigationAlignment);
  }

  preRender() {
    Adapt.trigger('navigationView:preRender', this);
    this.render();
  }

  render() {
    const template = Handlebars.templates[this.constructor.template];
    this.$el.html(template({
      _config: Adapt.config.toJSON(),
      _globals: Adapt.course.get('_globals'),
      _accessibility: Adapt.config.get('_accessibility')
    })).insertBefore('#app');
    this.sortNavigationButtons();
    _.defer(() => {
      Adapt.trigger('navigationView:postRender navigation:ready', this);
    });
    return this;
  }

  updateViewProperties() {
    const classesToAdd = _.result(this, 'className').trim().split(/\s+/);
    classesToAdd.forEach(i => this._classSet.add(i));
    const classesToRemove = [ ...this._classSet ].filter(i => !classesToAdd.includes(i));
    classesToRemove.forEach(i => this._classSet.delete(i));
    this._setAttributes({ ..._.result(this, 'attributes'), id: _.result(this, 'id') });
    this.$el.removeClass(classesToRemove).addClass(classesToAdd);
  }

  listenForInjectedButtons() {
    this.observer = this.observer || new MutationObserver(this.sortNavigationButtons);
    this.observer.observe(this.$('.nav__inner')[0], {
      childList: true,
      attributes: true,
      subtree: true
    });
  }

  sortNavigationButtons(changed) {
    if (Array.isArray(changed)) {
      // Summarize mutation observer changes
      const changes = Object.entries(changed.reduce((changes, change) => {
        const changeTypeName = `${change.type}.${change.attributeName}`;
        changes[changeTypeName] = changes[changeTypeName] || 0;
        changes[changeTypeName]++;
        return changes;
      }, {}));
      // Ignore blur event changes as this will interrupt focus assignment
      const shouldIgnore = changes.every(([key]) => [
        'attributes.data-a11y-force-focus',
        'attributes.tabindex',
        'attributes.aria-hidden',
        'attributes.aria-expanded'
      ].includes(key));
      if (shouldIgnore) return;
    }
    this.observer?.disconnect();
    const $container = this.$('.nav__inner');
    const items = [...$container[0].children];
    const identifiers = {
      '.js-nav-drawer-btn': 'drawer',
      '.js-nav-back-btn': 'back',
      '.js-nav-home-btn': 'home',
      '*': null
    };
    // Capture existing children and make models and views for any which
    //  weren't registered in the api.
    items.forEach(el => {
      const $el = $(el);
      // Ignore spacers
      if ($el.is('.nav__spacer')) return;
      // Try to generate an id
      const foundId = (
        $el.attr('name') ??
        Object.entries(identifiers).find(([classes]) => $el.is(classes))?.[1]
      ) || $el.attr('class');
      const attributes = {
        _id: foundId,
        _order: parseFloat($el.attr('data-order') || 0),
        _event: $el.attr('data-event')
      };
      const existingButton = this.getButton(attributes._id);
      if (existingButton) {
        if (!existingButton.isInjectedButton) return;
        if (existingButton.el !== el) {
          // Update injected buttons with new element if necessary
          existingButton.undelegateEvents();
          existingButton.el = el;
          existingButton.$el = $(el);
          existingButton.delegateEvents();
        }
        // Attempt to render changes on inject buttons
        existingButton.model.set(attributes);
        existingButton.changed();
        return;
      };
      // Add missing buttons
      const navigationButtonModel = new NavigationButtonModel(attributes);
      this.addButton(new NavigationButtonView({
        el,
        model: navigationButtonModel
      }));
    });
    // Sort items and add to dom in sorted order
    //   Make sure not to move any item with focus as it will lose focus
    const focusElement = document.activeElement;
    items.sort((a, b) => parseFloat($(a).attr('data-order') || 0) - parseFloat($(b).attr('data-order') || 0));
    let indexOfFocused = items.findIndex(el => el === focusElement);
    if (indexOfFocused === -1) indexOfFocused = Infinity;
    const before = items.slice(0, indexOfFocused);
    const after = items.slice(indexOfFocused + 1);
    before.reverse().forEach(el => $container.prepend(el));
    after.forEach(el => $container.append(el));
    this.observer?.takeRecords();
    this.listenForInjectedButtons();
  }

  hideNavigationButton(contentObjectModel) {
    const shouldHide = (contentObjectModel.get('_type') === 'course');
    this.$('.nav__back-btn, .nav__home-btn').toggleClass('u-display-none', shouldHide);
  }

  showNavigationButton() {
    this.$('.nav__back-btn, .nav__home-btn').removeClass('u-display-none');
  }

  addButton(buttonView) {
    this.buttons.push(buttonView);
    const container = this.$('.nav__inner');
    container.append(buttonView.$el);
    this.listenTo(buttonView.model, 'change', this.sortNavigationButtons);
    // Injected button are added from sortNavigationButtons, prevent recursion
    if (buttonView.isInjectedButton) return;
    this.sortNavigationButtons();
  }

  getButton(id) {
    return this.buttons.find(button => button.model.get('_id') === id);
  }

  removeButton(buttonView) {
    this.buttons = this.buttons.filter(view => view !== buttonView);
    this.stopListening(buttonView.model, 'change', this.sortNavigationButtons);
    if (buttonView.isInjectedButton) {
      buttonView.$el.remove();
      return;
    }
    buttonView.remove();
  }

}

NavigationView.template = 'nav';

export default NavigationView;
