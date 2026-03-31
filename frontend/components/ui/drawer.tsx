'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Drawer({ open, onClose, children, className }: DrawerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 z-40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full z-50 bg-white dark:bg-gray-900 shadow-xl',
          'w-80 flex flex-col border-l border-gray-200 dark:border-gray-700',
          'transform transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded z-10"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </>
  )
}
