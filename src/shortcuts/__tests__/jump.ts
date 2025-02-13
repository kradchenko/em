import deleteThought from '../../action-creators/deleteThought'
import importText from '../../action-creators/importText'
import indent from '../../action-creators/indent'
import jump from '../../action-creators/jump'
import newSubthought from '../../action-creators/newSubthought'
import newThought from '../../action-creators/newThought'
import { createTestStore } from '../../test-helpers/createTestStore'
import { editThoughtByContextActionCreator as editThought } from '../../test-helpers/editThoughtByContext'
import { setCursorFirstMatchActionCreator as setCursor } from '../../test-helpers/setCursorFirstMatch'
import head from '../../util/head'
import pathToContext from '../../util/pathToContext'

describe('jump back', () => {
  it('jump back to the last edit point', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
          - b
            - c
        - d
          - e
            - f
      `,
      }),
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      setCursor(['d', 'e', 'f']),
      editThought({
        oldValue: 'f',
        newValue: 'ff',
        at: ['d', 'e', 'f'],
      }),
      jump(-1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'b', 'cc'])
  })

  it('replace the last jump point when editing its parent', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - x
          - y
        - a
          - b
            - c
            - d
            - e
        - f
          - g
            - h
      `,
      }),
      // edit y (first edit point)
      setCursor(['x']),
      setCursor(['x', 'y']),
      editThought({
        oldValue: 'y',
        newValue: 'yy',
        at: ['x', 'y'],
      }),
      // edit c (second edit point)
      setCursor(['a']),
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      // edit b (overrides the second edit point)
      setCursor(['a', 'b']),
      editThought({
        oldValue: 'b',
        newValue: 'bb',
        at: ['a', 'b'],
      }),
      // edit h (third edit point)
      setCursor(['a']),
      setCursor(['f']),
      setCursor(['f', 'g', 'h']),
      editThought({
        oldValue: 'h',
        newValue: 'hh',
        at: ['f', 'g', 'h'],
      }),
      jump(-1),
    ])

    // jump batck to the updated second edit point
    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'bb'])

    // jump back to the first edit point
    store.dispatch(jump(-1))
    const state2 = store.getState()
    expect(state2.cursor && pathToContext(state2, state2.cursor)).toEqual(['x', 'yy'])
  })

  it('replace the last jump point when editing its child', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - x
          - y
        - a
          - b
            - c
            - d
            - e
        - f
          - g
            - h
      `,
      }),
      // edit y (first edit point)
      setCursor(['x']),
      setCursor(['x', 'y']),
      editThought({
        oldValue: 'y',
        newValue: 'yy',
        at: ['x', 'y'],
      }),
      // edit c (second edit point)
      setCursor(['a']),
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      // edit b (overrides the second edit point)
      setCursor(['a', 'b']),
      editThought({
        oldValue: 'b',
        newValue: 'bb',
        at: ['a', 'b'],
      }),
      // edit h (third edit point)
      setCursor(['a']),
      setCursor(['f']),
      setCursor(['f', 'g', 'h']),
      editThought({
        oldValue: 'h',
        newValue: 'hh',
        at: ['f', 'g', 'h'],
      }),
      jump(-1),
    ])

    // jump batck to the updated second edit point
    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'bb'])

    // jump back to the first edit point
    store.dispatch(jump(-1))
    const state2 = store.getState()
    expect(state2.cursor && pathToContext(state2, state2.cursor)).toEqual(['x', 'yy'])
  })

  it('replace the last jump point when editing its sibling', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - x
          - y
        - a
          - b
            - c
            - d
            - e
        - f
          - g
            - h
      `,
      }),
      // edit y (first edit point)
      setCursor(['x']),
      setCursor(['x', 'y']),
      editThought({
        oldValue: 'y',
        newValue: 'yy',
        at: ['x', 'y'],
      }),
      // edit c (second edit point)
      setCursor(['a']),
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      // edit d (overrides the second edit point)
      setCursor(['a', 'b', 'd']),
      editThought({
        oldValue: 'd',
        newValue: 'dd',
        at: ['a', 'b', 'd'],
      }),
      // edit e (overrides the second edit point)
      setCursor(['a', 'b', 'e']),
      editThought({
        oldValue: 'e',
        newValue: 'ee',
        at: ['a', 'b', 'e'],
      }),
      // edit h (third edit point)
      setCursor(['a']),
      setCursor(['f']),
      setCursor(['f', 'g', 'h']),
      editThought({
        oldValue: 'h',
        newValue: 'hh',
        at: ['f', 'g', 'h'],
      }),
      jump(-1),
    ])

    // jump batck to the updated second edit point
    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'b', 'ee'])

    // jump back to the first edit point
    store.dispatch(jump(-1))
    const state2 = store.getState()
    expect(state2.cursor && pathToContext(state2, state2.cursor)).toEqual(['x', 'yy'])
  })

  it('jump back to edit after indent', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
          - b
        - c
          - d
          - e
      `,
      }),
      setCursor(['a']),
      setCursor(['a', 'b']),
      editThought({
        oldValue: 'b',
        newValue: 'bb',
        at: ['a', 'b'],
      }),
      setCursor(['c']),
      setCursor(['c', 'e']),
      indent(),
      jump(-1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'bb'])
  })

  it('jump back after new subthought', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
        - c
      `,
      }),
      setCursor(['a']),
      newSubthought(),
      editThought({
        oldValue: '',
        newValue: 'b',
        at: ['a', ''],
      }),
      setCursor(['c']),
      newSubthought(),
      editThought({
        oldValue: '',
        newValue: 'd',
        at: ['c', ''],
      }),
      jump(-1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'b'])
  })

  it('jump back to edit after delete', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
          - b
            - c
        - d
          - e
            - f
      `,
      }),
      // edit a/b/c
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      // delete d/e/f
      setCursor(['d', 'e', 'f']),
      (dispatch, getState) => {
        const state = getState()
        dispatch(
          deleteThought({
            pathParent: state.cursor!,
            thoughtId: head(state.cursor!),
          }),
        )
      },
      jump(-1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'b', 'cc'])
  })

  it('jump back to parent of delete', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
          - b
            - c
        - d
          - e
            - f
      `,
      }),
      // delete d/e/f
      setCursor(['d', 'e', 'f']),
      (dispatch, getState) => {
        const state = getState()
        dispatch(
          deleteThought({
            pathParent: state.cursor!,
            thoughtId: head(state.cursor!),
          }),
        )
      },
      // edit a/b/c
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      jump(-1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['d', 'e'])
  })

  it('jump back from null cursor', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
        - b
      `,
      }),
      setCursor(['a']),
      editThought({
        oldValue: 'a',
        newValue: 'aa',
        at: ['a'],
      }),
      setCursor(null),
      jump(-1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['aa'])
  })
})

describe('jump forward', () => {
  it('jump back then forward should restore the cursor to where it was before jump back', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
        - b
        - c
        - d
        - e
      `,
      }),
      setCursor(['b']),
      editThought({
        oldValue: 'b',
        newValue: 'bb',
        at: ['b'],
      }),
      setCursor(['d']),
      editThought({
        oldValue: 'd',
        newValue: 'dd',
        at: ['d'],
      }),
      jump(-1),
      jump(1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['dd'])
  })

  it('jump back then forward then back should be equivalent to a single jump back', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
          - b
            - c
        - d
          - e
            - f
      `,
      }),
      // edit a/b/c
      setCursor(['a']),
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      // edit d/e/f
      setCursor(['a']),
      setCursor(['d']),
      setCursor(['d', 'e', 'f']),
      editThought({
        oldValue: 'f',
        newValue: 'ff',
        at: ['d', 'e', 'f'],
      }),
      // jump back to a/b/cc
      jump(-1),
      // jump forward to d/e/ff
      jump(1),
      // jump back to a/b/cc
      jump(-1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'b', 'cc'])
  })

  it('jump back then forward after indent', () => {
    const store = createTestStore()

    store.dispatch([
      newThought({ value: '' }),
      editThought({
        oldValue: '',
        newValue: 'a',
        at: [''],
      }),
      newThought({ value: '' }),
      editThought({
        oldValue: '',
        newValue: 'b',
        at: [''],
      }),
      indent(),
      jump(-1),
      jump(1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['a', 'b'])
  })

  it('do nothing if jump back was not activated', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
        - b
        - c
        - d
        - e
      `,
      }),
      setCursor(['b']),
      editThought({
        oldValue: 'b',
        newValue: 'bb',
        at: ['b'],
      }),
      setCursor(['d']),
      editThought({
        oldValue: 'd',
        newValue: 'dd',
        at: ['d'],
      }),
      jump(1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['dd'])
  })

  it('do nothing if already on most recent edit', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
        - b
        - c
        - d
        - e
      `,
      }),
      setCursor(['b']),
      editThought({
        oldValue: 'b',
        newValue: 'bb',
        at: ['b'],
      }),
      setCursor(['d']),
      editThought({
        oldValue: 'd',
        newValue: 'dd',
        at: ['d'],
      }),
      jump(-1),
      jump(1),
      jump(1),
      jump(1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['dd'])
  })

  it('ignore jump back if already back to the beginning', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
        - b
        - c
        - d
        - e
      `,
      }),
      setCursor(['b']),
      editThought({
        oldValue: 'b',
        newValue: 'bb',
        at: ['b'],
      }),
      setCursor(['d']),
      editThought({
        oldValue: 'd',
        newValue: 'dd',
        at: ['d'],
      }),
      jump(-1),
      jump(-1),
      jump(-1),
      jump(-1),
      jump(-1),
      jump(1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['dd'])
  })

  it('jump forward to parent after delete', () => {
    const store = createTestStore()

    store.dispatch([
      importText({
        text: `
        - a
          - b
            - c
        - d
          - e
            - f
      `,
      }),
      // edit a/b/c
      setCursor(['a', 'b', 'c']),
      editThought({
        oldValue: 'c',
        newValue: 'cc',
        at: ['a', 'b', 'c'],
      }),
      // delete d/e/f
      setCursor(['d', 'e', 'f']),
      (dispatch, getState) => {
        const state = getState()
        dispatch(
          deleteThought({
            pathParent: state.cursor!,
            thoughtId: head(state.cursor!),
          }),
        )
      },
      jump(-1),
      jump(1),
    ])

    const state = store.getState()
    expect(state.cursor && pathToContext(state, state.cursor)).toEqual(['d', 'e'])
  })
})
