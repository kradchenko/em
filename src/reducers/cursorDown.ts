import State from '../@types/State'
import { HOME_TOKEN } from '../constants'
import setCursor from '../reducers/setCursor'
import { getChildrenSorted } from '../selectors/getChildren'
import nextThought from '../util/nextThought'

/** Moves the cursor to the next child, sibling, or nearest uncle. */
const cursorDown = (state: State) => {
  const { cursor } = state

  // if there is a cursor, get the next logical child, sibling, or uncle
  if (cursor) {
    const path = nextThought(state, cursor)
    return path
      ? setCursor(state, {
          path,
          cursorHistoryClear: true,
          editing: true,
        })
      : state
  }
  // if no cursor, move cursor to first thought in root
  else {
    const children = getChildrenSorted(state, HOME_TOKEN)
    return children.length > 0 ? setCursor(state, { path: [children[0].id] }) : state
  }
}

export default cursorDown
