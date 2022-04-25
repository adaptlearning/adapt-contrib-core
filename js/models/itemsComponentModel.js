import ComponentModel from 'core/js/models/componentModel';
import ItemModel from 'core/js/models/itemModel';

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
      'change:_isActive': this.setVisitedStatus,
      'change:_isVisited': this.checkCompletionStatus
    });
    super.init();
  }

  restoreUserAnswers() {
    const booleanArray = this.get('_userAnswer');
    if (!booleanArray) return;
    this.getChildren().forEach((child, index) => child.set('_isVisited', booleanArray[index]));
  }

  storeUserAnswer() {
    const booleanArray = this.getChildren().map(child => child.get('_isVisited'));
    this.set('_userAnswer', booleanArray);
  }

  setUpItems() {
    // see https://github.com/adaptlearning/adapt_framework/issues/2480
    const items = this.get('_items') || [];
    items.forEach((item, index) => (item._index = index));
    this.setChildren(new Backbone.Collection(items, { model: ItemModel }));
  }

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
    this.storeUserAnswer();
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

  setActiveItem(index) {
    const item = this.getItem(index);
    if (!item) return;

    const activeItem = this.getActiveItem();
    if (activeItem) activeItem.toggleActive(false);
    item.toggleActive(true);
  }

}
