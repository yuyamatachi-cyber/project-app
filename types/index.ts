export type HealthStatus = 'green' | 'yellow' | 'red'
export type ThemeStatus = 'not_started' | 'in_progress' | 'done'
export type TaskStatus = 'backlog' | 'in_progress' | 'done'
export type BlockerStatus = 'open' | 'resolved'
export type MemberRole = 'owner' | 'pm' | 'executor' | 'decision_maker'

export interface Category {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  name: string
  initial: string
  created_at: string
}

export interface Project {
  id: string
  category_id: string | null
  name: string
  why: string | null
  what: string | null
  how: string | null
  so_what: string | null
  health: HealthStatus
  risk: HealthStatus
  created_at: string
  updated_at: string
  category?: Category
  themes?: Theme[]
}

export interface Theme {
  id: string
  project_id: string
  name: string
  status: ThemeStatus
  due_date: string | null
  is_completed: boolean
  created_at: string
  updated_at: string
  tasks?: Task[]
  blockers?: Blocker[]
  decision_logs?: DecisionLog[]
  progress_logs?: ProgressLog[]
  milestones?: Milestone
  sync_statuses?: SyncStatus
  theme_members?: ThemeMember[]
}

export interface ThemeMember {
  id: string
  theme_id: string
  member_id: string
  role: MemberRole
  member?: Member
}

export interface ProgressLog {
  id: string
  theme_id: string
  status: ThemeStatus
  progress_rate: number
  comment: string | null
  created_at: string
}

export interface Milestone {
  id: string
  theme_id: string
  due_date: string
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  theme_id: string
  name: string
  status: TaskStatus
  created_at: string
  updated_at: string
}

export interface Blocker {
  id: string
  theme_id: string
  content: string
  status: BlockerStatus
  resolved_by: string | null
  resolved_comment: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  resolver?: Member
}

export interface DecisionLog {
  id: string
  theme_id: string
  blocker_id: string | null
  content: string
  decided_by: string | null
  status: BlockerStatus
  created_at: string
  updated_at: string
  decider?: Member
}

export interface SyncStatus {
  id: string
  theme_id: string
  purpose_sync: number
  granularity_sync: number
  state_sync: number
  priority_sync: number
  interpretation_sync: number
  updated_at: string
}

export interface Snapshot {
  id: string
  project_id: string
  data: object
  created_at: string
}
