import React from 'react';
import { html, classes, compile } from 'core/js/reactHelpers';

export default function Tooltip(props) {
  const {
    _activeId,
    text
  } = props;

  return (
    <div
      className={classes([
        'tooltip',
        !_activeId && 'u-display-none'
      ])}
      dangerouslySetInnerHTML={{ __html: compile(text) }}
    >
    </div>
  );
}
