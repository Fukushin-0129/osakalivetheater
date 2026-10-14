import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (transporter) return transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export async function sendNotificationEmail(subject: string, text: string) {
  const to = process.env.NOTIFY_EMAIL
  const from = process.env.SMTP_USER
  const t = getTransporter()
  if (!t || !to || !from) {
    console.error('メール通知の設定(SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/NOTIFY_EMAIL)が未設定のため通知メールを送信できません')
    return
  }

  try {
    await t.sendMail({ from, to, subject, text })
  } catch (err) {
    console.error('通知メールの送信に失敗しました:', err)
  }
}
