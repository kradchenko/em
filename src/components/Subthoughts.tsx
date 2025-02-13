import classNames from 'classnames'
import _ from 'lodash'
import React, { useEffect, useMemo, useState } from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { connect, useSelector } from 'react-redux'
import Autofocus from '../@types/Autofocus'
import DragThoughtZone from '../@types/DragThoughtZone'
import DropThoughtZone from '../@types/DropThoughtZone'
import GesturePath from '../@types/GesturePath'
import LazyEnv from '../@types/LazyEnv'
import Path from '../@types/Path'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import ThoughtType from '../@types/Thought'
import ThoughtId from '../@types/ThoughtId'
import dragInProgress from '../action-creators/dragInProgress'
import { isTouch } from '../browser'
import { HOME_TOKEN, MAX_DEPTH, MAX_DISTANCE_FROM_CURSOR } from '../constants'
import globals from '../globals'
import appendChildPath from '../selectors/appendChildPath'
import attribute from '../selectors/attribute'
import childIdsToThoughts from '../selectors/childIdsToThoughts'
import findDescendant from '../selectors/findDescendant'
import getChildPath from '../selectors/getChildPath'
import {
  childrenFilterPredicate,
  getAllChildren,
  getAllChildrenAsThoughts,
  getAllChildrenSorted,
  getChildren,
  getChildrenRanked,
} from '../selectors/getChildren'
import getContexts from '../selectors/getContexts'
import getContextsSortedAndRanked from '../selectors/getContextsSortedAndRanked'
import getSortPreference from '../selectors/getSortPreference'
import getStyle from '../selectors/getStyle'
import getThoughtById from '../selectors/getThoughtById'
import isContextViewActive from '../selectors/isContextViewActive'
import rootedParentOf from '../selectors/rootedParentOf'
import themeColors from '../selectors/themeColors'
import thoughtToPath from '../selectors/thoughtToPath'
import { formatKeyboardShortcut, shortcutById } from '../shortcuts'
import { store } from '../store'
import checkIfPathShareSubcontext from '../util/checkIfPathShareSubcontext'
import equalPath from '../util/equalPath'
import hashPath from '../util/hashPath'
import head from '../util/head'
import headValue from '../util/headValue'
import isAbsolute from '../util/isAbsolute'
import isAttribute from '../util/isAttribute'
import isDescendant from '../util/isDescendant'
import isDescendantPath from '../util/isDescendantPath'
import isDivider from '../util/isDivider'
import isRoot from '../util/isRoot'
import once from '../util/once'
import parentOf from '../util/parentOf'
import parseJsonSafe from '../util/parseJsonSafe'
import parseLet from '../util/parseLet'
import pathToContext from '../util/pathToContext'
import safeRefMerge from '../util/safeRefMerge'
import unroot from '../util/unroot'
import DragAndDropSubthoughts from './DragAndDropSubthoughts'
import GestureDiagram from './GestureDiagram'
import SubthoughtsDropEmpty from './Subthoughts/SubthoughtsDropEmpty'
import SubthoughtsDropEnd from './Subthoughts/SubthoughtsDropEnd'
import useZoom from './Subthoughts/useZoom'
import Thought from './Thought'

/** The type of the exported Subthoughts. */
export interface SubthoughtsProps {
  allowSingleContext?: boolean
  allowSingleContextParent?: boolean
  childrenForced?: ThoughtId[]
  depth?: number
  env?: string
  expandable?: boolean
  isHeader?: boolean
  showContexts?: boolean
  simplePath: SimplePath
  path?: Path
}

// omit env since it is stringified in mapStateeToProps
export type ConnectedSubthoughtsProps = Omit<SubthoughtsProps, 'env'> & ReturnType<typeof mapStateToProps>

/** Props needed for drag-and-drop behavior. Must match the return type of dropCollect in DragAndDropSubthoughts. (We cannot import the type directly since it creates a circular import). */
interface SubthoughtsDropCollect {
  dropTarget?: ConnectDropTarget
  isHovering?: boolean
}

// assert shortcuts at load time
const subthoughtShortcut = shortcutById('newSubthought')
// const toggleContextViewShortcut = shortcutById('toggleContextView')
if (!subthoughtShortcut) throw new Error('newSubthought shortcut not found.')
// @MIGRATION_NOTE: toogle view is disabled for the migration
// if (!toggleContextViewShortcut) throw new Error('toggleContextView shortcut not found.')

const PAGINATION_SIZE = 100
const EMPTY_OBJECT = {}

/** Check if the given thought is a leaf. */
const isLeaf = (state: State, id: ThoughtId) => getChildren(state, id).length === 0

/** Finds the the first env entry with =focus/Zoom. O(children). */
const findFirstEnvContextWithZoom = (state: State, { id, env }: { id: ThoughtId; env: LazyEnv }): ThoughtId | null => {
  const children = getAllChildrenAsThoughts(state, id)
  const child = children.find(
    child => isAttribute(child.value) && attribute(state, env[child.value], '=focus') === 'Zoom',
  )
  return child ? findDescendant(state, env[child.value], ['=focus', 'Zoom']) : null
}

/********************************************************************
 * mapStateToProps
 ********************************************************************/

// eslint-disable-next-line jsdoc/require-jsdoc
const mapStateToProps = (state: State, props: SubthoughtsProps) => {
  const { cursor, showHiddenThoughts, rootContext, expandedBottom, expandHoverTopPath } = state

  const isAbsoluteContext = isAbsolute(rootContext)

  const resolvedPath = props.path ?? props.simplePath

  // check if the cursor is editing an thought directly
  const isEditing = equalPath(cursor, resolvedPath)

  const pathLive = isEditing ? cursor! : resolvedPath
  const showContexts = props.showContexts || isContextViewActive(state, pathLive)
  const showContextsParent = isContextViewActive(state, rootedParentOf(state, pathLive))

  const simplePath = showContexts && showContextsParent ? rootedParentOf(state, props.simplePath) : props.simplePath

  const idLive = head(simplePath)

  // check if the cursor path includes the current thought
  // include ROOT to prevent re-render when ROOT subthought changes
  const isEditingPath = isRoot(simplePath) || isDescendantPath(cursor, simplePath) // resolvedPath?

  const contextBinding = parseJsonSafe(attribute(state, head(simplePath), '=bindContext') ?? '', undefined) as
    | Path
    | undefined

  // If the cursor is a leaf, use cursorDepth of cursor.length - 1 so that the autofocus stays one level zoomed out.
  // This feels more intuitive and stable for moving the cursor in and out of leaves.
  // In this case, the grandparent must be given the cursor-parent className so it is not hidden (below)
  // TODO: Resolve cursor to a simplePath
  const isCursorLeaf = cursor && isLeaf(state, head(cursor))

  const cursorDepth = cursor ? cursor.length - (isCursorLeaf ? 1 : 0) : 0

  // Note: If there is an active expand top path then distance should be caculated with reference of expandTopDistance
  const referenceDepth = expandHoverTopPath ? unroot(expandHoverTopPath).length + 1 : cursorDepth

  const distance = referenceDepth
    ? Math.max(0, Math.min(MAX_DISTANCE_FROM_CURSOR, referenceDepth - (props.depth ?? 0)))
    : 0

  // TODO: Memoize childrenFiltered and pass to render instead of using dummy values to force a re-render
  const allChildren = showContexts ? getContexts(state, headValue(state, simplePath)) : getAllChildren(state, idLive)

  // encode the children's values and ranks, since the allChildren array will not change when ranks change (i.e. moveThoughtUp/Down)
  // this can be removed once childrenFiltered is memoized and passed to render
  const allChildrenValuesAndRanks = allChildren
    .map(childId => {
      if (showContexts) {
        // if ancestors have not loaded, return childId
        // TODO: thoughtToPath can return an invalid non-root path that starts with HOME_TOKEN. It should return null instead.
        // However, the current logic uses HOME_TOKEN to determine that the ancestors of a context are still loading.
        const path = thoughtToPath(state, childId)
        if (path[0] === HOME_TOKEN) return childId

        // if any ancestors are missing, return childId
        const ancestors = path.map(id => getThoughtById(state, id))
        if (!ancestors.every(Boolean)) return childId

        // otherwise return ancestor hash
        return ancestors.map(thought => `${thought?.value}-${thought?.rank}`).join('\x00__SEP1__')
      } else {
        const child = getThoughtById(state, childId)
        return `${child?.value}-${child?.rank}`
      }
    })
    .join('\x00__SEP2__')

  const firstChilId = allChildren[0]

  const hasChildrenLoaded = showContexts
    ? !getContextsSortedAndRanked(state, headValue(state, simplePath)).some(
        thought => thought.pending || !getThoughtById(state, thought.parentId),
      )
    : !!(firstChilId && getThoughtById(state, firstChilId))

  const cursorSubthoughtIndex = cursor ? checkIfPathShareSubcontext(cursor, resolvedPath) : -1

  const isAncestorOfCursor =
    cursor && resolvedPath.length === cursorSubthoughtIndex + 1 && cursor?.length > resolvedPath.length

  const maxDistance = MAX_DISTANCE_FROM_CURSOR - (isCursorLeaf ? 1 : 2)

  const isDescendantOfCursor =
    cursor && cursor.length === cursorSubthoughtIndex + 1 && resolvedPath.length > cursor?.length

  const isCursor = cursor && resolvedPath.length === cursorSubthoughtIndex + 1 && resolvedPath.length === cursor?.length
  const isCursorParent = cursor && isAncestorOfCursor && cursor.length - resolvedPath.length === 1

  // first visible thought at the top
  const firstVisiblePath =
    state.expandHoverTopPath ||
    (cursor && cursor.length > maxDistance ? (cursor?.slice(0, -maxDistance) as Path) : null)

  const isDescendantOfFirstVisiblePath =
    !firstVisiblePath ||
    isRoot(firstVisiblePath) ||
    // TODO: Why doesn't isDescendantPath work here? Even when excluding equality.
    isDescendant(pathToContext(state, firstVisiblePath), pathToContext(state, resolvedPath))

  // The thoughts that are not the ancestor of cursor or the descendants of first visible thought should be shifted left and hidden.
  const shouldShiftAndHide = !isAncestorOfCursor && !isDescendantOfFirstVisiblePath

  /*
    Note:

    # Thoughts that should not be dimmed
      - Cursor and its descendants.
      - Thoughts that are both descendant of the first visible thought and ancestor of the cursor.
      - Siblings of the cursor if the cursor is a leaf thought.

    # Thoughts that should be dimmed
      - first visible thought should be dimmed if it is not direct parent of the cursor.
      - Besides the above mentioned thoughts in the above "should not dim section", all the other thoughts that are descendants of the first visible thought should be dimmed.
  */
  const shouldDim =
    cursor && isDescendantOfFirstVisiblePath && !(isCursorParent && isCursorLeaf) && !isCursor && !isDescendantOfCursor

  /*
    Note: `shouldShiftAndHide` and `shouldDim` needs to be calculated here because autofocus implementation takes only depth into account. But some thoughts needs to be shifted, hidden or dimmed due to their position relative to the cursor.
  */

  // merge ancestor env into self env
  // only update the env object reference if there are new additions to the environment
  // otherwise props changes and causes unnecessary re-renders
  const envSelf = parseLet(state, simplePath)
  const envParsed: LazyEnv = JSON.parse(props.env || '{}')
  const env = Object.keys(envSelf).length > 0 ? { ...envParsed, ...envSelf } : envParsed || EMPTY_OBJECT

  /*
    Note: The following properties are applied to the immediate children with given class.

    autofocus-show fully visible
    autofocus-dim dimmed
    autofocus-hide shifted left and hidden
    autofocus-hide-parent shiifted left and hidden

    Note: This doesn't fully account for the visibility. There are other additional classes that can affect opacity. For example cursor and its expanded descendants are always visible with full opacity.
  */
  const actualDistance = shouldShiftAndHide ? 2 : shouldDim ? 1 : distance

  const sortPreference = getSortPreference(state, idLive)

  const hashedPath = hashPath(pathLive)

  /** Returns true if the thought is in table view and has more than two columns. This is the case when every row has at least two matching children in column 2. If this is the case, it will get rendered in multi column mode where grandchildren are used as header columns. */
  const isMultiColumnTable = () => {
    const view = attribute(state, head(simplePath), '=view')
    if (view !== 'Table') return false
    const childrenFiltered = allChildren
      .map(childId => getThoughtById(state, childId))
      .filter(child => child && !isAttribute(child.value))

    if (childrenFiltered.length === 0) return false

    const firstColumnId = findDescendant(state, idLive, childrenFiltered[0].value)
    const firstColumnChildren = getAllChildren(state, firstColumnId)
      .map(childId => getThoughtById(state, childId))
      .filter(child => child && !isAttribute(child.value))

    // create a map of column headers from the first row for O(1) lookup when checking other rows
    const columnMap = firstColumnChildren.reduce((accum, child) => ({ ...accum, [child.value]: true }), {})

    const otherChildren = childrenFiltered.slice(1).map(child => {
      const grandchildren = getAllChildren(state, child.id)
        .map(childId => getThoughtById(state, childId))
        .filter(child => child && !isAttribute(child.value))
      return grandchildren
    })

    const isMultiColumn =
      otherChildren.length > 0 &&
      otherChildren.every(children => children.filter(child => child.value in columnMap).length >= 2)

    return isMultiColumn
  }

  return {
    contextBinding,
    distance,
    actualDistance,
    // stringify for deep equals comparison
    env: JSON.stringify(env),
    isAbsoluteContext,
    isEditing,
    isEditingPath,
    // expand thought due to cursor and hover expansion
    isExpanded: !!state.expanded[hashedPath] || !!expandedBottom?.[hashedPath],
    isMultiColumnTable: isMultiColumnTable(),
    showContexts,
    showHiddenThoughts,
    simplePath,
    // pass sortType and sortDirection since they are scalars
    // passing sortPreference directly would re-render the component each time, since the preference object reference changes
    sortType: sortPreference.type,
    sortDirection: sortPreference.direction,
    // Re-render when children have been loaded into the thoughtIndex and when any child's value or rank changes
    __hasChildrenLoaded: hasChildrenLoaded,
    __allChildrenValuesAndRanks: allChildrenValuesAndRanks,
    // We need to re-render when actualDistance changes, but it is complicated and expensive.
    // Until actualDistance gets refactored and optimized, we can provide a quick fix for any observed rendering issues.
    // The only rendering issue observed so far is when the cursor changes from a leaf thought in the home context (actualDistance: 1) to null (actualDistance: 0).
    // This is especially fragile since other code may accidentally rely on this to re-render the component.
    // If optimizing or testing re-rendering, it would be best to remove this line.
    __noCursorRoot: isRoot(simplePath) && state.cursor === null,
  }
}

/********************************************************************
 * Component
 ********************************************************************/

/** A message that says there are no children in this context. */
const NoChildren = ({
  allowSingleContext,
  children,
  simplePath,
}: {
  allowSingleContext?: boolean
  children: ThoughtId[]
  simplePath: SimplePath
}) => {
  const value = useSelector((state: State) => getThoughtById(state, head(simplePath))?.value)
  const colors = useSelector(themeColors)

  return (
    <div className='children-subheading text-note text-small'>
      This thought is not found in any {children.length === 0 ? '' : 'other'} contexts.
      <br />
      <br />
      <span>
        {isTouch ? (
          <span className='gesture-container'>
            Swipe <GestureDiagram path={subthoughtShortcut.gesture as GesturePath} size={30} color={colors.gray66} />
          </span>
        ) : (
          <span>Type {formatKeyboardShortcut(subthoughtShortcut.keyboard!)}</span>
        )}{' '}
        to add "{value}" to a new context.
      </span>
      <br />
      {allowSingleContext ? (
        'A floating context... how interesting.'
      ) : (
        // @MIGRATION_NOTE: toogle view is disabled for the migration
        // <span>
        //   {isTouch ? (
        //     <span className='gesture-container'>
        //       Swipe{' '}
        //       <GestureDiagram
        //         path={toggleContextViewShortcut.gesture as GesturePath}
        //         size={30}
        //         color={colors.gray66} /* mtach .children-subheading color */
        //       />
        //     </span>
        //   ) : (
        //     <span>Type {formatKeyboardShortcut(toggleContextViewShortcut.keyboard!)}</span>
        //   )}{' '}
        //   to return to the normal view.
        // </span>
        <></>
      )}
    </div>
  )
}

/**
 * The static Subthoughts component.
 *
 * @param allowSingleContext         Allow showing a single context in context view. Default: false.
 * @param allowSingleContextParent   Pass through to Subthought since the SearchSubthoughts component does not have direct access. Default: false.
 */
export const SubthoughtsComponent = ({
  allowSingleContext,
  allowSingleContextParent,
  childrenForced,
  contextBinding,
  depth = 0,
  distance,
  dropTarget,
  env,
  isEditing,
  isEditingPath,
  isExpanded,
  isHeader,
  isHovering,
  isMultiColumnTable,
  path,
  showContexts,
  simplePath,
  sortDirection: contextSortDirection,
  sortType: contextSortType,
}: // omit env since it is stringified
Omit<SubthoughtsProps, 'env'> & SubthoughtsDropCollect & ReturnType<typeof mapStateToProps>) => {
  // <Subthoughts> render
  const state = store.getState()
  const [page, setPage] = useState(1)
  const { cursor } = state
  const thoughtId = head(simplePath)
  const thought = getThoughtById(state, head(simplePath))
  const { value } = thought
  const resolvedPath = path ?? simplePath
  const envParsed = JSON.parse(env || '{}') as LazyEnv

  const show = useSelector((state: State) => {
    /** Returns true if the cursor is on an ancestor of the path. Editing a context in the context view does not count as editing an ancestor. */
    const isEditingAncestor = () => isEditingPath && !isEditing && !(path && isContextViewActive(state, parentOf(path)))
    return depth < MAX_DEPTH && (isExpanded || isEditingAncestor())
  })

  // useWhyDidYouUpdate('All <Subthoughts> ' + prettyPath(state, simplePath), {
  //   allowSingleContext,
  //   allowSingleContextParent,
  //   childrenForced,
  //   contextBinding,
  //   depth,
  //   distance,
  //   dropTarget,
  //   env,
  //   isEditing,
  //   isEditingPath,
  //   isExpanded,
  //   isHeader,
  //   isHovering,
  //   isMultiColumnTable,
  //   path,
  //   showContexts,
  //   simplePath,
  //   sortDirection: contextSortDirection,
  //   sortType: contextSortType,
  // })

  const { zoom, zoomCursor, zoomParent } = useZoom({ env: envParsed, isEditing, isEditingPath, simplePath })

  // when Subthoughts is hovered over during drag, update the hoveringPath and hoverId
  // check dragInProgress to ensure the drag has not been aborted (e.g. by shaking)
  useEffect(() => {
    if (isHovering && store.getState().dragInProgress) {
      store.dispatch(
        dragInProgress({
          value: true,
          draggingThought: state.draggingThought,
          hoveringPath: path,
          hoverZone: DropThoughtZone.SubthoughtsDrop,
          sourceZone: DragThoughtZone.Thoughts,
        }),
      )
    }
  }, [isHovering])

  // disable intrathought linking until add, edit, delete, and expansion can be implemented
  // const subthought = once(() => getSubthoughtUnderSelection(headValue(simplePath), 3))
  const children =
    childrenForced || showContexts
      ? getContextsSortedAndRanked(state, headValue(state, simplePath))
      : contextSortType !== 'None'
      ? getAllChildrenSorted(state, thoughtId)
      : getChildrenRanked(state, head(simplePath))

  const cursorThoughtArray = cursor && childIdsToThoughts(state, cursor)
  // Ensure that editable newThought is visible.
  const editIndex =
    cursor && children && show && cursorThoughtArray
      ? children.findIndex(child => {
          return cursor[depth] && cursorThoughtArray[depth].rank === child.rank
        })
      : 0
  const filteredChildren = children.filter(childrenFilterPredicate(state, simplePath))

  const childrenAttributeId = useSelector(
    (state: State) =>
      (value !== '=children' &&
        getAllChildrenAsThoughts(state, thought.id).find(child => child.value === '=children')?.id) ||
      null,
  )
  const grandchildrenAttributeId = useSelector(
    (state: State) =>
      (value !== '=grandchildren' &&
        getAllChildrenAsThoughts(state, thought.parentId).find(child => child.value === '=grandchildren')?.id) ||
      null,
  )

  const hideBulletsChildren = useSelector((state: State) => attribute(state, childrenAttributeId, '=bullet') === 'None')
  const hideBulletsGrandchildren = useSelector(
    (state: State) => attribute(state, grandchildrenAttributeId, '=bullet') === 'None',
  )

  const styleChildren = useSelector((state: State) => getStyle(state, childrenAttributeId), _.isEqual)
  const styleGrandchildren = useSelector((state: State) => getStyle(state, grandchildrenAttributeId), _.isEqual)
  const styleContainerChildren = useSelector(
    (state: State) => getStyle(state, childrenAttributeId, { attributeName: '=styleContainer' }),
    _.isEqual,
  )
  const styleContainerGrandchildren = useSelector(
    (state: State) => getStyle(state, grandchildrenAttributeId, { attributeName: '=styleContainer' }),
    _.isEqual,
  )

  const proposedPageSize = PAGINATION_SIZE * page
  if (editIndex > proposedPageSize - 1) {
    setPage(page + 1)
    return null
  }
  const isPaginated = show && filteredChildren.length > proposedPageSize

  /** Calculates the autofocus state to hide or dim thoughts.
   * Note: The following properties are applied to the immediate children with given class.
   * - autofocus-show fully visible
   * - autofocus-dim dimmed
   * - autofocus-hide shifted left and hidden
   * - autofocus-hide-parent shiifted left and hidden
   * Note: This doesn't fully account for the visibility. There are other additional classes that can affect opacity. For example cursor and its expanded descendants are always visible with full opacity.
   */
  const actualDistance = once(() => {
    /*
    Note:

    # Thoughts that should not be dimmed
      - Cursor and its descendants.
      - Thoughts that are both descendant of the first visible thought and ancestor of the cursor.
      - Siblings of the cursor if the cursor is a leaf thought.

    # Thoughts that should be dimmed
      - first visible thought should be dimmed if it is not direct parent of the cursor.
      - Besides the above mentioned thoughts in the above "should not dim section", all the other thoughts that are descendants of the first visible thought should be dimmed.

    Note: `shouldShiftAndHide` and `shouldDim` needs to be calculated here because autofocus implementation takes only depth into account. But some thoughts needs to be shifted, hidden or dimmed due to their position relative to the cursor.
    */

    const isCursorLeaf = cursor && isLeaf(state, head(cursor))

    const maxDistance = MAX_DISTANCE_FROM_CURSOR - (isCursorLeaf ? 1 : 2)

    // first visible thought at the top
    const firstVisiblePath =
      state.expandHoverTopPath ||
      (cursor && cursor.length - maxDistance > 0 ? (cursor.slice(0, -maxDistance) as Path) : null)

    const isDescendantOfFirstVisiblePath =
      !firstVisiblePath ||
      isRoot(firstVisiblePath) ||
      // TODO: Why doesn't isDescendantPath work here? Even when excluding equality.
      isDescendant(pathToContext(state, firstVisiblePath), pathToContext(state, resolvedPath))

    const cursorSubthoughtIndex = once(() => (cursor ? checkIfPathShareSubcontext(cursor, resolvedPath) : -1))

    const isAncestorOfCursor =
      cursor && cursor.length > resolvedPath.length && resolvedPath.length === cursorSubthoughtIndex() + 1

    const isCursor =
      cursor && resolvedPath.length === cursorSubthoughtIndex() + 1 && resolvedPath.length === cursor?.length

    /** Returns true if the resolvedPath is a descendant of the cursor. */
    const isDescendantOfCursor = () =>
      cursor && resolvedPath.length > cursor.length && cursor.length === cursorSubthoughtIndex() + 1

    // thoughts that are not the ancestor of cursor or the descendants of first visible thought should be shifted left and hidden.
    const shouldShiftAndHide = !isAncestorOfCursor && !isDescendantOfFirstVisiblePath

    const isCursorParent = cursor && isAncestorOfCursor && cursor.length - resolvedPath.length === 1

    /** Returns true if the children should be dimmed by the autofocus. */
    const shouldDim = () =>
      cursor &&
      isDescendantOfFirstVisiblePath &&
      !(isCursorParent && isCursorLeaf) &&
      !isCursor &&
      !isDescendantOfCursor()

    return shouldShiftAndHide || zoom ? 2 : shouldDim() ? 1 : distance
  })

  /** In a Multi Column table, gets the children that serve as the column headers. */
  const headerChildrenWithFirstColumn = () => {
    if (!isMultiColumnTable) return []
    const headerChildren = getAllChildren(state, filteredChildren[0]?.id)
      .map(childId => getThoughtById(state, childId))
      .filter(x => x && !isAttribute(x.value))
    return isMultiColumnTable ? ([{ headerFirstColumn: true }, ...headerChildren] as typeof headerChildren) : []
  }

  /** Returns the base autofocus for all subthoughts based on the actual distance from the cursor. This will be overwridden for specific children, e.g. if the cursor is on a child it will be set to 'show'. */
  const autofocus = (): Autofocus => {
    const distance = actualDistance()
    return distance === 0 ? 'show' : distance === 1 ? 'dim' : distance === 2 ? 'hide' : 'hide-parent'
  }

  return (
    <>
      {contextBinding && showContexts ? (
        <div className='text-note text-small'>(Bound to {pathToContext(state, contextBinding!).join('/')})</div>
      ) : null}
      {show && showContexts && !(filteredChildren.length === 0 && isRoot(simplePath)) ? (
        filteredChildren.length < (allowSingleContext ? 1 : 2) ? (
          // No children
          <NoChildren
            allowSingleContext={allowSingleContext}
            children={children.map(({ id }) => id)}
            simplePath={simplePath}
          />
        ) : null
      ) : null}
      {show && filteredChildren.length > (showContexts && !allowSingleContext ? 1 : 0) ? (
        <ul
          aria-label='subthoughts'
          // lexemeIndex-thoughts={showContexts ? hashContext(unroot(pathToContext(simplePath))) : null}
          className={classNames({
            children: true,
            'context-chain': showContexts,
            [`autofocus-${autofocus()}`]: true,
            zoomCursor,
            zoomParent,
          })}
        >
          {
            /* TODO: Consolidate with filteredChildren items */
            isMultiColumnTable && (
              <li className='child is-multi-column'>
                {headerChildrenWithFirstColumn().map((child, i) => {
                  if ((child as any).headerFirstColumn) {
                    return <ul key=''></ul>
                  }

                  if (i >= proposedPageSize) {
                    return null
                  }

                  // TODO: childPath should be unrooted, but if we change it it breaks
                  // figure out what is incorrectly depending on childPath being rooted
                  const childPath = getChildPath(state, child.id, simplePath, showContexts)
                  const childEnvZoomId = once(() =>
                    findFirstEnvContextWithZoom(state, { id: child.id, env: envParsed }),
                  )

                  /** Returns true if the cursor is contained within the child path, i.e. the child is a descendant of the cursor. */
                  const isEditingChildPath = once(() => isDescendantPath(state.cursor, childPath))

                  /** Gets the =focus/Zoom/=style of the child path. */
                  const styleZoom = () => {
                    const zoomId = findDescendant(state, child.id, ['=focus', 'Zoom'])
                    return getStyle(state, zoomId)
                  }

                  const style = {
                    ...styleGrandchildren,
                    ...styleChildren,
                    ...(isEditingChildPath()
                      ? {
                          ...styleZoom(),
                          ...getStyle(state, childEnvZoomId()),
                        }
                      : null),
                  }

                  const styleContainer = safeRefMerge(styleContainerGrandchildren, styleContainerChildren)

                  const appendedChildPath = appendChildPath(state, childPath, path)
                  const isChildCursor = cursor && equalPath(appendedChildPath, state.cursor)
                  /*
            simply using index i as key will result in very sophisticated rerendering when new Empty thoughts are added.
            The main problem is that when a new Thought is added it will get key (index) of the previous thought,
            causing React DOM to think it as old component that needs re-render and thus the new thoughyt won't be able to mount itself as a new component.

            By using child's rank we have unique key for every new thought.
            Using unique rank will help React DOM to properly identify old components and the new one. Thus eliminating sophisticated
            re-renders.
          */
                  return child ? (
                    <ul className='children' key={child.id}>
                      <Thought
                        allowSingleContext={allowSingleContextParent}
                        depth={depth + 1}
                        env={env}
                        hideBullet={true}
                        rank={child.rank}
                        isVisible={
                          // if thought is a zoomed cursor then it is visible
                          (isChildCursor && !!zoomCursor) ||
                          actualDistance() < 2 ||
                          (distance === 2 && isEditingChildPath())
                        }
                        showContexts={showContexts}
                        prevChildId={filteredChildren[i - 1]?.id}
                        style={{
                          // disable pointer interaction until we can handle column header editing
                          // otherwise it edits them only for the first row (and seems to create a circular context for some reason)
                          cursor: 'default',
                          fontWeight: 'bold',
                          pointerEvents: 'none',
                          ...style,
                        }}
                        styleContainer={styleContainer || undefined}
                        path={appendedChildPath}
                        simplePath={childPath}
                        isMultiColumnTable={isMultiColumnTable}
                        isHeader={isHeader}
                      />
                    </ul>
                  ) : null
                })}
              </li>
            )
          }
          {filteredChildren.map(
            (child, i) =>
              i < proposedPageSize && (
                <SubthoughtMemo
                  actualDistance={actualDistance()}
                  allowSingleContext={allowSingleContextParent}
                  child={child}
                  depth={depth}
                  distance={distance}
                  env={env}
                  hideBullet={hideBulletsChildren || hideBulletsGrandchildren}
                  key={child.id}
                  prevChildId={filteredChildren[i - 1]?.id}
                  styleContainerChildren={styleContainerChildren || undefined}
                  styleContainerGrandchildren={styleContainerGrandchildren || undefined}
                  autofocus={autofocus()}
                  index={i}
                  isHeader={isHeader}
                  isMultiColumnTable={isMultiColumnTable}
                  zoomCursor={zoomCursor}
                  path={path}
                  showContexts={showContexts}
                  parentPath={simplePath}
                  styleChildren={styleChildren || undefined}
                  styleGrandchildren={styleGrandchildren || undefined}
                />
              ),
          )}
          {(autofocus() === 'show' || autofocus() === 'dim') &&
            (dropTarget || globals.simulateDrag || globals.simulateDrop) && (
              <SubthoughtsDropEnd
                depth={depth}
                distance={distance}
                dropTarget={dropTarget}
                isHovering={isHovering}
                simplePath={simplePath}
                // Extend the click area of the drop target when there is nothing below.
                // Always extend the root subthught drop target.
                // The last visible drop-end will always be a dimmed thought at distance 1 (an uncle).
                // Dimmed thoughts at distance 0 should not be extended, as they are dimmed siblings and sibling descendants that have thoughts below
                last={isRoot(simplePath) || (distance === 1 && autofocus() === 'dim')}
              />
            )}
        </ul>
      ) : (
        dropTarget &&
        (autofocus() === 'show' || autofocus() === 'dim') &&
        // even though canDrop will prevent a thought from being dropped on itself, we still should prevent rendering the drop target at all, otherwise it will obscure valid drop targets
        !equalPath(state.draggingThought, simplePath) && (
          <SubthoughtsDropEmpty
            isThoughtDivider={isDivider(value)}
            depth={depth}
            dropTarget={dropTarget}
            isHovering={isHovering}
            debugValue={globals.simulateDrop ? value : undefined}
          />
        )
      )}
      {isPaginated && distance !== 2 && (
        <a className='indent text-note' onClick={() => setPage(page + 1)}>
          More...
        </a>
      )}
    </>
  )
}

SubthoughtsComponent.displayName = 'SubthoughtsComponent'

/** Wraps a Thought component and calculates the child Path, style, etc. */
const Subthought = ({
  actualDistance,
  allowSingleContext,
  autofocus,
  child,
  depth,
  distance,
  env,
  hideBullet,
  index,
  isHeader,
  isMultiColumnTable,
  zoomCursor,
  parentPath,
  path,
  prevChildId,
  showContexts,
  styleChildren,
  styleGrandchildren,
  styleContainerChildren,
  styleContainerGrandchildren,
}: {
  actualDistance: number
  allowSingleContext?: boolean
  autofocus?: Autofocus
  child: ThoughtType
  depth: number
  distance: number
  env: string
  hideBullet?: boolean
  index?: number
  isHeader?: boolean
  isMultiColumnTable?: boolean
  zoomCursor?: boolean
  parentPath: SimplePath
  path?: Path
  prevChildId: ThoughtId
  showContexts: boolean
  styleChildren?: React.CSSProperties
  styleContainerChildren?: React.CSSProperties
  styleGrandchildren?: React.CSSProperties
  styleContainerGrandchildren?: React.CSSProperties
}) => {
  const state = store.getState()
  const { cursor } = state

  // getChildPath cannot be trivially memoized since it is not a pure function; its return value depends on which thoughts are loaded.
  // Memoizing it naively can result in not re-rendering contexts in the context view while they are loading.
  // There is no way to determine a priori whether a thought id's path to the root is fully loaded without traversing up the tree.
  // Instead we do a double memoization to minimize re-renders.
  const childPathUnstable = useMemo(
    // First, memoize the child path with, in addition to the parameters, the thought index (only if context view is activated, as full paths are guaranteed to be loaded in normal view).
    // This is O(depth) for each child, but is is only recalculated when the Subthoughts component is re-rendered; it won't trigger any additional re-renders of the child thought (due to the next memoization step).
    // However, childPathUnstable has a new object reference every time the thought index changes.
    () => getChildPath(state, child.id, parentPath, showContexts),
    [child.id, parentPath, showContexts, showContexts && state.thoughts.thoughtIndex],
  )
  // Second, therefore, memoize childPathUnstable based on its length, since we know that if thoughtToPath returns an array of the same length for the same id, then it is the same path.
  const childPath = useMemo(
    () => childPathUnstable,
    [child.id, parentPath, showContexts, showContexts && childPathUnstable.length],
  )

  const envParsed = JSON.parse(env || '{}')
  const childEnvZoomId = once(() => findFirstEnvContextWithZoom(state, { id: child.id, env: envParsed }))

  /** Returns true if the cursor is contained within the child path, i.e. the child is a descendant of the cursor. */
  const isEditingChildPath = once(() => isDescendantPath(state.cursor, childPath))

  /** Gets the =focus/Zoom/=style of the child path. */
  const styleZoom = () => {
    const zoomId = findDescendant(state, head(childPath), ['=focus', 'Zoom'])
    return getStyle(state, zoomId)
  }

  const style = {
    ...styleGrandchildren,
    ...(child.value !== '=children' ? styleChildren : null),
    ...(isEditingChildPath()
      ? {
          ...styleZoom(),
          ...getStyle(state, childEnvZoomId()),
        }
      : null),
  }

  const styleContainer = useMemo(
    () => safeRefMerge(styleContainerGrandchildren, styleContainerChildren),
    [styleContainerChildren, styleContainerGrandchildren],
  )

  // TODO: ROOT gets appended when isContextPending
  // What should appendedChildPath be?
  const appendedChildPath = appendChildPath(state, childPath, path)
  const isChildCursor = cursor && equalPath(appendedChildPath, cursor)
  const isParentCursor = cursor && equalPath(appendedChildPath, rootedParentOf(state, cursor))
  const isGrandparentCursor = cursor && equalPath(appendedChildPath, rootedParentOf(state, parentOf(cursor)))

  /*
              simply using index i as key will result in very sophisticated rerendering when new Empty thoughts are added.
              The main problem is that when a new Thought is added it will get key (index) of the previous thought,
              causing React DOM to think it as old component that needs re-render and thus the new thoughyt won't be able to mount itself as a new component.

              By using child's rank we have unique key for every new thought.
              Using unique rank will help React DOM to properly identify old components and the new one. Thus eliminating sophisticated
              re-renders.
            */

  // console.log('One <Subthought>', prettyPath(childPath))
  // useWhyDidYouUpdate('One <Subthought> ' + prettyPath(state, childPath), {
  //   actualDistance,
  //   allowSingleContext,
  //   autofocus,
  //   child,
  //   depth,
  //   distance,
  //   env,
  //   hideBullet,
  //   index,
  //   isHeader,
  //   isMultiColumnTable,
  //   zoomCursor,
  //   parentPath,
  //   path,
  //   prevChildId,
  //   showContexts,
  //   styleChildren,
  //   styleGrandchildren,
  //   styleContainerChildren,
  //   styleContainerGrandchildren,
  //   // hooks
  //   childPathUnstable,
  //   childPath,
  //   styleContainer,
  // })

  return child ? (
    <Thought
      autofocus={
        isChildCursor || (isParentCursor && distance === 1)
          ? 'show'
          : isParentCursor || (isGrandparentCursor && distance === 2)
          ? 'dim'
          : autofocus || 'show'
      }
      debugIndex={globals.simulateDrop ? index : undefined}
      depth={depth + 1}
      env={env}
      hideBullet={hideBullet}
      isContextPending={child.value === '__PENDING__'}
      isHeader={isHeader}
      isMultiColumnTable={isMultiColumnTable}
      isVisible={
        // if thought is a zoomed cursor then it is visible
        (isChildCursor && zoomCursor) || actualDistance < 2 || (distance === 2 && isEditingChildPath())
      }
      key={child.id}
      path={appendedChildPath}
      prevChildId={prevChildId}
      rank={child.rank}
      showContexts={showContexts}
      simplePath={childPath}
      style={Object.keys(style).length > 0 ? style : undefined}
      styleContainer={styleContainer || undefined}
    />
  ) : null
}

const SubthoughtMemo = React.memo(Subthought)
SubthoughtMemo.displayName = 'Subthought'

const Subthoughts = connect(mapStateToProps)(DragAndDropSubthoughts(SubthoughtsComponent))

export default Subthoughts
