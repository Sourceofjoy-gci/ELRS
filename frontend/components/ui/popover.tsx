'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState, useRef, createContext, useContext } from 'react'

interface PopoverContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

function usePopover() {
  const context = useContext(PopoverContext)
  if (!context) {
    throw new Error('Popover components must be used within a Popover')
  }
  return context
}

interface PopoverProps {
  children: React.ReactNode
  className?: string
}

export function Popover({ children, className }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div ref={popoverRef} className={cn('relative inline-block', className)}>
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}

export function PopoverTrigger({ children, asChild, className }: PopoverTriggerProps) {
  const { setOpen, open } = usePopover()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(!open)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void; className?: string }>, {
      onClick: (e: React.MouseEvent) => {
        handleClick(e)
        if ((children as React.ReactElement<{ onClick?: () => void }>).props.onClick) {
          (children as React.ReactElement<{ onClick?: () => void }>).props.onClick()
        }
      },
      className: cn((children as React.ReactElement<{ className?: string }>).props.className, className),
    })
  }

  return (
    <div onClick={handleClick} className={className}>
      {children}
    </div>
  )
}

interface PopoverContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  onClose?: () => void
}

export function PopoverContent({ children, className, align = 'start' }: PopoverContentProps) {
  const { open, setOpen } = usePopover()

  if (!open) return null

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg',
        'w-80',
        align === 'start' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'end' && 'right-0',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}
