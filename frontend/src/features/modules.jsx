import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useBusiness } from '../context/BusinessContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { profilePath } from '../utils/username.js'
import OrdersPage from './analytics/pages/OrdersPage.jsx'
import BillPage from './analytics/pages/BillPage.jsx'
import ProductsPage from './analytics/pages/ProductsPage.jsx'
import InventoryPage from './analytics/pages/InventoryPage.jsx'
import BillingPage from './analytics/pages/BillingPage.jsx'
import CustomersPage from './analytics/pages/CustomersPage.jsx'
import CustomerDetailPage from './analytics/pages/CustomerDetailPage.jsx'
import UdharPage from './analytics/pages/UdharPage.jsx'
import OffersPage from './analytics/pages/OffersPage.jsx'
import MessagesPage from './analytics/pages/MessagesPage.jsx'
import ShopProfilePage from './analytics/pages/ShopProfilePage.jsx'
import SettingsPage from './analytics/pages/SettingsPage.jsx'
import AnalyticsPage from './analytics/AnalyticsPage.jsx'
import BillingAnalyticsPage from './analytics/BillingAnalyticsPage.jsx'
import StudyDashboardPage from './study/StudyDashboardPage.jsx'
import MembersPage from './study/MembersPage.jsx'
import MemberDetailPage from './study/MemberDetailPage.jsx'
import CoursesPage from './study/CoursesPage.jsx'
import SeatsPage from './study/SeatsPage.jsx'
import ConfigAnalyticsPage from './study/ConfigAnalyticsPage.jsx'
import AddMenuPage from './study/AddMenuPage.jsx'

const MODULES = {
  orders: { list: OrdersPage }, billing: { list: BillingPage }, dues: { list: UdharPage }, analytics: { list: AnalyticsPage }, billingAnalytics: { list: BillingAnalyticsPage }, inventory: { list: InventoryPage },
  people: { list: CustomersPage, detail: CustomerDetailPage }, bill: { detail: BillPage, list: BillPage }, products: { list: ProductsPage }, offers: { list: OffersPage }, messages: { list: MessagesPage },
  shopProfile: { list: ShopProfilePage }, centerProfile: { list: ShopProfilePage }, settings: { list: SettingsPage },
  studyDashboard: { list: StudyDashboardPage }, members: { list: MembersPage, detail: MemberDetailPage }, memberDetail: { list: MemberDetailPage, detail: MemberDetailPage },
  courses: { list: CoursesPage }, seats: { list: SeatsPage }, configAnalytics: { list: ConfigAnalyticsPage }, addMenu: { list: AddMenuPage },
}

export function Module({ name, detail = false }) {
  const { business, ready } = useBusiness()
  const { user } = useAuth()
  const { username } = useParams()
  if (!ready && user?.sellerType !== 'shop') return <div className="min-h-[40vh]" aria-busy="true" />
  const id = business.modules?.[name]
  const Page = id && (detail ? MODULES[id]?.detail : MODULES[id]?.list)
  return Page ? <Page /> : <Navigate to={profilePath(username)} replace />
}
