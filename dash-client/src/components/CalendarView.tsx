import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Minimal appointment shape the calendar needs — both Médico and Paciente
// appointment objects satisfy this structurally.
export interface CalendarAppointment {
  id: string
  patientName: string
  type: 'presencial' | 'telechamada'
  status: 'pending' | 'confirmed' | 'cancelled'
  scheduledAt: number
  notes?: string | null
}

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const PT_DAYS   = ['D','S','T','Q','Q','S','S']

export function calendarStatusBadge(status: CalendarAppointment['status']) {
  if (status === 'confirmed') return { label: 'Confirmado', color: '#16A34A', bg: '#F0FDF4' }
  if (status === 'cancelled') return { label: 'Cancelado',  color: '#DC2626', bg: '#FEF2F2' }
  return { label: 'Pendente', color: '#D97706', bg: '#FFFBEB' }
}

/**
 * Month calendar with day dots + a "this month" list. Shared by the Médico
 * Agenda tab and the Paciente Consultas tab.
 */
export default function CalendarView<T extends CalendarAppointment>({
  appointments,
  onSelectAppt,
}: {
  appointments: T[]
  onSelectAppt: (a: T) => void
}) {
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [year,  setYear]  = useState(() => new Date().getFullYear())

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today       = new Date()

  const apptsByDay = new Map<number, T[]>()
  appointments.forEach(a => {
    const d = new Date(a.scheduledAt)
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate()
      apptsByDay.set(day, [...(apptsByDay.get(day) ?? []), a])
    }
  })

  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? 0 : i - firstDay + 1
  )

  const monthAppts = appointments.filter(a => {
    const d = new Date(a.scheduledAt)
    return d.getMonth() === month && d.getFullYear() === year
  })

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {PT_MONTHS[month]} {year}
        </span>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {PT_DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          const appts    = day > 0 ? (apptsByDay.get(day) ?? []) : []
          const isToday  = day > 0 && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
          const hasPending = appts.some(a => a.status === 'pending')

          return (
            <div
              key={i}
              className={`relative flex flex-col items-center py-1 rounded-lg ${
                day > 0 && appts.length > 0 ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950' : ''
              } ${isToday ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
              onClick={() => { if (appts.length === 1) onSelectAppt(appts[0]) }}
            >
              {day > 0 && (
                <>
                  <span className={`text-xs ${isToday ? 'font-bold text-[#0079C8]' : 'text-slate-600 dark:text-slate-300'}`}>
                    {day}
                  </span>
                  {appts.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {appts.slice(0, 3).map(a => (
                        <div
                          key={a.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: hasPending ? '#D97706' : '#16A34A' }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Appointments in current month */}
      {monthAppts.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Neste mês</p>
          {monthAppts.map(a => {
            const b = calendarStatusBadge(a.status)
            return (
              <button
                key={a.id}
                onClick={() => onSelectAppt(a)}
                className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
              >
                <span className="text-xs font-bold text-slate-500 w-6 shrink-0">
                  {new Date(a.scheduledAt).getDate()}
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{a.patientName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: b.bg, color: b.color }}>{b.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
