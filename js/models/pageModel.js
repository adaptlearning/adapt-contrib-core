/**
 * @file Page Model - Page content object data model
 * @module core/js/models/pageModel
 * @description Defines {@link module:core/js/models/pageModel~PageModel} and
 * registers it as the 'page' content type.
 */

import components from 'core/js/components';
import logging from 'core/js/logging';
import ContentObjectModel from 'core/js/models/contentObjectModel';

/**
 * @class PageModel
 * @classdesc Data model for a page content object. Pages are the learner-facing navigable
 * sections of a course that contain articles. Unlike menus, pages do not contain
 * other content objects.
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
