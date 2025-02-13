import _ from 'lodash'
import moize from 'moize'
import Context from './@types/Context'
import * as Firebase from './@types/Firebase'
import State from './@types/State'
import Thunk from './@types/Thunk'
import './App.css'
import authenticate from './action-creators/authenticate'
import loadFromUrl from './action-creators/loadFromUrl'
import loadLocalState from './action-creators/loadLocalState'
import loadPublicThoughts from './action-creators/loadPublicThoughts'
import logout from './action-creators/logout'
import preloadSources from './action-creators/preloadSources'
import pull from './action-creators/pull'
import setCursor from './action-creators/setCursor'
import setRemoteSearch from './action-creators/setRemoteSearch'
import statusActionCreator from './action-creators/status'
import userAuthenticated from './action-creators/userAuthenticated'
import { ALGOLIA_CONFIG, FIREBASE_CONFIG, OFFLINE_TIMEOUT } from './constants'
import initDB, * as db from './data-providers/dexie'
import * as selection from './device/selection'
import globals from './globals'
import initAlgoliaSearch from './search/algoliaSearch'
import contextToThoughtId from './selectors/contextToThoughtId'
import decodeThoughtsUrl from './selectors/decodeThoughtsUrl'
import { getAllChildren, getAllChildrenAsThoughts, getChildrenRanked } from './selectors/getChildren'
import getContexts from './selectors/getContexts'
import getLexeme from './selectors/getLexeme'
import getThoughtById from './selectors/getThoughtById'
import thoughtToContext from './selectors/thoughtToContext'
import { store } from './store'
import getLexemeFromDB from './test-helpers/getLexemeFromDB'
import importToContext from './test-helpers/importToContext'
import prettyPath from './test-helpers/prettyPath'
import hashThought from './util/hashThought'
import initEvents from './util/initEvents'
import isRoot from './util/isRoot'
import owner from './util/owner'
import * as sessionManager from './util/sessionManager'
import urlDataSource from './util/urlDataSource'

/** Initialize firebase and event handlers. */
export const initFirebase = async (): Promise<void> => {
  if (window.firebase) {
    const firebase = window.firebase
    firebase.initializeApp(FIREBASE_CONFIG)

    // on auth change
    // this is called when the user logs in or the page refreshes when the user is already authenticated
    firebase.auth().onAuthStateChanged((user: Firebase.User) => {
      if (user) {
        const status = store.getState().status
        store.dispatch(userAuthenticated(user, { connected: status === 'loading' || status === 'loaded' }))

        const { applicationId, index } = ALGOLIA_CONFIG
        const hasRemoteConfig = applicationId && index

        if (!hasRemoteConfig) console.warn('Algolia configs not found. Remote search is not enabled.')
        else initAlgoliaSearch(user.uid, { applicationId, index }, store)
      } else {
        // if the authentication state changes while the user is still logged in, it means that they logged out from another tab
        // we should log them out of all tabs
        if (store.getState().authenticated) store.dispatch(logout())

        store.dispatch(authenticate({ value: false }))
        store.dispatch(setRemoteSearch({ value: false }))
      }
    })

    // load a public context
    if (owner() !== '~') {
      store.dispatch(loadPublicThoughts())
    }

    // on connect change
    // this is called when moving from online to offline and vice versa
    const connectedRef = firebase.database().ref('.info/connected')
    connectedRef.on('value', async (snapshot: Firebase.Snapshot<boolean>) => {
      const connected = snapshot.val()
      const status = store.getState().status

      // either connect with authenticated user or go to connected state until they login
      if (connected) {
        // once connected, disable offline mode timer
        clearTimeout(globals.offlineTimer)

        // if reconnecting from offline mode, onAuthStateChange is not called since Firebase is still authenticated, but we still need to execute the app authentication logic and subscribe to the main value event
        // if status is loading or already loaded, we can assume onAuthStateChanged and thus userAuthenticated was already called
        // this happens on startup when onAuthStateChange is immediately followed by a connect event
        if (status !== 'loaded' && firebase.auth().currentUser) {
          await store.dispatch(userAuthenticated(firebase.auth().currentUser, { connected }))
        }
      }

      // if lexemeIndex was already loaded and we go offline, enter offline mode immediately
      else if (status === 'loaded') {
        store.dispatch(statusActionCreator({ value: 'offline' }))
      }
    })
  }

  // before lexemeIndex has been loaded, wait a bit before going into offline mode to avoid flashing the Offline status message
  globals.offlineTimer = window.setTimeout(() => {
    store.dispatch(statusActionCreator({ value: 'offline' }))
  }, OFFLINE_TIMEOUT)
}

/**
 * Decode cursor from url, pull and initialize the cursor.
 */
const initializeCursor = async () => {
  const { path } = decodeThoughtsUrl(store.getState())
  // if no path in decoded from the url initialize the cursor with null
  if (!path || isRoot(path)) {
    store.dispatch(setCursor({ path: null }))
  } else {
    // pull the path thoughts
    await store.dispatch(pull(path, { maxDepth: 0 }))
    const newState = store.getState()
    const isCursorLoaded = path.every(thoughtId => getThoughtById(newState, thoughtId))
    store.dispatch(
      setCursor({
        path: isCursorLoaded ? path : null,
      }),
    )
  }
}

/** Initilaize local db , firebase and window events. */
export const initialize = async () => {
  // initialize the session id
  sessionManager.init()

  // Note: Initialize firebase as soon as possible. Some components like ModalSignup needs to use firebase as soon as it renders.
  // TODO: Check if initializing firebase before local db causes any problem.
  initFirebase()

  // load local state unless loading a public context or source url
  await initDB()

  const src = urlDataSource()
  const thoughtsLocalPromise =
    owner() === '~'
      ? // authenticated or offline user
        store.dispatch(src ? loadFromUrl(src) : loadLocalState())
      : // other user context
        Promise.resolve()

  // load =preload sources
  thoughtsLocalPromise.then(() => {
    // extra delay for good measure to not block rendering
    setTimeout(() => {
      store.dispatch(preloadSources)
    }, 500)
  })

  await thoughtsLocalPromise

  await initializeCursor()

  return {
    thoughtsLocalPromise,
    ...initEvents(store),
  }
}

/** Partially apply state to a function. */
const withState =
  <T, R>(f: (state: State, ...args: T[]) => R) =>
  (...args: T[]) =>
    f(store.getState(), ...args)

/** Partially dispatches an action to the store. */
const withDispatch =
  <T extends any[], R extends Thunk>(f: (...args: T) => R) =>
  (...args: T) =>
    store.dispatch(f(...args))

const testHelpers = {
  setSelection: selection.set,
  importToContext: withDispatch(importToContext),
  getLexemeFromDB,
  getState: store.getState,
  _: _,
  clearAll: db.clearAll,
}

// add useful functions to window.em for debugging
const windowEm = {
  contextToThoughtId,
  db,
  getContexts: withState(getContexts),
  getLexeme: withState(getLexeme),
  getLexemeContexts: withState((state: State, value: string) => {
    const contexts = getLexeme(state, value)?.contexts || []
    return contexts.map(id => thoughtToContext(state, getThoughtById(state, id)?.parentId))
  }),
  getAllChildrenByContext: withState((state: State, context: Context) =>
    getAllChildren(state, contextToThoughtId(state, context) || null),
  ),
  getAllChildrenAsThoughts: withState((state: State, context: Context) =>
    getAllChildrenAsThoughts(state, contextToThoughtId(state, context) || null),
  ),
  getAllChildrenRankedByContext: withState((state: State, context: Context) =>
    getChildrenRanked(state, contextToThoughtId(state, context) || null),
  ),
  getThoughtById: withState(getThoughtById),
  getThoughtByContext: withState((state: State, context: Context) => {
    const id = contextToThoughtId(state, context)
    return id ? getThoughtById(state, id) : undefined
  }),
  hashThought,
  moize,
  prettyPath,
  store,
  // helper functions that will be used by puppeteer tests
  testHelpers,
  thoughtToContext: withState(thoughtToContext),
}

window.em = windowEm

/*
  Uncomment em.moize.collectStats() to start collecting stats on load.
  Do not enable in production.
  Call em.moize.getStats in the console to analyze cache hits, e.g. em.moize.getStats('getSetting').
*/
// moize.collectStats()

/** Logs debugging information to a fixed position debug window. Useful for PWA debugging. */
window.debug = (message: string) => {
  const debugEl = document.getElementById('debug')!
  debugEl.innerHTML = `${new Date()}: ${message}\n${debugEl.innerHTML}`
}

export type TestHelpers = typeof windowEm.testHelpers
export type WindowEm = typeof windowEm
