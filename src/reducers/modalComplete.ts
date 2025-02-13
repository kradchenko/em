import _ from 'lodash'
import State from '../@types/State'

/** Closes a modal permanently. */
const modalComplete = (state: State, { id }: { id: string }) => ({
  ...state,
  showModal: null,
  modals: {
    ...state.modals,
    [id]: {
      ...state.modals[id],
      complete: true,
    },
  },
})

export default _.curryRight(modalComplete)
