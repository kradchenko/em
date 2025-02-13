import React from 'react'
import IconType from '../@types/Icon'
import Shortcut from '../@types/Shortcut'
import showModal from '../action-creators/showModal'
import { isTouch } from '../browser'
import { HOME_TOKEN } from '../constants'
import { getAllChildren } from '../selectors/getChildren'

// eslint-disable-next-line jsdoc/require-jsdoc
const Icon = ({ fill, size = 20, style }: IconType) => (
  <svg
    version='1.1'
    className='icon'
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    // override fill since this SVG uses stroke
    style={{
      ...style,
      fill: 'none',
    }}
    fill='none'
    viewBox='0 0 20 20'
  >
    <path
      d='M1 13.5217V19H18V13.5217M9.5 1V15.087M9.5 15.087L5.08 9.69195M9.5 15.087L13.92 9.69195'
      stroke={style?.fill || fill}
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)

// eslint-disable-next-line jsdoc/require-jsdoc
const ShareIcon = ({ fill = 'black', size = 20, style }: IconType) => (
  <svg
    className='icon'
    width={size}
    height={size}
    fill={fill}
    style={style}
    viewBox='0 0 11 10'
    version='1.1'
    xmlns='http://www.w3.org/2000/svg'
  >
    <g>
      <path d='M5.07799385,1.57822638 L5.07799385,6.00195683 C5.07799385,6.25652943 4.87308997,6.46290127 4.61635805,6.46290127 C4.36140363,6.46290127 4.15472224,6.25632412 4.15472224,6.00195683 L4.15472224,1.57673073 L3.63332249,2.09813049 C3.45470505,2.27674793 3.16501806,2.27665705 2.98348118,2.09512018 C2.80320118,1.91484018 2.80426532,1.62148443 2.98047088,1.44527887 L4.29219473,0.133555019 C4.38100979,0.0447399441 4.49728613,0.000109416918 4.61407318,0 L4.61759666,0.0013781583 C4.73483522,0.00162826335 4.85141208,0.0459413813 4.93902573,0.133555019 L6.25074959,1.44527887 C6.42936703,1.62389632 6.42927613,1.91358331 6.24773926,2.09512018 C6.06745926,2.27540018 5.77410353,2.27433604 5.59789795,2.09813049 L5.07799385,1.57822638 Z M0.92327161,8.54026239 L8.30944449,8.54026239 L8.30944449,5.3066871 C8.30944449,5.05290609 8.51434837,4.84717595 8.77108029,4.84717595 C9.02603471,4.84717595 9.2327161,5.05449945 9.2327161,5.3066871 L9.2327161,9.00402285 C9.2327161,9.13081036 9.18157324,9.24560465 9.09837549,9.32874375 C9.01393142,9.41215029 8.89896465,9.463534 8.77170544,9.463534 L0.461010662,9.463534 C0.334057222,9.463534 0.219089304,9.41259023 0.135717961,9.32967926 C0.05158592,9.24480666 0,9.1300136 0,9.00402285 L0,5.3066871 C0,5.05290609 0.204903893,4.84717595 0.461635805,4.84717595 C0.71659022,4.84717595 0.92327161,5.05449945 0.92327161,5.3066871 L0.92327161,8.54026239 Z'></path>
    </g>
  </svg>
)

const exportContextShortcut: Shortcut = {
  id: 'exportContext',
  label: 'Export Context',
  description: 'Export the current context as plaintext or html',
  svg: isTouch ? ShareIcon : Icon,
  canExecute: getState => {
    const state = getState()
    if (state.cursor) return true
    return getAllChildren(state, HOME_TOKEN).length > 0
  },
  exec: dispatch => dispatch(showModal({ id: 'export' })),
}

export default exportContextShortcut
