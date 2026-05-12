/**
 * @file Menu View - Renders a menu-type content object
 * @module core/js/views/menuView
 * @description Extends {@link module:core/js/views/contentObjectView~ContentObjectView}
 * for menu content objects. Renders child content objects as
 * {@link module:core/js/views/menuItemView~MenuItemView} instances inside
 * `.js-children`. The child view class is currently fixed; making it configurable
 * is a planned improvement.
 */
import ContentObjectView from 'core/js/views/contentObjectView';
import MenuItemView from 'core/js/views/menuItemView';

/**
 * @class MenuView
 * @classdesc View for menu-type content objects. Displays child content objects
 * (pages or nested menus) as a list of {@link module:core/js/views/menuItemView~MenuItemView}
 * cards inside `.js-children`. All ready-state and lifecycle handling is inherited
 * from {@link module:core/js/views/contentObjectView~ContentObjectView}.
 * @extends ContentObjectView
 */
class MenuView extends ContentObjectView {}

Object.assign(MenuView, {
  /**
   * TODO:
   * child view here should not be fixed to the MenuItemView
   * menus may currently rely on this
   */
  childContainer: '.js-children',
  childView: MenuItemView,
  type: 'menu',
  template: 'menu'
});

export default MenuView;
