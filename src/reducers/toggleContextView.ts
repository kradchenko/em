import * as immer from 'immer'
import Context from '../@types/Context'
import State from '../@types/State'
import { TUTORIAL2_STEP_CONTEXT_VIEW_TOGGLE } from '../constants'
import globals from '../globals'
import settings from '../reducers/settings'
import contextToThoughtId from '../selectors/contextToThoughtId'
import expandThoughts from '../selectors/expandThoughts'
import getContexts from '../selectors/getContexts'
import getSetting from '../selectors/getSetting'
import headValue from '../util/headValue'
import pathToContext from '../util/pathToContext'
import reducerFlow from '../util/reducerFlow'

/** Returns a new contextViews object with the given context toggled to the opposite of its previous value. */
const toggleContext = (state: State, context: Context) =>
  immer.produce(state.contextViews, draft => {
    const encoded = contextToThoughtId(state, context)
    if (encoded) {
      if (encoded in state.contextViews) {
        delete draft[encoded] // eslint-disable-line fp/no-delete
      } else {
        draft[encoded] = true
      }
    }
    return draft
  })

/** Toggles the context view on a given thought. */
const toggleContextView = (state: State) => {
  if (!state.cursor) return state

  const context = pathToContext(state, state.cursor)

  return reducerFlow([
    // update contextViews
    state => ({
      ...state,
      contextViews: toggleContext(state, context),
    }),

    // update context views and expanded
    state => ({
      ...state,
      expanded: globals.suppressExpansion ? {} : expandThoughts(state, state.cursor),
    }),

    // advance tutorial from context view toggle step
    state => {
      const tutorialStep = +(getSetting(state, 'Tutorial Step') || 0)
      return Math.floor(tutorialStep) === TUTORIAL2_STEP_CONTEXT_VIEW_TOGGLE
        ? settings(state, {
            key: 'Tutorial Step',
            value: (
              tutorialStep + (getContexts(state, headValue(state, state.cursor!)).length > 1 ? 1 : 0.1)
            ).toString(),
          })
        : state
    },
  ])(state)
}

export default toggleContextView
