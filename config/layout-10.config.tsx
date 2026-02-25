import { Building2, Calendar, Columns, FileText, LayoutGrid, ListTodo, Scale, Settings, Briefcase, Users, UserCircle } from 'lucide-react';
import { type MenuConfig } from './types';

/** Sidebar menu for eNotaris. Berkas Akta = tree dropdown (Notaris + PPAT). */
export const MENU_SIDEBAR_COMPACT: MenuConfig = [
  {
    title: 'Dashboard',
    icon: LayoutGrid,
    path: '/dashboard',
  },
  {
    title: 'Berkas Akta',
    icon: FileText,
    children: [
      { title: 'Kanban', path: '/cases/kanban', icon: Columns },
      { title: 'Notaris', path: '/cases/notaris', icon: Scale },
      { title: 'PPAT', path: '/cases/ppat', icon: Building2 },
    ],
  },
  {
    title: 'Manajemen Klien',
    icon: UserCircle,
    path: '/clients',
  },
  {
    title: 'Tugas / Task',
    icon: ListTodo,
    path: '/tasks',
  },
  {
    title: 'Kalender',
    icon: Calendar,
    path: '/calendar',
  },
  {
    title: 'Administrator',
    icon: Settings,
    requiredRole: 'admin',
    children: [
      { title: 'Manajemen User', path: '/users', icon: Users },
      { title: 'Manajemen Pekerjaan', path: '/jenis-pekerjaan', icon: Briefcase },
      { title: 'Update Profile Notaris', path: '/profile-notaris', icon: Building2 },
    ],
  },
  // Legacy block removed - uncomment below to restore demo menu
  /* {
    title: 'Public Profile',
    icon: Users,
    children: [
      {
        title: 'Profiles',
        children: [
          { title: 'Default', path: '#' },
          { title: 'Creator', path: '#' },
          { title: 'Company', path: '#' },
          { title: 'NFT', path: '#' },
          { title: 'Blogger', path: '#' },
          { title: 'CRM', path: '#' },
          {
            title: 'More',
            collapse: true,
            collapseTitle: 'Show less',
            expandTitle: 'Show 4 more',
            children: [
              { title: 'Gamer', path: '#' },
              { title: 'Feeds', path: '#' },
              { title: 'Plain', path: '#' },
              { title: 'Modal', path: '#' },
            ],
          },
        ],
      },
      {
        title: 'Projects',
        children: [
          { title: '3 Columns', path: '#' },
          { title: '2 Columns', path: '#' },
        ],
      },
      { title: 'Works', path: '#' },
      { title: 'Teams', path: '#' },
      { title: 'Network', path: '#' },
      { title: 'Activity', path: '#' },
      {
        title: 'More',
        collapse: true,
        collapseTitle: 'Show less',
        expandTitle: 'Show 3 more',
        children: [
          { title: 'Campaigns - Card', path: '#' },
          { title: 'Campaigns - List', path: '#' },
          { title: 'Empty', path: '#' },
        ],
      },
    ],
  },
  {
    title: 'My Account',
    icon: Settings,
    children: [
      {
        title: 'Account',
        children: [
          { title: 'Get Started', path: '#' },
          { title: 'User Profile', path: '#' },
          { title: 'Company Profile', path: '#' },
          {
            title: 'Settings - With Sidebar',
            path: '#',
          },
          {
            title: 'Settings - Enterprise',
            path: '#',
          },
          { title: 'Settings - Plain', path: '#' },
          { title: 'Settings - Modal', path: '#' },
        ],
      },
      {
        title: 'Billing',
        children: [
          { title: 'Billing - Basic', path: '#' },
          {
            title: 'Billing - Enterprise',
            path: '#',
          },
          { title: 'Plans', path: '#' },
          { title: 'Billing History', path: '#' },
        ],
      },
      {
        title: 'Security',
        children: [
          { title: 'Get Started', path: '#' },
          { title: 'Security Overview', path: '#' },
          {
            title: 'Allowed IP Addresses',
            path: '#',
          },
          {
            title: 'Privacy Settings',
            path: '#',
          },
          {
            title: 'Device Management',
            path: '#',
          },
          {
            title: 'Backup & Recovery',
            path: '#',
          },
          {
            title: 'Current Sessions',
            path: '#',
          },
          { title: 'Security Log', path: '#' },
        ],
      },
      {
        title: 'Members & Roles',
        children: [
          { title: 'Teams Starter', path: '#' },
          { title: 'Teams', path: '#' },
          { title: 'Team Info', path: '#' },
          {
            title: 'Members Starter',
            path: '#',
          },
          { title: 'Team Members', path: '#' },
          { title: 'Import Members', path: '#' },
          { title: 'Roles', path: '#' },
          {
            title: 'Permissions - Toggler',
            path: '#',
          },
          {
            title: 'Permissions - Check',
            path: '#',
          },
        ],
      },
      { title: 'Integrations', path: '#' },
      { title: 'Notifications', path: '#' },
      { title: 'API Keys', path: '#' },
      {
        title: 'More',
        collapse: true,
        collapseTitle: 'Show less',
        expandTitle: 'Show 3 more',
        children: [
          { title: 'Appearance', path: '#' },
          { title: 'Invite a Friend', path: '#' },
          { title: 'Activity', path: '#' },
        ],
      },
    ],
  },
  {
    title: 'Network',
    icon: Users,
    children: [
      { title: 'Get Started', path: '#' },
      {
        title: 'User Cards',
        children: [
          { title: 'Mini Cards', path: '#' },
          { title: 'Team Crew', path: '#' },
          { title: 'Author', path: '#' },
          { title: 'NFT', path: '#' },
          { title: 'Social', path: '#' },
        ],
      },
      {
        title: 'User Table',
        children: [
          { title: 'Team Crew', path: '#' },
          { title: 'App Roster', path: '#' },
          {
            title: 'Market Authors',
            path: '#',
          },
          { title: 'SaaS Users', path: '#' },
          { title: 'Store Clients', path: '#' },
          { title: 'Visitors', path: '#' },
        ],
      },
      { title: 'Cooperations', path: '#', disabled: true },
      { title: 'Leads', path: '#', disabled: true },
      { title: 'Donators', path: '#', disabled: true },
    ],
  },
  {
    title: 'Store - Client',
    icon: ShoppingCart,
    children: [
      { title: 'Home', path: '#' },
      {
        title: 'Search Results - Grid',
        path: '#',
      },
      {
        title: 'Search Results - List',
        path: '#',
      },
      { title: 'Product Details', path: '#' },
      { title: 'Wishlist', path: '#' },
      {
        title: 'Checkout',
        children: [
          {
            title: 'Order Summary',
            path: '#',
          },
          {
            title: 'Shipping Info',
            path: '#',
          },
          {
            title: 'Payment Method',
            path: '#',
          },
          {
            title: 'Order Placed',
            path: '#',
          },
        ],
      },
      { title: 'My Orders', path: '#' },
      { title: 'Order Receipt', path: '#' },
    ],
  },
  {
    title: 'Authentication',
    icon: Shield,
    children: [
      {
        title: 'Classic',
        children: [
          { title: 'Sign In', path: '#' },
          { title: 'Sign Up', path: '#' },
          { title: '2FA', path: '#' },
          { title: 'Check Email', path: '#' },
          {
            title: 'Reset Password',
            children: [
              {
                title: 'Enter Email',
                path: '#',
              },
              {
                title: 'Check Email',
                path: '#',
              },
              {
                title: 'Password Changed',
                path: '#',
              },
            ],
          },
        ],
      },
      {
        title: 'Branded',
        children: [
          { title: 'Sign In', path: '#' },
          { title: 'Sign Up', path: '#' },
          { title: '2FA', path: '#' },
          { title: 'Check Email', path: '#' },
          {
            title: 'Reset Password',
            children: [
              {
                title: 'Enter Email',
                path: '#',
              },
              {
                title: 'Check Email',
                path: '#',
              },
              {
                title: 'Password Changed',
                path: '#',
              },
            ],
          },
        ],
      },
      { title: 'Welcome Message', path: '#' },
      { title: 'Account Deactivated', path: '#' },
      { title: 'Error 404', path: '#' },
      { title: 'Error 500', path: '#' },
    ],
  },
  */
];

/** Root menu for sidebar header (eNotaris). Administrator punya rootPaths agar terpilih saat /users atau /jenis-pekerjaan. */
export const MENU_ROOT: MenuConfig = [
  { title: 'Dashboard', icon: LayoutGrid, rootPath: '/dashboard', path: '/dashboard', childrenIndex: 0 },
  { title: 'Berkas Akta', icon: FileText, rootPath: '/cases', path: '/cases/notaris', childrenIndex: 1 },
  { title: 'Manajemen Klien', icon: UserCircle, rootPath: '/clients', path: '/clients', childrenIndex: 2 },
  { title: 'Tugas / Task', icon: ListTodo, rootPath: '/tasks', path: '/tasks', childrenIndex: 3 },
  { title: 'Kalender', icon: Calendar, rootPath: '/calendar', path: '/calendar', childrenIndex: 4 },
  {
    title: 'Administrator',
    icon: Settings,
    rootPaths: ['/users', '/jenis-pekerjaan', '/profile-notaris'],
    path: '/users',
    childrenIndex: 5,
    requiredRole: 'admin',
  },
];
