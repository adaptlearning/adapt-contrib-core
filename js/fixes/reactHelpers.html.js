import Adapt from 'core/js/adapt';
import HTMLReactParser from 'html-react-parser';
import 'core/js/templates';
import logging from 'core/js/logging';

/**
 * 27 October 2021 https://github.com/adaptlearning/adapt_authoring/issues/2570
 * The function reactHelpers.html was stopping javascript generated in the AAT editor
 * from presenting correctly in the DOM.
 *
 * This file helps deprecate the function reactHelpers.html and instead recommends
 * replacing it with dangerouslySetInnerHTML, a native react property.
 * https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml
 */
Adapt.on('app:dataReady', () => {
  const config = Adapt.config.get('_fixes');
  if (config?._jsxReactHelpersHTML === false) return;
  applyReactHelpersHTML();
});

function applyReactHelpersHTML() {
  Adapt.on('reactElement:preRender', event => {
    let [tagName, props, ...children] = event.args;
    if (!children) return;
    if (!Array.isArray(children)) children = [children];
    children = children.filter(Boolean);
    const hasSomeUnsafeConversions = children.some(c => c?.__html);
    if (!hasSomeUnsafeConversions) return;
    const hasManyChildren = (children.length > 1);
    if (hasManyChildren) {
      // Process reactHelpers.html() children amongst other nodes as a conversion from HTML strings to React nodes
      // Warn as this is an unexpected use-case
      event.args = event.args.map(child => {
        if (!child || !child.__html) return child;
        const attributes = Object.entries(props).map(([name, value]) => `${name}="${value}"`).join(' ');
        logging.warnOnce(`html() call should be the only child in its parent <${tagName} ${attributes}>`);
        return child.__html ? HTMLReactParser(child.__html) : undefined;
      });
      return;
    }
    // Process one reactHelpers.html() child as dangerouslySetInnerHTML on the parent
    // Allows html generated from the json to appear in the DOM in raw format
    props = (event.args[1] = event.args[1] || {});
    props.dangerouslySetInnerHTML = children[0];
    event.args.length = 2;
  });
}
