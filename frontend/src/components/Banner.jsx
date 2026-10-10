import React from 'react'
import Img from './Img.jsx'

const tones = { green: 'bg-green-50', peach: 'bg-orange-50', blue: 'bg-sky-50', purple: 'bg-violet-50', sand: 'bg-amber-50' }

function Banner({ tone = 'green', title, highlight, sub, list, cta, img, onClick, className = '' }) {
  return (
    <div className={`relative flex h-[150px] min-w-[86%] snap-start overflow-hidden rounded-2xl sm:min-w-[60%] md:min-w-0 ${tones[tone]} ${className}`}>
      <div className="z-10 flex w-[58%] flex-col justify-between p-4">
        <div>
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900">{title}</h3>
          {highlight && <div className="line-clamp-2 text-sm font-medium leading-snug text-orange-600">{highlight}</div>}
          {sub && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{sub}</p>}
          {list && <p className="mt-1 line-clamp-1 text-[11px] text-gray-600">✓ {list.slice(0, 2).join('  ✓ ')}</p>}
        </div>
        {cta && (
          <button type="button" onClick={onClick} className="w-fit rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-orange-600">
            {cta} →
          </button>
        )}
      </div>
      <Img src={img} className="absolute inset-y-0 right-0 h-full w-[46%] !bg-transparent" />
    </div>
  )
}
export default React.memo(Banner)
