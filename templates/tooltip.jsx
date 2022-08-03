import React from 'react';
import { classes, compile } from 'core/js/reactHelpers';

export default function Tooltip(props) {
  const {
    text
  } = props;

  return (
    <div
      className={classes([
        'tooltip'
      ])}
      dangerouslySetInnerHTML={{ __html: compile(text) }}
    >
    </div>
  );
}
