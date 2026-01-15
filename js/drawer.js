/**
 * @file Drawer Service - Sidebar navigation system with menu items and custom views
 * @module core/js/drawer
 * @description Singleton service managing the drawer sidebar navigation system. Provides API
 * for registering menu items and displaying custom views. Handles drawer lifecycle, state management,
 * and integration with navigation toolbar.
 *
 * **Architecture:**
 * - Singleton controller (exported as instance)
 * - Manages {@link DrawerCollection} of menu items (sorted by drawerOrder)
 * - Creates/destroys {@link DrawerView} on language change
 * - Two operational modes: menu list or custom view
 *
 * **Public Events Triggered:**
 * - `drawer:opened` - Drawer opened (any mode)
 * - `drawer:openedItemView` - Menu mode shown
 * - `drawer:openedCustomView` - Custom view shown
 * - `drawer:closed` - Drawer closed
 * - `drawer:empty` - Drawer content cleared
 * - `drawer:noItems` - No menu items registered
 *
 * **Usage Pattern:**
 * ```javascript
 * // Register menu item
 * drawer.addItem({
 *   title: 'Resources',
 *   description: 'View course resources',
 *   className: 'resources-drawer-item',
 *   drawerOrder: 10
 * }, 'resources:showDrawer');
 *
 * // Listen for callback
 * Adapt.on('resources:showDrawer', () => {
 *   drawer.openCustomView(new ResourcesView());
 * });
 * ```
 *
 * **Known Issues & Improvements:**
 * - **Issue:** DrawerCollection is module-scoped but not accessible via API
 * - **Issue:** No way to update existing item without remove/add
 * - **Issue:** No validation of drawerObject structure
 * - **Enhancement:** Add `updateItem(eventCallback, drawerObject)` method
 * - **Enhancement:** Add `getItem(eventCallback)` to retrieve item data
 * - **Enhancement:** Add `getAllItems()` to get current menu items
 */

import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import DrawerView from 'core/js/views/drawerView';
import tooltips from './tooltips';

const DrawerCollection = new Backbone.Collection(null, { comparator: 'drawerOrder' });

/**
 * @class Drawer
 * @classdesc Singleton service for drawer navigation system. Only one instance exists per course.
 * @extends {Backbone.Controller}
 */
class Drawer extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart,
      'app:languageChanged': this.onLanguageChanged,
      'navigation:toggleDrawer': this.toggle,
      'router:navigate': this.close
    });
  }

  onAdaptStart() {
    this._drawerView = new DrawerView({ collection: DrawerCollection });
    this._drawerView.$el.insertAfter('#shadow');
  }

  onLanguageChanged() {
    tooltips.register({
      _id: 'drawer',
      ...Adapt.course.get('_globals')?._extensions?._drawer?._navTooltip || {}
    });
    this.remove();
  }

  /**
   * Toggles drawer open/closed based on current state.
   * Convenience method for open/close logic.
   * @example
   * Adapt.trigger('navigation:toggleDrawer');
   *
   * drawer.toggle();
   */
  toggle() {
    (this.isOpen) ? this.close() : this.open();
  }

  /**
   * Checks if drawer is currently open in menu mode.
   * Returns false if drawer is showing custom view or closed.
   * @returns {boolean} True if drawer is visible in menu mode
   * @example
   * if (drawer.isOpen) {
   *   console.log('Menu is showing');
   * }
   */
  get isOpen() {
    return this._drawerView?.isOpen ?? false;
  }

  /**
   * Opens drawer in menu mode showing list of registered items.
   * If only one item registered, automatically triggers its callback.
   * @fires drawer:opened
   * @fires drawer:openedItemView
   * @example
   * drawer.open();
   */
  open() {
    this._drawerView?.showDrawer(true);
  }

  /**
   * Opens drawer with custom view content.
   * Called by plugins in response to menu item click.
   * @param {Backbone.View|jQuery|HTMLElement|string} view - View instance or HTML content to display
   * @param {boolean} [hasBackButton=true] - Show back button to return to menu
   * @param {string} [position] - Override drawer position ('left'|'right', null uses global config)
   * @fires drawer:opened
   * @fires drawer:openedCustomView
   * @fires drawer:empty
   * @example
   * Adapt.on('resources:showDrawer', () => {
   *   const resourcesView = new ResourcesView();
   *   drawer.openCustomView(resourcesView, true, 'right');
   * });
   *
   * drawer.openCustomView('<div>Simple HTML</div>', false);
   */
  openCustomView(view, hasBackButton, position) {
    this._drawerView?.openCustomView(view, hasBackButton, position);
  }

  /**
   * Registers a menu item in the drawer.
   * Replaces existing item with same eventCallback.
   * @param {Object} drawerObject - Menu item configuration
   * @param {string} drawerObject.title - Display title
   * @param {string} drawerObject.description - Description text
   * @param {string} [drawerObject.className] - CSS class for styling
   * @param {number} [drawerObject.drawerOrder=0] - Sort order (lower numbers first)
   * @param {string} eventCallback - Event name to trigger when clicked
   * @example
   * drawer.addItem({
   *   title: 'Resources',
   *   description: 'View downloadable resources',
   *   className: 'resources-item',
   *   drawerOrder: 20
   * }, 'resources:showDrawer');
   *
   * Adapt.on('resources:showDrawer', () => {
   *   drawer.openCustomView(new ResourcesView());
   * });
   */
  addItem(drawerObject, eventCallback) {
    if (this.hasItem(eventCallback)) {
      DrawerCollection.remove(DrawerCollection.find(item => item.eventCallback === eventCallback));
    }
    drawerObject.eventCallback = eventCallback;
    DrawerCollection.add(drawerObject);
  }

  /**
   * Checks if menu item is registered.
   * @param {string} eventCallback - Event callback to check
   * @returns {boolean} True if item exists
   * @example
   * if (!drawer.hasItem('resources:showDrawer')) {
   *   drawer.addItem({ title: 'Resources' }, 'resources:showDrawer');
   * }
   */
  hasItem(eventCallback) {
    return Boolean(DrawerCollection.find(item => item.eventCallback === eventCallback));
  }

  /**
   * Closes the drawer immediately.
   * Called automatically on navigation.
   * @param {jQuery} [$toElement=null] - Element to focus after closing
   * @fires drawer:closed
   * @example
   * drawer.close();
   *
   * drawer.close($('.js-nav-home-btn'));
   */
  close($toElement = null) {
    this._drawerView?.hideDrawer($toElement, { force: true });
  }

  /**
   * Destroys the drawer view and cleans up.
   * Called automatically on language change.
   * @fires drawer:empty
   * @example
   * drawer.remove();
   */
  remove() {
    this._drawerView?.remove();
    this._drawerView = null;
  }

}

export default new Drawer();
