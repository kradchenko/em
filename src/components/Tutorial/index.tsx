import React from 'react'
import { connect, useStore } from 'react-redux'
import { TransitionGroup } from 'react-transition-group'
import Connected from '../../@types/Connected'
import GesturePath from '../../@types/GesturePath'
import State from '../../@types/State'
import tutorial from '../../action-creators/tutorial'
import { isTouch } from '../../browser'
import {
  HOME_TOKEN,
  TUTORIAL2_STEP_CONTEXT1_HINT,
  TUTORIAL2_STEP_CONTEXT1_PARENT_HINT,
  TUTORIAL2_STEP_CONTEXT1_SUBTHOUGHT_HINT,
  TUTORIAL2_STEP_CONTEXT2_HINT,
  TUTORIAL2_STEP_CONTEXT2_PARENT_HINT,
  TUTORIAL2_STEP_CONTEXT2_SUBTHOUGHT_HINT,
  TUTORIAL2_STEP_CONTEXT_VIEW_TOGGLE,
  TUTORIAL2_STEP_SUCCESS,
  TUTORIAL_CONTEXT,
  TUTORIAL_CONTEXT1_PARENT,
  TUTORIAL_CONTEXT2_PARENT,
  TUTORIAL_STEP_FIRSTTHOUGHT,
  TUTORIAL_STEP_SECONDTHOUGHT_HINT,
  TUTORIAL_STEP_SUBTHOUGHT,
  TUTORIAL_STEP_SUCCESS,
} from '../../constants'
import { getAllChildrenAsThoughts } from '../../selectors/getChildren'
import getSetting from '../../selectors/getSetting'
import { shortcutById } from '../../shortcuts'
import headValue from '../../util/headValue'
import once from '../../util/once'
import GestureDiagram from '../GestureDiagram'
import TutorialNavigation from './TutorialNavigation'
import TutorialStepComponentMap from './TutorialStepComponentMap'
import WithCSSTransition from './WithCSSTransition'

// assert shortcut at load time
const newThoughtShortcut = shortcutById('newThought')
if (!newThoughtShortcut) {
  throw new Error('newThought shortcut not found.')
}

// eslint-disable-next-line jsdoc/require-jsdoc
const mapStateToProps = (state: State) => {
  const { contextViews, cursor } = state
  const tutorialChoice = +(getSetting(state, 'Tutorial Choice') || 0)
  const tutorialStep = +(getSetting(state, 'Tutorial Step') || 1)
  return {
    contextViews,
    cursor,
    rootChildren: getAllChildrenAsThoughts(state, HOME_TOKEN),
    // guard against invalid tutorialChoice and tutorialStep in case Settings/Tutorial Step is corrupted
    tutorialChoice: (isNaN(tutorialChoice) ? 0 : tutorialChoice) as keyof typeof TUTORIAL_CONTEXT1_PARENT,
    tutorialStep: isNaN(tutorialStep) ? 1 : tutorialStep,
  }
}

/** Tutorial component. */
const Tutorial = ({
  contextViews,
  cursor,
  rootChildren,
  tutorialChoice,
  tutorialStep,
  dispatch,
}: Connected<ReturnType<typeof mapStateToProps>>) => {
  rootChildren = rootChildren || []

  const tutorialStepProps = {
    cursor,
    tutorialChoice,
    rootChildren,
    contextViews,
    dispatch,
    key: Math.floor(tutorialStep),
  }

  const tutorialStepComponent =
    TutorialStepComponentMap[Math.floor(tutorialStep) as keyof typeof TutorialStepComponentMap]

  const gesture = once(
    () =>
      ((tutorialStep === TUTORIAL_STEP_FIRSTTHOUGHT ||
      tutorialStep === TUTORIAL_STEP_SECONDTHOUGHT_HINT ||
      tutorialStep === TUTORIAL2_STEP_CONTEXT1_PARENT_HINT ||
      tutorialStep === TUTORIAL2_STEP_CONTEXT2_PARENT_HINT
        ? shortcutById('newThought')?.gesture
        : tutorialStep === TUTORIAL_STEP_SUBTHOUGHT ||
          tutorialStep === TUTORIAL2_STEP_CONTEXT1_HINT ||
          tutorialStep === TUTORIAL2_STEP_CONTEXT1_SUBTHOUGHT_HINT ||
          tutorialStep === TUTORIAL2_STEP_CONTEXT2_HINT ||
          tutorialStep === TUTORIAL2_STEP_CONTEXT2_SUBTHOUGHT_HINT
        ? shortcutById('newSubthought')?.gesture
        : tutorialStep === TUTORIAL2_STEP_CONTEXT_VIEW_TOGGLE
        ? shortcutById('toggleContextView')?.gesture
        : null) || null) as GesturePath | null, // Why does it add 'string' to the type union without this?
  )

  const store = useStore<State>()
  const cursorHeadValue = cursor && headValue(store.getState(), cursor)
  return (
    <div className='tutorial'>
      <div className='tutorial-inner'>
        <a
          className='upper-right tutorial-skip text-small'
          style={{
            visibility:
              tutorialStep !== TUTORIAL_STEP_SUCCESS && tutorialStep !== TUTORIAL2_STEP_SUCCESS ? 'visible' : 'hidden',
          }}
          onClick={() => dispatch(tutorial({ value: false }))}
        >
          ✕ close tutorial
        </a>
        <div className='clear'>
          <div className='tutorial-text'>
            <TransitionGroup>
              {tutorialStepComponent ? (
                WithCSSTransition({ component: tutorialStepComponent, ...tutorialStepProps })
              ) : (
                <p>
                  Oops! I am supposed to continue the tutorial, but I do not recognize tutorial step {tutorialStep}.
                </p>
              )}
            </TransitionGroup>
          </div>
          <TutorialNavigation tutorialStep={tutorialStep} dispatch={dispatch} />
        </div>

        {isTouch &&
        (tutorialStep === TUTORIAL_STEP_FIRSTTHOUGHT ||
          tutorialStep === TUTORIAL_STEP_SECONDTHOUGHT_HINT ||
          tutorialStep === TUTORIAL_STEP_SUBTHOUGHT ||
          tutorialStep === TUTORIAL2_STEP_CONTEXT_VIEW_TOGGLE ||
          tutorialStep === TUTORIAL2_STEP_CONTEXT1_PARENT_HINT ||
          (tutorialStep === TUTORIAL2_STEP_CONTEXT1_HINT &&
            cursor &&
            cursorHeadValue &&
            cursorHeadValue.toLowerCase() === TUTORIAL_CONTEXT1_PARENT[tutorialChoice].toLowerCase()) ||
          (tutorialStep === TUTORIAL2_STEP_CONTEXT1_SUBTHOUGHT_HINT &&
            cursor &&
            cursorHeadValue &&
            cursorHeadValue.toLowerCase() === TUTORIAL_CONTEXT[tutorialChoice].toLowerCase()) ||
          (tutorialStep === TUTORIAL2_STEP_CONTEXT2_PARENT_HINT &&
            cursor &&
            cursorHeadValue &&
            cursorHeadValue.toLowerCase() === TUTORIAL_CONTEXT1_PARENT[tutorialChoice].toLowerCase()) ||
          (tutorialStep === TUTORIAL2_STEP_CONTEXT2_HINT &&
            cursor &&
            cursorHeadValue &&
            cursorHeadValue.toLowerCase() === TUTORIAL_CONTEXT2_PARENT[tutorialChoice].toLowerCase()) ||
          (tutorialStep === TUTORIAL2_STEP_CONTEXT2_SUBTHOUGHT_HINT &&
            cursor &&
            cursorHeadValue &&
            cursorHeadValue.toLowerCase() === TUTORIAL_CONTEXT[tutorialChoice].toLowerCase())) &&
        gesture() ? (
          <div className='tutorial-trace-gesture'>
            <GestureDiagram path={gesture()!} size={160} strokeWidth={10} arrowSize={5} className='animate-pulse' />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default connect(mapStateToProps)(Tutorial)
