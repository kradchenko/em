import { unescape } from 'html-escaper'
import _ from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import { ViewStyle } from 'react-native'
import { connect } from 'react-redux'
import Connected from '../@types/Connected'
import Path from '../@types/Path'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import TutorialChoice from '../@types/TutorialChoice'
import cursorCleared from '../action-creators/cursorCleared'
import editThought from '../action-creators/editThought'
import error from '../action-creators/error'
import importText from '../action-creators/importText'
import newThought from '../action-creators/newThought'
import setCursor from '../action-creators/setCursor'
import setEditingValue from '../action-creators/setEditingValue'
import setInvalidState from '../action-creators/setInvalidState'
import tutorialNext from '../action-creators/tutorialNext'
import {
  EDIT_THROTTLE,
  EM_TOKEN,
  TUTORIAL2_STEP_CONTEXT1,
  TUTORIAL2_STEP_CONTEXT1_PARENT,
  TUTORIAL2_STEP_CONTEXT2,
  TUTORIAL2_STEP_CONTEXT2_PARENT,
  TUTORIAL_CONTEXT,
  TUTORIAL_CONTEXT1_PARENT,
  TUTORIAL_CONTEXT2_PARENT,
} from '../constants'
import * as selection from '../device/selection'
import attributeEquals from '../selectors/attributeEquals'
import findDescendant from '../selectors/findDescendant'
import { getAllChildrenAsThoughts } from '../selectors/getChildren'
import getContexts from '../selectors/getContexts'
import getLexeme from '../selectors/getLexeme'
import getSetting from '../selectors/getSetting'
import getThoughtById from '../selectors/getThoughtById'
import rootedParentOf from '../selectors/rootedParentOf'
import { shortcutEmitter } from '../shortcuts'
import { store } from '../store'
import addEmojiSpace from '../util/addEmojiSpace'
import appendToPath from '../util/appendToPath'
import ellipsize from '../util/ellipsize'
import ellipsizeUrl from '../util/ellipsizeUrl'
import equalPath from '../util/equalPath'
import head from '../util/head'
import headValue from '../util/headValue'
import isDivider from '../util/isDivider'
import isHTML from '../util/isHTML'
import isURL from '../util/isURL'
import parentOf from '../util/parentOf'
import strip from '../util/strip'
import stripEmptyFormattingTags from '../util/stripEmptyFormattingTags'
import ContentEditable, { ContentEditableEvent, IOnPaste } from './ContentEditable.native'

// the amount of time in milliseconds since lastUpdated before the thought placeholder changes to something more facetious
const EMPTY_THOUGHT_TIMEOUT = 5 * 1000

interface EditableProps {
  path: Path
  disabled?: boolean
  isEditing?: boolean
  rank: number
  style?: ViewStyle
  simplePath: SimplePath
  /* If transient is true:
    1. Instead of calling exisitingThoughtChange, it calls newThought to add the given child to the state.
    2. It also sets focus to itself on render.
  */
  transient?: boolean
  onEdit?: (args: { path: Path; oldValue: string; newValue: string }) => void
}

// track if a thought is blurring so that we can avoid an extra dispatch of setEditingValue in onFocus
// otherwise it can trigger unnecessary re-renders
// intended to be global, not local state
let blurring = false

// eslint-disable-next-line jsdoc/require-jsdoc
const mapStateToProps = (state: State, props: EditableProps) => {
  const thought = getThoughtById(state, head(props.simplePath))
  return {
    isCursorCleared: props.isEditing && state.cursorCleared,
    value: thought.value,
    rank: thought.rank,
  }
}

/**
 * An editable thought with throttled editing.
 * Use rank instead of headRank(simplePath) as it will be different for context view.
 */
const Editable = ({
  disabled,
  isCursorCleared,
  isEditing,
  simplePath,
  path,
  rank,
  value,
  style,
  onEdit,
  dispatch,
  transient,
}: Connected<EditableProps & ReturnType<typeof mapStateToProps>>) => {
  const state = store.getState()
  const thoughtId = head(simplePath)
  const parentId = head(rootedParentOf(state, simplePath))

  const readonly = findDescendant(state, thoughtId, '=readonly')
  const uneditable = findDescendant(state, thoughtId, '=uneditable')
  const optionsId = findDescendant(state, parentId, '=options')
  const childrenOptions = getAllChildrenAsThoughts(state, optionsId)
  const options = childrenOptions.length > 0 ? childrenOptions.map(thought => thought.value.toLowerCase()) : null
  const isTableColumn1 = attributeEquals(state, parentId, '=view', 'Table')
  // store the old value so that we have a transcendental head when it is changed
  const oldValueRef = useRef(value)
  const editableNonceRef = useRef(state.editableNonce)
  const [isTapped, setIsTapped] = useState(false)

  useEffect(() => {
    editableNonceRef.current = state.editableNonce
  }, [state.editableNonce])

  const lexeme = getLexeme(state, value)

  const labelId = findDescendant(state, parentId, '=label')
  const childrenLabel = getAllChildrenAsThoughts(state, labelId)

  // side effect to set old value ref to head value from updated simplePath.
  useEffect(() => {
    oldValueRef.current = headValue(state, simplePath)
  }, [headValue(state, simplePath)])

  useEffect(() => {
    // set value to old value
    oldValueRef.current = value
  }, [simplePath])

  /** Set or reset invalid state. */
  const invalidStateError = (invalidValue: string | null) => {
    const isInvalid = invalidValue != null
    store.dispatch(error({ value: isInvalid ? `Invalid Value: "${invalidValue}"` : null }))
    setInvalidState(isInvalid)

    // the Editable cannot connect to state.invalidState, as it would re-render during editing
    // instead, we use setContentInvalidState to manipulate the DOM directly
  }

  /** Set the cursor on the thought. */
  const setCursorOnThought = ({ editing }: { editing?: boolean } = {}) => {
    const { cursor, editing: editingMode } = store.getState() // use fresh state

    // do not set cursor if it is unchanged and we are not entering edit mode
    if ((!editing || editingMode) && equalPath(cursor, path)) return

    const isEditing = equalPath(cursor, path)

    const pathLive = cursor && isEditing ? appendToPath(parentOf(path), head(cursor)) : path

    dispatch(
      setCursor({
        cursorHistoryClear: true,
        editing,
        // set offset to null to prevent setting the selection on next render
        // to use the existing offset after a user clicks or touches the screent
        // when cursor is changed through another method, such as cursorDown, offset will be reset
        offset: null,
        path: pathLive,
      }),
    )
  }

  /**
   * Dispatches editThought and has tutorial logic.
   * Debounced from onChangeHandler.
   * Since variables inside this function won't get updated between re-render so passing latest context, rank etc as params.
   */
  const thoughtChangeHandler = (newValue: string, { rank, simplePath }: { rank: number; simplePath: Path }) => {
    // Note: Don't update innerHTML of contentEditable here. Since thoughtChangeHandler may be debounced, it may cause cause contentEditable to be out of sync.
    invalidStateError(null)

    // make sure to get updated state
    const state = store.getState()

    const oldValue = oldValueRef.current

    const lexeme = getLexeme(state, oldValue)

    if (transient) {
      dispatch(
        newThought({
          at: rootedParentOf(state, path),
          value: newValue,
        }),
      )
      return
    }

    if (lexeme) {
      dispatch(
        editThought({
          oldValue,
          newValue,
          rankInContext: rank,
          path: simplePath as SimplePath,
        }),
      )

      if (isDivider(newValue)) {
        // remove selection so that the focusOffset does not cause a split false positive in newThought
        selection.clear()
      }

      // store the value so that we have a transcendental head when it is changed
      oldValueRef.current = newValue

      const tutorialChoice = +(getSetting(state, 'Tutorial Choice') || 0) as TutorialChoice
      const tutorialStep = +(getSetting(state, 'Tutorial Step') || 1)
      if (
        newValue &&
        ((Math.floor(tutorialStep) === TUTORIAL2_STEP_CONTEXT1_PARENT &&
          newValue.toLowerCase() === TUTORIAL_CONTEXT1_PARENT[tutorialChoice].toLowerCase()) ||
          (Math.floor(tutorialStep) === TUTORIAL2_STEP_CONTEXT2_PARENT &&
            newValue.toLowerCase() === TUTORIAL_CONTEXT2_PARENT[tutorialChoice].toLowerCase()) ||
          ((Math.floor(tutorialStep) === TUTORIAL2_STEP_CONTEXT1 ||
            Math.floor(tutorialStep) === TUTORIAL2_STEP_CONTEXT2) &&
            newValue.toLowerCase() === TUTORIAL_CONTEXT[tutorialChoice].toLowerCase()))
      ) {
        dispatch(tutorialNext({}))
      }
    }

    onEdit?.({ path, oldValue, newValue })
  }

  // using useRef hook to store throttled function so that it can persist even between component re-renders, so that throttle.flush method can be used properly
  const throttledChangeRef = useRef(_.throttle(thoughtChangeHandler, EDIT_THROTTLE, { leading: false }))

  /** Set the selection to the current Editable at the cursor offset. */
  // const setSelectionToCursorOffset = () => {
  //   selection.set(contentRef.current, { offset: cursorOffset || state.cursorOffset || 0 })
  // }

  useEffect(() => {
    const { editing, noteFocus, dragHold } = state

    // focus on the ContentEditable element if editing os on desktop
    const editMode = editing

    // if there is no browser selection, do not manually call selection.set as it does not preserve the cursor offset. Instead allow the default focus event.
    const cursorWithoutSelection = state.cursorOffset !== null || !selection.isActive()

    // if the selection is at the beginning of the thought, ignore cursorWithoutSelection and allow the selection to be set
    // otherwise clicking on empty space to activate cursorBack will not set the selection properly on desktop
    const isAtBeginning = selection.offset() === 0

    // allow transient editable to have focus on render
    if (
      transient ||
      (isEditing && editMode && !noteFocus && (cursorWithoutSelection || isAtBeginning) && !dragHold && !isTapped)
    ) {
      /*
        When a new thought is created, the Shift key should be on when Auto-Capitalization is enabled.
        On Mobile Safari, Auto-Capitalization is broken if the selection is set synchronously (#999).
        Only breaks on Enter or Backspace, not gesture. Even stranger, the issue only showed up when newThought was converted to a reducer (ecc3b3be).
        For some reason, setTimeout fixes it.
      */
      // if (isTouch && isSafari()) {
      //   asyncFocus()
      //   setTimeout(setSelectionToCursorOffset)
      // } else {
      //   setSelectionToCursorOffset()
      // }
    }

    if (isTapped) {
      setIsTapped(false)
    }

    /** Flushes pending edits. */
    const flush = () => throttledChangeRef.current.flush()
    shortcutEmitter.on('shortcut', flush)

    // flush edits and remove handler on unmount
    return () => {
      throttledChangeRef.current.flush()
      shortcutEmitter.off('shortcut', flush)
    }
  }, [isEditing, state.dragInProgress])

  /** Performs meta validation and calls thoughtChangeHandler immediately or using throttled reference. */
  const onChangeHandler = (e: ContentEditableEvent) => {
    // make sure to get updated state
    const state = store.getState()

    // NOTE: When Subthought components are re-rendered on edit, change is called with identical old and new values (?) causing an infinite loop
    const oldValue = oldValueRef.current
    const newValue = stripEmptyFormattingTags(addEmojiSpace(unescape(strip(e, { preserveFormatting: true })))) // : oldValue

    // TODO: Disable keypress
    // e.preventDefault() does not work
    // disabled={readonly} removes contenteditable property

    dispatch(setEditingValue(newValue))

    if (newValue === oldValue) {
      if (readonly || uneditable || options) invalidStateError(null)

      // if we cancel the edit, we have to cancel pending its
      // this can occur for example by editing a value away from and back to its
      throttledChangeRef.current.cancel()

      return
    }

    const oldValueClean = oldValue === EM_TOKEN ? 'em' : ellipsize(oldValue)

    if (readonly) {
      dispatch(error({ value: `"${ellipsize(oldValueClean)}" is read-only and cannot be edited.` }))
      throttledChangeRef.current.cancel() // see above
      return
    } else if (uneditable) {
      dispatch(error({ value: `"${ellipsize(oldValueClean)}" is uneditable.` }))
      throttledChangeRef.current.cancel() // see above
      return
    } else if (options && !options.includes(newValue.toLowerCase())) {
      invalidStateError(newValue)
      throttledChangeRef.current.cancel() // see above
      return
    }

    const newNumContext = getContexts(state, newValue).length
    const isNewValueURL = isURL(newValue)

    const contextLengthChange =
      newNumContext > 0 || newNumContext !== getContexts(state, oldValueRef.current).length - 1
    const urlChange = isNewValueURL || isNewValueURL !== isURL(oldValueRef.current)

    const isEmpty = newValue.length === 0

    // run the thoughtChangeHandler immediately if superscript changes or it's a url (also when it changes true to false)
    if (transient || contextLengthChange || urlChange || isEmpty || isDivider(newValue)) {
      // update new supercript value and url boolean
      throttledChangeRef.current.flush()
      thoughtChangeHandler(newValue, { rank, simplePath })
    } else throttledChangeRef.current(newValue, { rank, simplePath })
  }

  /** Imports text that is pasted onto the thought. */
  const onPaste = (e: IOnPaste) => {
    const { plainText, htmlText } = e
    // pasting from mobile copy (e.g. Choose "Share" in Twitter and select "Copy") results in blank plainText and htmlText
    // the text will still be pasted if we do not preventDefault, it just won't get stripped of html properly
    // See: https://github.com/cybersemics/em/issues/286
    if (plainText) {
      throttledChangeRef.current.flush()

      // import into the live thoughts
      // neither ref.current is set here nor can newValue be stored from onChange
      // not sure exactly why, but it appears that the DOM node has been removed before the paste handler is called
      const { cursor } = store.getState()
      const path = cursor && equalPath(cursor, simplePath) ? cursor : simplePath

      // text/plain may contain text that ultimately looks like html (contains <li>) and should be parsed as html
      // pass the untrimmed old value to importText so that the whitespace is not loss when combining the existing value with the pasted value
      const rawDestValue = strip(plainText, { preventTrim: true })

      // If transient first add new thought and then import the text
      if (transient) {
        dispatch(
          newThought({
            at: rootedParentOf(state, path),
            value: '',
          }),
        )
      }

      dispatch(
        importText({
          path,
          text: isHTML(plainText) ? plainText : htmlText || plainText,
          rawDestValue,
          // pass selection start and end for importText to replace (if the imported thoughts are one line)
          ...(selection.isActive() && !selection.isCollapsed()
            ? {
                replaceStart: selection.offsetStart()!,
                replaceEnd: selection.offsetEnd()!,
              }
            : null),
        }),
      )

      // TODO: When importText was converted to a reducer, it no longer reducers newValue
      // if (newValue) oldValueRef.current = newValue
    }
  }

  /** Flushes edits and updates certain state variables on blur. */
  const onBlur = () => {
    blurring = true

    setCursorOnThought({ editing: false })

    // if (isTouch && isSafari()) {
    //   resetToolbarPosition()
    //   document.removeEventListener('scroll', updateToolbarPositionOnScroll)
    // }

    const { invalidState } = state
    throttledChangeRef.current.flush()

    // on blur remove error, remove invalid-option class, and reset editable html
    if (invalidState) {
      invalidStateError(null)
    }

    // if we know that the focus is changing to another editable or note then do not set editing to false

    // const isRelatedTargetEditableOrNote =
    //   e.relatedTarget &&
    //   ((e.relatedTarget as Element).classList.contains('editable') ||
    //     (e.relatedTarget as Element).classList.contains('note-editable'))

    // if (isRelatedTargetEditableOrNote) return

    // if related target is not editable wait until the next render to determine if we have really blurred
    // otherwise editing may be incorrectly set to false when clicking on another thought from edit mode (which results in a blur and focus in quick succession)
    setTimeout(() => {
      // only setEditingValue if blur is not immediately followed by focus
      if (blurring) {
        blurring = false
        dispatch(setEditingValue(null))
        // temporary states such as duplicate error states and cursorCleared are reset on blur
        dispatch(cursorCleared({ value: false }))
      }
    })
  }

  /**
   * Sets the cursor on focus.
   * Prevented by mousedown event above for hidden thoughts.
   */
  const onFocus = () => {
    // do not allow blur to setEditingValue when it is followed immediately by a focus
    blurring = false

    setCursorOnThought({ editing: true })
    dispatch(setEditingValue(value))
  }

  return (
    <ContentEditable
      disabled={disabled}
      forceUpdate={editableNonceRef.current !== state.editableNonce}
      html={
        value === EM_TOKEN
          ? '<b>em</b>'
          : isCursorCleared
          ? ''
          : isEditing
          ? value
          : childrenLabel.length > 0
          ? childrenLabel[0].value
          : ellipsizeUrl(value)
      }
      placeholder={
        isTableColumn1
          ? ''
          : lexeme && Date.now() - new Date(lexeme.lastUpdated).getTime() > EMPTY_THOUGHT_TIMEOUT
          ? 'This is an empty thought'
          : 'Add a thought'
      }
      // stop propagation to prevent default content onClick (which removes the cursor)
      // onClick={stopPropagation}
      // onTouchEnd={onTap}
      // must call onMouseDown on mobile since onTap cannot preventDefault
      // otherwise gestures and scrolling can trigger cursorBack (#1054)
      // onMouseDown={onTap}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={onChangeHandler}
      onPaste={onPaste}
      isTable={isTableColumn1}
      style={style || {}}
      isEditing={isEditing}
    />
  )
}

export default connect(mapStateToProps)(Editable)
