import _ from 'lodash'
import State from '../@types/State'

/** Toggles the Toolbar Visibility. */
const toggleTopControlsAndBreadcrumbs = (state: State, { value }: { value?: boolean }) => ({
  ...state,
  showTopControls: value ?? !state.showTopControls,
  showBreadcrumbs: value ?? !state.showBreadcrumbs,
})

export default _.curryRight(toggleTopControlsAndBreadcrumbs)
