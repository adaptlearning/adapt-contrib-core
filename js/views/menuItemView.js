/**
 * @file Menu Item View - Renders a single menu item within a parent menu
 * @module core/js/views/menuItemView
 * @description Renders a menu item card representing a child content object
 * (page or nested menu) inside a parent menu. Checks completion and interaction
 * completion status before rendering, and signals ready only after all images
 * within the item have loaded.
 */
import AdaptView from 'core/js/views/adaptView';

/**
 * @class MenuItemView
 * @classdesc Renders a clickable menu item card for a child content object. Applies
 * state CSS classes for visited, complete, locked, and optional states. Defers the
 * ready signal until all embedded images have loaded via `imageready`.
 * @extends AdaptView
 */
class MenuItemView extends AdaptView {

  attributes() {
    return AdaptView.resultExtend('attributes', {
      role: 'listitem',
      'aria-labelledby': this.model.get('_id') + '-heading'
    }, this);
  }

  className() {
    return [
      'menu-item',
      this.constructor.className,
      this.model.get('_id'),
      this.model.get('_classes'),
      this.setVisibility(),
      this.setHidden(),
      (this.model.get('_isVisited') ? 'is-visited' : ''),
      (this.model.get('_isComplete') ? 'is-complete' : ''),
      (this.model.get('_isLocked') ? 'is-locked' : ''),
      (this.model.get('_isOptional') ? 'is-optional' : '')
    ].join(' ');
  }

  preRender() {
    this.model.checkCompletionStatus();
    this.model.checkInteractionCompletionStatus();
  }

  postRender() {
    this.$el.imageready(this.setReadyStatus.bind(this));
  }

}

MenuItemView.type = 'menuItem';

export default MenuItemView;
