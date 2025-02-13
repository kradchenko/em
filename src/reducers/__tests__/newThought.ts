import { setCursor } from '..'
import { HOME_TOKEN } from '../../constants'
import contextToThoughtId from '../../selectors/contextToThoughtId'
import exportContext from '../../selectors/exportContext'
import newThoughtAtFirstMatch from '../../test-helpers/newThoughtAtFirstMatch'
import initialState from '../../util/initialState'
import reducerFlow from '../../util/reducerFlow'
import newThought from '../newThought'

it('new thought in root', () => {
  const stateNew = newThought(initialState(), { value: 'a' })
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a`)
})

it('new thought after', () => {
  const steps = [newThought('a'), newThought('b')]

  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
  - b`)
})

it('new thought before', () => {
  const steps = [newThought('a'), newThought({ value: 'b', insertBefore: true })]

  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - b
  - a`)
})

it('new subthought', () => {
  const steps = [newThought('a'), newThought({ value: 'b', insertNewSubthought: true })]

  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - b`)
})

it('new subthought top', () => {
  const steps = [
    newThought('a'),
    newThought({ value: 'b', insertNewSubthought: true }),
    newThought('c'),
    newThoughtAtFirstMatch({
      value: 'd',
      at: ['a'],
      insertNewSubthought: true,
      insertBefore: true,
    }),
  ]

  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - d
    - b
    - c`)
})

it('new thought to top of home context', () => {
  const steps = [newThought('a'), setCursor({ path: null }), newThought({ value: 'b', insertBefore: true })]

  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - b
  - a`)
})

it('update cursor to first new thought', () => {
  const stateNew = newThought(initialState(), { value: 'a' })

  expect(stateNew.cursor).toMatchObject([contextToThoughtId(stateNew, ['a'])!])
})

it('update cursor to new thought', () => {
  const steps = [newThought('a'), newThought('b')]

  const stateNew = reducerFlow(steps)(initialState())

  expect(stateNew.cursor).toMatchObject([contextToThoughtId(stateNew, ['b'])!])
})
