import Adapt from 'core/js/adapt';
import NotifyView from 'core/js/views/notifyView';
import logging from 'core/js/logging';

const notify = new NotifyView();

Object.defineProperty(Adapt, 'notify', {
  get() {
    logging.deprecated('Adapt.notify, please use core/js/notify directly');
    return notify;
  }
});

export default notify;
