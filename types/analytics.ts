export interface AnalyticsKpis {
  totalSales: number
  todaySales: number
  monthSales: number
  pendingRentals: number
  activeRentals: number
  upcomingRentals: number
  overdueRentals: number
  totalExpenses: number
  netRevenue: number
  totalCustomers: number
  inventoryValue: number
}

export interface AnalyticsPoint {
  label: string
  value: number
}

export interface TopProduct {
  uuid: string
  name: string
  sku: string
  quantity: number
}

export interface AdminAnalytics {
  kpis: AnalyticsKpis
  salesByDay: AnalyticsPoint[]
  rentalsByStatus: AnalyticsPoint[]
  topProducts: TopProduct[]
  timezone: string
  asOf: string
}
