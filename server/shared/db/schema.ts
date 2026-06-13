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
  attachmentExamId: text('attachment_exam_id'), // FK-by-convention → exams.id
  createdAt:   integer('created_at').notNull(),
})

// ── Cadastro canônico de pacientes (perfil/demográficos)

export const patients = sqliteTable('patients', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull().unique(),
  dateOfBirth: text('date_of_birth'),                 // ISO date (YYYY-MM-DD)
  sex:         text('sex', { enum: ['M', 'F'] }),
  planTier:    text('plan_tier'),                     // Bronze | Prata | Ouro | Diamante
  phone:       text('phone'),
  email:       text('email'),
  address:     text('address'),
  allergies:   text('allergies'),                     // JSON array serializado
  createdAt:   integer('created_at').notNull(),
})

// ── Notificações / recomendações

export const notifications = sqliteTable('notifications', {
  id:              text('id').primaryKey(),
  recipientRole:   text('recipient_role', { enum: ['medico', 'paciente', 'operadora'] }).notNull(),
  recipientName:   text('recipient_name'),                 // null/'*' = broadcast para o papel
  type:            text('type').notNull(),                 // appointment | exam | risk | recommendation
  title:           text('title').notNull(),
  body:            text('body').notNull(),
  relatedEntityId: text('related_entity_id'),
  read:            integer('read', { mode: 'boolean' }).notNull().default(false),
  createdAt:       integer('created_at').notNull(),
})

// ── Conexões com wearables / apps de saúde

export const wearableConnections = sqliteTable('wearable_connections', {
  id:          text('id').primaryKey(),
  patientName: text('patient_name').notNull(),
  provider:    text('provider').notNull(),
  connected:   integer('connected', { mode: 'boolean' }).notNull().default(false),
  connectedAt: integer('connected_at'),
  data:        text('data'),                              // JSON: métricas (sintéticas ou sincronizadas)
  // ── OAuth2 (provedores reais: Fitbit / Withings / Oura) ──────────────
  accessToken:    text('access_token'),
  refreshToken:   text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at'),            // epoch ms
  scope:          text('scope'),
  externalUserId: text('external_user_id'),               // id do usuário no provedor
  lastSyncAt:     integer('last_sync_at'),
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
