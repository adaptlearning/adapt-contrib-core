/**
 * @file Drawer Service - Sidebar with drawer items and custom views
 * @module core/js/drawer
 * @description Singleton service managing the drawer sidebar. Provides API
 * for registering drawer items and displaying custom views. Handles drawer lifecycle, state management,
 * and integration with toolbar.
 *
 * **Architecture:**
 * - Singleton controller (exported as instance)
 * - Manages {@link DrawerCollection} of drawer items (sorted by drawerOrder)
 * - Creates/destroys {@link DrawerView} on language change
 * - Two operational modes: drawer list or custom view
 *
 * **Public Events Triggered:**
 * - `drawer:opened` - Drawer opened (any mode)
 * - `drawer:openedItemView` - Drawer shown
 * - `drawer:openedCustomView` - Custom view shown
 * - `drawer:closed` - Drawer closed
 * - `drawer:empty` - Drawer content cleared
 * - `drawer:noItems` - No drawer items registered
 *
 * @example
 * import drawer from 'core/js/drawer';
 *
 * // Register drawer item
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
 */

import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import DrawerView from 'core/js/views/drawerView';
import tooltips from './tooltips';

const DrawerCollection = new Backbone.Collection(null, { comparator: 'drawerOrder' });

/**
 * @typedef {Object} DrawerItemConfig
 * @property {string} title - Display title for the drawer item
 * @property {string} description - Description text shown below title
 * @property {string} [className] - CSS class name for custom styling
 * @property {number} [drawerOrder=0] - Sort order (lower numbers appear first)
 */

/**
 * @class Drawer
 * @classdesc Singleton service managing the drawer sidebar. The drawer is a vertical
 * sidebar that displays registered drawer items (plugin launcher buttons). Clicking
 * a drawer item switches the sidebar from list view to the plugin's custom view.
 * Custom views include a back button to return to the drawer item list. Manages
 * item registration, view lifecycle, and mode switching between list and custom views.
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
   * @example
   * drawer.toggle();
   */
  toggle() {
    (this.isOpen) ? this.close() : this.open();
  }

  /**
   * Checks if drawer is currently open showing drawer.
   * Returns false if drawer is showing custom view or closed.
   * @returns {boolean} True if drawer is visible showing drawer
   * @example
   * if (drawer.isOpen) {
   *   return;
   * }
   */
  get isOpen() {
    return this._drawerView?.isOpen ?? false;
  }

  /**
   * Opens drawer showing registered drawer items.
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
   * Called by plugins in response to drawer item click.
   * @param {Backbone.View|jQuery|HTMLElement|string} view - View instance or HTML content to display
   * @param {boolean} [hasBackButton=true] - Show back button to return to drawer list
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
   * // Or use simple HTML
   * drawer.openCustomView('<div>Simple HTML</div>', false);
   */
  openCustomView(view, hasBackButton, position) {
    this._drawerView?.openCustomView(view, hasBackButton, position);
  }

  /**
   * Registers a drawer item.
   * Replaces existing item with same eventCallback.
   * @param {DrawerItemConfig} drawerObject - Drawer item configuration
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
   * Checks if drawer item is registered.
   * @param {string} eventCallback - Event callback to check
   * @returns {boolean} True if item exists
   * @example
   * if (!drawer.hasItem('resources:showDrawer')) {
   *   drawer.addItem({
   *     title: 'Resources',
   *     drawerOrder: 10
   *   }, 'resources:showDrawer');
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
   * // Close and focus specific element
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
