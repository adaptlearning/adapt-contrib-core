import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import DrawerView from 'core/js/views/drawerView';

const DrawerCollection = new Backbone.Collection(null, { comparator: 'drawerOrder' });

class Drawer extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart,
      'app:languageChanged': this.remove,
      'navigation:toggleDrawer': this.toggle
    });
  }

  onAdaptStart() {
    const drawer = Adapt.config.get('_drawer');
    drawer._position ??= 'auto';
    this._drawerView = new DrawerView({ collection: DrawerCollection });
  }

  toggle() {
    if (this.isOpen) return this._drawerView?.hideDrawer();
    this._drawerView?.showDrawer(true);
  }

  get isOpen() {
    return this._drawerView?.isOpen ?? false;
  }

  open() {
    this._drawerView?.showDrawer(true);
  }

  openCustomView(view, hasBackButton) {
    if (hasBackButton !== false) {
      hasBackButton = true;
    }
    this._drawerView?.openCustomView(view, hasBackButton);
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
