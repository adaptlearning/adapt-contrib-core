import Adapt from 'core/js/adapt';

/**
  Prevent the user from accessing Adapt internal modules from the console when
  config.json:_fixes._harden = true and in production mode
 */

Adapt.on('adapt:start', () => {
  const config = Adapt.config.get('_fixes');
  if (config?._harden !== true) return;
  if (window.ADAPT_BUILD_TYPE !== 'development') return;
  applyHarden();
});

function applyHarden() {
  Object.defineProperties(window, {
    require: {
      writable: true,
      enumerable: true,
      value: undefined
    },
    requirejs: {
      writable: true,
      enumerable: true,
      value: undefined
    }
  });
}
