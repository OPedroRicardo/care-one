import 'dotenv/config'
import { connect } from 'mqtt'
import Redis from 'ioredis'

import { MqttOrchestrator } from './orchestrator.ts'

const VALKEY_MEASURE_CHANNEL = 'measure:start'

async function bootstrap() {
  const orchestrator = new MqttOrchestrator()

  // 1. Conecta ao broker MQTT
  const MQTT_BROKER = process.env.MQTT_BROKER ?? 'mqtt://test.mosquitto.org'
  const mqtt = connect(MQTT_BROKER)

  mqtt.on('connect', () => {
    console.log(`[MQTT] Conectado ao broker: ${MQTT_BROKER}`)

    const responseTopics = [
      'setup/response',
      'oximeter/response',
      'blood-pressure/response',
      'temp/response',
    ]

    mqtt.subscribe(responseTopics, (err) => {
      if (err) {
        console.error('[MQTT] Erro ao subscrever tópicos de resposta:', err)
        return
      }
      console.log('[MQTT] Inscrito nos tópicos:', responseTopics.join(', '))
    })
  })

  mqtt.on('error',     (err) => console.error('[MQTT] Erro de conexão:', err))
  mqtt.on('offline',   ()    => console.warn('[MQTT] Broker offline'))
  mqtt.on('reconnect', ()    => console.log('[MQTT] Reconectando ao broker...'))

  orchestrator.setupHandlers(mqtt)

  // 2. Conecta ao Valkey para receber pedidos da api-service
  const VALKEY_HOST = process.env.VALKEY_HOST ?? '127.0.0.1'
  const VALKEY_PORT = parseInt(process.env.VALKEY_PORT ?? '6379', 10)

  console.log(`[Valkey] Conectando a ${VALKEY_HOST}:${VALKEY_PORT}...`)

  const subscriber = new Redis({ host: VALKEY_HOST, port: VALKEY_PORT })

  subscriber.on('error', (err) => console.error('[Valkey] Erro de conexão:', err))

  await subscriber.subscribe(VALKEY_MEASURE_CHANNEL)

  subscriber.on('message', (_channel, message) => {
    try {
      const { sessionId, patientName } = JSON.parse(message) as {
        sessionId:   string
        patientName: string
      }
      if (!sessionId || !patientName) {
        console.warn('[Valkey] Payload incompleto — ignorando:', message)
        return
      }
      orchestrator.enqueue(mqtt, sessionId, patientName)
    } catch (err) {
      console.error('[Valkey] Erro ao processar mensagem:', err)
    }
  })

  console.log(`[Valkey] Aguardando medições no canal "${VALKEY_MEASURE_CHANNEL}"`)
}

bootstrap().catch((err) => {
  console.error('[Boot] Falha fatal ao iniciar o serviço MQTT:', err)
  process.exit(1)
})
