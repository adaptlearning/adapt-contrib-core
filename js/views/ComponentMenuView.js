import ComponentView from 'core/js/views/componentView';
import MenuItemView from './menuItemView';

class ComponentMenuView extends ComponentView {

  async postRender() {
    await this.addChildren();
  }

}

Object.assign(ComponentMenuView, {
  /**
   * TODO:
   * child view here should not be fixed to the MenuItemView
   * menus may currently rely on this
   */
  childContainer: '.js-children',
  childView: MenuItemView,
  type: 'component',
  template: 'menu'
});

export default ComponentMenuView;
