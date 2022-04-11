import components from 'core/js/components';
import ContentObjectView from 'core/js/views/contentObjectView';

class PageView extends ContentObjectView {

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
