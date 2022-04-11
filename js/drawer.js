import Adapt from 'core/js/adapt';
import DrawerView from 'core/js/views/drawerView';
import logging from 'core/js/logging';

const DrawerCollection = new Backbone.Collection(null, { comparator: 'drawerOrder' });
const Drawer = {};

Drawer.addItem = function(drawerObject, eventCallback) {
  drawerObject.eventCallback = eventCallback;
  DrawerCollection.add(drawerObject);
};

Drawer.triggerCustomView = function(view, hasBackButton) {
  if (hasBackButton !== false) {
    hasBackButton = true;
  }
  Adapt.trigger('drawer:triggerCustomView', view, hasBackButton);
};

Adapt.on({
  'adapt:start'() {
    new DrawerView({ collection: DrawerCollection });
  },
  'app:languageChanged'() {
    Adapt.trigger('drawer:remove');
  }
});

Object.defineProperty(Adapt, 'drawer', {
  get() {
    logging.deprecated('Adapt.drawer, please use core/js/drawer directly');
    return Drawer;
  }
});

export default Drawer;
