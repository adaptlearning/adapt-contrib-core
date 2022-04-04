import Adapt from 'core/js/adapt';
import a11y from 'core/js/a11y';
import components from 'core/js/components';
import data from 'core/js/data';
import device from 'core/js/device';
import drawer from 'core/js/drawer';
import location from 'core/js/location';
import logging from 'core/js/logging';
import mpabc from 'core/js/mpabc';
import notify from 'core/js/notify';
import offlineStorage from 'core/js/offlineStorage';
import router from 'core/js/router';
import scrolling from 'core/js/scrolling';
import startController from 'core/js/startController';
import tracking from 'core/js/tracking';
import wait from 'core/js/wait';

/** START REDUNDANT ADAPT WAIT BEHAVIOUR */
const beginWait = () => {
  logging.deprecated('Use wait.begin() as Adapt.trigger(\'plugin:beginWait\') will be removed in the future');
  wait.begin();
};

const endWait = () => {
  logging.deprecated('Use wait.end() as Adapt.trigger(\'plugin:endWait\') will be removed in the future');
  wait.end();
};

const ready = () => {
  if (wait.isWaiting()) {
    return;
  }
  const isEventListening = (Adapt._events['plugins:ready']);
  if (!isEventListening) {
    return;
  }
  logging.deprecated("Use wait.queue(callback) as Adapt.on('plugins:ready', callback) will be removed in the future");
  Adapt.trigger('plugins:ready');
};

Adapt.listenTo(wait, 'ready', ready);
Adapt.on({
  'plugin:beginWait': beginWait,
  'plugin:endWait': endWait
});
/** END REDUNDANT ADAPT WAIT BEHAVIOUR */

Object.defineProperties(Adapt, {
  accessibility: {
    get() {
      a11y.log.deprecated('Adapt.accessibility has moved to a11y');
      return a11y;
    }
  },
  a11y: {
    get() {
      logging.deprecated('Adapt.a11y, please use core/js/a11y directly');
      return a11y;
    }
  },
  componentStore: {
    get() {
      logging.deprecated('Adapt.componentStore, please use core/js/components directly');
      return components._register;
    }
  },
  data: {
    get() {
      logging.deprecated('Adapt.data, please use core/js/data directly');
      return data;
    }
  },
  device: {
    get() {
      logging.deprecated('device, please use core/js/device directly');
      return device;
    }
  },
  drawer: {
    get() {
      logging.deprecated('Adapt.drawer, please use core/js/drawer directly');
      return drawer;
    }
  },
  findById: {
    get() {
      logging.deprecated('Adapt.findById, please use data.findById directly');
      return data.findById;
    }
  },
  findViewByModelId: {
    get() {
      logging.deprecated('Adapt.findViewByModelId, please use data.findViewByModelId directly');
      return data.findViewByModelId;
    }
  },
  findByTrackingPosition: {
    get() {
      logging.deprecated('Adapt.findByTrackingPosition, please use data.findByTrackingPosition directly');
      return data.findByTrackingPosition;
    }
  },
  getViewName: {
    get() {
      logging.deprecated('Adapt.getViewName, please use components.getViewName instead');
      return components.getViewName;
    }

  },
  getViewClass: {
    get() {
      logging.deprecated('Adapt.getViewClass, please use components.getViewClass instead');
      return components.getViewClass;
    }

  },
  getModelName: {
    get() {
      logging.deprecated('Adapt.getModelName, please use components.getModelName instead');
      return components.getModelName;
    }
  },
  getModelClass: {
    get() {
      logging.deprecated('Adapt.getModelClass, please use components.getModelClass instead');
      return components.getModelClass;
    }
  },
  location: {
    get() {
      logging.deprecated('Adapt.location, please use core/js/location directly');
      return location;
    }
  },
  log: {
    get() {
      logging.deprecated('Adapt.log, please use core/js/logging directly');
      return logging;
    }
  },
  mpabc: {
    get() {
      logging.deprecated('Adapt.mpabc, please use core/js/mpabc directly');
      return mpabc;
    }
  },
  notify: {
    get() {
      logging.deprecated('Adapt.notify, please use core/js/notify directly');
      return notify;
    }
  },
  offlineStorage: {
    get() {
      logging.deprecated('offlineStorage, please use src/core/offlineStorage instead');
      return offlineStorage;
    }
  },
  navigateToElement: {
    get() {
      logging.deprecated('Adapt.navigateToElement, please use router.navigateToElement');
      return router.navigateToElement;
    }
  },
  register: {
    get() {
      logging.deprecated('Adapt.register, please use components.register instead');
      return components.register;
    }
  },
  router: {
    get() {
      logging.deprecated('Adapt.router, please use core/js/router directly');
      return router;
    }
  },
  scrolling: {
    get() {
      logging.deprecated('Adapt.scrolling, please use core/js/scrolling directly');
      return scrolling;
    }
  },
  scrollTo: {
    get() {
      logging.deprecated('Adapt.scrollTo, please use router.navigateToElement');
      return scrolling.scrollTo;
    }
  },
  startController: {
    get() {
      logging.deprecated('Adapt.startController, please use core/js/startController directly');
      return startController;
    }
  },
  store: {
    get() {
      logging.deprecated('Adapt.store, please use core/js/components directly');
      return components._register;
    }
  },
  tracking: {
    get() {
      logging.deprecated('Adapt.tracking, please use core/js/tracking directly');
      return tracking;
    }
  },
  wait: {
    get() {
      logging.deprecated('Adapt.wait, please use src/core/wait instead');
      return wait;
    }
  }
});
