import { type LucideIcon } from 'lucide-react';

export interface MenuItem {
  title?: string;
  desc?: string;
  img?: string;
  icon?: LucideIcon;
  path?: string;
  rootPath?: string;
  /** When set, header dropdown considers this item selected if pathname starts with any of these paths. */
  rootPaths?: string[];
  childrenIndex?: number;
  heading?: string;
  children?: MenuConfig;
  disabled?: boolean;
  collapse?: boolean;
  collapseTitle?: string;
  expandTitle?: string;
  badge?: string;
  separator?: boolean;
  /** If set, menu item is only shown when user.role_name matches (e.g. "admin"). */
  requiredRole?: string;
}

export type MenuConfig = MenuItem[];
