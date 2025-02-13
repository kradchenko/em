import { unescape } from 'html-escaper'
import _ from 'lodash'
import sanitize from 'sanitize-html'
import Path from '../@types/Path'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import Timestamp from '../@types/Timestamp'
import { ALLOWED_ATTRIBUTES, ALLOWED_TAGS, HOME_PATH } from '../constants'
import getTextContentFromHTML from '../device/getTextContentFromHTML'
import editThought from '../reducers/editThought'
import editingValue from '../reducers/editingValue'
import setCursor from '../reducers/setCursor'
import updateThoughts from '../reducers/updateThoughts'
import { getAllChildren, getAllChildrenAsThoughts } from '../selectors/getChildren'
import getThoughtById from '../selectors/getThoughtById'
import rootedParentOf from '../selectors/rootedParentOf'
import simplifyPath from '../selectors/simplifyPath'
import appendToPath from '../util/appendToPath'
import createId from '../util/createId'
import head from '../util/head'
import htmlToJson from '../util/htmlToJson'
import importJSON from '../util/importJSON'
import initialState from '../util/initialState'
import isRoot from '../util/isRoot'
import parentOf from '../util/parentOf'
import reducerFlow from '../util/reducerFlow'
import roamJsonToBlocks from '../util/roamJsonToBlocks'
import { getSessionId } from '../util/sessionManager'
import strip from '../util/strip'
import textToHtml from '../util/textToHtml'
import unroot from '../util/unroot'
import validateRoam from '../util/validateRoam'
import collapseContext from './collapseContext'
import newThought from './newThought'

// a list item tag
const regexpListItem = /<li(?:\s|>)/gim
export interface ImportTextPayload {
  path?: Path

  // Set the lastUpdated timestamp on the imported thoughts. Default: now.
  lastUpdated?: Timestamp

  // Prevents the default behavior of setting the cursor to the last thought at the first level.
  preventSetCursor?: boolean

  // When pasting after whitespace, e.g. Pasting "b" after "a ", the normal destValue has already been trimmed, which would result in "ab". We need to pass the untrimmed.destination value in so that it can be trimmed after concatenation.
  rawDestValue?: string

  // the character offset to end replacing text if the import is not multiline, such as the end of the selection
  replaceEnd?: number

  // the character offset to start replacing text if the import is not multiline, such as the start of the selection
  replaceStart?: number

  skipRoot?: boolean

  // text or HTML that will be inserted below the thought (if multiline) or inside the thought (singl line only)
  text: string

  // A user session id to associate with the update. Defaults to the current session.
  updatedBy?: string

  caretPosition?: number
}

/** Imports thoughts from html or raw text. */
const importText = (
  state: State,
  {
    path,
    text,
    lastUpdated,
    preventSetCursor,
    rawDestValue,
    replaceEnd,
    replaceStart,
    skipRoot,
    updatedBy = getSessionId(),
    caretPosition = 0,
  }: ImportTextPayload,
): State => {
  const isRoam = validateRoam(text)

  path = path || HOME_PATH
  const simplePath = simplifyPath(state, path)
  const convertedText = isRoam ? text : textToHtml(text)
  const numLines = (convertedText.match(regexpListItem) || []).length
  const thoughtId = head(path)
  const destThought = getThoughtById(state, thoughtId)
  const destValue = rawDestValue || destThought.value

  // import raw thoughts
  // overwrite all state
  if (
    text.startsWith(`{
  "thoughtIndex": {
    "__ROOT__": {`)
  ) {
    const thoughts = JSON.parse(text)
    const stateNew = initialState()
    return {
      ...stateNew,
      thoughts: {
        ...stateNew.thoughts,
        ...thoughts,
      },
    }
  }

  // if we are only importing a single line of html, then simply modify the current thought
  if (numLines <= 1 && !isRoam && !isRoot(path)) {
    // TODO: textToHtml already strips the text, but one test fails if we remove it
    // See: "single-line nested html tags" in importText test
    const textNormalized = strip(convertedText, { preserveFormatting: true })

    // insert the textNormalized into the destValue in the correct place
    // if cursorCleared is true i.e. clearThought is enabled we don't have to use existing thought to be appended
    const replacedDestValue = state.cursorCleared
      ? ''
      : destValue.slice(0, replaceStart || 0) + destValue.slice(replaceEnd || 0)

    const newValue = `${replacedDestValue.slice(
      0,
      replaceStart || caretPosition,
    )}${textNormalized}${replacedDestValue.slice(replaceStart || caretPosition)}`
    const offset = caretPosition + getTextContentFromHTML(textNormalized).length

    return reducerFlow([
      editThought({
        oldValue: destValue,
        newValue,
        path: simplePath,
      }),

      editingValue({
        value: newValue,
      }),

      !preventSetCursor && path
        ? setCursor({
            path: [...parentOf(path), thoughtId],
            offset,
          })
        : null,
    ])(state)
  } else {
    // Closed incomplete tags, preserve only allowed tags and attributes and decode the html.
    const sanitizedConvertedText = unescape(
      sanitize(convertedText, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: ALLOWED_ATTRIBUTES,
        disallowedTagsMode: 'recursiveEscape',
      }),
    )

    const json = isRoam ? roamJsonToBlocks(JSON.parse(sanitizedConvertedText)) : htmlToJson(sanitizedConvertedText)

    const destIsLeaf = getAllChildren(state, head(simplePath)).length === 0

    /** Check if destination's parent context has more than one children. */
    const isDestParentContextEmpty = () => getAllChildren(state, head(rootedParentOf(state, simplePath))).length <= 1

    const destEmpty = destThought.value === '' && destIsLeaf

    // In order to merge the top-level imports with existing siblings, we need to trigger mergeThoughts through moveThought.
    // Rather than do this individually for each top level imported thought, we import into a dummy thought and then collapse it.
    // Since collapse uses moveThought it will merge the imported thoughts.
    const shouldImportIntoDummy = destEmpty ? !isDestParentContextEmpty() : !destIsLeaf
    const dummyValue = createId()
    const stateWithDummy = shouldImportIntoDummy
      ? newThought(state, {
          at: simplePath,
          insertNewSubthought: true,
          value: dummyValue,
        })
      : state

    /**
     * Returns the Path where thoughts will be imported. It may be the simplePath passed to importText, or it may be a dummy Path (see shouldImportIntoDummy above).
     */
    const getDestinationPath = (): SimplePath => {
      if (!shouldImportIntoDummy) return simplePath
      const dummyThought = getAllChildrenAsThoughts(stateWithDummy, head(simplePath)).find(
        child => child.value === dummyValue,
      )
      return (dummyThought ? [...simplePath, dummyThought.id] : simplePath) as SimplePath
    }

    const newDestinationPath = getDestinationPath()

    const imported = importJSON(stateWithDummy, newDestinationPath, json, { lastUpdated, skipRoot, updatedBy })

    /** Set cursor to the last thought on the first level of imports. */
    const setLastImportedCursor = (state: State) => {
      if (!imported.lastImported) return state

      /** Get last imported cursor after using collapse. */
      const getLastImportedAfterCollapse = () => {
        const pathStart = imported.lastImported!.slice(0, newDestinationPath.length - (destEmpty ? 2 : 1)) as Path
        const pathMiddle = imported.lastImported!.slice(newDestinationPath.length, imported.lastImported!.length - 1)
        const id = head(imported.lastImported!)
        const thought = getThoughtById(stateWithDummy, id)

        // if the last imported thought was merged into an existing thought, then the imported thought will no longer exist
        // find the sibling with the same value and use that to set the new cursor
        // otherwise this will return an invalid Path
        // (this seems fragile: is it guaranteed to be the merged thought?)

        /** Gets the id of a destination sibling with the same value as the last imported thought. */
        const idMerged = () => {
          const thoughtImported = imported.thoughtIndexUpdates[id]
          const idMatchedValue = getAllChildrenAsThoughts(
            state,
            destEmpty ? destThought.parentId : destThought.id,
          ).find(child => child.value === thoughtImported.value)?.id
          if (!thought && !idMatchedValue) {
            throw new Error(
              'Last imported cursor after collapse and merge is wrong. Expected the destination thought to have a sibling that matches the value of the last imported thought. This is a bug and the logic needs to be updated to handle this case.',
            )
          }

          return idMatchedValue
        }

        return appendToPath(pathStart, ...pathMiddle, thought ? id : idMerged()!)
      }

      const newCursor = shouldImportIntoDummy ? getLastImportedAfterCollapse() : imported.lastImported

      return setCursor(state, {
        path: newCursor,
      })
    }

    const parentOfDestination = parentOf(newDestinationPath)

    return reducerFlow([
      updateThoughts(imported),
      // set cusor to destination path's parent after collapse unless it's em or cusor set is prevented.
      shouldImportIntoDummy ? collapseContext({ at: unroot(newDestinationPath) }) : null,
      // if original destination is empty then collapse once more.
      shouldImportIntoDummy && destEmpty ? collapseContext({ at: parentOfDestination }) : null,
      // restore the cursor to the last imported thought on the first level
      // Note: collapseContext may be executed as part of the import. Since collapseContext moves the cursor, we need to set cursor back to the old cursor if preventSetCursor is true.
      !preventSetCursor
        ? setLastImportedCursor
        : setCursor({
            path: state.cursor,
          }),
    ])(stateWithDummy)
  }
}

export default _.curryRight(importText)
