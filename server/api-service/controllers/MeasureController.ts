import { Express, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import z from 'zod'

import { getValkeyPublisher, VALKEY_MEASURE_CHANNEL } from '../services/ValkeyPublisher.ts'

const MeasureBody = z.object({
  patientName: z.string().min(1, 'Nome do paciente é obrigatório.'),
})

export class MeasureController {
  constructor(_app: Express) {}

  /**
   * POST /totem/measure
   *
   * Inicia o fluxo de coleta de sinais vitais via IoT.
   * Publica no Valkey para o mqtt-service orquestrar o dispositivo.
   * Retorna 202 Accepted com o sessionId para rastreamento.
   */
  measure = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName } = MeasureBody.parse(req.body)

      const sessionId = randomUUID()

      const valkey = await getValkeyPublisher()
      await valkey.publish(
        VALKEY_MEASURE_CHANNEL,
        JSON.stringify({ sessionId, patientName }),
      )

      res.status(202).json({
        sessionId,
        message: 'Medição iniciada. Os sinais vitais serão coletados pelo dispositivo.',
      })
    } catch (err) {
      next(err)
    }
  }
}
