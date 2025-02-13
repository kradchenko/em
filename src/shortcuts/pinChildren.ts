import Shortcut from '../@types/Shortcut'
import alert from '../action-creators/alert'
import deleteAttribute from '../action-creators/deleteAttribute'
import setAttribute from '../action-creators/setAttribute'
import toggleAttribute from '../action-creators/toggleAttribute'
import PinChildrenIcon from '../components/icons/PinChildrenIcon'
import { HOME_PATH } from '../constants'
import attribute from '../selectors/attribute'
import findDescendant from '../selectors/findDescendant'
import { getAllChildren } from '../selectors/getChildren'
import simplifyPath from '../selectors/simplifyPath'
import appendToPath from '../util/appendToPath'
import head from '../util/head'

const pinChildrenShortcut: Shortcut = {
  id: 'pinChildren',
  label: 'Pin Open Subthoughts',
  description: "Pin open the current thought's subthoughts.",
  keyboard: { key: 'p', meta: true, shift: true },
  svg: PinChildrenIcon,
  canExecute: getState => !!getState().cursor,
  exec: (dispatch, getState, e, { type }) => {
    const state = getState()
    const { cursor } = state
    if (!cursor) return

    const simplePath = simplifyPath(state, cursor)
    const thoughtId = head(simplePath)

    // if the user used the keyboard to activate the shortcut, show an alert describing the sort direction
    // since the user won't have the visual feedbavk from the toolbar due to the toolbar hiding logic
    if (type === 'keyboard') {
      const pinned = findDescendant(state, thoughtId, ['=children', '=pin', 'true'])
      dispatch(
        alert(pinned ? 'Unpinned subthoughts' : 'Pinned subthoughts', { clearDelay: 2000, showCloseLink: false }),
      )
    }

    const childrenAttributeId = findDescendant(state, thoughtId, '=children')
    const pinned = attribute(state, childrenAttributeId, '=pin')
    const childrenIds = getAllChildren(state, thoughtId)

    dispatch([
      // if =children/=pin/true, toggle =children off
      // if =children/=pin/false, do nothing
      // otherwise toggle =children on
      ...(pinned !== 'false'
        ? [
            toggleAttribute({
              path: simplePath,
              values: ['=children', '=pin'],
            }),
          ]
        : []),
      // if pinning on, remove =pin/false from all subthoughts
      ...(pinned !== 'true'
        ? childrenIds.map(childId =>
            deleteAttribute({ path: appendToPath(simplePath, childId), values: ['=pin', 'false'] }),
          )
        : []),
      // set =children/=pin/true
      // setAttribute does nothing if childrenAttributeIdNew no longer exists?
      (dispatch, getState) => {
        const childrenAttributeIdNew = findDescendant(getState(), thoughtId, '=children')
        if (!childrenAttributeIdNew) return false
        dispatch(
          setAttribute({
            path: appendToPath(simplePath, childrenAttributeIdNew),
            values: ['=pin', 'true'],
          }),
        )
      },
    ])
  },
  isActive: getState => {
    const state = getState()
    const { cursor } = state
    const path = cursor ? simplifyPath(state, cursor) : HOME_PATH
    return !!findDescendant(state, head(path), ['=children', '=pin', 'true'])
  },
}

export default pinChildrenShortcut
