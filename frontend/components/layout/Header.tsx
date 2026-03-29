'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SystemHealthBar } from './SystemHealthBar'
import { isAdmin } from '@/lib/auth'
import { Bell, Moon, Sun, Menu } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  title: string
  breadcrumb?: string[]
  onMenuClick?: () => void
  className?: string
}

export function Header({ title, breadcrumb, onMenuClick, className }: HeaderProps) {
  const [isDark, setIsDark] = useState(false)
  const [showHealth, setShowHealth] = useState(false)

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark')
    setIsDark(!isDark)
  }

  const showAdminBar = typeof window !== 'undefined' && isAdmin()

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
              {breadcrumb.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  {idx > 0 && <span>/</span>}
                  <span className={idx === breadcrumb.length - 1 ? 'text-gray-900 dark:text-white font-medium' : ''}>
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showAdminBar && (
          <button
            onClick={() => setShowHealth(!showHealth)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
              showHealth
                ? 'bg-accent-gold/20 text-accent-gold'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            System Health
          </button>
        )}

        <button
          onClick={toggleDark}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent-crimson rounded-full" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">System Status</span>
              <span className="text-xs text-gray-500">All systems operational</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">New Document Added</span>
              <span className="text-xs text-gray-500">Employment Act amendments indexed</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showHealth && showAdminBar && (
        <div className="absolute top-16 right-6 z-50">
          <SystemHealthBar />
        </div>
      )}
    </header>
  )
}
