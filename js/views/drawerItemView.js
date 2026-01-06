/**
 * @file Drawer Item View - Individual menu item in drawer list
 * @module core/js/views/drawerItemView
 * @description Simple view rendering individual menu items in drawer menu mode.
 * Created by {@link DrawerView} for each model in collection. Handles click events
 * and triggers registered callback.
 *
 * **Lifecycle:**
 * - Created by DrawerView.renderItems()
 * - Appends itself to `.drawer__holder`
 * - Listens for `drawer:empty` → self-removes
 * - No explicit remove() call needed
 *
 * **Model Structure Expected:**
 * ```javascript
 * {
 *   eventCallback: 'extension:openSettings',
 *   title: 'Settings',
 *   description: 'Configure course settings',
 *   className: 'settings-item',
 *   drawerOrder: 10
 * }
 * ```
 *
 * **Important:** Created internally by {@link DrawerView}. Use {@link module:core/js/drawer#addItem}
 * to register items, not direct instantiation.
 */

import Adapt from 'core/js/adapt';

/**
 * @class DrawerItemView
 * @classdesc Renders single drawer menu item button with title and description.
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

  render() {
    const data = this.model.toJSON();
    const template = Handlebars.templates.drawerItem;
    $(this.el).html(template(data)).appendTo('.drawer__holder');
    return this;
  }

  /**
   * Handles menu item click.
   * Triggers the callback event registered with this item.
   * Drawer service listens to callback and opens custom view.
   * @param {jQuery.Event} event - Click event
   * @example
   * Adapt.on('resources:showDrawer', () => {
   *   drawer.openCustomView(new ResourcesView());
   * });
   */
  onDrawerItemClicked(event) {
    event.preventDefault();
    const eventCallback = this.model.get('eventCallback');
    Adapt.trigger(eventCallback);
  }

}

DrawerItemView.type = 'drawerItem';

export default DrawerItemView;
