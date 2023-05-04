import ContentObjectView from 'core/js/views/contentObjectView';
import MenuItemView from 'core/js/views/menuItemView';
import logging from '../logging';

class MenuView extends ContentObjectView {

  initialize(...args) {
    super.initialize(...args);
    const immediatePageDescendents = this.model.getAllDescendantModels({
      filter: model => !model.isTypeGroup('contentobject')
    });
    if (!immediatePageDescendents.length) return;
    logging.warn('Classic menu has children which are not contentobjects, use config.json:_isPageMenu = true');
  }

}

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
