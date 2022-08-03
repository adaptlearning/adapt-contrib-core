import React from 'react';
import { classes, compile } from 'core/js/reactHelpers';

export default function Tooltip(props) {
  const {
    _id,
    _classes,
    text,
    top,
    left
  } = props;

  return (
    <div
      className={classes([
        `tooltip-${_id}`,
        _classes,
        'tooltip'
      ])}
      style={{ top, left }}
    >
      <div
        className='tooltip-inner'
        dangerouslySetInnerHTML={{ __html: compile(text) }}
      >
      </div>
    </div>
  );
}
