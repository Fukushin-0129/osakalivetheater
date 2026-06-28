'use client'

import { useEffect } from 'react'
import { Check, AlertCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  isOpen: boolean
  onClose: () => void
  duration?: number
}

export default function Toast({
  message,
  type = 'success',
  isOpen,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  const styles = {
    success: {
      bg: 'bg-green-600',
      icon: <Check size={20} />,
    },
    error: {
      bg: 'bg-red-600',
      icon: <AlertCircle size={20} />,
    },
    info: {
      bg: 'bg-blue-600',
      icon: <AlertCircle size={20} />,
    },
  }

  const style = styles[type]

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in">
      <div className={`${style.bg} text-white rounded-lg shadow-lg p-4 flex items-center gap-3 max-w-sm`}>
        {style.icon}
        <span className="flex-1">{message}</span>
        <button
          onClick={onClose}
          className="text-white hover:opacity-75 p-1"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
