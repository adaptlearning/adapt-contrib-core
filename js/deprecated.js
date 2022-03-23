import Adapt from 'core/js/adapt';
import logging from 'core/js/logging';
import wait from 'core/js/wait';

/** START REDUNDANT ADAPT WAIT BEHAVIOUR */
Object.defineProperties(Adapt, {
  wait: {
    get() {
      logging.deprecated('Adapt.wait, please use src/core/wait instead');
      return wait;
    }
  }
});

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
