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
