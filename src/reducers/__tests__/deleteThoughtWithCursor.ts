import { importText } from '..'
import { HOME_TOKEN } from '../../constants'
import contextToPath from '../../selectors/contextToPath'
import exportContext from '../../selectors/exportContext'
import expectPathToEqual from '../../test-helpers/expectPathToEqual'
import setCursor from '../../test-helpers/setCursorFirstMatch'
import initialState from '../../util/initialState'
import reducerFlow from '../../util/reducerFlow'
import cursorBack from '../cursorBack'
import cursorUp from '../cursorUp'
import deleteThoughtWithCursor from '../deleteThoughtWithCursor'
import newSubthought from '../newSubthought'
import newThought from '../newThought'
import toggleContextView from '../toggleContextView'

describe('delete', () => {
  it('delete thought within root', () => {
    const steps = [newThought('a'), newThought('b'), deleteThoughtWithCursor({})]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a`)
  })

  it('delete thought with no cursor should do nothing ', () => {
    const steps = [newThought('a'), newThought('b'), setCursor(null), deleteThoughtWithCursor({})]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a
  - b`)
  })

  it('delete thought within context', () => {
    const steps = [newThought('a'), newSubthought('a1'), deleteThoughtWithCursor({})]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a`)
  })

  it('delete descendants', () => {
    const steps = [newThought('a'), newSubthought('a1'), newSubthought('a1.1'), cursorBack, deleteThoughtWithCursor({})]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a`)
  })

  it('cursor should move to next sibling by default', () => {
    const steps = [
      newThought('a'),
      newSubthought('a1'),
      newThought('a2'),
      newThought('a3'),
      cursorUp,
      deleteThoughtWithCursor({}),
    ]

    const stateNew = reducerFlow(steps)(initialState())

    expect(stateNew.cursor).toMatchObject(contextToPath(stateNew, ['a', 'a3'])!)
  })

  it('cursor should move to prev sibling when deleting the last thought in the context', () => {
    const steps = [
      newThought('a'),
      newSubthought('a1'),
      newThought('a2'),
      newThought('a3'),
      deleteThoughtWithCursor({}),
    ]

    const stateNew = reducerFlow(steps)(initialState())

    expect(stateNew.cursor).toMatchObject(contextToPath(stateNew, ['a', 'a2'])!)
  })

  it('cursor should move to parent if the deleted thought has no siblings', () => {
    const steps = [newThought('a'), newSubthought('a1'), deleteThoughtWithCursor({})]

    const stateNew = reducerFlow(steps)(initialState())

    expect(stateNew.cursor).toMatchObject(contextToPath(stateNew, ['a'])!)
  })

  it('cursor should be removed if the last thought in the thoughtspace is deleted', () => {
    const steps = [newThought('a'), deleteThoughtWithCursor({})]
    const stateNew = reducerFlow(steps)(initialState())

    expect(stateNew.cursor).toBe(null)
  })
})

describe('context view', () => {
  it('delete thought from within tangential context', () => {
    const steps = [
      importText({
        text: `
        - a
          - m
            - x
        - b
          - m
            - y
      `,
      }),
      setCursor(['a', 'm']),
      toggleContextView,
      setCursor(['a', 'm', 'b', 'y']),
      deleteThoughtWithCursor({}),
    ]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - m
      - x
  - b
    - m`)

    expectPathToEqual(stateNew, stateNew.cursor, ['a', 'm', 'b'])
  })

  it('delete thought from within cyclic context', () => {
    const steps = [
      importText({
        text: `
        - a
          - m
            - x
        - b
          - m
            - y
      `,
      }),
      setCursor(['a', 'm']),
      toggleContextView,
      setCursor(['a', 'm', 'a', 'x']),
      deleteThoughtWithCursor({}),
    ]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - m
  - b
    - m
      - y`)

    expectPathToEqual(stateNew, stateNew.cursor, ['a', 'm', 'a'])
  })

  it('delete leaf from within tangential context', () => {
    const steps = [
      importText({
        text: `
        - a
          - m
        - b
          - m
      `,
      }),
      setCursor(['a', 'm']),
      toggleContextView,
      setCursor(['a', 'm', 'b']),
      deleteThoughtWithCursor({}),
    ]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - m
  - b`)

    expectPathToEqual(stateNew, stateNew.cursor, ['a', 'm'])
  })

  it('delete leaf from within cyclic context', () => {
    const steps = [
      importText({
        text: `
        - a
          - m
        - b
          - m
      `,
      }),
      setCursor(['a', 'm']),
      toggleContextView,
      setCursor(['a', 'm', 'a']),
      deleteThoughtWithCursor({}),
    ]

    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - a
  - b
    - m`)

    expectPathToEqual(stateNew, stateNew.cursor, ['a'])
  })
})
