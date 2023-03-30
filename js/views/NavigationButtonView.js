import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import { compile, templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';
import router from 'core/js/router';
import startController from 'core/js/startController';
import a11y from 'core/js/a11y';
import location from 'core/js/location';

export default class NavigationButtonView extends Backbone.View {

  events() {
    return {
      click: 'triggerEvent'
    };
  }

  className() {
    return '';
  }

  attributes() {
    const attributes = this.model.toJSON();
    return {
      'data-order': attributes._order,
      'data-event': attributes._event
    };
  }

  initialize({ el }) {
    if (el) {
      this.isInjectedButton = true;
    } else {
      this.isJSX = (this.constructor.template || '').includes('.jsx');
    }
    this._classSet = new Set(_.result(this, 'className').trim().split(/\s+/));
    this._attributes = _.result(this, 'attributes');
    this.listenTo(this.model, 'change', this.changed);
    this.render();
  }

  static template() {
    return 'navigation-button.jsx';
  }

  render() {
    if (this.isInjectedButton) {
      this.changed();
    } else if (this.isJSX) {
      this.changed();
    } else {
      const data = this.model.toJSON();
      data.view = this;
      const template = Handlebars.templates[this.constructor.template];
      this.$el.html(template(data));
    }
    return this;
  }

  updateViewProperties() {
    const classesToAdd = _.result(this, 'className').trim().split(/\s+/);
    classesToAdd.forEach(i => this._classSet.add(i));
    const classesToRemove = [ ...this._classSet ].filter(i => !classesToAdd.includes(i));
    classesToRemove.forEach(i => this._classSet.delete(i));
    Object.keys(this._attributes).forEach(name => this.$el.removeAttr(name));
    Object.entries(_.result(this, 'attributes')).forEach(([name, value]) => this.$el.attr(name, value));
    this.$el.removeClass(classesToRemove).addClass(classesToAdd);
  }

  injectLabel() {
    const textLabel = this.$el.find('> .label');
    const ariaLabel = this.$el.attr('aria-label') ?? this.$el.find('.aria-label').text();
    const text = this.model.get('text');
    const output = compile(text ?? '', { ariaLabel });
    if (!textLabel.length) {
      this.$el.append(`<span class="label" aria-hidden="true">${output}</span>`);
      return;
    }
    textLabel.html(output);
  }

  /**
   * Re-render a react template
   * @param {string} eventName=null Backbone change event name
   */
  changed(eventName = null) {
    if (typeof eventName === 'string' && eventName.startsWith('bubble')) {
      // Ignore bubbling events as they are outside of this view's scope
      return;
    }
    if (this.isInjectedButton) {
      this.updateViewProperties();
      this.injectLabel();
      return;
    }
    if (!this.isJSX) {
      this.updateViewProperties();
      return;
    }
    const props = {
      // Add view own properties, bound functions etc
      ...this,
      // Add model json data
      ...this.model.toJSON(),
      // Add globals
      _globals: Adapt.course.get('_globals')
    };
    const Template = templates[this.constructor.template.replace('.jsx', '')];
    this.updateViewProperties();
    ReactDOM.render(<Template {...props} />, this.el);
  }

  triggerEvent(event) {
    event.preventDefault();
    const currentEvent = $(event.currentTarget).attr('data-event');
    if (!currentEvent) return;
    Adapt.trigger('navigation:' + currentEvent);
    switch (currentEvent) {
      case 'backButton':
        router.navigateToPreviousRoute();
        break;
      case 'homeButton':
        router.navigateToHomeRoute();
        break;
      case 'parentButton':
        router.navigateToParent();
        break;
      case 'skipNavigation':
        a11y.focusFirst('.' + location._contentType);
        break;
      case 'returnToStart':
        startController.returnToStartLocation();
        break;
    }
  }

  remove() {
    this._isRemoved = true;
    this.stopListening();
    wait.for(end => {
      if (this.isJSX) {
        ReactDOM.unmountComponentAtNode(this.el);
      }
      super.remove();
      end();
    });
    return this;
  }

}
