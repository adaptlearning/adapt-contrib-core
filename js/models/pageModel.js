/**
 * @file Page Model - Page content object data model
 * @module core/js/models/pageModel
 * @description Data model for page content objects. Extends
 * {@link module:core/js/models/contentObjectModel~ContentObjectModel} to represent
 * learner-facing pages. Pages are leaf-level content objects that contain articles.
 * Registered as the 'page' component type.
 */

import components from 'core/js/components';
import logging from 'core/js/logging';
import ContentObjectModel from 'core/js/models/contentObjectModel';

/**
 * @class PageModel
 * @classdesc Data model for a page content object. Pages are the learner-facing navigable
 * sections of a course that contain articles. They are leaf nodes in the content object
 * hierarchy — unlike menus, pages do not contain other content objects.
 * @extends ContentObjectModel
 */
class PageModel extends ContentObjectModel {

  get _children() {
    logging.deprecated('pageModel._children, use menuModel.hasManagedChildren instead, child models are defined by the JSON');
    return 'articles';
  }

  /**
   * Returns a string of the model type group.
   * @returns {string}
   */
  getTypeGroup() {
    return 'page';
  }

}

components.register('page', { model: PageModel });

export default PageModel;
