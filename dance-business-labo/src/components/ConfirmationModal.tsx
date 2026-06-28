'use client'

import { X, AlertCircle, Check } from 'lucide-react'

interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  type?: 'confirm' | 'success' | 'warning'
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  onConfirm,
  onCancel,
  isLoading = false,
  type = 'confirm',
}: ConfirmationModalProps) {
  if (!isOpen) return null

  const bgColor = {
    confirm: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
  }[type]

  const iconColor = {
    confirm: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
  }[type]

  const buttonColor = {
    confirm: 'bg-blue-600 hover:bg-blue-700',
    success: 'bg-green-600 hover:bg-green-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
  }[type]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in">
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            {type === 'confirm' && <AlertCircle size={24} className={iconColor} />}
            {type === 'success' && <Check size={24} className={iconColor} />}
            {type === 'warning' && <AlertCircle size={24} className={iconColor} />}
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* メッセージ */}
        <div className={`rounded-lg p-4 mb-6 ${bgColor}`}>
          <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
        </div>

        {/* ボタン */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 ${buttonColor}`}
          >
            {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
