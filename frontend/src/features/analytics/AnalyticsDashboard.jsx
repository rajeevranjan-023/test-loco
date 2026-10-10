import React, { useEffect, useState } from 'react'
import { Bell, ChevronDown, ChevronRight, CalendarDays, IndianRupee, ShoppingCart, UserPlus, Wallet, ShoppingBag, Users, Package, Star } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import Sidebar from './Sidebar.jsx'
import { SalesOverview, CategoryDonut } from './Charts.jsx'
import { Card, CardHead, Growth, Pulse, StatusBadge, Thumb, inr } from './ui.jsx'

const kpiStyle = {
  green: ['bg-[#EAF8F1]', 'bg-[#12A36E]'], blue: ['bg-[#EAF2FE]', 'bg-[#2F7CF6]'],
  yellow: ['bg-[#FFF8E3]', 'bg-[#FBBF24]'], purple: ['bg-[#F1EEFD]', 'bg-[#6D5BD0]'],
}
function Kpi({ tone, icon: Icon, label, value, growth }) {
  const [bg, ic] = kpiStyle[tone]
  return (
    <div className={`flex h-[118px] items-center gap-4 rounded-2xl border border-white/60 px-6 ${bg}`}>
      <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl text-white ${ic}`}><Icon size={26} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-gray-800">{label}</div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[26px] font-semibold leading-tight text-gray-900">{value}</span>
          <div className="text-right leading-tight"><Growth v={growth} /><div className="text-[11px] text-gray-500">vs last month</div></div>
        </div>
      </div>
    </div>
  )
}
function Mini({ tone, icon: Icon, label, value, sub, growth }) {
  const [bg, ic] = kpiStyle[tone]
  return (
    <Card className="flex h-[102px] items-center gap-4 px-5">
      <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl ${bg}`}><Icon size={26} className={ic.replace('bg-', 'text-')} /></span>
      <div className="leading-tight">
        <div className="text-[13px] text-gray-800">{label}</div>
        <div className="my-0.5 text-[22px] font-semibold text-gray-900">{value}</div>
        {growth !== undefined ? <Growth v={growth} /> : <div className="text-[13px] text-gray-500">{sub}</div>}
      </div>
    </Card>
  )
}
const Th = ({ children, right }) => <th className={`py-2.5 text-[13px] font-semibold text-gray-900 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
const avatarTones = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-orange-100 text-orange-700', 'bg-green-100 text-green-700', 'bg-indigo-100 text-indigo-700']

export default function AnalyticsDashboard() {
  const { user } = useAuth()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    api.get('/api/seller/dashboard?days=30', { requiresAuth: true })
      .then((r) => live && setD(r)).catch((e) => live && setErr(e?.message || 'Could not load analytics'))
    return () => { live = false }
  }, [])

  const k = d?.kpis, x = d?.extra
  return (
    <div className="min-h-screen bg-[#F5F7FB] lg:pl-[256px]">
      <Sidebar shop={d?.shop} badges={d?.badges} username={user?.username} />
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-5">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold text-gray-900">Welcome back, {d?.shop?.name || user?.name || ''}! 👋</h1>
            <p className="text-[15px] text-gray-600">Here’s what’s happening with your shop today.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden h-[46px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-gray-800 sm:flex">
              <CalendarDays size={17} />{d?.range || '—'}<ChevronDown size={16} className="text-gray-500" />
            </div>
            <button type="button" aria-label="Notifications" className="relative grid h-[46px] w-[46px] place-items-center rounded-xl bg-white">
              <Bell size={20} /><i className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#1F6FEB] text-sm font-semibold text-white">{(user?.name || 'U')[0]}</span>
              <div className="hidden leading-tight sm:block"><div className="text-[15px] font-medium">{user?.name}</div><div className="text-[13px] text-gray-500">Owner</div></div>
              <ChevronDown size={16} className="text-gray-500" />
            </div>
          </div>
        </header>

        {err && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{err}</div>}
        {!d && !err ? (
          <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Pulse key={i} className="h-[118px]" />)}</div><Pulse className="h-[320px]" /><Pulse className="h-[220px]" /></div>
        ) : d && (
          <div className="space-y-4 animate-[fadeIn_.35s_ease]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi tone="green" icon={IndianRupee} label="Total Sales" value={inr(k.sales.value)} growth={k.sales.growth} />
              <Kpi tone="blue" icon={ShoppingCart} label="Total Orders" value={k.orders.value} growth={k.orders.growth} />
              <Kpi tone="yellow" icon={UserPlus} label="New Customers" value={k.customers.value} growth={k.customers.growth} />
              <Kpi tone="purple" icon={Wallet} label="Pending Udhar" value={inr(k.udhar.value)} growth={k.udhar.growth} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[1.85fr_1fr] content-start">
                <SalesOverview data={d.series} />
                <CategoryDonut data={d.categories} total={k.sales.value} />
                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4">
                  <Mini tone="green" icon={ShoppingBag} label="Average Order Value" value={inr(x.aov)} growth={x.aovGrowth} />
                  <Mini tone="purple" icon={Users} label="Repeat Customers" value={`${x.repeatPct}%`} growth={x.repeatGrowth} />
                  <Mini tone="yellow" icon={Package} label="Total Products Sold" value={x.unitsSold.toLocaleString('en-IN')} growth={x.unitsGrowth} />
                  <Mini tone="yellow" icon={Star} label="Customer Rating" value={`${x.rating} / 5`} sub={`(${x.reviews} reviews)`} />
                </div>
                <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
                  <Card className="p-5">
                    <CardHead title="Top Selling Products" action="View All" />
                    <table className="w-full"><thead className="border-b border-gray-100 bg-gray-50/70"><tr><Th>#</Th><Th>Product</Th><Th right>Units Sold</Th><Th right>Revenue</Th></tr></thead>
                      <tbody>{d.topProducts.map((p, i) => (
                        <tr key={p.name} className="border-b border-gray-100 text-[14px] last:border-0">
                          <td className="py-2.5 pr-2 text-gray-700">{i + 1}</td>
                          <td className="py-2.5"><span className="flex items-center gap-3"><Thumb src={p.imageUrl} icon={p.icon} />{p.name}</span></td>
                          <td className="py-2.5 text-right">{p.units}</td><td className="py-2.5 text-right">{inr(p.revenue)}</td>
                        </tr>))}</tbody></table>
                  </Card>
                  <Card className="p-5">
                    <CardHead title="Top Customers" action="View All" />
                    <table className="w-full"><thead className="border-b border-gray-100 bg-gray-50/70"><tr><Th>#</Th><Th>Customer</Th><Th right>Total Orders</Th><Th right>Total Spent</Th></tr></thead>
                      <tbody>{d.topCustomers.map((c, i) => (
                        <tr key={c.name} className="border-b border-gray-100 text-[14px] last:border-0">
                          <td className="py-2.5 pr-2 text-gray-700">{i + 1}</td>
                          <td className="py-2.5"><span className="flex items-center gap-3"><span className={`grid h-[30px] w-[30px] place-items-center rounded-full text-xs font-semibold ${avatarTones[i % 5]}`}>{c.name[0]}</span>{c.name}</span></td>
                          <td className="py-2.5 text-right">{c.orders}</td><td className="py-2.5 text-right">{inr(c.spent)}</td>
                        </tr>))}</tbody></table>
                  </Card>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="p-5">
                  <CardHead title="Recent Orders" action="View All" />
                  <ul>{d.recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0">
                      <div className="w-[78px] leading-tight"><div className="text-[13px] font-semibold">{o.id}</div><div className="text-[11px] text-gray-400">{o.ago}</div></div>
                      <div className="w-[46px] text-[13px]">{inr(o.total)}</div>
                      <div className="flex-1"><StatusBadge s={o.status} /></div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </li>))}</ul>
                  <button type="button" className="mt-3 h-12 w-full rounded-xl bg-[#0E9F6E] text-[15px] font-medium text-white hover:bg-[#0b8a5f]">View All Orders</button>
                </Card>
                <div className="rounded-2xl border border-[#FBE3E3] bg-[#FFF3F3] p-5">
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[#D92D20]">Low Stock Alerts</h3><span className="text-[13px] text-gray-800">View All</span></div>
                  <ul>{d.lowStock.map((p) => (
                    <li key={p.name} className="flex items-center gap-3 py-2.5">
                      <div className="rounded-lg bg-white p-1"><Thumb src={p.imageUrl} icon={p.icon} size={38} /></div>
                      <div className="flex-1 leading-tight"><div className="text-[14px] text-gray-900">{p.name}</div><div className="text-[13px] font-medium text-[#F97316]">Only {p.stock} left</div></div>
                      <button type="button" className="rounded-lg border border-[#F5C2C2] bg-[#FDE8E8] px-4 py-2 text-[13px] font-medium text-[#D92D20] hover:bg-[#fbd5d5]">Restock</button>
                    </li>))}</ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
