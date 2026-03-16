// Importa tipos e funções do Express e Zod para validação
import { Express, Request, Response, RequestHandler, NextFunction } from 'express';
import z from 'zod';

// Tipo para definir intervalos de valores (mínimo e máximo)
type rangeType = {
  min?: number;
  max?: number;
}

// Tipo para os sinais vitais utilizados no cálculo do NEWS2
type vitalsType = {
  fr: number;      // Frequência respiratória
  fc: number;      // Frequência cardíaca
  spo2: number;    // Saturação de oxigênio
  temp: number;    // Temperatura
  pa: number;      // Pressão arterial
  oxygen: boolean; // Uso de oxigênio suplementar
}

// Regras de pontuação do algoritmo NEWS2 para cada parâmetro vital
const SCORE_RULES = {
  fr: [ // Frequência respiratória
    [{ min: 12, max: 20 }],
    [{ min:  9, max: 11 }],
    [{ min: 21, max: 24 }]
  ],

  pa: [ // Pressão arterial
    [{ min: 111, max: 219 }],
    [{ min: 101, max: 110 }],
    [{ min:  91, max: 100 }]
  ],

  fc: [ // Frequência cardíaca
    [{ min: 51, max: 90 }],
    [{ min: 41, max: 50 }, { min: 91, max: 110 }],
    [{ min:  111, max: 130 }]
  ],

  temp: [ // Temperatura
    [{ min: 36.1, max: 38.0 }],
    [{ min: 35.1, max: 36 }, { min: 38.1, max: 39 }],
    [{ min: 39.1 }],
    [{ max: 35.0 }]
  ],

  spo2_1: [ // Saturação de oxigênio sem uso de oxigênio suplementar
    [{ min: 96 }],
    [{ min: 94, max: 95 }],
    [{ min: 92, max: 93 }]
  ],

  spo2_2_air: [ // Saturação de oxigênio em ar ambiente
    [{ min: 88, max: 92 }, { min: 93 }],
    [{ min: 86, max: 87 }],
    [{ min: 84, max: 85 }]
  ],

  spo2_2_oxygen: [ // Saturação de oxigênio com oxigênio suplementar
    [{ min: 88, max: 92 }],
    [{ min: 86, max: 87 }, { min: 93, max: 94 }],
    [{ min: 84, max: 85 }, { min: 95, max: 96 }]
  ],
}

// Controlador responsável por calcular o escore NEWS2 a partir dos sinais vitais
export class ScoreController {
  #app

  constructor (app: Express) {
    this.#app = app
  }

  /**
   * Calcula o score para um valor de sinal vital, baseado nas regras fornecidas.
   * Retorna o índice do intervalo correspondente, ou 3 se não encontrar.
   */
  #calcScore (value: number, range: rangeType[][]) {
    const score = range.findIndex(ranges => {
      return ranges.some(({ min, max }) =>
        value >= (min || -Infinity) &&
        value <= (max || Infinity)
    )})

    return score >= 0 ? score : 3
  }

  /**
   * Retorna a pontuação para uso de oxigênio suplementar.
   * NEWS2 atribui 2 pontos se o paciente estiver usando oxigênio.
   */
  handleAirOxygenScore (oxygen: boolean) {
    return oxygen ? 2 : 0
  }

  /**
   * Calcula todos os scores dos sinais vitais conforme as regras do NEWS2.
   * Retorna um objeto com os scores individuais.
   */
  calcAllScores (vitals: vitalsType) {
    const cs = this.#calcScore

    const fr = cs(vitals.fr, SCORE_RULES.fr)
    const pa = cs(vitals.pa, SCORE_RULES.pa)
    const fc = cs(vitals.fc, SCORE_RULES.fc)
    const temp = cs(vitals.temp, SCORE_RULES.temp)

    // NEWS2 tem duas abordagens para SpO2, dependendo do uso de oxigênio
    const spo2_1 = cs(vitals.spo2, SCORE_RULES.spo2_1)
    const spo2_2 = this.#calcScore(vitals.spo2, vitals.oxygen ? SCORE_RULES.spo2_2_oxygen : SCORE_RULES.spo2_2_air)
    const airOxygen = this.handleAirOxygenScore(vitals.oxygen)

    console.log({
      fr,
      pa,
      fc,
      temp,
      spo2_1,
      spo2_2,
      airOxygen,
    })

    return { fr, pa, fc, temp, spo2_1, spo2_2, airOxygen }
  }

  /**
   * Endpoint para calcular o escore NEWS2.
   * Valida o corpo da requisição, calcula os scores e retorna o resultado.
   */
  calcNEWS2 (req: Request, res: Response, next: NextFunction) {
    // Validação dos dados recebidos
    const validator = z.object({ // TODO: definir range de valores possíveis
      fr: z.number(),
      fc: z.number(),
      spo2: z.number(),
      temp: z.number(),
      pa: z.number(),
      oxygen: z.boolean()
    })

    const body = validator.parse(req.body)

    // Calcula os scores dos sinais vitais
    const score = this.calcAllScores(body)

    // Retorna o resultado
    res.status(200).send({ score })
  }
}