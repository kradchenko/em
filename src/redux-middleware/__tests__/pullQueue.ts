import Context from '../../@types/Context'
import Thought from '../../@types/Thought'
import clear from '../../action-creators/clear'
import importText from '../../action-creators/importText'
import newThought from '../../action-creators/newThought'
import setCursor from '../../action-creators/setCursor'
import { HOME_TOKEN } from '../../constants'
import { DataProvider } from '../../data-providers/DataProvider'
import getContext from '../../data-providers/data-helpers/getContext'
import getThoughtByIdFromDB from '../../data-providers/data-helpers/getThoughtById'
import * as dexie from '../../data-providers/dexie'
import { store } from '../../store'
import contextToThought from '../../test-helpers/contextToThought'
import createTestApp, { cleanupTestApp, refreshTestApp } from '../../test-helpers/createTestApp'
import { deleteThoughtAtFirstMatchActionCreator } from '../../test-helpers/deleteThoughtAtFirstMatch'
import { editThoughtByContextActionCreator } from '../../test-helpers/editThoughtByContext'
import getAllChildrenByContext from '../../test-helpers/getAllChildrenByContext'
import { moveThoughtAtFirstMatchActionCreator } from '../../test-helpers/moveThoughtAtFirstMatch'
import { setCursorFirstMatchActionCreator } from '../../test-helpers/setCursorFirstMatch'
import testTimer from '../../test-helpers/testTimer'

/*
  Note: sinon js fake timer is used to overcome some short comming we have with jest's fake timer.
  For details: https://github.com/cybersemics/em/issues/919#issuecomment-739135971
*/

const fakeTimer = testTimer()

const db = dexie as DataProvider

/**
 * Match given children with for given context.
 */
const matchContextsChildren = async (provider: DataProvider, context: Context, children: Partial<Thought>[]) => {
  const parentThought = (await getContext(provider, context))!
  expect(parentThought).toBeTruthy()
  const childrenThoughts = await provider.getThoughtsByIds(Object.values(parentThought.childrenMap))
  expect(childrenThoughts).toMatchObject(children)
}

beforeEach(createTestApp)
afterEach(cleanupTestApp)

it('disable isLoading after initialize', async () => {
  expect(store.getState().isLoading).toBe(false)
})

it('load thought', async () => {
  const root1 = await getContext(db, [HOME_TOKEN])
  expect(root1).toBeFalsy()

  fakeTimer.useFakeTimer()

  // create a thought, which will get persisted to local db
  store.dispatch(newThought({ value: 'a' }))

  await fakeTimer.runAllAsync()
  fakeTimer.useRealTimer()

  const thoughtA = contextToThought(store.getState(), ['a'])!

  const root = await getContext(db, [HOME_TOKEN])
  expect(root).toMatchObject({
    childrenMap: { [thoughtA.id]: thoughtA.id },
  })

  fakeTimer.useFakeTimer()
  // clear state
  store.dispatch(clear())
  await fakeTimer.runAllAsync()
  fakeTimer.useRealTimer()

  const children = getAllChildrenByContext(store.getState(), [HOME_TOKEN])
  expect(children).toHaveLength(0)

  // Note: Always use real timer before awaiting db calls. https://github.com/cybersemics/em/issues/919#issuecomment-739135971

  // confirm thought is still in local db after state has been cleared
  const rootAfterReload = await getContext(db, [HOME_TOKEN])
  expect(rootAfterReload).toMatchObject({
    childrenMap: { [thoughtA.id]: thoughtA.id },
  })

  await refreshTestApp()

  const childrenAfterInitialize = getAllChildrenByContext(store.getState(), [HOME_TOKEN])
  expect(childrenAfterInitialize).toMatchObject([thoughtA?.id])
})

it('do not repopulate deleted thought', async () => {
  fakeTimer.useFakeTimer()

  store.dispatch([
    newThought({}),
    deleteThoughtAtFirstMatchActionCreator(['']),
    // Need to setCursor to trigger the pullQueue
    // Must set cursor manually since deleteThought does not.
    // (The cursor is normally set after deleting via the deleteThoughtWithCursor reducer).
    setCursor({ path: null }),
  ])

  await fakeTimer.runAllAsync()
  fakeTimer.useRealTimer()

  const root = contextToThought(store.getState(), [HOME_TOKEN])
  expect(root).toMatchObject({
    childrenMap: {},
  })

  const parentEntryChild = contextToThought(store.getState(), [''])
  expect(parentEntryChild).toBe(null)
})

it('load buffered thoughts', async () => {
  fakeTimer.useFakeTimer()

  store.dispatch(
    importText({
      text: `
      - a
        - b
          - c
            - d
              - e`,
    }),
  )

  await fakeTimer.runAllAsync()
  fakeTimer.useRealTimer()

  const thoughtA = contextToThought(store.getState(), ['a'])!
  const thoughtB = contextToThought(store.getState(), ['a', 'b'])!
  const thoughtC = contextToThought(store.getState(), ['a', 'b', 'c'])!
  const thoughtD = contextToThought(store.getState(), ['a', 'b', 'c', 'd'])!
  const thoughtE = contextToThought(store.getState(), ['a', 'b', 'c', 'd', 'e'])!

  await matchContextsChildren(db, [HOME_TOKEN], [{ value: 'a' }])
  await matchContextsChildren(db, ['a'], [{ value: 'b' }])
  await matchContextsChildren(db, ['a', 'b'], [{ value: 'c' }])
  await matchContextsChildren(db, ['a', 'b', 'c'], [{ value: 'd' }])
  await matchContextsChildren(db, ['a', 'b', 'c', 'd'], [{ value: 'e' }])
  await matchContextsChildren(db, ['a', 'b', 'c', 'd', 'e'], [])

  // clear state
  // call initialize again to reload from db (simulating page refresh)

  await refreshTestApp()

  const state = store.getState()
  expect(getAllChildrenByContext(state, [HOME_TOKEN])).toMatchObject([thoughtA.id])
  expect(getAllChildrenByContext(state, ['a'])).toMatchObject([thoughtB.id])
  expect(getAllChildrenByContext(state, ['a', 'b'])).toMatchObject([thoughtC.id])
  expect(getAllChildrenByContext(state, ['a', 'b', 'c'])).toMatchObject([thoughtD.id])
  expect(getAllChildrenByContext(state, ['a', 'b', 'c', 'd'])).toMatchObject([thoughtE.id])
  expect(getAllChildrenByContext(state, ['a', 'b', 'c', 'd', 'e'])).toMatchObject([])
})

it('delete thought with buffered descendants', async () => {
  fakeTimer.useFakeTimer()

  store.dispatch([
    importText({
      text: `
        - x
        - a
          - b
            - c
              - d
                - e
    `,
    }),
    setCursorFirstMatchActionCreator(['x']),
  ])

  await fakeTimer.runAllAsync()
  fakeTimer.useRealTimer()

  await matchContextsChildren(db, [HOME_TOKEN], [{ value: 'x' }, { value: 'a' }])
  await matchContextsChildren(db, ['a'], [{ value: 'b' }])
  await matchContextsChildren(db, ['a', 'b'], [{ value: 'c' }])
  await matchContextsChildren(db, ['a', 'b', 'c'], [{ value: 'd' }])
  await matchContextsChildren(db, ['a', 'b', 'c', 'd'], [{ value: 'e' }])
  await matchContextsChildren(db, ['a', 'b', 'c', 'd', 'e'], [])

  await refreshTestApp()

  fakeTimer.useFakeTimer()

  // delete thought with buffered descendants
  store.dispatch(deleteThoughtAtFirstMatchActionCreator(['a']))
  await fakeTimer.runAllAsync()

  fakeTimer.useRealTimer()

  await matchContextsChildren(db, [HOME_TOKEN], [{ value: 'x' }])
  expect(await getContext(db, ['a'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c', 'd'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c', 'd', 'e'])).toBeFalsy()
})

it('move thought with buffered descendants', async () => {
  fakeTimer.useFakeTimer()

  store.dispatch([
    importText({
      text: `
        - x
        - a
          - m
          - b
            - c
              - d
                - e
    `,
    }),
    setCursorFirstMatchActionCreator(['x']),
  ])

  await fakeTimer.runAllAsync()

  fakeTimer.useRealTimer()

  const thoughtX = contextToThought(store.getState(), ['x'])!
  const thoughtA = contextToThought(store.getState(), ['a'])!
  const thoughtM = contextToThought(store.getState(), ['a', 'm'])!
  const thoughtB = contextToThought(store.getState(), ['a', 'b'])!
  const thoughtC = contextToThought(store.getState(), ['a', 'b', 'c'])!
  const thoughtD = contextToThought(store.getState(), ['a', 'b', 'c', 'd'])!
  const thoughtE = contextToThought(store.getState(), ['a', 'b', 'c', 'd', 'e'])!

  expect(await getThoughtByIdFromDB(db, HOME_TOKEN)).toMatchObject({
    childrenMap: { [thoughtX.id]: thoughtX.id, [thoughtA.id]: thoughtA.id },
  })
  expect(await getThoughtByIdFromDB(db, thoughtA.id)).toMatchObject({
    childrenMap: { [thoughtM.id]: thoughtM.id, [thoughtB.id]: thoughtB.id },
  })
  expect(await getThoughtByIdFromDB(db, thoughtB.id)).toMatchObject({ childrenMap: { [thoughtC.id]: thoughtC.id } })
  expect(await getThoughtByIdFromDB(db, thoughtM.id)).toMatchObject({ childrenMap: {} })
  expect(await getThoughtByIdFromDB(db, thoughtC.id)).toMatchObject({ childrenMap: { [thoughtD.id]: thoughtD.id } })
  expect(await getThoughtByIdFromDB(db, thoughtD.id)).toMatchObject({ childrenMap: { [thoughtE.id]: thoughtE.id } })
  expect(await getThoughtByIdFromDB(db, thoughtE.id)).toMatchObject({ childrenMap: {} })

  await refreshTestApp()

  fakeTimer.useFakeTimer()

  // delete thought with buffered descendants
  store.dispatch(
    moveThoughtAtFirstMatchActionCreator({
      from: ['a'],
      to: ['x', 'a'],
      newRank: 0,
    }),
  )

  await fakeTimer.runAllAsync()

  fakeTimer.useRealTimer()

  await matchContextsChildren(db, [HOME_TOKEN], [{ value: 'x' }])
  expect(await getContext(db, ['a'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c', 'd'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c', 'd', 'e'])).toBeFalsy()

  await matchContextsChildren(db, ['x'], [{ value: 'a' }])
  await matchContextsChildren(db, ['x', 'a'], [{ value: 'm' }, { value: 'b' }])
  await matchContextsChildren(db, ['x', 'a', 'b'], [{ value: 'c' }])
  await matchContextsChildren(db, ['x', 'a', 'b', 'c'], [{ value: 'd' }])
  await matchContextsChildren(db, ['x', 'a', 'b', 'c', 'd'], [{ value: 'e' }])
  await matchContextsChildren(db, ['x', 'a', 'b', 'c', 'd', 'e'], [])
})

it('edit thought with buffered descendants', async () => {
  fakeTimer.useFakeTimer()

  store.dispatch([
    importText({
      text: `
        - x
        - a
          - m
          - b
            - c
              - d
                - e
    `,
    }),
    setCursorFirstMatchActionCreator(['x']),
  ])

  await fakeTimer.runAllAsync()

  fakeTimer.useRealTimer()

  await matchContextsChildren(db, [HOME_TOKEN], [{ value: 'x' }, { value: 'a' }])
  await matchContextsChildren(db, ['a'], [{ value: 'm' }, { value: 'b' }])
  await matchContextsChildren(db, ['a', 'b'], [{ value: 'c' }])
  await matchContextsChildren(db, ['a', 'm'], [])
  await matchContextsChildren(db, ['a', 'b', 'c'], [{ value: 'd' }])
  await matchContextsChildren(db, ['a', 'b', 'c', 'd'], [{ value: 'e' }])
  await matchContextsChildren(db, ['a', 'b', 'c', 'd', 'e'], [])

  await refreshTestApp()
  fakeTimer.useFakeTimer()

  // edit thought with buffered descendants
  store.dispatch(
    editThoughtByContextActionCreator({
      at: ['a'],
      oldValue: 'a',
      newValue: 'k',
    }),
  )

  await fakeTimer.runAllAsync()

  fakeTimer.useRealTimer()

  await matchContextsChildren(db, [HOME_TOKEN], [{ value: 'x' }, { value: 'k' }])
  expect(await getContext(db, ['a'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c', 'd'])).toBeFalsy()
  expect(await getContext(db, ['a', 'b', 'c', 'd', 'e'])).toBeFalsy()

  await matchContextsChildren(db, ['k'], [{ value: 'm' }, { value: 'b' }])
  await matchContextsChildren(db, ['k!', 'b'], [{ value: 'c' }])
  await matchContextsChildren(db, ['k!', 'b', 'c'], [{ value: 'd' }])
  await matchContextsChildren(db, ['k!', 'b', 'c', 'd'], [{ value: 'e' }])
  await matchContextsChildren(db, ['k!', 'b', 'c', 'd', 'e'], [])
})
