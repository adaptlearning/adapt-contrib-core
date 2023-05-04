import Adapt from 'core/js/adapt';
import wait from 'core/js/wait';
import LockingModel from 'core/js/models/lockingModel';
import logging from 'core/js/logging';

export default class ConfigModel extends LockingModel {

  defaults() {
    return {
      screenSize: null,
      _forceRouteLocking: false,
      _canLoadData: true,
      _disableAnimation: false
    };
  }

  /**
   * Parse the incoming search queries for certain parameter values to use as defaults
   */
  setValuesFromURLParams() {
    const paramMappings = {
      dir: '_defaultDirection',
      lang: '_defaultLanguage'
    };

    const params = new URLSearchParams(window.location.search);

    Object.entries(paramMappings).forEach(([key, value]) => {
      const passedVal = params.get(key);
      if (!passedVal) return;
      if (key === 'lang' && Adapt.build.get('availableLanguageNames')?.includes(passedVal) === false) return;
      this.set(value, passedVal);
    });
  }

  initialize(attrs, options) {
    this.url = options.url;
    // Fetch data & if successful trigger event to enable plugins to stop course files loading
    // Then check if course files can load
    // 'configModel:loadCourseData' event starts the core content collections and models being fetched
    this.fetch({
      success: () => {
        this.setValuesFromURLParams();

        Adapt.trigger('offlineStorage:prepare');
        wait.queue(() => {
          Adapt.trigger('configModel:dataLoaded');
          if (!this.get('_canLoadData')) return;
          Adapt.trigger('configModel:loadCourseData');
        });
      },
      error: () => logging.error('Unable to load course/config.json')
    });
  }

  loadData() {}

}
