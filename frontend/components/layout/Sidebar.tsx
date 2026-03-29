'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { isAdmin } from '@/lib/auth'
import {
  Search,
  FileText,
  History,
  Settings,
  Shield,
  Scale,
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

const navigation = [
  { name: 'Research', href: '/dashboard/research', icon: Search },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
  { name: 'History', href: '/dashboard/history', icon: History },
]

const adminNavigation = [
  { name: 'Admin', href: '/dashboard/admin', icon: Shield },
  { name: 'Models', href: '/dashboard/admin/models', icon: Settings },
]

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const showAdmin = typeof window !== 'undefined' && isAdmin()

  return (
    <aside
      className={cn(
        'flex flex-col w-64 bg-sidebar text-white h-screen sticky top-0',
        className
      )}
    >
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Scale className="w-6 h-6 text-accent-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">ELRI</h1>
            <p className="text-xs text-gray-400">Eswatini Legal Research</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Main
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-white border-l-4 border-accent-gold'
                  : 'text-gray-300 hover:bg-primary/20 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}

        {showAdmin && (
          <>
            <p className="px-3 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Administration
            </p>
            {adminNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-white border-l-4 border-accent-gold'
                      : 'text-gray-300 hover:bg-primary/20 hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-medium">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">User</p>
            <p className="text-xs text-gray-400">Researcher</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
