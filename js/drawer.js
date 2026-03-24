import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import DrawerView from 'core/js/views/drawerView';
import tooltips from './tooltips';
import logging from './logging';

const DrawerCollection = new Backbone.Collection(null, { comparator: 'drawerOrder' });

class Drawer extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart,
      'app:languageChanged': this.onLanguageChanged,
      'navigation:toggleDrawer': this.toggle,
      'router:navigate': this.onNavigate
    });
  }

  get config() {
    return Adapt.config.get('_drawer');
  }

  onAdaptStart() {
    this._drawerView = new DrawerView({ collection: DrawerCollection });
    this._drawerView.$el.insertAfter('#shadow');
    if (this.config?._startOpen) {
      // Wait for the first page to finish rendering — by then all extensions
      // have registered their drawer items and event listeners via adapt:start
      this.listenToOnce(Adapt, 'contentObjectView:ready', this.onStartOpen);
    }
  }

  onStartOpen() {
    if (DrawerCollection.length === 0) return;
    const startItem = this.config?._startOpenItem;
    if (!startItem) return this.open();
    // Support friendly names (e.g. "resources") by matching against
    // registered drawer item eventCallbacks (e.g. "resources:showResources")
    const eventCallback = this.resolveStartItem(startItem);
    if (eventCallback) Adapt.trigger(eventCallback);
  }

  resolveStartItem(name) {
    // Direct event callback (e.g. "resources:showResources")
    if (name.includes(':')) return name;
    // Match extension name (e.g. "resources", "glossary", "toc") against
    // the prefix of registered drawer item eventCallbacks
    const getCallback = item => item.get?.('eventCallback') ?? item.eventCallback;
    const match = DrawerCollection.find(item =>
      getCallback(item)?.startsWith(`${name}:`)
    );
    const callback = getCallback(match);
    if (!callback) logging.warn(`Drawer _startOpenItem "${name}" not found in registered drawer items`);
    return callback;
  }

  onNavigate() {
    const isPushStartOpen = this._drawerView?.isPush && this.config?._startOpen;
    if (isPushStartOpen) return;
    this.close();
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
    this._drawerView?.hideDrawer($toElement, { force: true });
  }

  remove() {
    this._drawerView?.remove();
    this._drawerView = null;
  }

}

export default new Drawer();
