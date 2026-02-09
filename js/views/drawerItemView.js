/**
 * @file Drawer Item View - Individual drawer item
 * @module core/js/views/drawerItemView
 * @description Renders individual drawer items in the drawer.
 * Created by {@link DrawerView} for each model in collection. Handles click events
 * and triggers registered callback. Use {@link module:core/js/drawer#addItem}
 * to register drawer items.
 */

import Adapt from 'core/js/adapt';

/**
 * @class DrawerItemView
 * @classdesc Renders single drawer item button with title and description.
 * @extends {Backbone.View}
 */
class DrawerItemView extends Backbone.View {

  className() {
    return 'drawer__menu drawer__item';
  }

  attributes() {
    return {
      role: 'listitem'
    };
  }

  initialize() {
    this.listenTo(Adapt, 'drawer:empty', this.remove);
    this.render();
  }

  events() {
    return {
      'click .drawer__item-btn': 'onDrawerItemClicked'
    };
  }

  /**
   * Renders drawer item button and appends to drawer holder.
   * @returns {DrawerItemView} This view instance for chaining
   */
  render() {
    const data = this.model.toJSON();
    const template = Handlebars.templates.drawerItem;
    $(this.el).html(template(data)).appendTo('.drawer__holder');
    return this;
  }

  /**
   * Handles drawer item click.
   * Triggers the callback event registered with this item.
   * @param {jQuery.Event} event - Click event
   * @example
   * // Click event automatically triggers the registered callback
   * // Model must have eventCallback property
   * const model = new Backbone.Model({
   *   eventCallback: 'resources:show',
   *   title: 'Resources'
   * });
   * const view = new DrawerItemView({ model });
   * // User click triggers: Adapt.trigger('resources:show')
   */
  onDrawerItemClicked(event) {
    event.preventDefault();
    const eventCallback = this.model.get('eventCallback');
    Adapt.trigger(eventCallback);
  }

}

DrawerItemView.type = 'drawerItem';

export default DrawerItemView;
