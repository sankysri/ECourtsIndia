import {
  LayoutDashboard,
  Building2,
  Scale,
  Compass,
  RefreshCw,
  FileText,
  Search,
  Activity,
  AlertTriangle,
  Settings,
  Users,
  Clock,
  Shield,
} from 'lucide-react';
import { PERMISSIONS } from './constants/permissions.js';

export const NAVIGATION_SECTIONS = [
  {
    id: 'main',
    title: null, // No header for top dashboard item
    items: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        path: '/',
        icon: LayoutDashboard,
        permission: PERMISSIONS.VIEW_DASHBOARD,
      },
    ],
  },
  {
    id: 'data',
    title: 'DATA',
    readOnlyTitle: 'EXPLORE',
    items: [
      {
        id: 'courts',
        name: 'Courts',
        path: '/courts',
        icon: Building2,
        permission: PERMISSIONS.VIEW_COURTS,
      },
      {
        id: 'cases',
        name: 'Cases',
        path: '/cases',
        icon: Scale,
        permission: PERMISSIONS.VIEW_CASES,
      },
      {
        id: 'discovery',
        name: 'Discovery',
        path: '/discovery',
        icon: Compass,
        permission: PERMISSIONS.VIEW_DISCOVERY,
      },
      {
        id: 'sync',
        name: 'Sync Center',
        path: '/sync',
        icon: RefreshCw,
        permission: PERMISSIONS.VIEW_SYNC,
      },
      {
        id: 'documents',
        name: 'Documents',
        path: '/documents',
        icon: FileText,
        permission: PERMISSIONS.VIEW_DOCUMENTS,
      },
      {
        id: 'search',
        name: 'Search',
        path: '/search',
        icon: Search,
        permission: PERMISSIONS.VIEW_SEARCH,
      },
    ],
  },
  {
    id: 'operations',
    title: 'OPERATIONS',
    items: [
      {
        id: 'api-usage',
        name: 'API Usage',
        path: '/api-usage',
        icon: Activity,
        permission: PERMISSIONS.VIEW_API_USAGE,
      },
      {
        id: 'failures',
        name: 'Failures',
        path: '/failures',
        icon: AlertTriangle,
        permission: PERMISSIONS.VIEW_FAILURES,
      },
    ],
  },
  {
    id: 'administration',
    title: 'ADMINISTRATION',
    items: [
      {
        id: 'settings',
        name: 'Settings',
        path: '/settings',
        icon: Settings,
        permission: PERMISSIONS.VIEW_SETTINGS,
      },
    ],
  },
];
