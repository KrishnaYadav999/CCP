import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileStack,
  FileText,
  Gauge,
  Headphones,
  Home,
  UserRound,
  Users
} from 'lucide-react'

export const roles = ['operation', 'admin', 'superadmin', 'manager', 'compliance', 'sales']
export const adminRoles = ['admin', 'superadmin']
export const defaultTeams = ['No team assigned', 'Operations', 'Compliance', 'Sales', 'Client Success', 'Management']

export const roleLabels = {
  operation: 'Operation',
  admin: 'Admin',
  superadmin: 'Super Admin',
  manager: 'Manager',
  compliance: 'Compliance',
  sales: 'Sales'
}

export const defaultUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  avatarUrl: '',
  role: 'operation',
  team: 'No team assigned',
  isActive: true
}

export const navSections = [
  {
    label: 'Operations',
    items: [
      {
        label: 'Home',
        icon: Home,
        children: [
          { label: 'Dashboard', icon: Gauge, path: '/dashboard' },
          { label: 'Pending Action', icon: Clock3 },
          { label: 'Notifications', icon: Bell },
          { label: 'Calendar', icon: CalendarDays },
          { label: 'User Management', icon: Users, path: '/dashboard' }
        ]
      }
    ]
  },
  {
    label: 'Sales',
    items: [
      {
        label: 'Sales',
        icon: BriefcaseBusiness,
        children: [
          { label: 'Lead Generation', icon: ClipboardList, path: '/sales/lead-generation' },
          { label: 'Client Master', icon: UserRound, path: '/sales/client-master' },
          { label: 'Quotations', icon: FileText }
        ]
      },
      { label: 'Client Data Processing', icon: FileStack },
      { label: 'Client Connect', icon: Headphones }
    ]
  }
]
