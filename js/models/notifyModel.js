import LockingModel from 'core/js/models/lockingModel';

export default class NotifyModel extends LockingModel {

  defaults() {
    return {
      _isActive: false,
      _showIcon: false,
      _timeout: 3000,
      _delay: 0,
      _hasClosed: false
    };
  }

  close() {
    if (this.get('_hasClosed')) return;
    this.set('_hasClosed', true);
    this.trigger('closed');
  }

  async onClosed() {
    if (this.get('_hasClosed')) return;
    return new Promise(resolve => this.once('closed', resolve));
  }

}
