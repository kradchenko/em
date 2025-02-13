import React, { Fragment } from 'react'
import { useStore } from 'react-redux'
import { isMac, isTouch } from '../../browser'
import headValue from '../../util/headValue'

// eslint-disable-next-line jsdoc/require-jsdoc
const TutorialStepSubThought = ({ cursor }) => {
  const state = useStore().getState()

  const headCursorValue = cursor && headValue(state, cursor)
  return (
    <Fragment>
      <p>
        Now I am going to show you how to add a thought <i>within</i> another thought.
      </p>
      {cursor && headCursorValue === '' ? (
        <p>Hit the Delete key to delete the current blank thought. It's not needed right now.</p>
      ) : null}
      {!cursor ? (
        <p>{isTouch ? 'Tap' : 'Click'} a thought to select it.</p>
      ) : (
        <p>
          {isTouch
            ? 'Trace the line below'
            : `${cursor && headCursorValue === '' ? 'Then h' : 'H'}old the ${
                isMac ? 'Command' : 'Ctrl'
              } key and hit the Enter key`}
          .
        </p>
      )}
    </Fragment>
  )
}

export default TutorialStepSubThought
