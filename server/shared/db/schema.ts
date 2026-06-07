import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const chats = sqliteTable('chats', {
  id:        text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
})

export const messages = sqliteTable('messages', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role:      text('role', { enum: ['user', 'assistant'] }).notNull(),
  content:   text('content').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
}))

// ── Histórico (triagens e exames)

export const historyRecords = sqliteTable('history_records', {
  id:          text('id').primaryKey(),
  type:        text('type', { enum: ['triagem', 'exame'] }).notNull(),
  patientName: text('patient_name').notNull(),
  date:        integer('date').notNull(),
  summary:     text('summary').notNull(),
  details:     text('details').notNull(), // JSON serializado
  createdAt:   integer('created_at').notNull(),
})

// ── Agendamentos (paciente ↔ médico)

export const appointments = sqliteTable('appointments', {
  id:          text('id').primaryKey(),
  patientName: text('patient_name').notNull(),
  doctorName:  text('doctor_name').notNull().default('Dr. Silva'),
  type:        text('type', { enum: ['presencial', 'telechamada'] }).notNull(),
  status:      text('status', { enum: ['pending', 'confirmed', 'cancelled'] }).notNull().default('pending'),
  scheduledAt: integer('scheduled_at').notNull(),
  notes:       text('notes'),
  createdAt:   integer('created_at').notNull(),
})

// ── Mensagens médico ↔ paciente

export const patientMessages = sqliteTable('patient_messages', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  patientName: text('patient_name').notNull(),
  senderRole:  text('sender_role', { enum: ['medico', 'paciente'] }).notNull(),
  content:     text('content').notNull(),
  createdAt:   integer('created_at').notNull(),
})

// ── Exames enviados pelo paciente

export const exams = sqliteTable('exams', {
  id:          text('id').primaryKey(),
  patientName: text('patient_name').notNull(),
  examType:    text('exam_type').notNull(),
  fileName:    text('file_name').notNull(),
  fileData:    text('file_data'),   // base64 (PoC)
  shared:      integer('shared', { mode: 'boolean' }).notNull().default(false),
  sharedUntil: integer('shared_until'),
  createdAt:   integer('created_at').notNull(),
})
