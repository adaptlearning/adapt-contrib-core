import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import DrawerView from 'core/js/views/drawerView';
import tooltips from './tooltips';

const DrawerCollection = new Backbone.Collection(null, { comparator: 'drawerOrder' });

class Drawer extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart,
      'app:languageChanged': this.onLanguageChanged,
      'navigation:toggleDrawer': this.toggle
    });
  }
  
  onAdaptStart() {
    this._drawerView = new DrawerView({ collection: DrawerCollection });
  }
  
  onLanguageChanged() {
    tooltips.register({
      _id: 'drawer',
      ...Adapt.course.get('_globals')?._extensions?._drawer?._navTooltip || {}
    });
    this.remove();
  }

  toggle() {
    (this.isOpen) ? this.close() : this.open();
  }

  get isOpen() {
    return this._drawerView?.isOpen ?? false;
  }

  open() {
    this._drawerView?.showDrawer(true);
  }

  openCustomView(view, hasBackButton, position) {
    this._drawerView?.openCustomView(view, hasBackButton, position);
  }

  addItem(drawerObject, eventCallback) {
    if (this.hasItem(eventCallback)) {
      DrawerCollection.remove(DrawerCollection.find(item => item.eventCallback === eventCallback));
    }
    drawerObject.eventCallback = eventCallback;
    DrawerCollection.add(drawerObject);
  }

  hasItem(eventCallback) {
    return Boolean(DrawerCollection.find(item => item.eventCallback === eventCallback));
  }

  close($toElement = null) {
    this._drawerView?.hideDrawer($toElement);
  }

  remove() {
    this._drawerView?.remove();
    this._drawerView = null;
  }

}

export default new Drawer();
