import LockingModel from 'core/js/models/lockingModel';
import { toggleModelClass } from '../modelHelpers';

export default class ItemModel extends LockingModel {

  defaults() {
    return {
      _classes: '',
      _isActive: false,
      _isVisited: false,
      _score: 0
    };
  }

  /**
   * Toggle a className in the _classes attribute
   * @param className {string} Name or names of class to add/remove to _classes attribute, space separated list
   * @param hasClass {boolean} true to add a class, false to remove
   */
  toggleClass(className, hasClass) {
    toggleModelClass(this, className, hasClass);
    return this;
  }

  reset() {
    this.set({ _isActive: false, _isVisited: false });
  }

  toggleActive(isActive = !this.get('_isActive')) {
    this.set('_isActive', Boolean(isActive));
  }

  toggleVisited(isVisited = !this.get('_isVisited')) {
    this.set('_isVisited', Boolean(isVisited));
  }

}
