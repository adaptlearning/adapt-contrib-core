/**
 * @file AdaptCollection - Base Backbone collection for Adapt data
 * @module core/js/collections/adaptCollection
 * @description Base collection class for Adapt Framework data sets. Fires
 * `adaptCollection:dataLoaded` on its first reset, signalling downstream
 * modules that the collection's data is available.
 */
import Adapt from 'core/js/adapt';

/**
 * @class AdaptCollection
 * @classdesc Base Backbone collection used throughout the Adapt Framework.
 * Fires `adaptCollection:dataLoaded` on its first reset, allowing dependent
 * modules to react when the collection's data is available.
 * @extends {Backbone.Collection}
 */
export default class AdaptCollection extends Backbone.Collection {

  initialize(models, options) {
    this.once('reset', this.loadedData, this);
  }

  loadedData() {
    Adapt.trigger('adaptCollection:dataLoaded');
  }

}
