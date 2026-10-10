import React, { useEffect, useState } from 'react'
import { useOwnerNavigate } from '../../hooks/useOwnerPath.jsx'
import { useOutletContext } from 'react-router-dom'
import { ChevronRight, IndianRupee, ShoppingCart, UserPlus, Wallet, ShoppingBag, Users, Package, Star } from 'lucide-react'
import { api } from '../../services/api.js'
import { SalesOverview, CategoryDonut } from './Charts.jsx'
import { Card, CardHead, Growth, Pulse, StatusBadge, PayTag, Thumb, inr } from './ui.jsx'

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

export default function DashboardPage() {
  const navigate = useOwnerNavigate()
  const { days, setDays } = useOutletContext()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const go = (p) => () => navigate(`/analytics/${p}`)

  useEffect(() => {
    let live = true
    setErr('')
    api.get(`/api/seller/dashboard?days=${days}`, { requiresAuth: true })
      .then((r) => live && setD(r)).catch((e) => live && setErr(e?.message || 'Could not load analytics'))
    return () => { live = false }
  }, [days, tick])

  const k = d?.kpis, x = d?.extra
  const none = (t) => <div className="py-8 text-center text-[14px] text-gray-400">{t}</div>
  return (
    <div>
        {err && <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-600"><span className="flex-1">{err}</span><button type="button" onClick={() => setTick((t) => t + 1)} className="font-medium underline">Retry</button></div>}
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
                <SalesOverview data={d.series} days={days} onDays={setDays} />
                <CategoryDonut data={d.categories} total={k.sales.value} />
                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4">
                  <Mini tone="green" icon={ShoppingBag} label="Average Order Value" value={inr(x.aov)} growth={x.aovGrowth} />
                  <Mini tone="purple" icon={Users} label="Repeat Customers" value={`${x.repeatPct}%`} growth={x.repeatGrowth} />
                  <Mini tone="yellow" icon={Package} label="Total Products Sold" value={x.unitsSold.toLocaleString('en-IN')} growth={x.unitsGrowth} />
                  <Mini tone="yellow" icon={Star} label="Customer Rating" value={`${x.rating} / 5`} sub={`(${x.reviews} reviews)`} />
                </div>
                <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
                  <Card className="p-5">
                    <CardHead title="Top Selling Products" action="View All" onAction={go('products')} />
                    <table className="w-full"><thead className="border-b border-gray-100 bg-gray-50/70"><tr><Th>#</Th><Th>Product</Th><Th right>Units Sold</Th><Th right>Revenue</Th></tr></thead>
                      <tbody>{d.topProducts.map((p, i) => (
                        <tr key={p.name} className="border-b border-gray-100 text-[14px] last:border-0">
                          <td className="py-2.5 pr-2 text-gray-700">{i + 1}</td>
                          <td className="py-2.5"><span className="flex items-center gap-3"><Thumb src={p.imageUrl} icon={p.icon} />{p.name}</span></td>
                          <td className="py-2.5 text-right">{p.units}</td><td className="py-2.5 text-right">{inr(p.revenue)}</td>
                        </tr>))}</tbody></table>
                    {!d.topProducts.length && none('No sales yet')}
                  </Card>
                  <Card className="p-5">
                    <CardHead title="Top Customers" action="View All" onAction={go('customers')} />
                    <table className="w-full"><thead className="border-b border-gray-100 bg-gray-50/70"><tr><Th>#</Th><Th>Customer</Th><Th right>Total Orders</Th><Th right>Total Spent</Th></tr></thead>
                      <tbody>{d.topCustomers.map((c, i) => (
                        <tr key={c.name} className="border-b border-gray-100 text-[14px] last:border-0">
                          <td className="py-2.5 pr-2 text-gray-700">{i + 1}</td>
                          <td className="py-2.5"><span className="flex items-center gap-3"><span className={`grid h-[30px] w-[30px] place-items-center rounded-full text-xs font-semibold ${avatarTones[i % 5]}`}>{c.name[0]}</span>{c.name}</span></td>
                          <td className="py-2.5 text-right">{c.orders}</td><td className="py-2.5 text-right">{inr(c.spent)}</td>
                        </tr>))}</tbody></table>
                    {!d.topCustomers.length && none('No customers yet')}
                  </Card>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="p-5">
                  <CardHead title="Recent Orders" action="View All" onAction={go('orders')} />
                  {!d.recentOrders.length && none('No orders yet')}
                  <ul>{d.recentOrders.map((o) => (
                    <li key={o.id + o.ago} onClick={go('orders')} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 py-3 transition last:border-0 hover:bg-gray-50/70">
                      <div className="w-[78px] leading-tight"><div className="text-[13px] font-semibold">{o.id}</div><div className="text-[11px] text-gray-400">{o.ago}</div></div>
                      <div className="w-[52px] leading-tight"><div className="text-[13px]">{inr(o.total)}</div><PayTag v={o.payment} /></div>
                      <div className="flex-1"><StatusBadge s={o.status} /></div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </li>))}</ul>
                  <button type="button" onClick={go('orders')} className="mt-3 h-12 w-full rounded-xl bg-[#0E9F6E] text-[15px] font-medium text-white hover:bg-[#0b8a5f]">View All Orders</button>
                </Card>
                <div className="rounded-2xl border border-[#FBE3E3] bg-[#FFF3F3] p-5">
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[#D92D20]">Low Stock Alerts</h3><button type="button" onClick={go('inventory')} className="text-[13px] text-gray-800 hover:underline">View All</button></div>
                  {!d.lowStock.length && none('All products are well stocked 👍')}
                  <ul>{d.lowStock.map((p) => (
                    <li key={p.name} className="flex items-center gap-3 py-2.5">
                      <div className="rounded-lg bg-white p-1"><Thumb src={p.imageUrl} icon={p.icon} size={38} /></div>
                      <div className="flex-1 leading-tight"><div className="text-[14px] text-gray-900">{p.name}</div><div className="text-[13px] font-medium text-[#F97316]">Only {p.stock} left</div></div>
                      <button type="button" onClick={go('inventory')} className="rounded-lg border border-[#F5C2C2] bg-[#FDE8E8] px-4 py-2 text-[13px] font-medium text-[#D92D20] hover:bg-[#fbd5d5]">Restock</button>
                    </li>))}</ul>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
