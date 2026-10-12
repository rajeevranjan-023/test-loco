import React from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useApiData } from '../../hooks/useApiData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTitle } from '../../hooks/title.js'
import { DEFAULT_AVATAR } from '../../utils/placeholders.js'
import { profilePath } from '../../utils/username.js'
import ErrorState from '../../components/ErrorState.jsx'

// Personal analytics / activity — the Analytics tab for an account WITHOUT a business.
// This is only the base structure: the page renders the SECTIONS list below, each section is an independent component that
// receives the same `data`. Adding a section later = write a component + add one line to SECTIONS. It shows real data only
// (the account itself, the requests it posted, the businesses it follows) and an empty state where there is nothing yet.
const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const Card = ({ title, children, right }) => (
  <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-gray-900">{title}</h2>{right}</div>{children}
  </section>
)
const Empty = ({ children }) => <p className="py-4 text-center text-sm text-gray-500">{children}</p>

function PersonalOverview({ user, data }) {
  const tiles = [['Following', user.followingCount ?? 0], ['Requests posted', data.requirements.length], ['Open requests', data.requirements.filter((r) => r.status === 'open').length]]
  return (
    <Card title="Personal overview" right={<Link to="/settings?edit=1" className="text-sm font-medium text-orange-600">Edit profile</Link>}>
      <div className="flex items-center gap-4">
        <img src={user.avatarUrl || DEFAULT_AVATAR} alt="" className="h-16 w-16 rounded-full object-cover" />
        <div className="min-w-0 leading-tight"><p className="truncate text-lg font-semibold">{user.name}</p>{user.username && <p className="text-sm text-gray-500">{user.username}</p>}<p className="truncate text-sm text-gray-500">{user.email}</p>{user.bio && <p className="mt-1 text-sm text-gray-700">{user.bio}</p>}</div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">{tiles.map(([k, v]) => <div key={k} className="rounded-xl bg-gray-50 py-3"><dt className="text-xs text-gray-500">{k}</dt><dd className="text-xl font-semibold">{v}</dd></div>)}</dl>
    </Card>
  )
}

function MyActivity({ data }) {
  const { requirements, following } = data
  return (
    <Card title="My activity" right={<Link to="/requirements" className="text-sm font-medium text-orange-600">All requests</Link>}>
      <h3 className="mb-1 text-sm font-semibold text-gray-700">Requests I posted</h3>
      {requirements.length ? <ul className="divide-y divide-gray-100">{requirements.slice(0, 5).map((r) => <li key={r._id} className="flex items-center justify-between py-2 text-sm"><span className="truncate pr-3">{r.title}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${r.status === 'open' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span></li>)}</ul> : <Empty>You haven't posted any requests yet.</Empty>}
      <h3 className="mb-1 mt-4 text-sm font-semibold text-gray-700">Businesses I follow</h3>
      {following.length ? <ul className="divide-y divide-gray-100">{following.slice(0, 6).map((f) => <li key={`${f.type}-${f.id}`} className="py-2 text-sm"><Link to={profilePath(f.username)} className="hover:text-orange-600">{f.name}</Link></li>)}</ul> : <Empty>You aren't following any business yet.</Empty>}
    </Card>
  )
}

function RecentActions({ data }) {
  const events = data.requirements.map((r) => ({ id: r._id, at: r.createdAt, text: `You posted a request: ${r.title}` })).sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8)
  return <Card title="Recent actions">{events.length ? <ul className="space-y-2">{events.map((e) => <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate">{e.text}</span><time className="shrink-0 text-xs text-gray-500">{date(e.at)}</time></li>)}</ul> : <Empty>Nothing yet — your recent actions will appear here.</Empty>}</Card>
}

export const SECTIONS = [
  { id: 'overview', Component: PersonalOverview },
  { id: 'activity', Component: MyActivity },
  { id: 'recent', Component: RecentActions },
]

export default function PersonalActivityPage() {
  useTitle('My activity')
  const { user } = useAuth()
  const state = useApiData(async () => {
    const [requirements, following] = await Promise.all([
      api.get('/api/requirements/mine', { requiresAuth: true }).catch(() => []),
      api.get(`/api/follow/following/${user.id}`).catch(() => []),
    ])
    return { requirements: Array.isArray(requirements) ? requirements : [], following: Array.isArray(following) ? following : [] }
  }, [user.id])
  return (
    <section className="section">
      <div className="container mx-auto grid max-w-3xl gap-4 px-4">
        <h1 className="text-2xl font-semibold">My activity</h1>
        {state.loading && <p className="text-sm text-gray-500" aria-busy="true">Loading your activity…</p>}
        {state.error && <ErrorState error={state.error} onRetry={state.retry} title="Couldn't load your activity: " className="text-sm text-red-600" />}
        {state.data && SECTIONS.map(({ id, Component }) => <Component key={id} user={user} data={state.data} />)}
      </div>
    </section>
  )
}
