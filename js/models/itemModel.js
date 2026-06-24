/**
 * @file ItemModel - State model for a single interactive item within a component
 * @module core/js/models/itemModel
 * @description Represents one item (e.g. a tab, accordion panel, or answer option) within
 * an items-based component. Tracks active and visited state, and supports per-item class toggling.
 * Typically managed by {@link module:core/js/models/itemsComponentModel}.
 *
 * **Known Issues & Improvements:**
 *   - `_score` is only used when item scoring is enabled (`_hasItemScoring`); could be clearer in defaults.
 */
import LockingModel from 'core/js/models/lockingModel';
import { toggleModelClass } from '../modelHelpers';

/**
 * @class ItemModel
 * @classdesc State model for a single selectable or interactive item within an items-based component.
 * Stores `_isActive`, `_isVisited`, `_score`, and `_classes`.
 * @extends LockingModel
 */
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
   * Toggle a CSS class name on the `_classes` attribute.
   * @param {string} className - Name or space-separated names to add/remove from `_classes`
   * @param {boolean|null} [hasClass] - `true` to add, `false` to remove, `null`/`undefined` to toggle
   * @returns {ItemModel} This model, for chaining
   */
  toggleClass(className, hasClass) {
    toggleModelClass(this, className, hasClass);
    return this;
  }

  reset() {
    this.set({ _isActive: false, _isVisited: false });
  }

  /**
   * Set or toggle the `_isActive` state of this item.
   * @param {boolean} [isActive] - `true` to activate, `false` to deactivate. Defaults to the inverse of the current state.
   */
  toggleActive(isActive = !this.get('_isActive')) {
    this.set('_isActive', Boolean(isActive));
  }

  /**
   * Set or toggle the `_isVisited` state of this item.
   * @param {boolean} [isVisited] - `true` to mark visited, `false` to unmark. Defaults to the inverse of the current state.
   */
  toggleVisited(isVisited = !this.get('_isVisited')) {
    this.set('_isVisited', Boolean(isVisited));
  }

}
