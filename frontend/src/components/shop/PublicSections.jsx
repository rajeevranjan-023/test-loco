import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, MessageCircle, Navigation, BadgeCheck, MapPin, Mail, Clock, Store, Camera, Pencil, Share2, ExternalLink, Tag, Leaf, Truck, ShieldCheck, ArrowRight } from 'lucide-react'
import Img from '../Img.jsx'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { Card, Section, Grid, Button, Stars, categoryLabel, fmtDate, hoursLabel, daysLabel, addressLine, shortLocation, mapsUrl, digits } from './ui.jsx'
import { CategoryIcon } from './categoryIcon.jsx'
import { profilePath } from '../../utils/username.js'

// ---------------------------------------------------------------- Profile header
export function ProfileHeader({ profile, isOwner, onEditProfile, onChangeBanner, onShare, onViewShop, onFollowList }) {
  const phone = digits(profile.phone)
  const wa = digits(profile.socials?.whatsapp || profile.phone)
  const stat = (n, label, onClick) => (
    <button type="button" onClick={onClick} className="min-w-[64px] text-center leading-tight">
      <span className="block text-base font-bold text-gray-900">{n ?? 0}</span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </button>
  )
  return (
    <Card className="overflow-hidden">
      <div className="relative h-[84px] w-full sm:h-[110px] md:h-[150px]">
        <Img src={profile.bannerUrl || 'banner.png'} alt="" className="h-full w-full" eager />
        {isOwner && (
          <button type="button" onClick={onChangeBanner} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-gray-700 shadow hover:bg-white">
            <Camera size={13} /> Change Banner
          </button>
        )}
      </div>

      <div className="relative flex flex-col gap-3 px-4 pb-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="relative -mt-10 shrink-0 sm:-mt-14">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-orange-500 shadow-md sm:h-28 sm:w-28">
              {profile.logoUrl ? <Img src={profile.logoUrl} alt={profile.name} className="h-full w-full" /> : <span className="grid h-full w-full place-items-center text-white"><Store size={44} strokeWidth={1.6} /></span>}
            </div>
            {isOwner && (
              <button type="button" onClick={onEditProfile} aria-label="Change logo" className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-gray-700 text-white"><Camera size={12} /></button>
            )}
          </div>
          <div className="min-w-0 pt-2 sm:pt-3">
            <h1 className="flex items-center gap-1.5 text-lg font-bold text-gray-900 sm:text-[22px]">
              <span className="truncate">{profile.name}</span>
              {profile.verified && <BadgeCheck size={20} className="shrink-0 fill-green-500 text-white" aria-label="Verified" />}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {profile.username}
              {isOwner && <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">● Active</span>}
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"><Store size={11} className="text-orange-500" />{categoryLabel(profile.category)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end md:pt-3">
          <div className="flex flex-wrap gap-2">
            {isOwner ? (
              <>
                <Button variant="ghost" icon={ExternalLink} onClick={onViewShop}>View Shop</Button>
                <Button variant="primary" icon={Pencil} onClick={onEditProfile}>Edit Profile</Button>
                <Button variant="ghost" icon={Share2} onClick={onShare}>Share Profile</Button>
              </>
            ) : (
              <>
                <Button as="a" variant="blue" icon={Phone} href={phone ? `tel:${phone}` : undefined} className="min-w-[100px]">Call</Button>
                <Button as="a" variant="green" icon={MessageCircle} href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noreferrer" className="min-w-[110px]">WhatsApp</Button>
                <Button as="a" variant="primary" icon={Navigation} href={mapsUrl(profile.location)} target="_blank" rel="noreferrer">Get Directions</Button>
              </>
            )}
          </div>
          <div className="flex gap-4 self-start md:self-end md:pr-2">
            {stat(profile.productCount, 'Products')}
            {stat(profile.followerCount, 'Followers', () => onFollowList('followers'))}
            {stat(profile.followingCount, 'Following', () => onFollowList('following'))}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- About + tags
const FEATURE_ICONS = [Leaf, Tag, Truck, ShieldCheck]
const FEATURE_TONES = ['bg-green-50 text-green-600', 'bg-orange-50 text-orange-600', 'bg-sky-50 text-sky-600', 'bg-orange-50 text-orange-500']
export function AboutCard({ profile, title = 'About This Shop', onEdit }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
        {onEdit && <EditPill onClick={onEdit} />}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-500">{profile.description || 'No description added yet.'}</p>
      {profile.features?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {profile.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]
            return <span key={f} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${FEATURE_TONES[i % FEATURE_TONES.length]}`}><Icon size={13} />{f}</span>
          })}
        </div>
      )}
    </Card>
  )
}
export function EditPill({ onClick, label = 'Edit' }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-600 hover:bg-orange-100"><Pencil size={11} />{label}</button>
}

// ---------------------------------------------------------------- Shop Information (right column)
function InfoRow({ icon: Icon, tone, label, children }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={14} /></span>
      <span className="w-[70px] shrink-0 pt-1 text-[11px] text-gray-400">{label}</span>
      <div className="min-w-0 break-words pt-0.5 text-[12px] font-medium text-gray-800">{children}</div>
    </div>
  )
}
export function ShopInformation({ profile }) {
  const loc = profile.location || {}
  return (
    <Card className="p-5">
      <h2 className="mb-2 text-[15px] font-bold text-gray-900">Shop Information</h2>
      <div>
        <div>
          <InfoRow icon={Store} tone="bg-orange-50 text-orange-500" label="Category">{categoryLabel(profile.category)}</InfoRow>
          <InfoRow icon={MapPin} tone="bg-red-50 text-red-500" label="Location">
            {addressLine(loc) || '—'}
            <a href={mapsUrl(loc)} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-orange-500"><MapPin size={10} />View on Map</a>
          </InfoRow>
          <InfoRow icon={Phone} tone="bg-green-50 text-green-500" label="Phone">{profile.phone || '—'}</InfoRow>
          <InfoRow icon={Mail} tone="bg-blue-50 text-blue-500" label="Email">{profile.email || '—'}</InfoRow>
          <InfoRow icon={Clock} tone="bg-green-50 text-green-500" label="Open Hours">{hoursLabel(profile.timing)}<span className="block text-[11px] font-normal text-gray-500">({daysLabel(profile.timing)})</span></InfoRow>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- Shop Photos (horizontal scroll)
export function PhotosSection({ images = [] }) {
  if (!images.length) return null
  return (
    <Card className="p-5">
      <Section title="Shop Photos">
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {images.map((src, i) => (
            <div key={src + i} className="relative h-[110px] w-[170px] shrink-0 overflow-hidden rounded-xl sm:h-[112px] sm:w-[calc((100%-48px)/5)] sm:min-w-[150px]">
              <Img src={src} alt={`Shop photo ${i + 1}`} className="h-full w-full" />
            </div>
          ))}
        </div>
      </Section>
    </Card>
  )
}

// ---------------------------------------------------------------- Category cards
export function CategoriesSection({ categories = [], onPick, owner = false, onAdd }) {
  if (!categories.length) return null
  return (
    <Section title={owner ? 'Categories' : 'Shop Categories'} sub={owner ? 'Manage your product categories' : 'Explore products by category'}
      action={owner ? <Button variant="outline" size="sm" onClick={onAdd}>+ Add Category</Button> : null}>
      <Grid cols={owner ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}>
        {categories.map((c) => (
          <button key={c.name} type="button" onClick={() => onPick?.(c.name)} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition hover:border-orange-200 hover:shadow-md">
            <CategoryIcon name={c.name} />
            <span className="min-w-0 leading-tight"><span className="block truncate text-xs font-semibold text-gray-800">{c.name}</span><span className="text-[11px] text-gray-500">{c.count} product{c.count === 1 ? '' : 's'}</span></span>
          </button>
        ))}
      </Grid>
    </Section>
  )
}

// ---------------------------------------------------------------- Reviews
const AVATAR_TONES = ['bg-rose-50 text-rose-500', 'bg-blue-50 text-blue-500', 'bg-green-50 text-green-600', 'bg-violet-50 text-violet-500', 'bg-amber-50 text-amber-600']
export function ReviewTile({ r, compact = false, i = 0 }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>{(r.userName || '?')[0].toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><p className="truncate text-[13px] font-semibold text-gray-900">{r.userName}</p><span className="shrink-0 text-[11px] text-gray-400">{fmtDate(r.createdAt)}</span></div>
          <Stars rating={r.rating} size={12} />
          <p className={`mt-1.5 text-xs text-gray-500 ${compact ? 'line-clamp-2' : ''}`}>{r.comment}</p>
        </div>
      </div>
    </div>
  )
}
export function ReviewsSection({ profile, canWrite, onWrite, refreshKey = 0, owner = false }) {
  const { data } = useApiData(() => api.get(`/api/reviews?targetType=shop&targetId=${profile.id}`), [profile.id, refreshKey])
  const [all, setAll] = useState(false)
  const reviews = data?.reviews || []
  const shown = owner ? reviews.slice(0, 3) : all ? reviews : reviews.slice(0, 3)
  return (
    <Section title={owner ? 'Recent Reviews' : 'Customer Reviews'}
      action={<span className="flex items-center gap-3">
        {canWrite && <button type="button" onClick={onWrite} className="text-xs font-medium text-gray-600 hover:text-orange-600">Write a review</button>}
        {reviews.length > 3 && !owner && <button type="button" onClick={() => setAll((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-sky-600">{all ? 'Show less' : 'View All'} <ArrowRight size={12} /></button>}
      </span>}>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-xs text-gray-500">No reviews yet.</p>
      ) : (
        <Grid cols={owner ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}>{shown.map((r, i) => <ReviewTile key={r._id} r={r} i={i} compact={!all} />)}</Grid>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------- Similar shops
export function SimilarShops({ username }) {
  const { data } = useApiData(() => api.get(`/api/profile/${username}/similar?limit=4`), [username])
  if (!data?.length) return null
  return (
    <Section title="Similar Shops Near You" action={<Link to="/search" className="inline-flex items-center gap-1 text-xs font-medium text-sky-600">View All <ArrowRight size={12} /></Link>}>
      <div className="grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto pb-1 sm:auto-cols-[46%] lg:auto-cols-[calc((100%-36px)/4)] [scrollbar-width:thin]">
        {data.map((s) => (
          <Link key={s.id} to={profilePath(s.username)} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition hover:shadow-md">
            <Img src={s.imageUrl} alt={s.name} className="h-[68px] w-[68px] shrink-0 rounded-lg" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-gray-900">{s.name}</span>
              <span className="block truncate text-[11px] text-gray-500">{s.category}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-700"><span className="text-amber-400">★</span>{s.rating?.toFixed?.(1) ?? s.rating} <span className="text-gray-400">({s.reviewCount})</span></span>
              {(s.area || s.district) && <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500"><MapPin size={10} className="shrink-0 text-orange-500" />{shortLocation({ area: s.area, district: s.district })}</span>}
            </span>
          </Link>
        ))}
      </div>
    </Section>
  )
}
