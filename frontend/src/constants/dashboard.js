import { ClipboardList, FilePlus2, Home, UserRound, Users } from 'lucide-react'

export const roles = ['operation', 'admin', 'superadmin', 'manager', 'compliance', 'sales', 'accounts']
export const adminRoles = ['admin', 'superadmin']
export const defaultTeams = ['No team assigned', 'Operations', 'Compliance', 'Sales', 'Accounts', 'Client Success', 'Management']

export const roleLabels = {
  operation: 'Operation',
  admin: 'Admin',
  superadmin: 'Super Admin',
  manager: 'Manager',
  compliance: 'Compliance',
  sales: 'Sales',
  accounts: 'Accounts'
}

export const defaultUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  avatarUrl: '',
  role: 'operation',
  team: 'No team assigned',
  teamId: '',
  managerId: '',
  operationHeadId: '',
  isActive: true
}

export const navSections = [
  {
    label: 'Navigation',
    items: [
      {
        label: 'Home',
        icon: Home,
        children: [
          { label: 'Lead Generator', icon: ClipboardList, path: '/sales/lead-generation' },
          { label: 'Client Master Generator', icon: UserRound, path: '/sales/client-master' },
          { label: 'Add New Quotation', icon: FilePlus2, path: '/sales/quotations/new' },
          { label: 'Admin User Master', icon: Users, path: '/dashboard' }
        ]
      }
    ]
  }
]
