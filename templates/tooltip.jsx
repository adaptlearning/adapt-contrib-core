import React from 'react';
import { classes, compile } from 'core/js/reactHelpers';

export default function Tooltip(props) {
  const {
    _id,
    _classes,
    text,
    disabledText,
    top,
    left,
    tooltipPosition,
    arrowPosition,
    arrowPositionCalc,
    _isFixedPosition
  } = props;

  const defaultTooltipPosition = !tooltipPosition ? 'is-bottom is-right' : tooltipPosition;
  const defaultArrowPosition = !arrowPosition ? 'is-top is-left' : arrowPosition;
  const id = `tooltip-${_id}`;

  let tooltipText = text;
  const $target = $(`[data-tooltip-id=${_id}]`);
  const isDisabled = $target.attr('aria-disabled') || $target.hasClass('is-disabled') || $target.is(':disabled');
  if (isDisabled && disabledText) tooltipText = disabledText;

  return (
    <div id = { id }
      className={classes([
        'tooltip',
        'js-tooltip',
        defaultTooltipPosition,
        _isFixedPosition && 'tooltip-fixed',
        _classes
      ])}
      style={{ top, left }} role='tooltip'
    >
      <div
        className='tooltip__inner'
      >

        <div
          className={classes([
            'tooltip__arrow',
            'has-arrow',
            defaultArrowPosition
          ])}
          style={ arrowPositionCalc } aria-hidden='true'
        >
        </div>

        <div
          className='tooltip__body'
          dangerouslySetInnerHTML={{ __html: compile(tooltipText) }}
        >
        </div>

      </div>
    </div>
  );
}
