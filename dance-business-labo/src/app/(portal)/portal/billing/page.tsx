import { AlertCircle, CreditCard, Calendar } from 'lucide-react'

export default async function BillingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">料金・支払い管理</h1>

      {/* 料金体系セクション */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* チケット制情報 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="text-blue-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-800">チケット制</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            利用回数に応じた料金体系。自分のペースで続けられます。
          </p>
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">チケット割り当てなし</p>
              <p className="text-xs text-gray-500 mt-1">
                先生からチケットが割り当てられたら、ここに表示されます
              </p>
            </div>
          </div>
        </div>

        {/* 月謝制情報 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-green-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-800">月謝制</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            毎月一定額で通い放題。継続的に学習できます。
          </p>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">月謝プラン未割り当て</p>
            <p className="text-xs text-gray-500 mt-1">
              先生から月謝プランが割り当てられたら、ここに表示されます
            </p>
          </div>
        </div>
      </div>

      {/* 支払い履歴 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">支払い履歴</h2>
        <div className="text-center py-12 text-gray-400">
          <p>支払い履歴がありません</p>
        </div>
      </div>

      {/* ご不明な点について */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">ご質問がある場合</h3>
        <p className="text-sm text-blue-800">
          料金や支払いについてご質問がある場合は、お気軽に先生にお問い合わせください。
        </p>
      </div>
    </div>
  )
}
