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
