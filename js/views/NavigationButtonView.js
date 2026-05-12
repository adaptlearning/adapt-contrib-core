/**
 * @file Navigation Button View - Renders a single navigation bar button
 * @module core/js/views/NavigationButtonView
 * @description Supports three rendering modes: standard Handlebars, JSX (React), and
 * injected (an existing DOM element promoted to a managed view). Handles navigation
 * events for built-in actions (back, home, parent, skip, return-to-start) and
 * delegates custom events to `Adapt.trigger`.
 */
import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import { compile, templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';
import router from 'core/js/router';
import startController from 'core/js/startController';
import a11y from 'core/js/a11y';
import location from 'core/js/location';

/**
 * @class NavigationButtonView
 * @classdesc Backbone view for one button in the navigation bar. Managed by
 * {@link module:core/js/views/navigationView NavigationView}.
 */
export default class NavigationButtonView extends Backbone.View {

  tagName() {
    return 'button';
  }

  events() {
    return {
      click: 'triggerEvent'
    };
  }

  className() {
    if (this.isInjectedButton) {
      return [
        this.model.get('_showLabel') === false && 'hide-label'
      ].filter(Boolean).join(' ');
    }
    return [
      'btn-icon nav__btn',
      this.model.get('_classes'),
      this.model.get('_showLabel') === false && 'hide-label'
    ].filter(Boolean).join(' ');
  }

  attributes() {
    const attributes = this.model.toJSON();
    if (this.isInjectedButton) {
      return {
        name: attributes._id,
        'data-order': attributes._order,
        'data-event': attributes._event
      };
    }
    return {
      name: attributes._id,
      role: attributes._role === 'button' ? undefined : attributes._role,
      'aria-label': attributes.ariaLabel,
      'data-order': attributes._order,
      'data-event': attributes._event
    };
  }

  /**
   * @param {object} options - Backbone view options
   * @param {HTMLElement} [options.el] - When provided the view adopts an existing DOM
   *   element and is treated as an injected button (no framework rendering).
   */
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

  /**
   * Name of the Handlebars or JSX template used to render the button.
   * Subclasses can override this to supply a custom template.
   * A `.jsx` extension enables React rendering mode.
   * @type {string}
   */
  static get template() {
    return 'navButton.jsx';
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
    const textLabel = this.$el.find('> .nav__btn-label');
    const ariaLabel = this.$el.attr('aria-label') ?? this.$el.find('.aria-label').text();
    const text = this.model.get('text');
    const output = compile(text ?? '', { ariaLabel });
    if (!textLabel.length) {
      this.$el.append(`<span class="nav__btn-label" aria-hidden="true">${output}</span>`);
      return;
    }
    textLabel.html(output);
  }

  /**
   * Re-renders the button in response to model changes. For JSX buttons a full
   * React render is performed; for injected buttons only attributes and the
   * label text are updated; for Handlebars buttons only view properties are synced.
   * Bubbling Backbone events (names starting with `"bubble"`) are ignored.
   * @param {string|null} [eventName=null] - Backbone change event name
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
      _globals: Adapt.course?.get('_globals')
    };
    const Template = templates[this.constructor.template.replace('.jsx', '')];
    this.updateViewProperties();
    ReactDOM.render(<Template {...props} />, this.el);
  }

  /**
   * Handles button click, prevents default, and fires `navigation:<eventName>` on
   * `Adapt`. Built-in `currentEvent` values handled internally:
   * `backButton`, `homeButton`, `parentButton`, `skipNavigation`, `returnToStart`.
   * Any other value is forwarded as a plain Adapt event.
   * @param {jQuery.Event} event - The click event
   * @fires navigation:backButton
   * @fires navigation:homeButton
   * @fires navigation:parentButton
   * @fires navigation:skipNavigation
   * @fires navigation:returnToStart
   */
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
        _.delay(() => {
          a11y.focusFirst('.' + location._contentType);
        }, 250);
        break;
      case 'returnToStart':
        startController.returnToStartLocation();
        break;
    }
  }

  /**
   * Stops listening, unmounts any React component, and removes the element from
   * the DOM. Uses {@link module:core/js/wait wait} to ensure the unmount completes
   * before the element is detached.
   * @returns {this}
   */
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
