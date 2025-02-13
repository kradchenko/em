import { findAllByPlaceholderText } from '@testing-library/react'
import SimplePath from '../../@types/SimplePath'
import Thunk from '../../@types/Thunk'
import editThought from '../../action-creators/editThought'
import importText from '../../action-creators/importText'
import newThought from '../../action-creators/newThought'
import setCursor from '../../action-creators/setCursor'
import setFirstSubthought from '../../action-creators/setFirstSubthought'
import toggleAttribute from '../../action-creators/toggleAttribute'
import { EM_TOKEN, HOME_PATH, HOME_TOKEN } from '../../constants'
import contextToPath from '../../selectors/contextToPath'
import { store } from '../../store'
import attributeByContext from '../../test-helpers/attributeByContext'
import createTestApp, { cleanupTestApp } from '../../test-helpers/createRtlTestApp'
import { createTestStore } from '../../test-helpers/createTestStore'
import executeShortcut from '../../test-helpers/executeShortcut'
import { findThoughtByText } from '../../test-helpers/queries'
import { setCursorFirstMatchActionCreator } from '../../test-helpers/setCursorFirstMatch'
import toggleSortShortcut from '../toggleSort'

it('toggle on sort preference of cursor (initial state without =sort attribute)', () => {
  const store = createTestStore()

  // import thoughts
  store.dispatch([
    importText({
      text: `
        - a
          - d
          - b
          - c
          - e`,
    }),
    setCursorFirstMatchActionCreator(['a']),
  ])

  executeShortcut(toggleSortShortcut, { store })

  expect(attributeByContext(store.getState(), ['a'], '=sort')).toBe('Alphabetical')
})

it('toggle sort preference descending of cursor (initial state with =sort/Alphabetical)', () => {
  const store = createTestStore()

  // import thoughts
  store.dispatch([
    importText({
      text: `
        - a
          - =sort
            - Alphabetical
              - Asc
          - d
          - b
          - c
          - e`,
    }),
    setCursorFirstMatchActionCreator(['a']),
  ])

  executeShortcut(toggleSortShortcut, { store })

  expect(attributeByContext(store.getState(), ['a'], '=sort')).toBe('Alphabetical')
  expect(attributeByContext(store.getState(), ['a', '=sort'], 'Alphabetical')).toBe('Desc')
})

it('toggle off sort preference of cursor (initial state with =sort/Alphabetical/desc)', () => {
  const store = createTestStore()

  // import thoughts
  store.dispatch([
    importText({
      text: `
        - a
          - =sort
            - Alphabetical
              - Desc
          - d
          - b
          - c
          - e`,
    }),
    setCursorFirstMatchActionCreator(['a']),
  ])

  executeShortcut(toggleSortShortcut, { store })

  expect(attributeByContext(store.getState(), ['a'], '=sort')).toBe(null)
})

it('toggle off sort preference of cursor (initial state with =sort/Alphabetical and Global Sort Alphabetical/desc)', () => {
  const store = createTestStore()

  // import thoughts
  store.dispatch([
    importText({
      text: `
        - a
          - =sort
            - Alphabetical
              - Asc
          - d
          - b
          - c
          - e`,
    }),

    ((dispatch, getState) =>
      dispatch(
        editThought({
          context: [EM_TOKEN, 'Settings', 'Global Sort'],
          oldValue: 'None',
          newValue: 'Alphabetical',
          path: contextToPath(getState(), [EM_TOKEN, 'Settings', 'Global Sort', 'None']) as SimplePath,
        }),
      )) as Thunk,

    ((dispatch, getState) =>
      dispatch(
        setFirstSubthought({
          path: contextToPath(getState(), [EM_TOKEN, 'Settings', 'Global Sort', 'Alphabetical'])!,
          value: 'Desc',
        }),
      )) as Thunk,

    setCursorFirstMatchActionCreator(['a']),
  ])

  executeShortcut(toggleSortShortcut, { store })
  expect(attributeByContext(store.getState(), ['a'], '=sort')).toBe(null)
})

// TODO: setFirstSubthought is failing because the Path doesn't exist for some reason
it.skip('toggle off sort preference of cursor (initial state without =sort attribute and Global Sort Alphabetical/desc)', () => {
  const store = createTestStore()

  // import thoughts
  store.dispatch([
    importText({
      text: `
        - a
          - d
          - b
          - c
          - e`,
    }),

    ((dispatch, getState) =>
      dispatch(
        editThought({
          context: [EM_TOKEN, 'Settings', 'Global Sort'],
          oldValue: 'None',
          newValue: 'Alphabetical',
          path: contextToPath(getState(), [EM_TOKEN, 'Settings', 'Global Sort', 'None']) as SimplePath,
        }),
      )) as Thunk,

    ((dispatch, getState) =>
      dispatch(
        setFirstSubthought({
          context: [EM_TOKEN, 'Settings', 'Global Sort', 'Alphabetical'],
          value: 'Desc',
        }),
      )) as Thunk,

    setCursorFirstMatchActionCreator(['a']),
  ])

  executeShortcut(toggleSortShortcut, { store })
  expect(attributeByContext(store.getState(), ['a'], '=sort')).toBe('None')
})

it('toggle on sort preference of home context when cursor is null (initial state without =sort attribute)', () => {
  const store = createTestStore()

  // import thoughts
  store.dispatch([
    importText({
      text: `
        - b
          - 1
          - 2
        - a
          - 3
          - 4`,
    }),

    setCursor({ path: null }),
  ])

  executeShortcut(toggleSortShortcut, { store })

  expect(attributeByContext(store.getState(), [HOME_TOKEN], '=sort')).toBe('Alphabetical')
})

it('toggle sort preference descending of home context when cursor is null (initial state with =sort/Alphabetical)', () => {
  const store = createTestStore()

  // import thoughts
  store.dispatch([
    importText({
      text: `
        - =sort
          - Alphabetical
        -a
        -b`,
    }),

    setCursor({ path: null }),
  ])

  executeShortcut(toggleSortShortcut, { store })

  expect(attributeByContext(store.getState(), [HOME_TOKEN], '=sort')).toBe('Alphabetical')
  expect(attributeByContext(store.getState(), ['=sort'], 'Alphabetical')).toBe('Desc')
})

it('override global Alphabetical with local Alphabetical/desc', () => {
  const store = createTestStore()

  store.dispatch([
    importText({
      text: `
        - a
          - d
          - b
          - c
          - e
    `,
    }),

    ((dispatch, getState) =>
      dispatch(
        editThought({
          context: [EM_TOKEN, 'Settings', 'Global Sort'],
          oldValue: 'None',
          newValue: 'Alphabetical',
          path: contextToPath(getState(), [EM_TOKEN, 'Settings', 'Global Sort', 'None']) as SimplePath,
        }),
      )) as Thunk,

    setCursorFirstMatchActionCreator(['a']),
  ])

  executeShortcut(toggleSortShortcut, { store })

  expect(attributeByContext(store.getState(), ['a'], '=sort')).toBe('Alphabetical')
  expect(attributeByContext(store.getState(), ['a', '=sort'], 'Alphabetical')).toBe('Desc')
})

describe('DOM', () => {
  beforeEach(async () => {
    await createTestApp()
  })
  afterEach(cleanupTestApp)

  it('thoughts are sorted alphabetically', async () => {
    store.dispatch([
      newThought({ value: 'c' }),
      newThought({ value: 'a' }),
      newThought({ value: 'b' }),
      setCursor({ path: null }),

      toggleAttribute({
        path: HOME_PATH,
        values: ['=sort', 'Alphabetical'],
      }),
    ])

    const thought = await findThoughtByText('c')
    expect(thought).toBeTruthy()

    const thoughtsWrapper = thought!.closest('ul') as HTMLElement
    const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')

    expect(thoughts.map((child: HTMLElement) => child.textContent)).toMatchObject(['a', 'b', 'c'])
  })

  it('subthoughts are sorted alphabetically', async () => {
    store.dispatch([
      newThought({ value: 'a' }),
      newThought({ value: '3', insertNewSubthought: true }),
      newThought({ value: '1' }),
      newThought({ value: '2' }),
      setCursorFirstMatchActionCreator(['a']),

      (dispatch, getState) =>
        dispatch(
          toggleAttribute({
            path: contextToPath(getState(), ['a']),
            values: ['=sort', 'Alphabetical'],
          }),
        ),
    ])

    const thought = await findThoughtByText('a')
    expect(thought).toBeTruthy()

    const thoughtChildrenWrapper = thought!.closest('li')?.lastElementChild as HTMLElement
    const thoughtChildren = await findAllByPlaceholderText(thoughtChildrenWrapper, 'Add a thought')

    expect(thoughtChildren.map((child: HTMLElement) => child.textContent)).toMatchObject(['1', '2', '3'])
  })

  describe('sort with Global Sort settings', () => {
    it('thoughts are sorted alphabetically when "Global Sort" settings is Alphabetical', async () => {
      store.dispatch([
        newThought({ value: 'c' }),
        newThought({ value: 'b' }),
        newThought({ value: 'a' }),
        setCursor({ path: null }),

        ((dispatch, getState) =>
          dispatch(
            editThought({
              context: [EM_TOKEN, 'Settings', 'Global Sort'],
              oldValue: 'None',
              newValue: 'Alphabetical',
              path: contextToPath(getState(), [EM_TOKEN, 'Settings', 'Global Sort', 'None']) as SimplePath,
            }),
          )) as Thunk,
      ])

      const thought = await findThoughtByText('c')
      expect(thought).toBeTruthy()

      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')

      expect(thoughts.map((child: HTMLElement) => child.textContent)).toMatchObject(['a', 'b', 'c'])
    })

    it('subthoughts are sorted alphabetically when "Global Sort" settings is Alphabetical', async () => {
      store.dispatch([
        newThought({ value: 'a' }),
        newThought({ value: '3', insertNewSubthought: true }),
        newThought({ value: '1' }),
        newThought({ value: '2' }),
        setCursorFirstMatchActionCreator(['a']),
        ((dispatch, getState) =>
          dispatch(
            editThought({
              context: [EM_TOKEN, 'Settings', 'Global Sort'],
              oldValue: 'None',
              newValue: 'Alphabetical',
              path: contextToPath(getState(), [EM_TOKEN, 'Settings', 'Global Sort', 'None']) as SimplePath,
            }),
          )) as Thunk,
      ])

      const thought = await findThoughtByText('a')
      expect(thought).toBeTruthy()

      const thoughtChildrenWrapper = thought!.closest('li')?.lastElementChild as HTMLElement
      const thoughtChildren = await findAllByPlaceholderText(thoughtChildrenWrapper, 'Add a thought')

      expect(thoughtChildren.map((child: HTMLElement) => child.textContent)).toMatchObject(['1', '2', '3'])
    })

    it('subthoughts are not sorted alphabetically when context sort is None and "Global Sort" settings is Alphabetical', async () => {
      store.dispatch([
        newThought({ value: 'a' }),
        newThought({ value: '3', insertNewSubthought: true }),
        newThought({ value: '1' }),
        newThought({ value: '2' }),

        setCursorFirstMatchActionCreator(['a']),

        ((dispatch, getState) =>
          dispatch(
            editThought({
              context: [EM_TOKEN, 'Settings', 'Global Sort'],
              oldValue: 'None',
              newValue: 'Alphabetical',
              path: contextToPath(getState(), [EM_TOKEN, 'Settings', 'Global Sort', 'None']) as SimplePath,
            }),
          )) as Thunk,

        (dispatch, getState) =>
          dispatch(
            toggleAttribute({
              path: contextToPath(getState(), ['a']),
              values: ['=sort', 'None'],
            }),
          ),
      ])

      const thought = await findThoughtByText('a')
      expect(thought).toBeTruthy()

      const thoughtChildrenWrapper = thought!.closest('li')?.lastElementChild as HTMLElement
      const thoughtChildren = await findAllByPlaceholderText(thoughtChildrenWrapper, 'Add a thought')

      expect(thoughtChildren.map((child: HTMLElement) => child.textContent)).toMatchObject(['3', '1', '2'])
    })
  })

  describe('descending order', () => {
    it('thoughts are sorted alphabetically in descending order', async () => {
      store.dispatch([
        newThought({ value: 'c' }),
        newThought({ value: 'a' }),
        newThought({ value: 'b' }),
        setCursor({ path: null }),
      ])

      store.dispatch([
        toggleAttribute({
          path: HOME_PATH,
          values: ['=sort', 'Alphabetical'],
        }),
        (dispatch, getState) =>
          dispatch(
            setFirstSubthought({
              path: contextToPath(getState(), ['=sort', 'Alphabetical'])!,
              value: 'Desc',
            }),
          ),
      ])

      const thought = await findThoughtByText('c')
      expect(thought).toBeTruthy()

      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')

      expect(thoughts.map((child: HTMLElement) => child.textContent)).toMatchObject(['c', 'b', 'a'])
    })

    it('subthoughts are sorted alphabetically in descending order', async () => {
      store.dispatch([
        newThought({ value: 'a' }),
        newThought({ value: '3', insertNewSubthought: true }),
        newThought({ value: '1' }),
        newThought({ value: '2' }),
        setCursorFirstMatchActionCreator(['a']),
      ])

      store.dispatch([
        (dispatch, getState) =>
          dispatch(
            toggleAttribute({
              path: contextToPath(getState(), ['a']),
              values: ['=sort', 'Alphabetical'],
            }),
          ),
        (dispatch, getState) =>
          dispatch(
            setFirstSubthought({
              path: contextToPath(getState(), ['a', '=sort', 'Alphabetical'])!,
              value: 'Desc',
            }),
          ),
      ])

      const thought = await findThoughtByText('a')
      expect(thought).toBeTruthy()

      const thoughtChildrenWrapper = thought!.closest('li')?.lastElementChild as HTMLElement
      const thoughtChildren = await findAllByPlaceholderText(thoughtChildrenWrapper, 'Add a thought')

      expect(thoughtChildren.map((child: HTMLElement) => child.textContent)).toMatchObject(['3', '2', '1'])
    })
  })

  describe('empty thought ordering is preserved at the point of creation', () => {
    it('after first thought', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['a']),
        newThought({ value: '' }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('a_bcdef')
    })

    it('after middle thought', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['c']),
        newThought({ value: '' }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('abc_def')
    })

    it('after last thought', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['f']),
        newThought({ value: '' }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('abcdef_')
    })

    it('before first thought', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['a']),
        newThought({ value: '', insertBefore: true }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('_abcdef')
    })

    it('before middle thought', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['c']),
        newThought({ value: '', insertBefore: true }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('ab_cdef')
    })

    it('before last thought', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['f']),
        newThought({ value: '', insertBefore: true }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('abcde_f')
    })

    it('multiple empty thoughts', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['a']),
        newThought({ value: '', insertBefore: true }),
        setCursorFirstMatchActionCreator(['a']),
        newThought({ value: '' }),
        setCursorFirstMatchActionCreator(['c']),
        newThought({ value: '' }),
        setCursorFirstMatchActionCreator(['f']),
        newThought({ value: '' }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('_a_bc_def_')
    })

    it('only one empty subthought', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['a']),
        newThought({ value: '', insertNewSubthought: true }),
      ])

      const thought = await findThoughtByText('a')

      const thoughtChildrenWrapper = thought!.closest('li')?.lastElementChild as HTMLElement
      const thoughtChildren = await findAllByPlaceholderText(thoughtChildrenWrapper, 'Add a thought')
      const childrenString = thoughtChildren
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('_')
    })

    // TODO
    it.skip('multiple contiguous empty thoughts', async () => {
      store.dispatch([
        importText({
          text: `
              - =sort
                - Alphabetical
              - d
              - f
              - a
              - c
              - e
              - b
          `,
        }),
        setCursorFirstMatchActionCreator(['c']),
        newThought({ value: '' }),
        newThought({ value: '' }),
      ])

      const thought = await findThoughtByText('a')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('abc__def')
    })

    it('except with insertNewSubthought', async () => {
      store.dispatch([
        importText({
          text: `
            - a
              - =sort
                - Alphabetical
              - d
              - f
              - c
              - b
              - e
          `,
        }),
        setCursorFirstMatchActionCreator(['a']),
        newThought({ value: '', insertNewSubthought: true }),
      ])

      const thought = await findThoughtByText('d')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('bcdef_')
    })

    it('except with insertNewSubthought and insertBefore', async () => {
      store.dispatch([
        importText({
          text: `
            - a
              - =sort
                - Alphabetical
              - d
              - f
              - c
              - b
              - e
          `,
        }),
        setCursorFirstMatchActionCreator(['a']),
        newThought({ value: '', insertNewSubthought: true, insertBefore: true }),
      ])

      const thought = await findThoughtByText('d')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('_bcdef')
    })

    it('preserve sort order when thought is edited to empty instead of moving it back to its insertion point', async () => {
      store.dispatch([
        importText({
          text: `
            - test
              - =sort
                - Alphabetical
              - c
              - b
              - a
          `,
        }),
        setCursorFirstMatchActionCreator(['test', 'a']),
        // wrap in a thunk in order to access fresh state
        (dispatch, getState) =>
          dispatch(
            editThought({
              context: ['test'],
              oldValue: 'a',
              newValue: '',
              path: contextToPath(getState(), ['test', 'a']) as SimplePath,
            }),
          ),
      ])

      const thought = await findThoughtByText('b')
      const thoughtsWrapper = thought!.closest('ul') as HTMLElement
      const thoughts = await findAllByPlaceholderText(thoughtsWrapper, 'Add a thought')
      const childrenString = thoughts
        .map((child: HTMLElement) => child.textContent)
        .map(value => value || '_')
        .join('')
      expect(childrenString).toMatch('_bc')
    })
  })
})
