import { Reminders } from './protocol'

export interface Task {
  index: number
  completed: boolean
  reportedCompletion: boolean
  timestamp: number
  name: string
  nQuestions: number
  questions?: any[]
  reminderSettings?: any
  estimatedCompletionTime: number
  warning: string
  isClinical: boolean
}

export interface TasksProgress {
  numberOfTasks: number
  completedTasks: number
}
