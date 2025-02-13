import Index from '../@types/IndexType'
import Lexeme from '../@types/Lexeme'
import State from '../@types/State'
import Thought from '../@types/Thought'
import ThoughtId from '../@types/ThoughtId'
import ThoughtIndices from '../@types/ThoughtIndices'
import Timestamp from '../@types/Timestamp'
import { ABSOLUTE_TOKEN, EM_TOKEN, HOME_TOKEN, MODALS, ROOT_PARENT_ID, SCHEMA_LATEST } from '../constants'
import { isLocalNetwork } from '../device/router'
import globals from '../globals'
import canShowModal from '../selectors/canShowModal'
import hashThought from '../util/hashThought'
import isDocumentEditable from '../util/isDocumentEditable'
import never from '../util/never'
import parseJsonSafe from '../util/parseJsonSafe'
import timestamp from '../util/timestamp'
import { getSessionId } from './sessionManager'
import storage from './storage'

/** Safely gets a value from localStorage if it is in the environment. */
const getLocal = (key: string) => {
  if (typeof storage === 'undefined') return undefined
  return storage.getItem(key)
}

/** Generates an initial ThoughtIndices with the root and em contexts. */
const initialThoughts = (created: Timestamp = timestamp()): ThoughtIndices => {
  const HOME_TOKEN_HASH = HOME_TOKEN
  const ABSOLUTE_TOKEN_HASH = ABSOLUTE_TOKEN
  const EM_TOKEN_HASH = EM_TOKEN
  const thoughtIndex: Index<Thought> = {
    [HOME_TOKEN_HASH]: {
      id: HOME_TOKEN as ThoughtId,
      value: HOME_TOKEN,
      parentId: ROOT_PARENT_ID as ThoughtId,
      childrenMap: {},
      // start pending to trigger pullQueue fetch
      pending: true,
      lastUpdated: never(),
      rank: 0,
      updatedBy: getSessionId(),
    },
    [ABSOLUTE_TOKEN_HASH]: {
      id: ABSOLUTE_TOKEN as ThoughtId,
      value: ABSOLUTE_TOKEN,
      parentId: ROOT_PARENT_ID as ThoughtId,
      childrenMap: {},
      // start pending to trigger pullQueue fetch
      pending: true,
      lastUpdated: never(),
      rank: 0,
      updatedBy: getSessionId(),
    },
    [EM_TOKEN_HASH]: {
      id: EM_TOKEN as ThoughtId,
      value: EM_TOKEN,
      parentId: ROOT_PARENT_ID as ThoughtId,
      childrenMap: {},
      // start pending to trigger pullQueue fetch
      pending: true,
      lastUpdated: never(),
      rank: 0,
      updatedBy: getSessionId(),
    },
  }

  const lexemeIndex: Index<Lexeme> = {
    [hashThought(HOME_TOKEN)]: {
      lemma: HOME_TOKEN,
      contexts: [],
      // set to beginning of epoch to ensure that server lexemeIndex is always considered newer from init lexemeIndex
      created,
      lastUpdated: never(),
      updatedBy: getSessionId(),
    },
    [hashThought(ABSOLUTE_TOKEN)]: {
      lemma: ABSOLUTE_TOKEN,
      contexts: [],
      // set to beginning of epoch to ensure that server lexemeIndex is always considered newer from init lexemeIndex
      created,
      lastUpdated: never(),
      updatedBy: getSessionId(),
    },
    // this will get populated by importText in loadLocalState
    // unfortunately that's the best way currently to create nested thoughts and ensure that lexemeIndex and thoughtIndex are correct
    [hashThought(EM_TOKEN)]: {
      lemma: EM_TOKEN,
      contexts: [],
      created,
      lastUpdated: never(),
      updatedBy: getSessionId(),
    },
  }

  return {
    thoughtIndex,
    lexemeIndex,
  }
}

/** Generates the initial state of the application. */
const initialState = (created: Timestamp = timestamp()) => {
  const state: State = {
    authenticated: false,
    // eslint-disable-next-line no-mixed-operators
    autologin: getLocal('autologin') === 'true',
    contextViews: {},
    cursor: null,
    cursorBeforeSearch: null,
    cursorBeforeQuickAdd: null,
    cursorCleared: false,
    cursorHistory: [],
    cursorInitialized: false, // tracks if the cursor has been restored from the url on first load and ensures it only happens once
    cursorOffset: 0,
    dragInProgress: false,
    editableNonce: 0,
    editing: null,
    editingValue: null,
    enableLatestShortcutsDiagram: false,
    expanded: {},
    fontSize: +(getLocal('fontSize') || 18),
    expandedBottom: {},
    expandHoverBottomPaths: {},
    invalidState: false,
    // Displays a loading screen when the app starts.
    // This is disabled by updateThoughts once it detects that the root thought is loaded.
    // Used by the Content component to determine if there are no root children and NewThoughtInstructions should be displayed.
    isLoading: true,
    isPushing: false,
    jumpHistory: [],
    jumpIndex: 0,
    latestShortcuts: [],
    modals: {},
    noteFocus: false,
    recentlyEdited: {},
    redoPatches: [],
    resourceCache: {},
    rootContext: [HOME_TOKEN],
    schemaVersion: SCHEMA_LATEST,
    scrollPrioritized: false,
    search: null,
    remoteSearch: false,
    searchContexts: null,
    showHiddenThoughts: false,
    showSidebar: false,
    showSplitView: false,
    showTopControls: true,
    showBreadcrumbs: true,
    // eslint-disable-next-line no-mixed-operators
    splitPosition: parseJsonSafe(getLocal('splitPosition') || null, 0),
    status: 'disconnected',
    pushQueue: [],
    thoughts: initialThoughts(created),
    toolbarOverlay: null,
    undoPatches: [],
  }
  Object.keys(MODALS).forEach(key => {
    // initial modal states
    state.modals[key] = {
      // eslint-disable-next-line no-mixed-operators
      complete: globals.disableTutorial || JSON.parse(getLocal('modal-complete-' + key) || 'false'),
    }
  })

  // welcome modal
  if (isDocumentEditable() && canShowModal(state, 'welcome')) {
    state.showModal = 'welcome'
  }

  /**
   * Show the modal specified by modal-to-show.
   * Modal-to-show is set to 'welcome' on login, 'auth' on logout, and empty string in offline mode.
   * Modal-to-show is needed because otherwise when the user is autologged in with google, it shows the signup screen for a few seconds then flips to welcome.
   * Use localStorage to get the value of modal-to-show to avoid the flip second auth screen.
   * If modal-to-show is unset, default to the signup screen, unless on localhost.
   * If working offline, modal-to-show is set to an empty string so the welcome dialog is skipped.
   */
  if (!isLocalNetwork) {
    const showModalLocal = getLocal('modal-to-show')
    // do not show the modal if it has been permanently dismissed (complete)
    if (showModalLocal !== '' && !state.modals[showModalLocal as keyof typeof state.modals]?.complete) {
      state.showModal = showModalLocal || 'auth'
    }
  }

  // show the signup modal if the app is loaded with signup path
  if (typeof window !== 'undefined' && window.location.pathname.substr(1) === 'signup') {
    state.showModal = 'signup'
  }

  return state
}

export default initialState
