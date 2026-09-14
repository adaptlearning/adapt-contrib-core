/**
 * @file Menu Model - Menu content object data model
 * @module core/js/models/menuModel
 * @description Defines {@link module:core/js/models/menuModel~MenuModel} and
 * registers it as the 'menu' content type.
 */

import components from 'core/js/components';
import logging from 'core/js/logging';
import ContentObjectModel from 'core/js/models/contentObjectModel';

/**
 * @class MenuModel
 * @classdesc Data model for a menu content object. Menus are container nodes in the
 * content object hierarchy that hold other content objects (pages or nested menus).
 * Applies lock state to children based on the configured locking strategy.
 * @extends ContentObjectModel
 */
class MenuModel extends ContentObjectModel {

  get _children() {
    logging.deprecated('menuModel._children, use menuModel.hasManagedChildren instead, child models are defined by the JSON');
    return 'contentObjects';
  }

  /**
   * Returns a string of the model type group.
   * @returns {string}
   */
  getTypeGroup() {
    return 'menu';
  }

  /**
   * Applies lock state to each available child model using the configured locking strategy.
   * Calls `checkLocking()` on any child that is itself a
   * {@link module:core/js/models/menuModel~MenuModel}, so nested menus re-evaluate their
   * own children in turn.
   */
  setCustomLocking() {
    const children = this.getAvailableChildModels();
    children.forEach(child => {
      child.set('_isLocked', this.shouldLock(child), { pluginName: 'adapt' });
      if (!(child instanceof MenuModel)) return;
      child.checkLocking();
    });
  }

}

components.register('menu', { model: MenuModel });

export default MenuModel;
