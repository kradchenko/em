import Path from '../@types/Path'
import State from '../@types/State'
import Thought from '../@types/Thought'
import { getChildrenRanked, getChildrenSorted, isChildVisible } from '../selectors/getChildren'
import getContextsSortedAndRanked from '../selectors/getContextsSortedAndRanked'
import getSortPreference from '../selectors/getSortPreference'
import getThoughtById from '../selectors/getThoughtById'
import isContextViewActive from '../selectors/isContextViewActive'
import head from '../util/head'
import isVisibleContext from '../util/isVisibleContext'

/**
 * Gets the previous sibling of a thought according to its parent's sort preference.
 */
export const prevSibling = (state: State, value: string, path: Path, rank: number): Thought | null => {
  const { showHiddenThoughts } = state
  const thought = getThoughtById(state, head(path))
  if (!thought) return null
  const contextViewActive = isContextViewActive(state, path)

  /** Gets siblings of a context. */
  const getContextSiblings = () => getContextsSortedAndRanked(state, thought.value)

  /** Gets siblings of thought. */
  const getThoughtSiblings = () =>
    (getSortPreference(state, thought.id).type === 'Alphabetical' ? getChildrenSorted : getChildrenRanked)(
      state,
      thought.id,
    )

  const siblings = contextViewActive ? getContextSiblings() : getThoughtSiblings()
  let prev = null // eslint-disable-line fp/no-let
  siblings.find(child => {
    if (child.rank === rank && (contextViewActive || child.value === value)) {
      return true
    } else if (
      !(contextViewActive ? isVisibleContext(state, child.id) : showHiddenThoughts || isChildVisible(state, child))
    ) {
      return false
    } else {
      prev = child
      return false
    }
  })
  // redeclare prev to convince typescript that the type changed after `siblings.find`
  // otherwise it assumes that `find` has no side effect`
  const prevChild = prev as Thought | null

  return prevChild
}

export default prevSibling
