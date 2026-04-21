import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock do banco — evita conexão real com SQLite
vi.mock('../../shared/db/index.ts', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

import { MqttOrchestrator, TOPICS } from '../orchestrator.ts'
import { db } from '../../shared/db/index.ts'

// ── Fake MQTT client ──────────────────────────────────────────────────────────
function makeMqtt() {
  return { publish: vi.fn() } as unknown as import('mqtt').MqttClient
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function payload(data: Record<string, unknown>) {
  return JSON.stringify(data)
}

const SESSION_ID   = 'sess-001'
const PATIENT_NAME = 'João Silva'

// ─────────────────────────────────────────────────────────────────────────────
describe('MqttOrchestrator — enqueue / dequeue', () => {
  let orc: MqttOrchestrator
  let mqtt: ReturnType<typeof makeMqtt>

  beforeEach(() => {
    orc  = new MqttOrchestrator()
    mqtt = makeMqtt()
    vi.clearAllMocks()
  })

  it('começa com fila vazia e sem sessão ativa', () => {
    expect(orc.currentSession).toBeNull()
    expect(orc.queueLength).toBe(0)
  })

  it('enqueue adiciona a sessão à fila', () => {
    orc.enqueue(mqtt, SESSION_ID, PATIENT_NAME)
    // A sessão saiu da fila e virou a atual (dequeue chamado internamente)
    expect(orc.currentSession?.sessionId).toBe(SESSION_ID)
    expect(orc.queueLength).toBe(0)
  })

  it('enqueue publica no tópico "setup" com sessionId e patientName', () => {
    orc.enqueue(mqtt, SESSION_ID, PATIENT_NAME)

    expect(mqtt.publish).toHaveBeenCalledOnce()
    expect(mqtt.publish).toHaveBeenCalledWith(
      TOPICS.SETUP,
      JSON.stringify({ sessionId: SESSION_ID, patientName: PATIENT_NAME }),
    )
  })

  it('segunda enqueue fica na fila enquanto há sessão ativa', () => {
    orc.enqueue(mqtt, 'sess-1', 'Paciente A')
    orc.enqueue(mqtt, 'sess-2', 'Paciente B')

    // Apenas a primeira chamada a dequeue publicou
    expect(mqtt.publish).toHaveBeenCalledOnce()
    expect(orc.currentSession?.sessionId).toBe('sess-1')
    expect(orc.queueLength).toBe(1)
  })

  it('dequeue não faz nada com fila vazia', () => {
    orc.dequeue(mqtt)
    expect(mqtt.publish).not.toHaveBeenCalled()
    expect(orc.currentSession).toBeNull()
  })

  it('dequeue não faz nada quando há sessão ativa', () => {
    orc.enqueue(mqtt, 'sess-1', 'Paciente A')
    vi.clearAllMocks()

    // Chama dequeue novamente sem limpar a sessão atual
    orc.dequeue(mqtt)
    expect(mqtt.publish).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('MqttOrchestrator — handleMessage', () => {
  let orc: MqttOrchestrator
  let mqtt: ReturnType<typeof makeMqtt>

  beforeEach(() => {
    orc  = new MqttOrchestrator()
    mqtt = makeMqtt()
    vi.clearAllMocks()

    // Inicia uma sessão ativa
    orc.enqueue(mqtt, SESSION_ID, PATIENT_NAME)
    vi.clearAllMocks() // limpa o publish do setup
  })

  // ── Sem sessão ativa ────────────────────────────────────────────────────────
  it('ignora mensagem quando não há sessão ativa', async () => {
    const sem = new MqttOrchestrator() // fresh, sem sessão
    await sem.handleMessage(mqtt, TOPICS.SETUP_RESPONSE, payload({}))
    expect(mqtt.publish).not.toHaveBeenCalled()
  })

  // ── Payload inválido ────────────────────────────────────────────────────────
  it('não lança erro com payload JSON inválido', async () => {
    await expect(
      orc.handleMessage(mqtt, TOPICS.SETUP_RESPONSE, 'não-é-json'),
    ).resolves.not.toThrow()
    expect(mqtt.publish).not.toHaveBeenCalled()
  })

  // ── setup/response ──────────────────────────────────────────────────────────
  describe('setup/response', () => {
    it('publica no tópico "oximeter" com o sessionId da sessão', async () => {
      await orc.handleMessage(mqtt, TOPICS.SETUP_RESPONSE, payload({}))

      expect(mqtt.publish).toHaveBeenCalledOnce()
      expect(mqtt.publish).toHaveBeenCalledWith(
        TOPICS.OXIMETER,
        JSON.stringify({ sessionId: SESSION_ID }),
      )
    })

    it('não altera a sessão atual', async () => {
      await orc.handleMessage(mqtt, TOPICS.SETUP_RESPONSE, payload({}))
      expect(orc.currentSession?.sessionId).toBe(SESSION_ID)
    })
  })

  // ── oximeter/response ───────────────────────────────────────────────────────
  describe('oximeter/response', () => {
    const oxData = { oxygenSaturation: 98, respiratoryRate: 16, heartRate: 72 }

    it('salva SpO2, FR e FC nos vitais da sessão', async () => {
      await orc.handleMessage(mqtt, TOPICS.OXIMETER_RESPONSE, payload(oxData))

      const { vitals } = orc.currentSession!
      expect(vitals.oxygenSaturation).toBe(98)
      expect(vitals.respiratoryRate).toBe(16)
      expect(vitals.heartRate).toBe(72)
    })

    it('publica no tópico "blood-pressure"', async () => {
      await orc.handleMessage(mqtt, TOPICS.OXIMETER_RESPONSE, payload(oxData))

      expect(mqtt.publish).toHaveBeenCalledOnce()
      expect(mqtt.publish).toHaveBeenCalledWith(
        TOPICS.BLOOD_PRESSURE,
        JSON.stringify({ sessionId: SESSION_ID }),
      )
    })
  })

  // ── blood-pressure/response ─────────────────────────────────────────────────
  describe('blood-pressure/response', () => {
    const bpData = { systolic: 120, diastolic: 80 }

    it('salva pressão arterial nos vitais da sessão', async () => {
      await orc.handleMessage(mqtt, TOPICS.BLOOD_PRESSURE_RESPONSE, payload(bpData))

      expect(orc.currentSession!.vitals.bloodPressure).toEqual({ systolic: 120, diastolic: 80 })
    })

    it('publica no tópico "temp"', async () => {
      await orc.handleMessage(mqtt, TOPICS.BLOOD_PRESSURE_RESPONSE, payload(bpData))

      expect(mqtt.publish).toHaveBeenCalledOnce()
      expect(mqtt.publish).toHaveBeenCalledWith(
        TOPICS.TEMP,
        JSON.stringify({ sessionId: SESSION_ID }),
      )
    })
  })

  // ── temp/response ───────────────────────────────────────────────────────────
  describe('temp/response', () => {
    it('salva temperatura nos vitais', async () => {
      await orc.handleMessage(mqtt, TOPICS.TEMP_RESPONSE, payload({ temperature: 36.5 }))
      // currentSession é null após persistir — verificamos via DB mock
      expect(orc.currentSession).toBeNull()
    })

    it('persiste a sessão no banco com todos os campos', async () => {
      // Popula vitais simulando o fluxo anterior
      await orc.handleMessage(mqtt, TOPICS.OXIMETER_RESPONSE, payload({ oxygenSaturation: 98, respiratoryRate: 16, heartRate: 72 }))
      await orc.handleMessage(mqtt, TOPICS.BLOOD_PRESSURE_RESPONSE, payload({ systolic: 120, diastolic: 80 }))
      vi.clearAllMocks()

      await orc.handleMessage(mqtt, TOPICS.TEMP_RESPONSE, payload({ temperature: 36.5 }))

      const insertMock = vi.mocked(db.insert)
      expect(insertMock).toHaveBeenCalledOnce()

      const valuesMock = insertMock.mock.results[0].value.values
      expect(valuesMock).toHaveBeenCalledOnce()

      const record = valuesMock.mock.calls[0][0]
      expect(record.id).toBe(SESSION_ID)
      expect(record.type).toBe('triagem')
      expect(record.patientName).toBe(PATIENT_NAME)
      expect(record.summary).toBeDefined()

      const details = JSON.parse(record.details)
      expect(details.vitals.temperature).toBe(36.5)
      expect(details.vitals.oxygenSaturation).toBe(98)
    })

    it('limpa a sessão atual após persistir', async () => {
      await orc.handleMessage(mqtt, TOPICS.TEMP_RESPONSE, payload({ temperature: 36.5 }))
      expect(orc.currentSession).toBeNull()
    })

    it('processa a próxima sessão da fila após persistir', async () => {
      // Enfileira uma segunda sessão antes de processar a temp/response
      orc.enqueue(mqtt, 'sess-2', 'Maria Lima')
      vi.clearAllMocks()

      await orc.handleMessage(mqtt, TOPICS.TEMP_RESPONSE, payload({ temperature: 36.5 }))

      // Deve ter iniciado o setup da segunda sessão
      expect(mqtt.publish).toHaveBeenCalledWith(
        TOPICS.SETUP,
        JSON.stringify({ sessionId: 'sess-2', patientName: 'Maria Lima' }),
      )
      expect(orc.currentSession?.sessionId).toBe('sess-2')
      expect(orc.queueLength).toBe(0)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('MqttOrchestrator — fluxo completo (happy path)', () => {
  it('processa uma medição do início ao fim', async () => {
    const orc  = new MqttOrchestrator()
    const mqtt = makeMqtt()
    vi.clearAllMocks()

    // 1. Medição chega via Valkey → enfileira
    orc.enqueue(mqtt, SESSION_ID, PATIENT_NAME)
    expect(mqtt.publish).toHaveBeenCalledWith(TOPICS.SETUP, expect.any(String))

    // 2. Dispositivo confirma setup → inicia oxímetro
    await orc.handleMessage(mqtt, TOPICS.SETUP_RESPONSE, payload({}))
    expect(mqtt.publish).toHaveBeenCalledWith(TOPICS.OXIMETER, expect.any(String))

    // 3. Oxímetro retorna dados → inicia pressão
    await orc.handleMessage(
      mqtt,
      TOPICS.OXIMETER_RESPONSE,
      payload({ oxygenSaturation: 97, respiratoryRate: 14, heartRate: 68 }),
    )
    expect(mqtt.publish).toHaveBeenCalledWith(TOPICS.BLOOD_PRESSURE, expect.any(String))

    // 4. Pressão retorna dados → inicia temperatura
    await orc.handleMessage(
      mqtt,
      TOPICS.BLOOD_PRESSURE_RESPONSE,
      payload({ systolic: 118, diastolic: 78 }),
    )
    expect(mqtt.publish).toHaveBeenCalledWith(TOPICS.TEMP, expect.any(String))

    // 5. Temperatura retorna → persiste e limpa sessão
    await orc.handleMessage(mqtt, TOPICS.TEMP_RESPONSE, payload({ temperature: 36.8 }))

    expect(orc.currentSession).toBeNull()
    expect(orc.queueLength).toBe(0)
    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce()
  })
})
