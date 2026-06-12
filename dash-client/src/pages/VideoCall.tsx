import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, AlertTriangle } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'
const WS_BASE  = API_BASE.replace(/^http/, 'ws')

const ICE_CONFIG: RTCConfiguration = {
  // STUN-only — production would also need a TURN server for restrictive NATs.
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

type Status = 'connecting' | 'waiting' | 'connected' | 'error' | 'ended'

export default function VideoCall() {
  const { appointmentId = '' } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()

  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef          = useRef<RTCPeerConnection | null>(null)
  const wsRef          = useRef<WebSocket | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingIce     = useRef<RTCIceCandidateInit[]>([])
  const remoteSet      = useRef(false)

  const [status, setStatus] = useState<Status>('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  const send = (msg: unknown) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  const flushIce = async () => {
    const pc = pcRef.current
    if (!pc) return
    for (const c of pendingIce.current) {
      try { await pc.addIceCandidate(c) } catch { /* noop */ }
    }
    pendingIce.current = []
  }

  const makeOffer = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ kind: 'offer', sdp: offer })
  }, [])

  const hangUp = useCallback(() => {
    try { wsRef.current?.close() } catch { /* noop */ }
    try { pcRef.current?.close() } catch { /* noop */ }
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    setStatus('ended')
    navigate(-1)
  }, [navigate])

  useEffect(() => {
    let cancelled = false

    async function start() {
      // 1) Local media (graceful on permission denial)
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg('Não foi possível acessar câmera/microfone. Verifique as permissões do navegador e tente novamente.')
        }
        return
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      // 2) Peer connection
      const pc = new RTCPeerConnection(ICE_CONFIG)
      pcRef.current = pc
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      pc.onicecandidate = e => { if (e.candidate) send({ kind: 'candidate', candidate: e.candidate }) }
      pc.ontrack = e => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0]
          setStatus('connected')
        }
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setStatus(s => (s === 'connected' ? 'waiting' : s))
        }
      }

      // 3) Signaling
      const ws = new WebSocket(`${WS_BASE}/ws/videochamada?room=${encodeURIComponent(appointmentId)}`)
      wsRef.current = ws

      ws.onmessage = async ev => {
        const msg = JSON.parse(ev.data)
        switch (msg.kind) {
          case 'joined':
            // If a peer is already here, we're the second arrival → make the offer.
            if (msg.peers > 0) await makeOffer()
            else setStatus('waiting')
            break
          case 'peer-joined':
            // We were first; the newcomer will send an offer. Keep waiting.
            break
          case 'peer-left':
            remoteSet.current = false
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
            setStatus('waiting')
            break
          case 'offer':
            await pc.setRemoteDescription(msg.sdp)
            remoteSet.current = true
            await flushIce()
            { const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); send({ kind: 'answer', sdp: answer }) }
            break
          case 'answer':
            await pc.setRemoteDescription(msg.sdp)
            remoteSet.current = true
            await flushIce()
            break
          case 'candidate':
            if (remoteSet.current) { try { await pc.addIceCandidate(msg.candidate) } catch { /* noop */ } }
            else pendingIce.current.push(msg.candidate)
            break
        }
      }
      ws.onerror = () => { if (!cancelled) { setStatus('error'); setErrorMsg('Falha na conexão de sinalização. O servidor está em execução?') } }
    }

    start()

    return () => {
      cancelled = true
      try { wsRef.current?.close() } catch { /* noop */ }
      try { pcRef.current?.close() } catch { /* noop */ }
      localStreamRef.current?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId])

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled) }
  }
  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled) }
  }

  return (
    <div className="min-h-screen pt-16 bg-slate-100 dark:bg-slate-950 flex flex-col transition-colors">
      <div className="flex-1 relative max-w-5xl w-full mx-auto p-4 flex flex-col">

        {/* Remote video (main) */}
        <div className="relative flex-1 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 min-h-[50vh]">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {/* Overlays */}
          {status !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-3 px-6 text-center">
              {status === 'error' ? (
                <>
                  <AlertTriangle size={40} className="text-amber-400" />
                  <p className="text-sm max-w-sm">{errorMsg}</p>
                  <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 rounded-xl bg-[#0079C8] text-white text-sm font-medium hover:bg-[#0060a0]">
                    Tentar novamente
                  </button>
                </>
              ) : (
                <>
                  <Loader2 size={36} className="animate-spin" />
                  <p className="text-sm">
                    {status === 'waiting' ? 'Aguardando o outro participante entrar na chamada…' : 'Conectando…'}
                  </p>
                  <p className="text-xs text-slate-500">Sala: {appointmentId.slice(0, 8)}</p>
                </>
              )}
            </div>
          )}

          {/* Local PiP */}
          <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-slate-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400">
                <VideoOff size={18} />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 py-4">
          <button
            onClick={toggleMic}
            title={micOn ? 'Desativar microfone' : 'Ativar microfone'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              micOn ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700' : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            onClick={toggleCam}
            title={camOn ? 'Desativar câmera' : 'Ativar câmera'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              camOn ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700' : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <button
            onClick={hangUp}
            title="Encerrar chamada"
            className="w-14 h-12 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
