import React, { useEffect } from 'react'
import { DropTarget, DropTargetConnector, DropTargetMonitor } from 'react-dnd'
import { useSelector } from 'react-redux'
import DragThoughtItem from '../@types/DragThoughtItem'
import DragThoughtZone from '../@types/DragThoughtZone'
import State from '../@types/State'
import alert from '../action-creators/alert'
import deleteThought from '../action-creators/deleteThought'
import toggleAttribute from '../action-creators/toggleAttribute'
import { AlertText, AlertType } from '../constants'
import getThoughtById from '../selectors/getThoughtById'
import rootedParentOf from '../selectors/rootedParentOf'
import theme from '../selectors/theme'
import { store } from '../store'
import ellipsize from '../util/ellipsize'
import head from '../util/head'
import { SubthoughtsProps } from './Subthoughts'
import DeleteIcon from './icons/DeleteIcon'

/** Delete the thought on drop. */
const drop = (props: SubthoughtsProps, monitor: DropTargetMonitor) => {
  const state = store.getState()
  const { simplePath, zone } = monitor.getItem() as DragThoughtItem

  if (zone === DragThoughtZone.Favorites) {
    const value = getThoughtById(state, head(simplePath))?.value
    store.dispatch([
      toggleAttribute({ path: simplePath, values: ['=favorite', 'true'] }),
      alert(`Removed ${ellipsize(value)} from favorites`, {
        alertType: AlertType.DeleteThoughtComplete,
        clearDelay: 8000,
        showCloseLink: true,
      }),
    ])
  } else if (zone === DragThoughtZone.Thoughts) {
    const value = getThoughtById(state, head(simplePath))?.value
    store.dispatch([
      deleteThought({
        pathParent: rootedParentOf(state, simplePath),
        thoughtId: head(simplePath),
      }),
      alert(`Deleted ${ellipsize(value)}`, {
        alertType: AlertType.DeleteThoughtComplete,
        clearDelay: 8000,
        showCloseLink: true,
      }),
    ])
  } else {
    console.error(`Unsupported DragThoughtZone: ${zone}`)
  }
}

/** Show an alert on hover that notifies the user the thought will be deleted if dropped on the icon. */
const hover = (isHovering: boolean, zone: DragThoughtZone) => {
  const state = store.getState()
  const value = state.draggingThought && getThoughtById(state, head(state.draggingThought))?.value

  if (isHovering || state.alert?.alertType === AlertType.DeleteDropHint) {
    const message = isHovering
      ? zone === DragThoughtZone.Thoughts
        ? `Drop to delete ${ellipsize(value!)}`
        : `Remove ${ellipsize(value!)} from favorites`
      : zone === DragThoughtZone.Thoughts
      ? AlertText.DragAndDrop
      : AlertText.ReorderFavorites
    store.dispatch(
      alert(message, {
        alertType: isHovering ? AlertType.DeleteDropHint : AlertType.DragAndDropHint,
        showCloseLink: false,
      }),
    )
  }
}

/** Creates the props for drop. */
const dropCollect = (connect: DropTargetConnector, monitor: DropTargetMonitor) => ({
  dropTarget: connect.dropTarget(),
  isDragInProgress: !!monitor.getItem(),
  zone: monitor.getItem()?.zone || null,
  isHovering: monitor.isOver({ shallow: true }),
})

/** An icon that a thought can be dropped on to delete. */
const DeleteDrop = ({ dropTarget, isDragInProgress, isHovering, zone }: ReturnType<typeof dropCollect>) => {
  const dark = useSelector((state: State) => theme(state) !== 'Light')
  const fontSize = useSelector((state: State) => state.fontSize)

  useEffect(() => {
    hover(isHovering, zone)
  }, [isHovering])

  return dropTarget(
    <div
      className='delete-drop z-index-stack'
      style={{
        padding: '1em 0 1em 1em',
        borderRadius: '999px 0 0 999px',
        backgroundColor: isHovering ? 'rgba(40,40,40,0.8)' : 'rgba(30,30,30,0.8)',
      }}
    >
      <DeleteIcon
        size={fontSize * 1.5}
        fill={isHovering ? (dark ? 'lightblue' : 'royalblue') : dark ? 'white' : 'black'}
        // disable default .icon transition so that highlight is immediate
        style={{ cursor: 'move', transition: 'none', verticalAlign: 'middle' }}
      />
    </div>,
  )
}

export default DropTarget('thought', { drop }, dropCollect)(DeleteDrop)
