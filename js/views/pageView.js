/**
 * @file Page View - Renders a page-type content object
 * @module core/js/views/pageView
 * @description Extends {@link module:core/js/views/contentObjectView~ContentObjectView}
 * for page content objects. Registered as the 'page' component type. Cleans up
 * any injected page-label element when the view is removed.
 */
import components from 'core/js/components';
import ContentObjectView from 'core/js/views/contentObjectView';

/**
 * @class PageView
 * @classdesc View for page-type content objects. A page is the primary learner-facing
 * screen and contains one or more articles. This view adds cleanup of any page-label
 * element on removal; all other lifecycle behaviour is inherited from
 * {@link module:core/js/views/contentObjectView~ContentObjectView}.
 * @extends ContentObjectView
 */
class PageView extends ContentObjectView {

  /**
   * Removes the page view from the DOM. Cleans up the injected
   * `$pageLabel` element (added by the page heading plugin) before
   * delegating full removal to
   * {@link module:core/js/views/contentObjectView~ContentObjectView#remove}.
   * @returns {PageView} This view instance
   */
  remove() {
    if (this.$pageLabel) {
      this.$pageLabel.remove();
    }
    super.remove();
  }

}

Object.assign(PageView, {
  childContainer: '.article__container',
  type: 'page',
  template: 'page'
});

components.register('page', { view: PageView });

export default PageView;
