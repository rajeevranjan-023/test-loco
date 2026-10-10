import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Phone, Clock, Armchair, Star, CheckCircle2 } from 'lucide-react'
import FollowButton from '../../features/follow/FollowButton.jsx'
import ReviewsSection from '../../features/review/ReviewsSection.jsx'
import { DEFAULT_AVATAR, DEFAULT_BANNER } from '../../utils/placeholders.js'
import { profilePath } from '../../utils/username.js'

// Public + owner profile of a Study Center (profile layout chosen by the business type, same owner/viewer permission rules as the shop profile).
// It shows the centre, its facilities, live seat availability and membership options — never who sits where.
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
export default function StudyCenterProfile({ profile: p, isOwner, embedded, refresh }) {
  const nav = useNavigate()
  const Wrap = ({ children }) => (embedded ? <div className="w-full min-w-0">{children}</div> : <section className="section"><div className="container">{children}</div></section>)
  const seats = p.seats || { total: 0, available: 0, partial: 0 }
  return (
    <Wrap>
      <div className="overflow-hidden rounded-2xl border border-[#EEF0F5] bg-white shadow-sm">
        <div className="h-[170px] w-full bg-gray-100 sm:h-[220px]"><img src={p.bannerUrl || DEFAULT_BANNER} alt="" className="h-full w-full object-cover" /></div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
          <img src={p.logoUrl || DEFAULT_AVATAR} alt={`${p.name} logo`} className="-mt-12 h-24 w-24 rounded-full border-4 border-white bg-white object-cover shadow" />
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="flex items-center gap-2 text-[24px] font-semibold">{p.name}{p.verified && <CheckCircle2 size={18} className="text-[#2F6FEB]" aria-label="Verified" />}</h1>
            <p className="text-[13px] text-gray-500">{p.category}{p.centerCode ? ` · ${p.centerCode}` : ''} · <Star size={12} className="inline text-amber-500" /> {p.rating} ({p.reviewCount} reviews) · {p.followerCount ?? 0} followers</p>
          </div>
          <div className="flex gap-2 pt-3">
            {isOwner ? <button type="button" className="btn btn-outline btn-sm" onClick={() => nav(profilePath(p.username, 'shop'))}>Edit center details</button>
              : <FollowButton targetType="study_center" targetId={p.id} initialFollowing={p.isFollowing} onChange={refresh} />}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4">
          {p.description && <div className="rounded-2xl border border-[#EEF0F5] bg-white p-5"><h3 className="mb-2 text-[16px] font-semibold">About</h3><p className="text-[14px] leading-relaxed text-gray-700">{p.description}</p></div>}
          {p.studyEnvironment && <div className="rounded-2xl border border-[#EEF0F5] bg-white p-5"><h3 className="mb-2 text-[16px] font-semibold">Study environment</h3><p className="text-[14px] text-gray-700">{p.studyEnvironment}</p></div>}
          {p.features?.length > 0 && <div className="rounded-2xl border border-[#EEF0F5] bg-white p-5"><h3 className="mb-3 text-[16px] font-semibold">Facilities</h3><div className="flex flex-wrap gap-2">{p.features.map((f) => <span key={f} className="rounded-full bg-orange-50 px-3 py-1 text-[13px] text-orange-700">{f}</span>)}</div></div>}
          {p.plans?.length > 0 && <div className="rounded-2xl border border-[#EEF0F5] bg-white p-5"><h3 className="mb-3 text-[16px] font-semibold">Membership options</h3><div className="grid gap-2 sm:grid-cols-2">{p.plans.map((m) => <div key={m.name} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5"><span className="text-[14px] font-medium">{m.name}</span><span className="text-[14px] text-gray-700">{inr(m.price)}</span></div>)}</div></div>}
          <ReviewsSection profile={p} isOwner={isOwner} />
        </div>
        <div className="grid content-start gap-4">
          <div className="rounded-2xl border border-[#EEF0F5] bg-white p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[16px] font-semibold"><Armchair size={17} />Seat availability</h3>
            <div className="flex items-end gap-2"><span className="text-[34px] font-semibold leading-none text-[#12A05C]">{seats.available}</span><span className="pb-1 text-[13px] text-gray-500">of {seats.total} seats available{seats.partial ? ` (${seats.partial} part-time)` : ''}</span></div>
          </div>
          <div className="rounded-2xl border border-[#EEF0F5] bg-white p-5 text-[14px] text-gray-700">
            <h3 className="mb-3 text-[16px] font-semibold">Contact</h3>
            <p className="mb-2 flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" />{[p.location?.address, p.location?.area, p.location?.district].filter(Boolean).join(', ') || '—'}</p>
            <p className="mb-2 flex items-center gap-2"><Phone size={16} className="text-gray-400" />{p.phone}</p>
            <p className="flex items-center gap-2"><Clock size={16} className="text-gray-400" />{p.timing?.open} – {p.timing?.close} · {p.timing?.openDays}</p>
          </div>
        </div>
      </div>
    </Wrap>
  )
}
