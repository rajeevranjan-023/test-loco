import React, { useState } from 'react'
import { useOwnerNavigate } from '../../../hooks/useOwnerPath.jsx'
import { IndianRupee, ShoppingCart, UserPlus, Wallet, TrendingUp, Package, ShoppingBag, Users, Star, AlertTriangle, BarChart3 } from 'lucide-react'
import { Panel, Sel, MiniTabs, Gr, NoData, Tbl, Td, PName, StatusPill, ago, inr } from './bits.jsx'
import { SalesOrders, RevenueProfit, StockVsSales, HourlyArea, Heatmap, Donut, MarginBars, Dot, C } from '../charts.jsx'

const BIG = { green: ['bg-[#EAF8F1]', 'bg-[#16A870]'], blue: ['bg-[#EAF3FF]', 'bg-[#2F86F6]'], yellow: ['bg-[#FFF6DF]', 'bg-[#FBBF24]'], purple: ['bg-[#F1EDFD]', 'bg-[#7C5CE0]'] }
function Big({ tone, icon: I, label, value, growth }) {
  const [bg, ic] = BIG[tone]
  return (
    <div className={`flex h-[92px] items-center gap-3 rounded-2xl border border-white/70 px-4 transition hover:-translate-y-0.5 hover:shadow-md ${bg}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${ic}`}><I size={22} /></span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[11.5px] text-gray-700">{label}</div>
        <div className="flex items-end justify-between gap-1"><span className="text-[21px] font-semibold text-gray-900">{value}</span><div className="pb-0.5 text-right"><Gr v={growth} /><div className="text-[9.5px] text-gray-500">vs last period</div></div></div>
      </div>
    </div>
  )
}
function Small({ box, icon: I, label, value, sub, growth, bad }) {
  return (
    <div className="flex h-[72px] items-center gap-3 rounded-2xl border border-[#E8EEF6] bg-white px-3.5 transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${box}`}><I size={18} /></span>
      <div className="leading-tight"><div className="text-[10.5px] text-gray-600">{label}</div><div className="text-[17px] font-semibold text-gray-900">{value}</div>{growth !== undefined ? <Gr v={growth} /> : <span className={`text-[10px] ${bad ? 'text-red-500' : 'text-gray-500'}`}>{sub}</span>}</div>
    </div>
  )
}
const Av = ({ n, i = 0 }) => <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700', 'bg-indigo-100 text-indigo-700'][i % 5]}`}>{n[0]}</span>

export default function Overview({ d, days }) {
  const nav = useOwnerNavigate()
  const go = (p) => () => nav(`/analytics/${p}`)
  const k = d.kpis
  const [tab, setTab] = useState('Most Sold')
  const [mode, setMode] = useState('Both')
  const [hourMode, setHourMode] = useState('Today')
  const list = { 'Most Sold': d.topProducts.mostSold, 'Most Profitable': d.topProducts.mostProfitable, 'Least Sold': d.topProducts.leastSold, 'Fastest Growing': d.topProducts.fastestGrowing }[tab]
  const view = (p) => <button type="button" onClick={p} className="text-[11.5px] font-medium text-blue-600 hover:underline">View All</button>
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Big tone="green" icon={IndianRupee} label="Total Sales" value={inr(k.sales.value)} growth={k.sales.growth} />
        <Big tone="blue" icon={ShoppingCart} label="Total Orders" value={k.orders.value} growth={k.orders.growth} />
        <Big tone="yellow" icon={UserPlus} label="New Customers" value={k.customers.value} growth={k.customers.growth} />
        <Big tone="purple" icon={Wallet} label="Pending Udhar" value={inr(k.udhar.value)} growth={k.udhar.growth} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Small box="bg-[#FFF3D6] text-[#E09A0B]" icon={TrendingUp} label="Total Profit" value={inr(k.profit.value)} growth={k.profit.growth} />
        <Small box="bg-[#EEF1F6] text-gray-600" icon={Package} label="Products Sold" value={k.unitsSold.value.toLocaleString('en-IN')} growth={k.unitsSold.growth} />
        <Small box="bg-[#E3F7EC] text-[#12A05C]" icon={ShoppingBag} label="Avg Order Value" value={inr(k.aov.value)} growth={k.aov.growth} />
        <Small box="bg-[#F1EDFD] text-[#7C5CE0]" icon={Users} label="Repeat Customers" value={`${k.repeat.value}%`} growth={k.repeat.growth} />
        <Small box="bg-[#FFF3D6] text-[#E09A0B]" icon={Star} label="Customer Rating" value={`${k.rating.value} / 5`} sub={`(${k.rating.reviews} reviews)`} />
        <Small box="bg-[#FDE8E8] text-red-500" icon={AlertTriangle} label="Low Stock Items" value={k.lowStock.value} sub="needs restock" bad />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
        <Panel id="sec-sales" title="Sales & Orders Overview" right={<span className="text-[11px] text-gray-500">Last {days} Days</span>}>
          <div className="mb-1 flex gap-4"><Dot c={C.blue}>Sales (₹)</Dot><Dot c={C.green}>Orders</Dot></div>
          <SalesOrders data={d.series} />
        </Panel>
        <Panel title="Sales by Category">
          {d.categories.length ? <Donut items={d.categories} total={k.sales.value} label="Total Sales" money /> : <NoData t="No category sales yet" />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
        <Panel title="Revenue vs Profit" right={<span className="text-[11px] text-gray-500">Last {days} Days</span>}>
          <div className="mb-1 flex gap-4"><Dot c={C.blue}>Revenue</Dot><Dot c={C.orange}>Profit</Dot></div>
          <RevenueProfit data={d.series} />
        </Panel>
        <Panel title="Order Source"><Donut items={d.orderSource} total={k.orders.value} label="Total Orders" colors={[C.blue, C.orange, C.green]} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Panel id="sec-products" title="Top Performing Products" right={view(go('products'))}>
          <div className="mb-2"><MiniTabs items={['Most Sold', 'Most Profitable', 'Least Sold', 'Fastest Growing']} value={tab} onChange={setTab} /></div>
          {list.length ? (
            <Tbl head={[['#'], ['Product'], ['Units Sold', 1], ['Revenue', 1], ['Profit', 1], ['Margin', 1]]}>
              {list.map((p, i) => <tr key={p.id}><Td>{i + 1}</Td><Td><PName p={p} /></Td><Td r>{p.units}</Td><Td r>{inr(p.revenue)}</Td><Td r>{inr(p.profit)}</Td><Td r>{p.margin}%</Td></tr>)}
            </Tbl>) : <NoData />}
        </Panel>
        <Panel title="Stock vs Sales Trend (Top Products)" right={<Sel value={mode} onChange={setMode} options={['Both', 'Units Sold', 'Current Stock']} />}>
          <div className="mb-1 flex gap-4"><Dot c={C.blue}>Units Sold</Dot><Dot c={C.orange}>Current Stock</Dot></div>
          <StockVsSales data={d.stockVsSales} mode={mode} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Hourly Sales Trend" right={<Sel value={hourMode} onChange={setHourMode} options={['Today', 'Selected range']} />}>
          <HourlyArea data={hourMode === 'Today' ? d.hourlyToday : d.timeSeries.hourly} />
        </Panel>
        <Panel title="Day-wise Heatmap (Sales)" right={<span className="text-[11px] text-gray-500">Last {days} Days</span>}><Heatmap heat={d.heatmap} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue Breakdown"><Donut items={d.revenueBreakdown.items} total={d.revenueBreakdown.total} label="Total Sales" money size={130} colors={[C.blue, C.orange, C.green, C.purple]} /></Panel>
        <Panel title="Payment Method"><Donut items={d.paymentMethods} total={k.sales.value} label="Total Sales" money size={130} colors={[C.blue, C.orange, C.green, C.purple]} /></Panel>
        <Panel title="Profit Margin by Category"><MarginBars data={d.categories} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel id="sec-customers" title="Top Customers" right={view(go('customers'))}>
          {d.topCustomers.length ? (
            <Tbl head={[['#'], ['Customer'], ['Total Orders', 1], ['Total Spent', 1], ['Last Order', 1]]}>
              {d.topCustomers.map((c, i) => <tr key={c.name}><Td>{i + 1}</Td><Td><span className="flex items-center gap-2"><Av n={c.name} i={i} />{c.name}</span></Td><Td r>{c.orders}</Td><Td r>{inr(c.spent)}</Td><Td r className="text-gray-500">{c.lastOrder}</Td></tr>)}
            </Tbl>) : <NoData t="No customers yet" />}
        </Panel>
        <Panel title="Customer Type"><Donut items={d.customerType.items} total={d.customerType.total} label="Total Customers" colors={[C.blue, C.orange, C.green]} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent Orders" right={view(go('orders'))}>
          {d.recentOrders.length ? (
            <Tbl head={[['Order ID'], ['Customer'], ['Amount', 1], ['Status'], ['Time', 1]]}>
              {d.recentOrders.map((o) => <tr key={o.id + o.createdAt} className="cursor-pointer" onClick={go('orders')}><Td className="font-medium">{o.id}</Td><Td>{o.customer}</Td><Td r>{inr(o.amount)}</Td><Td><StatusPill s={o.status} /></Td><Td r className="whitespace-nowrap text-gray-500">{ago(o.createdAt)}</Td></tr>)}
            </Tbl>) : <NoData t="No orders yet" />}
        </Panel>
        <Panel title="Recent Messages" right={view(go('messages'))}>
          {d.recentMessages.length ? (
            <Tbl head={[['Customer'], ['Message'], ['Time', 1]]}>
              {d.recentMessages.map((m, i) => <tr key={m.customer} className="cursor-pointer" onClick={go('messages')}><Td><span className="flex items-center gap-2"><Av n={m.customer} i={i} />{m.customer}</span></Td><Td className="max-w-[180px] truncate text-gray-600">{m.text}</Td><Td r className="whitespace-nowrap text-gray-500">{ago(m.createdAt)}</Td></tr>)}
            </Tbl>) : <NoData t="No messages yet" />}
        </Panel>
      </div>
    </div>
  )
}
export { BarChart3 }
