export type Student = {
  id: string
  name: string
  name_kana: string | null
  email: string | null
  phone: string | null
  birthdate: string | null
  address: string | null
  emergency_contact: string | null
  notes: string | null
  legacy_id: number | null
  is_active: boolean
  joined_at: string
  created_at: string
  updated_at: string
}

export type LessonType = {
  id: string
  name: string
  duration_minutes: number
  price: number
  created_at: string
}

export type Lesson = {
  id: string
  lesson_type_id: string | null
  title: string
  scheduled_at: string
  location: string | null
  max_capacity: number
  notes: string | null
  created_at: string
  lesson_types?: LessonType
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'cancelled'

export type Attendance = {
  id: string
  lesson_id: string
  student_id: string
  status: AttendanceStatus
  ticket_used: boolean
  notes: string | null
  created_at: string
  students?: Student
  lessons?: Lesson
}

export type TicketType = {
  id: string
  name: string
  total_count: number
  price: number
  valid_days: number
  created_at: string
}

export type StudentTicket = {
  id: string
  student_id: string
  ticket_type_id: string | null
  purchased_at: string
  expires_at: string | null
  total_count: number
  used_count: number
  created_at: string
  students?: Student
  ticket_types?: TicketType
}

export type StudentRecord = {
  id: string
  student_id: string
  record_date: string
  content: string
  created_at: string
  students?: Student
}

export type TransactionType = 'income' | 'expense'

export type Transaction = {
  id: string
  transaction_date: string
  type: TransactionType
  category: string
  amount: number
  description: string | null
  created_at: string
}
