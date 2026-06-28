'use client'

export default function StudentBillingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">💳 支払い管理</h1>

      {/* 月謝プラン */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">月謝プラン</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">ベーシックプラン</h3>
            <p className="text-2xl font-bold text-blue-600 mb-4">
              ¥8,000
              <span className="text-sm text-gray-600">/月</span>
            </p>
            <p className="text-gray-600 mb-4">月4回まで</p>
            <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition">
              登録する
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">スタンダードプラン</h3>
            <p className="text-2xl font-bold text-blue-600 mb-4">
              ¥12,000
              <span className="text-sm text-gray-600">/月</span>
            </p>
            <p className="text-gray-600 mb-4">月8回まで</p>
            <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition">
              登録する
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">プレミアムプラン</h3>
            <p className="text-2xl font-bold text-blue-600 mb-4">
              ¥15,000
              <span className="text-sm text-gray-600">/月</span>
            </p>
            <p className="text-gray-600 mb-4">月12回まで（無制限）</p>
            <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition">
              登録する
            </button>
          </div>
        </div>
      </div>

      {/* チケット */}
      <div>
        <h2 className="text-2xl font-bold mb-4">チケット</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">10回チケット</h3>
            <p className="text-gray-600 mb-2">10回</p>
            <p className="text-2xl font-bold text-green-600 mb-2">¥15,000</p>
            <p className="text-sm text-gray-500 mb-4">有効期限: 180日間</p>
            <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition">
              購入する
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">5回チケット</h3>
            <p className="text-gray-600 mb-2">5回</p>
            <p className="text-2xl font-bold text-green-600 mb-2">¥8,000</p>
            <p className="text-sm text-gray-500 mb-4">有効期限: 180日間</p>
            <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition">
              購入する
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
