import React from 'react'
import IconType from '../@types/Icon'
import Shortcut from '../@types/Shortcut'
import subCategorizeOne from '../action-creators/subCategorizeOne'
import isDocumentEditable from '../util/isDocumentEditable'

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
    viewBox='0 0 24 24'
  >
    <path d='M12.6,15.782V8.218a2.939,2.939,0,1,0-1.2,0v7.564a2.939,2.939,0,1,0,1.2,0ZM10.26,5.34A1.74,1.74,0,1,1,12,7.081,1.743,1.743,0,0,1,10.26,5.34ZM12,20.4a1.741,1.741,0,1,1,1.74-1.74A1.743,1.743,0,0,1,12,20.4Z' />
  </svg>
)

// NOTE: The keyboard shortcut for New Uncle handled in New Thought command until it is confirmed that shortcuts are evaluated in the correct order
const subCategorizeOneShortcut: Shortcut = {
  id: 'subcategorizeOne',
  label: 'Subcategorize',
  description: 'Move the current thought into a new, empty thought at the same level.',
  gesture: 'lu',
  keyboard: { key: 'o', meta: true, alt: true },
  svg: Icon,
  canExecute: getState => isDocumentEditable() && !!getState().cursor,
  exec: dispatch => dispatch(subCategorizeOne()),
}

// a shortcut for Raine until we have custom user shortcuts
export const subCategorizeOneShortcutAlias: Shortcut = {
  id: 'subcategorizeOneAlias',
  label: 'Subcategorize',
  hideFromInstructions: true,
  keyboard: { key: ']', meta: true },
  svg: Icon,
  canExecute: getState => isDocumentEditable() && !!getState().cursor,
  exec: dispatch => dispatch(subCategorizeOne()),
}

export default subCategorizeOneShortcut
