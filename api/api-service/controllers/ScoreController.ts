import { Express, Request, Response, RequestHandler, NextFunction } from 'express';
import z from 'zod';

type rangeType = {
  min?: number;
  max?: number;
}

type vitalsType = {
  fr: number;
  fc: number;
  spo2: number;
  temp: number;
  pa: number;
  oxygen: boolean;
}

export class ScoreController {
  #app

  constructor (app: Express) {
    this.#app = app
  }

  #calcScore (value: number, range: rangeType[][]) {
    const score = range.findIndex((ranges, index) => {
      return ranges.some(({ min, max }) =>
        value >= (min || -Infinity) &&
        value <= (max || Infinity)
    )})

    return score >= 0 ? score : 3
  }

  handleFrScore (fr: number) {
    const range = [
      [{ min: 12, max: 20 }],
      [{ min:  9, max: 11 }],
      [{ min: 21, max: 24 }]
    ]
    
    return this.#calcScore(fr ,range)
  }

  spo2Score1 (o2:number) {
    const range = [
      [{ min: 96 }],
      [{ min: 94, max: 95 }],
      [{ min: 92, max: 93 }]
    ]
    
    return this.#calcScore(o2 ,range)
  }

  spo2Score2 (o2:number, oxygen: boolean) {
    const range = [
      [{ min: 88, max: 92 }, { min: 93 }],
      [{ min: 86, max: 87 }, { min: 93, max: 94 }],
      [{ min: 84, max: 85 }]
    ]

    if (oxygen) {
      range[0] = [{ min: 88, max: 92 }]
      range[1].push({ min: 93, max: 94 })
      range[2].push({ min: 95, max: 96 })
    }

    return this.#calcScore(o2, range)
  }

  handleAirOxygenScore (oxygen: boolean) {
    if (oxygen) return 2
    return 0
  }

  handlePaScore (pa: number) {
    const range = [
      [{ min: 111, max: 219 }],
      [{ min: 101, max: 110 }],
      [{ min:  91, max: 100 }]
    ]

    return this.#calcScore(pa, range)
  }

  handleFcScore (fc: number) {
    const range = [
      [{ min: 51, max: 90 }],
      [{ min: 41, max: 50 }, { min: 91, max: 110 }],
      [{ min:  111, max: 130 }]
    ]

    return this.#calcScore(fc, range)
  }

  handleTempScore (temp: number) {
    const range = [
      [{ min: 36.1, max: 38.0 }],
      [{ min: 35.1, max: 36 }, { min: 38.1, max: 39 }],
      [{ min: 39.1 }],
      [{ max: 35.0 }]
    ]

    return this.#calcScore(temp, range)
  }

  calcAllScores (vitals: vitalsType) {
    const fr = this.handleFrScore(vitals.fr)
    const spo2_1 = this.spo2Score1(vitals.spo2)
    const spo2_2 = this.spo2Score2(vitals.spo2, vitals.oxygen)
    const airOxygen = this.handleAirOxygenScore(vitals.oxygen)
    const pa = this.handlePaScore(vitals.pa)
    const fc = this.handleFcScore(vitals.fc)
    const temp = this.handleTempScore(vitals.temp)

    return {
      fr,
      spo2_1,
      spo2_2,
      airOxygen,
      pa,
      fc,
      temp
    }
  }

  calcNEWS2 (req: Request, res: Response, next: NextFunction) {
    const validator = z.object({ // TODO: definir range de valores possívels
      fr: z.number(),
      fc: z.number(),
      spo2: z.number(),
      temp: z.number(),
      pa: z.number(),
      oxygen: z.boolean()
    })

    const body = validator.parse(req.body)

    const score = this.calcAllScores(body)

    res.status(200).send({ score })
  }
}