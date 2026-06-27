'use client'

import { useState } from 'react'
import SubscriptionTypesTab from '@/components/subscriptions/SubscriptionTypesTab'
import StudentSubscriptionsTab from '@/components/subscriptions/StudentSubscriptionsTab'
import PaymentHistoryTab from '@/components/subscriptions/PaymentHistoryTab'

type TabType = 'types' | 'students' | 'payments'

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('types')

  const tabs: { id: TabType; label: string }[] = [
    { id: 'types', label: 'プラン管理' },
    { id: 'students', label: '生徒割り当て' },
    { id: 'payments', label: '支払い履歴' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">月謝管理</h1>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'types' && <SubscriptionTypesTab />}
          {activeTab === 'students' && <StudentSubscriptionsTab />}
          {activeTab === 'payments' && <PaymentHistoryTab />}
        </div>
      </div>
    </div>
  )
}
