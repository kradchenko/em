import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import SimplePath from '../../@types/SimplePath'
import importText from '../../action-creators/importText'
import newThought from '../../action-creators/newThought'
import * as selection from '../../device/selection'
import rootedParentOf from '../../selectors/rootedParentOf'
import { store } from '../../store'
import equalPath from '../../util/equalPath'
import isHTML from '../../util/isHTML'
import strip from '../../util/strip'

/** Returns an onPaste handler that parses and inserts the pasted text or thoughts at the cursor. Handles plaintext and HTML, inline and nested paste. */
const useOnPaste = ({
  contentRef,
  simplePath,
  transient,
}: {
  contentRef: React.RefObject<HTMLInputElement>
  simplePath: SimplePath
  transient?: boolean
}) => {
  const dispatch = useDispatch()
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      // mobile Safari copies URLs as 'text/uri-list' when the share button is used
      const plainText = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text/uri-list')
      const htmlText = e.clipboardData.getData('text/html')

      // import raw thoughts: confirm before overwriting state
      if (
        typeof window !== 'undefined' &&
        plainText.startsWith(`{
  "thoughtIndex": {
    "__ROOT__": {`) &&
        !window.confirm('Import raw thought state? Current state will be overwritten.')
      ) {
        e.preventDefault()
        return
      }

      // pasting from mobile copy (e.g. Choose "Share" in Twitter and select "Copy") results in blank plainText and htmlText
      // the text will still be pasted if we do not preventDefault, it just won't get stripped of html properly
      // See: https://github.com/cybersemics/em/issues/286
      if (plainText || htmlText) {
        e.preventDefault()

        // import into the live thoughts
        // neither ref.current is set here nor can newValue be stored from onChange
        // not sure exactly why, but it appears that the DOM node has been removed before the paste handler is called
        const { cursor, cursorOffset: cursorOffsetState } = store.getState()
        const path = cursor && equalPath(cursor, simplePath) ? cursor : simplePath

        // text/plain may contain text that ultimately looks like html (contains <li>) and should be parsed as html
        // pass the untrimmed old value to importText so that the whitespace is not loss when combining the existing value with the pasted value
        const rawDestValue = strip(contentRef.current!.innerHTML, { preventTrim: true })

        // If transient first add new thought and then import the text
        if (transient) {
          dispatch(
            newThought({
              at: rootedParentOf(store.getState(), path),
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
            // pass caret position to correctly track the last navigated point for caret
            // calculated on the basis of node type we are currently focused on. `state.cursorOffset` doesn't really keeps track of updated caret position when navigating within single thought. Hence selection.offset() is also used depending upon which node type we are on.
            caretPosition: (selection.isText() ? selection.offset() || 0 : cursorOffsetState) || 0,
          }),
        )

        // TODO: When importText was converted to a reducer, it no longer reducers newValue
        // if (newValue) oldValueRef.current = newValue
      }
    },
    [simplePath, transient],
  )

  return onPaste
}

export default useOnPaste
