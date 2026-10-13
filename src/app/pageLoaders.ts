// Dynamic imports for each page; shared by the router (lazy) and the layout (idle preloading).
export const pages = {
  Dashboard: () => import('./pages/Dashboard'),
  ApproveLeads: () => import('./pages/ApproveLeads'),
  ApprovedLeads: () => import('./pages/ApprovedLeads'),
  Conversations: () => import('./pages/Conversations'),
  Meetings: () => import('./pages/Meetings'),
  Analytics: () => import('./pages/Analytics'),
  ContentEngine: () => import('./pages/ContentEngine'),
  Profile: () => import('./pages/Profile'),
};
