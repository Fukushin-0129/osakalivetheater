'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode, X, Printer } from 'lucide-react'

export default function StudentQrCode({
  studentName,
  qrToken,
}: {
  studentName: string
  qrToken: string
}) {
  const [open, setOpen] = useState(false)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // トークンだけを埋め込むとスマホのカメラで読んだときに検索結果などへ飛んでしまうため、
    // チェックイン画面のURLとして埋め込む。アプリ内スキャナはURLからトークンを取り出す。
    const checkinUrl = `${window.location.origin}/attendance/checkin?token=${encodeURIComponent(qrToken)}`
    QRCode.toDataURL(checkinUrl, { width: 280, margin: 2 }).then(setDataUrl)
  }, [open, qrToken])

  function printCard() {
    if (!dataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>${studentName} - QRコード</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:24px;">
        <h2>${studentName}</h2>
        <img src="${dataUrl}" style="width:280px;height:280px;" />
        <p>出席時にこのQRコードをカメラにかざしてください</p>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      >
        <QrCode size={14} /> QRコード表示
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{studentName}さんのQRコード</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 flex flex-col items-center gap-3">
              {dataUrl ? (
                <img src={dataUrl} alt="QRコード" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 bg-gray-100 rounded-xl animate-pulse" />
              )}
              <p className="text-xs text-gray-400 text-center">出席管理の「QRチェックイン」でカメラにかざすと出席登録されます</p>
              <button onClick={printCard} disabled={!dataUrl}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-xl text-sm font-medium w-full justify-center">
                <Printer size={14} /> 印刷する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
