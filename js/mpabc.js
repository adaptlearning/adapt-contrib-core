/**
 * @file MPABC - Menus, Pages, Articles, Blocks and Components controller
 * @module core/js/mpabc
 * @description Singleton controller that bootstraps the core Adapt content hierarchy.
 * Registers the primary content type models and views (menus, pages, articles, blocks,
 * components), then creates {@link AdaptSubsetCollection} instances on the `Adapt` global
 * for each type: `Adapt.contentObjects`, `Adapt.articles`, `Adapt.blocks`, and
 * `Adapt.components`. Coordinates data loading via the wait API.
 *
 * @example
 * import 'core/js/mpabc'; // imported for side-effects; bootstraps the content hierarchy
 */

import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import Data from 'core/js/data';
import AdaptSubsetCollection from 'core/js/collections/adaptSubsetCollection';
import ContentObjectModel from 'core/js/models/contentObjectModel';
import ArticleModel from 'core/js/models/articleModel';
import BlockModel from 'core/js/models/blockModel';
import ComponentModel from 'core/js/models/componentModel';

import 'core/js/models/courseModel';
import 'core/js/models/menuModel';
import 'core/js/models/pageModel';
import 'core/js/views/pageView';
import 'core/js/views/articleView';
import 'core/js/views/blockView';

/**
 * @class MPABC
 * @classdesc Singleton controller responsible for bootstrapping the core content type
 * hierarchy. Sets up `Adapt.contentObjects`, `Adapt.articles`, `Adapt.blocks`, and
 * `Adapt.components` as {@link AdaptSubsetCollection} instances filtered by model type.
 * Coordinates with the data loader via the wait API to ensure collections are ready
 * before the framework proceeds.
 * @extends Backbone.Controller
 */
class MPABC extends Backbone.Controller {

  initialize() {
    // Example of how to cause the data loader to wait for another module to setup
    this.listenTo(Data, {
      loading: this.waitForDataLoaded,
      loaded: this.onDataLoaded
    });
    this.setupSubsetCollections();
  }

  waitForDataLoaded() {
    // Tell the data loader to wait
    wait.begin();
  }

  onDataLoaded() {
    // Tell the data loader that we have finished
    wait.end();
  }

  setupSubsetCollections() {
    Adapt.contentObjects = new AdaptSubsetCollection(null, { parent: Data, model: ContentObjectModel });
    Adapt.articles = new AdaptSubsetCollection(null, { parent: Data, model: ArticleModel });
    Adapt.blocks = new AdaptSubsetCollection(null, { parent: Data, model: BlockModel });
    Adapt.components = new AdaptSubsetCollection(null, { parent: Data, model: ComponentModel });
  }

}

const mpabc = new MPABC();
export default mpabc;
