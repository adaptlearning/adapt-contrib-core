/**
 * @file AdaptSubsetCollection - Filtered subset of a parent AdaptCollection
 * @module core/js/collections/adaptSubsetCollection
 * @description A filtered view of a parent {@link module:core/js/collections/adaptCollection}.
 * Automatically re-filters its contents whenever the parent collection resets,
 * keeping only models that are instances of this collection's model type.
 */
import AdaptCollection from 'core/js/collections/adaptCollection';

/**
 * @class AdaptSubsetCollection
 * @classdesc Maintains a live, filtered subset of a parent
 * {@link module:core/js/collections/adaptCollection|AdaptCollection}. When the parent
 * resets, `loadSubset` rebuilds the subset by retaining only models that are
 * instances of `this.model`. Also builds a `_byAdaptID` lookup map for fast
 * retrieval by `_id`.
 * @extends {AdaptCollection}
 */
export default class AdaptSubsetCollection extends AdaptCollection {

  initialize(models, options) {
    super.initialize(models, options);
    this.parent = options.parent;
    this.listenTo(this.parent, 'reset', this.loadSubset);
  }

  /**
   * Rebuilds the subset from the parent collection, keeping only models that
   * are instances of `this.model`. Also indexes the subset by `_id` in
   * `this._byAdaptID` for fast lookup.
   */
  loadSubset() {
    this.set(this.parent.filter(model => model instanceof this.model));
    this._byAdaptID = this.groupBy('_id');
  }

}
