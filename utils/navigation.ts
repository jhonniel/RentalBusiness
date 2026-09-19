export interface NavItem {
  label: string
  to?: string
  icon: string
  enabled: boolean
  authRequired?: boolean
}

export const publicNavItems: NavItem[] = [
  { label: 'Rent', to: '/products', icon: 'i-lucide-camera', enabled: true },
  { label: 'How it Works', to: '/#how-it-works', icon: 'i-lucide-list-checks', enabled: true },
  { label: 'My Bookings', to: '/my-rentals', icon: 'i-lucide-clipboard-list', enabled: true, authRequired: true },
  { label: 'About', to: '/about', icon: 'i-lucide-info', enabled: true },
]

export const customerNavItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard', enabled: true },
  { label: 'My rentals', to: '/my-rentals', icon: 'i-lucide-clipboard-list', enabled: true },
  { label: 'Profile', to: '/profile', icon: 'i-lucide-user', enabled: true },
]

export const adminNavItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: 'i-lucide-layout-dashboard', enabled: true },
  { label: 'Rentals', to: '/admin/rentals', icon: 'i-lucide-clipboard-list', enabled: true },
  { label: 'Calendar', to: '/admin/calendar', icon: 'i-lucide-calendar', enabled: true },
  { label: 'Products', to: '/admin/products', icon: 'i-lucide-package', enabled: true },
  { label: 'Inventory', to: '/admin/inventory', icon: 'i-lucide-boxes', enabled: true },
  { label: 'Customers', to: '/admin/customers', icon: 'i-lucide-users', enabled: true },
  { label: 'Payments', to: '/admin/payments', icon: 'i-lucide-credit-card', enabled: true },
  { label: 'Sales', to: '/admin/sales', icon: 'i-lucide-trending-up', enabled: true },
  { label: 'Expenses', to: '/admin/expenses', icon: 'i-lucide-wallet', enabled: true },
  { label: 'Recurring Expenses', to: '/admin/expenses/recurring', icon: 'i-lucide-repeat', enabled: true },
  { label: 'Reports', to: '/admin/reports', icon: 'i-lucide-bar-chart-3', enabled: true },
  { label: 'Notifications', to: '/notifications', icon: 'i-lucide-bell', enabled: true },
  { label: 'Waivers', to: '/admin/waivers', icon: 'i-lucide-file-pen-line', enabled: true },
  { label: 'Settings', to: '/admin/settings', icon: 'i-lucide-settings', enabled: true },
  { label: 'Audit Logs', to: '/admin/audit-logs', icon: 'i-lucide-scroll-text', enabled: true },
]
