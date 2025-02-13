import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import search from '../action-creators/search'
import searchContexts from '../action-creators/searchContexts'
import setCursor from '../action-creators/setCursor'
import toggleSidebar from '../action-creators/toggleSidebar'
import { EM_TOKEN } from '../constants'
import scrollCursorIntoView from '../device/scrollCursorIntoView'
import * as selection from '../device/selection'
import getThoughtById from '../selectors/getThoughtById'
import decodeCharacterEntities from '../util/decodeCharacterEntities'
import ellipsize from '../util/ellipsize'
import head from '../util/head'
import strip from '../util/strip'

interface LinkProps {
  charLimit?: number
  label?: string
  simplePath: SimplePath
  style?: React.CSSProperties
}

/** Renders a link to a thought. */
const Link = React.memo(({ simplePath, label, charLimit = 32, style }: LinkProps) => {
  const isEM = simplePath.length === 1 && head(simplePath) === EM_TOKEN
  const value = useSelector((state: State) => strip(label || getThoughtById(state, head(simplePath))?.value || ''))
  const dispatch = useDispatch()

  // TODO: Fix tabIndex for accessibility
  return (
    <a
      tabIndex={-1}
      className='link'
      onClick={e => {
        // eslint-disable-line react/no-danger-with-children
        e.preventDefault()
        selection.clear()
        dispatch([
          search({ value: null }),
          searchContexts({ value: null }),
          setCursor({ path: simplePath }),
          toggleSidebar({ value: false }),
        ])
        scrollCursorIntoView()
      }}
      style={{
        userSelect: 'none',
        color: 'inherit',
        textDecoration: 'none',
        ...style,
      }}
      dangerouslySetInnerHTML={isEM ? { __html: '<b>em</b>' } : undefined}
    >
      {!isEM ? ellipsize(decodeCharacterEntities(value), charLimit) : null}
    </a>
  )
})

Link.displayName = 'Link'

export default Link
