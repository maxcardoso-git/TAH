export const API_BASE_URL = '/api/v1'

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  deleted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  maintenance: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  deprecated: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  invited: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export const NAV_ITEMS = [
  {
    title: 'Tenants',
    href: '/tenants',
    icon: 'Building2',
    description: 'Gerenciar organizações',
  },
  {
    title: 'Aplicações',
    href: '/applications',
    icon: 'LayoutGrid',
    description: 'Registry de aplicações',
  },
] as const

export const TENANT_NAV_ITEMS = [
  {
    title: 'Roles',
    href: '/roles',
    icon: 'Shield',
    description: 'Perfis de acesso',
  },
  {
    title: 'Usuários',
    href: '/users',
    icon: 'Users',
    description: 'Gestão de usuários',
  },
  {
    title: 'Audit Log',
    href: '/audit',
    icon: 'FileText',
    description: 'Histórico de alterações',
  },
] as const
