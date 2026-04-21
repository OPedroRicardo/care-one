import { MqttClient } from 'mqtt'
import { db } from '../shared/db/index.ts'
import { historyRecords } from '../shared/db/schema.ts'

// ── Tópicos MQTT ────────────────────────────────────────────────────────────────
export const TOPICS = {
  SETUP:                   'setup',
  SETUP_RESPONSE:          'setup/response',
  OXIMETER:                'oximeter',
  OXIMETER_RESPONSE:       'oximeter/response',
  BLOOD_PRESSURE:          'blood-pressure',
  BLOOD_PRESSURE_RESPONSE: 'blood-pressure/response',
  TEMP:                    'temp',
  TEMP_RESPONSE:           'temp/response',
} as const

// ── Tipos ───────────────────────────────────────────────────────────────────────
export interface Vitals {
  oxygenSaturation?: number
  respiratoryRate?:  number
  heartRate?:        number
  bloodPressure?:    { systolic: number; diastolic: number }
  temperature?:      number
}

export interface MeasureSession {
  sessionId:   string
  patientName: string
  vitals:      Vitals
  startedAt:   number
}

/**
 * Orquestra o fluxo de coleta de sinais vitais via dispositivos IoT.
 * Mantém uma fila de sessões (o dispositivo é único e processa uma por vez).
 */
export class MqttOrchestrator {
  readonly #queue: MeasureSession[] = []
  #current: MeasureSession | null = null

  get currentSession() { return this.#current }
  get queueLength()    { return this.#queue.length }

  // ── Fila ──────────────────────────────────────────────────────────────────────

  enqueue(mqtt: MqttClient, sessionId: string, patientName: string): void {
    const session: MeasureSession = { sessionId, patientName, vitals: {}, startedAt: Date.now() }
    this.#queue.push(session)
    console.log(
      `[MQTT] Sessão enfileirada: "${patientName}" (${sessionId}) — fila: ${this.#queue.length}`,
    )
    this.dequeue(mqtt)
  }

  dequeue(mqtt: MqttClient): void {
    if (this.#current !== null || this.#queue.length === 0) return
    this.#current = this.#queue.shift()!
    console.log(
      `[MQTT] Iniciando setup para "${this.#current.patientName}" (${this.#current.sessionId})`,
    )
    mqtt.publish(
      TOPICS.SETUP,
      JSON.stringify({ sessionId: this.#current.sessionId, patientName: this.#current.patientName }),
    )
  }

  // ── Persistência ──────────────────────────────────────────────────────────────

  async persistSession(session: MeasureSession): Promise<void> {
    const now = Date.now()
    await db.insert(historyRecords).values({
      id:          session.sessionId,
      type:        'triagem',
      patientName: session.patientName,
      date:        now,
      summary:     'Medição de sinais vitais via dispositivo IoT',
      details:     JSON.stringify({ vitals: session.vitals }),
      createdAt:   now,
    })
    console.log(`[MQTT] Registro salvo para "${session.patientName}" (${session.sessionId})`)
  }

  // ── Handler de mensagens MQTT ─────────────────────────────────────────────────

  async handleMessage(mqtt: MqttClient, topic: string, raw: string): Promise<void> {
    const session = this.#current
    if (!session) {
      console.warn('[MQTT] Mensagem recebida sem sessão ativa — ignorando')
      return
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(raw)
    } catch {
      console.error(`[MQTT] Payload inválido no tópico "${topic}": ${raw}`)
      return
    }

    switch (topic) {
      case TOPICS.SETUP_RESPONSE: {
        console.log('[MQTT] Setup OK → publicando em "oximeter"')
        mqtt.publish(TOPICS.OXIMETER, JSON.stringify({ sessionId: session.sessionId }))
        break
      }

      case TOPICS.OXIMETER_RESPONSE: {
        session.vitals.oxygenSaturation = data.oxygenSaturation as number
        session.vitals.respiratoryRate  = data.respiratoryRate  as number
        session.vitals.heartRate        = data.heartRate        as number
        mqtt.publish(TOPICS.BLOOD_PRESSURE, JSON.stringify({ sessionId: session.sessionId }))
        break
      }

      case TOPICS.BLOOD_PRESSURE_RESPONSE: {
        session.vitals.bloodPressure = {
          systolic:  data.systolic  as number,
          diastolic: data.diastolic as number,
        }
        mqtt.publish(TOPICS.TEMP, JSON.stringify({ sessionId: session.sessionId }))
        break
      }

      case TOPICS.TEMP_RESPONSE: {
        session.vitals.temperature = data.temperature as number
        await this.persistSession(session)
        this.#current = null
        this.dequeue(mqtt)
        break
      }
    }
  }

  // ── Wiring com o cliente MQTT ─────────────────────────────────────────────────

  setupHandlers(mqtt: MqttClient): void {
    mqtt.on('message', async (topic, payload) => {
      const raw = payload.toString()
      console.log(`[MQTT] ← ${topic}: ${raw}`)
      try {
        await this.handleMessage(mqtt, topic, raw)
      } catch (err) {
        console.error(`[MQTT] Erro ao processar tópico "${topic}":`, err)
      }
    })
  }
}
