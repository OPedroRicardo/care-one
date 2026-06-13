/**
 * Deterministic exam-report PDF generation.
 *
 * The PDF is a projection of the structured exam record — same values the app
 * shows, never a generic file (see pdf_integration.md). Built with pdf-lib using
 * the WinAnsi Helvetica fonts (cover Portuguese accents); avoid characters
 * outside Latin-1 (e.g. use "SpO2", not "SpO₂").
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export interface ExamResultItem {
  item: string
  value: string
  reference: string
  status?: 'normal' | 'alterado' | string
}

export interface ExamPdfInput {
  patientName: string
  examType: string
  dateMs: number
  results?: ExamResultItem[]
  triagem?: {
    riskLevel?: string
    vitals?: Record<string, number | undefined>
    news2?: number
  }
  notes?: string
}

const BLUE = rgb(0x00 / 255, 0x79 / 255, 0xc8 / 255)
const DARK = rgb(0.13, 0.16, 0.19)
const GREY = rgb(0.42, 0.45, 0.5)
const RED = rgb(0.86, 0.15, 0.15)
const GREEN = rgb(0.09, 0.6, 0.31)
const LINE = rgb(0.85, 0.87, 0.89)

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const VITAL_LABELS: Record<string, { label: string; unit: string }> = {
  fc:   { label: 'Freq. Cardiaca', unit: 'bpm' },
  spo2: { label: 'Saturacao O2',   unit: '%' },
  fr:   { label: 'Freq. Respiratoria', unit: 'rpm' },
  temp: { label: 'Temperatura',    unit: 'C' },
  pa:   { label: 'Pressao Arterial', unit: 'mmHg' },
}

export async function generateExamPdf(input: ExamPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Laudo - ${input.examType}`)
  const page = doc.addPage([595.28, 841.89]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const M = 50
  const W = page.getWidth()
  let y = page.getHeight() - M

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont, color = DARK) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color })

  // ── Header ──
  text('Care', M, y, 20, bold, BLUE)
  text('One', M + bold.widthOfTextAtSize('Care', 20), y, 20, font, DARK)
  text('LAUDO DE EXAME', W - M - font.widthOfTextAtSize('LAUDO DE EXAME', 10), y + 4, 10, bold, GREY)
  y -= 14
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE })
  y -= 26

  // ── Identification ──
  text(input.examType, M, y, 16, bold, DARK)
  y -= 20
  text(`Paciente: ${input.patientName}`, M, y, 11, font, DARK)
  text(`Data: ${fmtDate(input.dateMs)}`, W - M - font.widthOfTextAtSize(`Data: ${fmtDate(input.dateMs)}`, 11), y, 11, font, GREY)
  y -= 26

  // ── Body ──
  if (input.results?.length) {
    y = drawResultsTable(page, font, bold, M, W, y, input.results)
  }
  if (input.triagem) {
    y = drawTriagem(page, font, bold, M, W, y, input.triagem)
  }

  if (input.notes) {
    y -= 8
    text('Observacoes', M, y, 10, bold, GREY); y -= 16
    y = drawWrapped(page, font, input.notes, M, y, W - 2 * M, 10, DARK, 14)
  }

  // ── Footer ──
  const footY = M + 6
  page.drawLine({ start: { x: M, y: footY + 24 }, end: { x: W - M, y: footY + 24 }, thickness: 0.6, color: LINE })
  text('Laboratorio Care One', M, footY + 10, 9, font, GREY)
  text(`Emitido em ${fmtDate(Date.now())}`, M, footY, 8, font, GREY)
  const resp = 'Responsavel tecnico: Dra. Helena (CRM 00000)'
  text(resp, W - M - font.widthOfTextAtSize(resp, 8), footY, 8, font, GREY)

  return doc.save()
}

function drawResultsTable(
  page: PDFPage, font: PDFFont, bold: PDFFont, M: number, W: number, y: number, results: ExamResultItem[],
): number {
  const cols = [M, M + 200, M + 330, W - M - 70]
  text2(page, bold, 'MARCADOR', cols[0], y, 8, GREY)
  text2(page, bold, 'RESULTADO', cols[1], y, 8, GREY)
  text2(page, bold, 'REFERENCIA', cols[2], y, 8, GREY)
  text2(page, bold, 'STATUS', cols[3], y, 8, GREY)
  y -= 8
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE })
  y -= 16

  for (const r of results) {
    const altered = (r.status ?? '').toLowerCase() === 'alterado'
    const statusColor = altered ? RED : GREEN
    text2(page, font, clip(r.item, 32), cols[0], y, 10, DARK)
    text2(page, altered ? bold : font, r.value, cols[1], y, 10, altered ? RED : DARK)
    text2(page, font, r.reference, cols[2], y, 9, GREY)
    text2(page, font, altered ? 'Alterado' : 'Normal', cols[3], y, 9, statusColor)
    y -= 18
    page.drawLine({ start: { x: M, y: y + 5 }, end: { x: W - M, y: y + 5 }, thickness: 0.4, color: LINE })
  }
  return y - 6
}

function drawTriagem(
  page: PDFPage, font: PDFFont, bold: PDFFont, M: number, W: number, y: number,
  t: NonNullable<ExamPdfInput['triagem']>,
): number {
  if (t.riskLevel) { text2(page, bold, `Nivel de risco: ${cap(t.riskLevel)}`, M, y, 11, DARK); y -= 18 }
  if (t.news2 !== undefined) { text2(page, font, `Escore NEWS2: ${t.news2} pts`, M, y, 11, DARK); y -= 22 }

  const vitals = t.vitals ?? {}
  const entries = Object.entries(VITAL_LABELS).filter(([k]) => vitals[k] !== undefined)
  if (entries.length) {
    text2(page, bold, 'SINAIS VITAIS', M, y, 8, GREY); y -= 8
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE }); y -= 16
    for (const [k, meta] of entries) {
      text2(page, font, meta.label, M, y, 10, DARK)
      text2(page, bold, `${vitals[k]} ${meta.unit}`, M + 220, y, 10, DARK)
      y -= 18
    }
  }
  return y - 6
}

// ── small helpers ──
// Keep Latin-1 + common CP1252 punctuation (all encodable by WinAnsi Helvetica);
// replace anything else so pdf-lib never throws on exotic characters in data.
function safe(s: string): string {
  return s.replace(/[^\x00-\xFF€–—‘’“”•…™]/g, '?')
}
function text2(page: PDFPage, f: PDFFont, s: string, x: number, y: number, size: number, color: ReturnType<typeof rgb>) {
  page.drawText(safe(s), { x, y, size, font: f, color })
}
function drawWrapped(page: PDFPage, f: PDFFont, s: string, x: number, y: number, maxW: number, size: number, color: ReturnType<typeof rgb>, lh: number): number {
  const words = s.split(/\s+/)
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (f.widthOfTextAtSize(test, size) > maxW) {
      page.drawText(safe(line), { x, y, size, font: f, color }); y -= lh; line = w
    } else line = test
  }
  if (line) { page.drawText(safe(line), { x, y, size, font: f, color }); y -= lh }
  return y
}
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 3) + '...' : s)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
