import { View } from 'moti'
import React, { FC } from 'react'
import { connect, useSelector } from 'react-redux'
import GesturePath from '../@types/GesturePath'
import State from '../@types/State'
import { TUTORIAL_STEP_FIRSTTHOUGHT } from '../constants'
import getSetting from '../selectors/getSetting'
import themeColors from '../selectors/themeColors'
import { shortcutById } from '../shortcuts'
import { commonStyles } from '../style/commonStyles'
import GestureDiagram from './GestureDiagram'
import { Text } from './Text.native'

interface NewThoughtInstructionsProps {
  childrenLength: number
  isTutorial: boolean
}

// assert the search shortcut at load time
const newThoughtShortcut = shortcutById('newThought')
if (!newThoughtShortcut) {
  throw new Error('newThought shortcut not found.')
}

// eslint-disable-next-line jsdoc/require-jsdoc
const mapStateToProps = (state: State) => {
  const { isLoading, status } = state

  return {
    localLoading: isLoading,
    status,
    tutorialStep: +(getSetting(state, 'Tutorial Step') || 0),
  }
}

type NewThoughtInstructionsComponent = FC<NewThoughtInstructionsProps & ReturnType<typeof mapStateToProps>>

/** An absolutely centered LoadingEllipsis. */
const CenteredLoadingEllipsis = () => (
  <View>
    <Text>...</Text>
  </View>
)

/** Display platform-specific instructions of how to create a thought when a context has no thoughts. */
const NewThoughtInstructions: NewThoughtInstructionsComponent = ({
  childrenLength,
  localLoading,
  isTutorial,
  status,
  tutorialStep,
}) => {
  const remoteLoading = status === 'connecting' || status === 'loading'
  const colors = useSelector(themeColors)

  // loading
  // show loading message if local store is loading or if remote is loading and there are no children
  return (
    <View /* className='new-thought-instructions' */>
      {(localLoading || remoteLoading) && childrenLength === 0 ? (
        // show loading ellipsis when loading
        <CenteredLoadingEllipsis />
      ) : // tutorial no children
      // show special message when there are no children in tutorial
      isTutorial ? (
        childrenLength === 0 && (tutorialStep !== TUTORIAL_STEP_FIRSTTHOUGHT || false) ? (
          <View style={commonStyles.alignItemsCenter}>
            <Text style={commonStyles.whiteText}>Ahhh. Open space. Unlimited possibilities.</Text>
          </View>
        ) : // hide on mobile during TUTORIAL_STEP_FIRSTTHOUGHT since the gesture diagram is displayed
        null
      ) : (
        // default
        <>
          <Text style={commonStyles.whiteText}>
            Swipe <GestureDiagram path={newThoughtShortcut.gesture as GesturePath} size={30} color={colors.gray66} />
            to add a new thought.
          </Text>
        </>
      )}
    </View>
  )
}

export default connect(mapStateToProps)(NewThoughtInstructions)
