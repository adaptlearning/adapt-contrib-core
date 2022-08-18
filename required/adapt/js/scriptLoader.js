(function() {

  function loadScript(url, callback) {
    if (!url || typeof url !== 'string') return;
    const script = document.createElement('script');
    script.onload = callback;
    script.src = url;
    document.getElementsByTagName('head')[0].appendChild(script);
  };

  window.__loadScript = loadScript;

  function loadRequireJS() {
    loadScript('libraries/require.min.js', function setupRequireJS() {
      requirejs.config({
        paths: {
          jquery: 'libraries/jquery.min',
          handlebars: 'libraries/handlebars.min',
          underscore: 'libraries/underscore.min',
          jqueryMobile: 'libraries/jquery.mobile.custom.min'
        },
        waitSeconds: 1
      });
      setupModernizr();
    });
  }

  function setupModernizr() {
    window.Modernizr.touch = window.Modernizr.touchevents;
    const touchClass = window.Modernizr.touch ? 'touch' : 'no-touch';
    document.querySelector('html').classList.add(touchClass);
    loadGlobals();
  }

  function loadGlobals() {
    require([
      'jquery',
      'handlebars',
      'underscore',
      'jqueryMobile',
      'templates'
    ], function setupGlobals($, Handlebars, _) {
      // NOTE: Global handlerbars and underscore need to be faded out
      window.$ = $;
      if (window.Handlebars) Object.assign(Handlebars, window.Handlebars);
      window.Handlebars = Handlebars;
      window._ = _;
      loadTouchEvents();
    });
  }

  function loadTouchEvents() {
    require([
      'events/touch'
    ], loadAdapt);
  }

  function loadAdapt() {
    window.$.ajaxPrefilter(function(options) {
      options.crossDomain = true;
    });
    loadScript('adapt/js/adapt.min.js');
  }

  loadRequireJS();

})();
