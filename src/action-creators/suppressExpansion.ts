import Thunk from '../@types/Thunk'
import setCursor from '../action-creators/setCursor'
import globals from '../globals'

let timer: ReturnType<typeof setTimeout> // eslint-disable-line fp/no-let

interface Options {
  cancel?: boolean
  duration?: number
}

/** Supress context expansion for a given duration. */
const suppressExpansion =
  ({ cancel, duration }: Options = {}): Thunk =>
  (dispatch, getState) => {
    /** Cancels suppressExpansion and sets the cursor to re-trigger expandThoughts. */
    const disableSuppressExpansion = () => {
      globals.suppressExpansion = false
      const { cursor, noteFocus } = getState()
      dispatch(setCursor({ path: cursor, noteFocus: noteFocus })) // preserve noteFocus
    }

    /** Enables the global suppressExpansion flag. */
    const enableSuppressExpansion = () => {
      globals.suppressExpansion = true
    }

    clearTimeout(timer)
    if (cancel) {
      disableSuppressExpansion()
    } else {
      enableSuppressExpansion()

      // if a duration was specified, re-enable expansion after short delay
      if (duration) {
        timer = setTimeout(() => {
          if (globals.suppressExpansion) {
            disableSuppressExpansion()
          }
        }, duration)
      }
    }
  }

export default suppressExpansion
