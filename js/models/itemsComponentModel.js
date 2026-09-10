/**
 * @file ItemsComponentModel - Base model for components backed by an item collection
 * @module core/js/models/itemsComponentModel
 * @description Extends ComponentModel to manage a Backbone.Collection of
 * {@link module:core/js/models/itemModel|ItemModel} children. Provides item lookup,
 * active/visited state management, user-answer persistence, and completion tracking.
 * Used as a base class by tab, accordion, and carousel-style components.
 *
 * **Known Issues & Improvements:**
 *   - `Backbone` is referenced as a global rather than imported, which may cause issues in strict module environments.
 *   - Items are initialised from `_items` JSON but collection changes are not written back automatically (only via `toJSON`).
 */
import ComponentModel from 'core/js/models/componentModel';
import ItemModel from 'core/js/models/itemModel';

/**
 * @class ItemsComponentModel
 * @classdesc Base model for Adapt components that manage a collection of interactive items.
 * Sets up a `Backbone.Collection` of {@link module:core/js/models/itemModel|ItemModel} instances
 * accessible via `getChildren()`. Handles user-answer storage, visited-state tracking, and
 * completion detection.
 * @extends ComponentModel
 */
export default class ItemsComponentModel extends ComponentModel {

  toJSON() {
    const json = super.toJSON();
    // Make sure _items is updated from child collection
    json._items = this.getChildren().toJSON();
    return json;
  }

  init() {
    this.setUpItems();
    this.listenTo(this.getChildren(), {
      all: this.onAll,
      change: this.storeUserAnswer,
      'change:_isActive': this.setVisitedStatus,
      'change:_isVisited': this.checkCompletionStatus
    });
    super.init();
  }

  /**
   * Restore `_isVisited` flags on child items from the stored `_userAnswer` boolean array.
   * Called during revisit to reinstate the learner's previous interaction state.
   */
  restoreUserAnswers() {
    const booleanArray = this.get('_userAnswer');
    if (!booleanArray) return;
    this.getChildren().forEach(child => child.set('_isVisited', booleanArray[child.get('_index')]));
  }

  /**
   * Persist the current visited state of all items as a sorted boolean array in `_userAnswer`.
   * Items are sorted by `_index` before serialisation to ensure consistent order.
   */
  storeUserAnswer() {
    const items = this.getChildren().slice(0);
    items.sort((a, b) => a.get('_index') - b.get('_index'));
    const booleanArray = items.map(child => child.get('_isVisited'));
    this.set('_userAnswer', booleanArray);
  }

  setUpItems() {
    // see https://github.com/adaptlearning/adapt_framework/issues/2480
    const items = this.get('_items') || [];
    items.forEach((item, index) => (item._index = index));
    this.setChildren(new Backbone.Collection(items, { model: ItemModel }));
  }

  /**
   * Return the child ItemModel at the given index.
   * @param {number} index - Zero-based item index
   * @returns {ItemModel|undefined}
   */
  getItem(index) {
    return this.getChildren().findWhere({ _index: index });
  }

  getVisitedItems() {
    return this.getChildren().where({ _isVisited: true });
  }

  getActiveItems() {
    return this.getChildren().where({ _isActive: true });
  }

  getActiveItem() {
    return this.getChildren().findWhere({ _isActive: true });
  }

  areAllItemsCompleted() {
    return this.getVisitedItems().length === this.getChildren().length;
  }

  checkCompletionStatus() {
    this.setVisitedStatus();
    if (!this.areAllItemsCompleted()) return;
    this.setCompletionStatus();
  }

  /**
   * @param {string} [type] 'hard' resets _isComplete and _isInteractionComplete, 'soft' resets _isInteractionComplete only.
   * @param {boolean} [canReset] Defaults to this.get('_canReset')
   * @returns {boolean}
   */
  reset(type = 'hard', canReset = this.get('_canReset')) {
    const wasReset = super.reset(type, canReset);
    if (!wasReset) return false;
    this.getChildren().each(item => item.reset());
    return true;
  }

  resetActiveItems() {
    this.getChildren().each(item => item.toggleActive(false));
  }

  /**
   * Deactivate the current active item and activate the item at the given index.
   * Does nothing if no item exists at `index`.
   * @param {number} index - Zero-based index of the item to activate
   */
  setActiveItem(index) {
    const item = this.getItem(index);
    if (!item) return;
    const activeItem = this.getActiveItem();
    if (activeItem) activeItem.toggleActive(false);
    item.toggleActive(true);
  }

}
