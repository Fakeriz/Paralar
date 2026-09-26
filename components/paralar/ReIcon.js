'use client'

import React from 'react'

/**
 * ReIcon renders SVG from 'reicon' icons safely in React & Next.js SSR
 * @param {Object} props
 * @param {Function} props.icon - The reicon function (e.g. Home6, Flame)
 * @param {'Outline'|'Filled'} [props.weight='Outline']
 * @param {number} [props.size=24]
 * @param {string} [props.className]
 */
export default function ReIcon({ icon, weight = 'Outline', size = 24, className = '', ...props }) {
  const key = weight === 'Filled' ? 'F' : 'O'
  const innerHtml = icon?.iconData?.[key] || icon?.iconData?.O || icon?.iconData?.F || ''

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      dangerouslySetInnerHTML={{ __html: innerHtml }}
      {...props}
    />
  )
}
