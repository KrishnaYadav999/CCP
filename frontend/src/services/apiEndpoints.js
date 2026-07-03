const apiEndpoints = {
  auth: {
    me: '/auth/me',
    updateMe: '/auth/me',
    updatePassword: '/auth/me/password',
    requestOtp: '/auth/request-otp',
    resendOtp: '/auth/resend-otp',
    verifyOtp: '/auth/verify-otp',
    users: '/auth/users',
    adminUsers: '/auth/admin/users',
    adminCreateUser: '/auth/admin/create-user',
    adminUser: (id) => `/auth/admin/users/${id}`
  },
  leads: {
    list: '/leads',
    bulk: '/leads/bulk',
    detail: (id) => `/leads/${id}`
  },
  clients: {
    list: '/clients',
    bulk: '/clients/bulk',
    detail: (id) => `/clients/${id}`
  },
  teams: {
    list: '/teams',
    create: '/teams'
  },
  crm: {
    resync: (type) => `/crm/resync/${type}`
  },
  notifications: {
    list: '/notifications',
    markRead: (id) => `/notifications/${id}/read`,
    readAll: '/notifications/read-all'
  }
}

export default apiEndpoints
