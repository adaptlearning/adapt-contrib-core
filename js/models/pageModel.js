import components from 'core/js/components';
import logging from 'core/js/logging';
import ContentObjectModel from 'core/js/models/contentObjectModel';

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
