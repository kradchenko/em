import React from 'react'
import Svg, { Path } from 'react-native-svg'
import IconType from '../@types/Icon'
import Shortcut from '../@types/Shortcut'
import toggleContextView from '../action-creators/toggleContextView'

// eslint-disable-next-line jsdoc/require-jsdoc
const Icon = ({ fill = 'black', size = 20, style }: IconType) => (
  <Svg width={size} height={size} fill={fill} viewBox='0 0 24 24'>
    <Path d='M18.5,3A2.5,2.5,0,0,0,18,7.95V12.5a.501.501,0,0,1-.5.5H12V7.95a2.5,2.5,0,1,0-1,0V13H5.5a.5006.5006,0,0,1-.5-.5V7.95a2.5,2.5,0,1,0-1,0V12.5A1.5017,1.5017,0,0,0,5.5,14H11v3.05a2.5,2.5,0,1,0,1,0V14h5.5A1.5017,1.5017,0,0,0,19,12.5V7.95A2.5,2.5,0,0,0,18.5,3ZM10,5.5A1.5,1.5,0,1,1,11.5,7,1.5017,1.5017,0,0,1,10,5.5Zm-7,0A1.5,1.5,0,1,1,4.5,7,1.5017,1.5017,0,0,1,3,5.5Zm10,14A1.5,1.5,0,1,1,11.5,18,1.5017,1.5017,0,0,1,13,19.5ZM18.5,7A1.5,1.5,0,1,1,20,5.5,1.5017,1.5017,0,0,1,18.5,7Z' />
  </Svg>
)

const toggleContextViewShortcut: Shortcut = {
  id: 'toggleContextView',
  label: 'Toggle Context View',
  description:
    'Open the context view of the current thought in order to see all of the different contexts in which that thought can be found. Use the same shortcut to close the context view.',
  gesture: 'ru',
  keyboard: { key: 's', shift: true, alt: true },
  svg: Icon,
  exec: dispatch => dispatch(toggleContextView()),
}

export default toggleContextViewShortcut
