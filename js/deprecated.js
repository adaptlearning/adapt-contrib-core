import Adapt from 'core/js/adapt';
import components from 'core/js/components';
import logging from 'core/js/logging';
import offlineStorage from 'core/js/offlineStorage';
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
  componentStore: {
    get() {
      logging.deprecated('Adapt.componentStore, please use core/js/components directly');
      return components._register;
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
  log: {
    get() {
      logging.deprecated('Adapt.log, please use core/js/logging directly');
      return logging;
    }
  },
  offlineStorage: {
    get() {
      logging.deprecated('offlineStorage, please use src/core/offlineStorage instead');
      return offlineStorage;
    }
  },
  register: {
    get() {
      logging.deprecated('Adapt.register, please use components.register instead');
      return components.register;
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
