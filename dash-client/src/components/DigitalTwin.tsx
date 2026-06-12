import { useState } from 'react'

// ── types & constants ─────────────────────────────────────────────────────────

const STATUS = {
  normal:   { fill: '#10B981', glow: '#34D399', label: 'Normal',  badge: 'rgba(16,185,129,0.15)'  },
  warning:  { fill: '#F59E0B', glow: '#FBBF24', label: 'Atenção', badge: 'rgba(245,158,11,0.15)'  },
  critical: { fill: '#EF4444', glow: '#F87171', label: 'Crítico', badge: 'rgba(239,68,68,0.15)'   },
} as const

type Status = keyof typeof STATUS

interface VitalStatus { heart: Status; lungs: Status; temp: Status; pressure: Status }

interface Props {
  vitals?: { fc?: number; fr?: number; spo2?: number; temp?: number; pa?: number }
  riskLevel?: string | null
}

interface TooltipState {
  label:  string
  detail: string
  x:      number
  y:      number
}

// ── classification ────────────────────────────────────────────────────────────

function classify(v?: Props['vitals']): VitalStatus {
  const fc   = v?.fc   ?? 75
  const fr   = v?.fr   ?? 16
  const spo2 = v?.spo2 ?? 98
  const temp = v?.temp ?? 37
  const pa   = v?.pa   ?? 120

  return {
    heart:    fc <= 40 || fc >= 131 ? 'critical' : fc <= 50 || fc >= 111 ? 'warning' : 'normal',
    lungs:    fr <= 8  || fr >= 25  || spo2 <= 91 ? 'critical' : fr <= 11 || spo2 <= 95 ? 'warning' : 'normal',
    temp:     temp <= 35 || temp >= 40 ? 'critical' : temp <= 36 || temp >= 38 ? 'warning' : 'normal',
    pressure: pa <= 90  || pa >= 220  ? 'critical' : pa <= 100  || pa >= 140  ? 'warning' : 'normal',
  }
}

// ── sub-components ────────────────────────────────────────────────────────────

function Ring({ cx, cy, r0, color, dur, begin = '0s' }: {
  cx: number; cy: number; r0: number; color: string; dur: string; begin?: string
}) {
  return (
    <circle cx={cx} cy={cy} fill="none" stroke={color} strokeWidth="1.5">
      <animate attributeName="r" values={`${r0};${r0 + 10};${r0}`} dur={dur} begin={begin} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.7;0;0.7" dur={dur} begin={begin} repeatCount="indefinite" />
    </circle>
  )
}

function Dot({ cx, cy, status, r = 5, dur = '2s', begin = '0s', onEnter, onLeave }: {
  cx: number; cy: number; status: Status; r?: number; dur?: string; begin?: string
  onEnter?: () => void
  onLeave?: () => void
}) {
  const c = STATUS[status]
  return (
    <g>
      <Ring cx={cx} cy={cy} r0={r} color={c.glow} dur={dur} begin={begin} />
      <circle cx={cx} cy={cy} r={r} fill={c.fill} filter="url(#dt-glow)" />
      {/* Transparent larger hit area for easier hover */}
      <circle
        cx={cx} cy={cy} r={r + 10} fill="transparent"
        style={{ cursor: 'crosshair' }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
    </g>
  )
}

// ── body path constants ───────────────────────────────────────────────────────

// const BS = '#60A5FA' // body stroke
// const BF = 'url(#dt-body)' // body fill
// const BW = '1.3'
// const BO = '0.4'

// ── main component ────────────────────────────────────────────────────────────

export default function DigitalTwin({ vitals, riskLevel }: Props) {
  const st = classify(vitals)
  const overall: Status = riskLevel === 'alto' ? 'critical' : riskLevel === 'médio' ? 'warning' : 'normal'

  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const legend: [string, Status][] = [
    ['Coração',  st.heart   ],
    ['Pulmões',  st.lungs   ],
    ['Temp.',    st.temp    ],
    ['Pressão',  st.pressure],
  ]

  // SVG viewBox 200×360, rendered at width=180, height=324, positioned at left-1.5 (6px)
  const scaleX = 180 / 200
  const scaleY = 324 / 360
  const svgLeft = 6

  function tip(label: string, detail: string, cx: number, cy: number) {
    return {
      onEnter: () => setTooltip({ label, detail, x: cx * scaleX + svgLeft, y: cy * scaleY }),
      onLeave: () => setTooltip(null),
    }
  }

  const fc   = vitals?.fc   ?? 75
  const fr   = vitals?.fr   ?? 16
  const spo2 = vitals?.spo2 ?? 98
  const temp = vitals?.temp ?? 37
  const pa   = vitals?.pa   ?? 120

  return (
    <div className="rounded-2xl overflow-hidden select-none" style={{ background: 'linear-gradient(160deg,#080f1f 0%,#0c1a42 100%)' }}>

      {/* ── Card header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 4px' }}>
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: STATUS[overall].fill,
          background: STATUS[overall].badge,
          padding: '2px 8px', borderRadius: 20,
        }}>
          {STATUS[overall].label}
        </span>
      </div>

      {/* ── SVG body (viewBox 200 × 360) ── */}
      <div className="flex flex-row justify-center relative">
        <img draggable={false} className="w-50 h-90 pb-2" src="/assets/body.svg" />
        <svg className="absolute top-0" viewBox="0 0 200 360" width="190 " height="324" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Scan-line sweep gradient */}
            <linearGradient id="dt-scan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0"   />
              <stop offset="50%"  stopColor="#38BDF8" stopOpacity=".55" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0"   />
            </linearGradient>
          </defs>

          {/* ── Background grid (medical monitor aesthetic) ── */}
          <g opacity=".09">
            {[50, 100, 150].map(x => (
              <line key={`v${x}`} x1={x} y1="0" x2={x} y2="360" stroke="#60A5FA" strokeWidth=".7" />
            ))}
            {[45, 90, 135, 180, 225, 270, 315, 360].map(y => (
              <line key={`h${y}`} x1="0" y1={y} x2="200" y2={y} stroke="#60A5FA" strokeWidth=".7" />
            ))}
          </g>

          {/* -- Head -- */}

          {/* Brain hint — inside skull */}
          <path
            d="M86,30 Q82,22 88,19 Q94,16 100,21 Q106,16 112,19 Q118,22 114,30 Q108,27 100,28 Q92,27 86,30 Z"
            fill={STATUS[st.temp].fill} opacity=".2" filter="url(#dt-glow)"
          />

          {/* Temperature — forehead dot */}
          <Dot cx={100} cy={14} status={st.temp} r={4} dur="3.5s"
            {...tip('Temperatura', `${temp} °C — ${STATUS[st.temp].label}`, 100, 14)} />

          {/* -- Body -- */}
          {/* Left lung — breathing ellipse + dot */}
          <ellipse cx="68" cy="103" rx="8" ry="15" fill={STATUS[st.lungs].fill} opacity=".15">
            <animate attributeName="ry" values="15;18;15" dur="3.2s" repeatCount="indefinite" />
          </ellipse>
          <Dot cx={68} cy={103} status={st.lungs} r={4.5} dur="3.2s" begin=".4s"
            {...tip('Pulmão Esq.', `FR: ${fr} rpm  |  SpO₂: ${spo2}%`, 68, 103)} />

          {/* Right lung — breathing ellipse + dot */}
          <ellipse cx="132" cy="103" rx="8" ry="15" fill={STATUS[st.lungs].fill} opacity=".15">
            <animate attributeName="ry" values="15;18;15" dur="3.2s" repeatCount="indefinite" />
          </ellipse>
          <Dot cx={132} cy={103} status={st.lungs} r={4.5} dur="3.2s" begin=".9s"
            {...tip('Pulmão Dir.', `FR: ${fr} rpm  |  SpO₂: ${spo2}%`, 132, 103)} />

          {/* Heart — shape + ECG trace + dot */}
          <path
            d="M100,124 C100,124 87,116 87,108 C87,103 91,99 96,101 C98,102 100,104 100,104 C100,104 102,102 104,101 C109,99 113,103 113,108 C113,116 100,124 100,124 Z"
            fill={STATUS[st.heart].fill} opacity=".22">
            <animate attributeName="opacity" values=".22;.52;.22" dur="1.0s" repeatCount="indefinite" />
          </path>

          <Dot cx={100} cy={117} status={st.heart} r={5} dur="1.0s" begin=".2s"
            {...tip('Coração', `FC: ${fc} bpm — ${STATUS[st.heart].label}`, 100, 117)} />

          {/* Blood pressure — cross-hair on left arm + dot */}
          <g stroke={STATUS[st.pressure].fill} strokeWidth=".8" opacity=".3">
            <line x1="21" y1="120" x2="35" y2="120" />
            <line x1="28" y1="113" x2="28" y2="127" />
          </g>
          <Dot cx={50} cy={120} status={st.pressure} r={4} dur="2.5s" begin=".6s"
            {...tip('Pressão Art.', `${pa} mmHg — ${STATUS[st.pressure].label}`, 50, 120)} />

          {/* ── Scan-line sweep ── */}
          <rect x="10" y="-7" width="200" height="9" fill="url(#dt-scan)" opacity=".65">
            <animateTransform attributeName="transform" type="translate"
              values="0,-7;0,367;0,-7" dur="8s" repeatCount="indefinite" />
          </rect>
        </svg>

        {/* ── Tooltip overlay ── */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y - 46,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10,
            background: 'rgba(8,15,31,0.93)',
            border: '1px solid rgba(96,165,250,0.3)',
            borderRadius: 8,
            padding: '5px 10px',
            backdropFilter: 'blur(6px)',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: 9, color: '#60A5FA', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
              {tooltip.label}
            </div>
            <div style={{ fontSize: 10, color: '#E2E8F0', fontWeight: 500 }}>
              {tooltip.detail}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 6, padding: '2px 16px 14px' }}>
        {legend.map(([label, s]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#94A3B8' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: STATUS[s].fill,
              boxShadow: `0 0 6px ${STATUS[s].glow}`,
            }} />
            {label}
          </div>
        ))}
      </div>

    </div>
  )
}
