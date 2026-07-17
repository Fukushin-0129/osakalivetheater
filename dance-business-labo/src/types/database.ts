export type Student = {
  id: string
  name: string
  name_kana: string | null
  email: string | null
  phone: string | null
  birthdate: string | null
  address: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  postal_code: string | null
  emergency_contact: string | null
  notes: string | null
  legacy_id: number | null
  is_active: boolean
  joined_at: string | null
  avatar_url: string | null
  goal: string | null
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
  plan_content: string | null
  plan_goal: string | null
  plan_generated_at: string | null
  plan_status: string
  created_at: string
  lesson_types?: LessonType
  lesson_plans?: LessonPlan
}

export type LessonPlan = {
  id: string
  lesson_id: string
  content: string | null
  goal: string | null
  generated_from_lesson_id: string | null
  status: string
  generated_at: string
  created_at: string
  updated_at: string
  lessons?: Lesson
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'cancelled' | 'substituted'

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

export type CurriculumItem = {
  id: string
  parent_id: string | null
  name: string
  level: 1 | 2 | 3
  display_order: number
  video_url?: string | null
  brain_effects?: string | null
  teaching_notes?: string | null
  created_at: string
  children?: CurriculumItem[]
}

export type LessonPlanItem = {
  id: string
  lesson_id: string
  curriculum_item_id: string
  plan_notes: string | null
  actual_notes: string | null
  skipped: boolean
  display_order: number
  created_at: string
  curriculum_items?: CurriculumItem
}

export type LessonEvaluation = {
  id: string
  lesson_id: string
  student_id: string
  curriculum_item_id: string
  rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
  curriculum_items?: CurriculumItem
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
  lesson_date: string | null
  created_at: string
}

export type SubscriptionType = {
  id: string
  name: string
  monthly_price: number
  max_lessons_per_month: number | null
  created_at: string
}

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export type StudentSubscription = {
  id: string
  student_id: string
  subscription_type_id: string
  start_date: string
  end_date: string | null
  status: SubscriptionStatus
  monthly_price: number
  billing_day: number | null
  next_payment_date: string | null
  created_at: string
  updated_at: string
  subscription_types?: SubscriptionType
  students?: Student
}

export type PaymentType = 'ticket_purchase' | 'subscription_payment' | 'trial_lesson_payment' | 'manual'

export type PaymentStatus = 'pending' | 'completed' | 'failed'

export type StudentPayment = {
  id: string
  student_id: string
  amount: number
  payment_date: string
  payment_type: PaymentType
  reference_id: string | null
  status: PaymentStatus
  notes: string | null
  created_at: string
  updated_at: string
  students?: Student
}
