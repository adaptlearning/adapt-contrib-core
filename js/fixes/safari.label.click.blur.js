import Adapt from 'core/js/adapt';
import 'core/js/templates';

/**
  In Safari, a click triggers a mousedown, a blur, a mouseup, a focus, then a click,
  which is different from chrome-based browsers.
  Sometimes we rerender the template on a blur, the rerender prevents
  the click event from firing in Safari, instead of allowing click to fall through from
  the label to the input, we prevent the label click and instead
  trigger a manual click on the input referenced by the label's for attribute.
  This fixes the issue in both the iOS and MacOS versions of Safari
  References:
    https://www.eventbrite.com/engineering/a-story-of-a-react-re-rendering-bug/
    https://sitr.us/2011/07/28/how-mobile-safari-emulates-mouse-events.html
    https://stackoverflow.com/questions/9335325/blur-event-stops-click-event-from-working
 */

Adapt.on('app:dataReady', () => {
  const config = Adapt.config.get('_fixes');
  if (config?._jsxReactHelpersHTML === false) return;
  applySafariLabelClickBlur();
});

function onLabelClick (event) {
  event.preventDefault();
  const input = document.querySelector(`#${event.currentTarget.getAttribute('for')}`);
  input.click();
};

function applySafariLabelClickBlur () {
  Adapt.on('reactElement:preRender', event => {
    const [tagName, props] = event.args;
    if (tagName !== 'label' && !Object.hasOwn(props, 'for') && !Object.hasOwn(props, 'onClick')) return;
    props.onClick = onLabelClick;
  });
}
