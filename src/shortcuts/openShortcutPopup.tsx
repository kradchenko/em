import React from 'react'
import IconType from '../@types/Icon'
import Shortcut from '../@types/Shortcut'
import showModal from '../action-creators/showModal'
import { isTouch } from '../browser'
import scrollTo from '../device/scrollTo'

// eslint-disable-next-line jsdoc/require-jsdoc
const Icon = ({ fill = 'black', size = 20, style }: IconType) => (
  <svg
    version='1.1'
    className='icon'
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    fill={fill}
    style={style}
    viewBox='0 0 19.481 19.481'
    enableBackground='new 0 0 19.481 19.481'
  >
    <g>
      <path d='m10.201,.758l2.478,5.865 6.344,.545c0.44,0.038 0.619,0.587 0.285,0.876l-4.812,4.169 1.442,6.202c0.1,0.431-0.367,0.77-0.745,0.541l-5.452-3.288-5.452,3.288c-0.379,0.228-0.845-0.111-0.745-0.541l1.442-6.202-4.813-4.17c-0.334-0.289-0.156-0.838 0.285-0.876l6.344-.545 2.478-5.864c0.172-0.408 0.749-0.408 0.921,0z' />
    </g>
  </svg>
)

const openShortcutPopupShortcut: Shortcut = {
  id: 'openShortcutPopup',
  label: 'Open Shortcut Popup',
  description: `Open the help screen which contains the tutorials and a list of all ${
    isTouch ? 'gestures' : 'keyboard shortcuts'
  }. Yes, this help screen.`,
  keyboard: { key: '/', meta: true },
  svg: Icon,
  exec: dispatch => {
    dispatch(showModal({ id: 'help' }))
    scrollTo('top')
  },
}

export default openShortcutPopupShortcut
