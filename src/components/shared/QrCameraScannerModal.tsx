import { useState, useEffect, useRef } from 'react'
import {
  X,
  Camera,
  AlertCircle,
  CheckCircle2,
  Volume2,
  Smartphone,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'

interface QrCameraScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (code: string) => void
  title?: string
}

export function QrCameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Escanear QR Code ou Código de Barras',
}: QrCameraScannerModalProps) {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = 'qr-camera-stream-viewport'

  // Emite um bip agradável ao detectar código
  function playBeep() {
    if (!soundEnabled) return
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, audioCtx.currentTime) // Lá (A5)
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.15)
    } catch {
      // Ignora erro de áudio se política do navegador bloquear
    }
  }

  // Lista câmeras disponíveis
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    async function initCameras() {
      setError(null)
      try {
        const devices = await Html5Qrcode.getCameras()
        if (devices && devices.length > 0) {
          if (isMounted) {
            setCameras(devices)
            // Prioriza câmera traseira se for mobile (geralmente contém 'back' ou 'environment' ou é a última)
            const backCam = devices.find(
              (d) =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('traseira') ||
                d.label.toLowerCase().includes('environment')
            )
            setSelectedCameraId(backCam ? backCam.id : devices[devices.length - 1].id)
          }
        } else {
          if (isMounted) {
            setError('Nenhuma câmera localizada no dispositivo.')
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(
            err.message?.includes('Permission')
              ? 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do navegador.'
              : 'Não foi possível acessar a câmera do dispositivo.'
          )
        }
      }
    }

    initCameras()

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Inicia o scanner quando tiver câmera selecionada
  useEffect(() => {
    if (!isOpen || !selectedCameraId) return

    let scannerInstance: Html5Qrcode | null = null

    async function startScanner() {
      try {
        setError(null)
        // Se já existia instância, finaliza antes
        if (html5QrCodeRef.current?.isScanning) {
          await html5QrCodeRef.current.stop()
        }

        scannerInstance = new Html5Qrcode(scannerContainerId)
        html5QrCodeRef.current = scannerInstance

        await scannerInstance.start(
          selectedCameraId,
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            playBeep()
            setLastScanned(decodedText)
            onScan(decodedText)
          },
          () => {
            // Ignora falhas de frame sem detecção
          }
        )

        setIsScanning(true)
      } catch (err: any) {
        console.error('Erro ao iniciar Html5Qrcode:', err)
        setError(
          err.message ||
            'Falha ao iniciar stream de vídeo da câmera. Verifique as permissões de acesso.'
        )
      }
    }

    startScanner()

    return () => {
      if (scannerInstance?.isScanning) {
        scannerInstance.stop().catch(console.error)
      }
      setIsScanning(false)
    }
  }, [isOpen, selectedCameraId])

  if (!isOpen) return null

  function handleClose() {
    if (html5QrCodeRef.current?.isScanning) {
      html5QrCodeRef.current.stop().catch(console.error)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-850/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">
                Aponte a câmera para o QR Code ou código de barras do produto
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((p) => !p)}
              className={`p-1.5 rounded-lg border text-xs transition ${
                soundEnabled
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title={soundEnabled ? 'Bip de leitura ativado' : 'Bip de leitura mudo'}
            >
              <Volume2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Viewport do Scanner */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Seletor de Câmera */}
          {cameras.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selecionar Câmera
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Câmera ${c.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Área de Vídeo / Mirador do Scanner */}
          <div className="relative mx-auto w-full max-w-xs aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-blue-500/40 bg-black flex items-center justify-center shadow-inner">
            <div id={scannerContainerId} className="w-full h-full object-cover" />

            {/* Linha laser de leitura animada sobreposta */}
            {isScanning && (
              <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse" />
            )}
          </div>

          {/* Feedback de último código lido */}
          {lastScanned && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-mono font-bold truncate max-w-xs">{lastScanned}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                Detectado
              </span>
            </div>
          )}

          {/* Dica para smartphone / celular */}
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
            <Smartphone className="h-4 w-4 text-blue-400 shrink-0" />
            <span>
              <strong>Dica Mobile:</strong> Se estiver acessando o ERP pelo celular, o scanner utiliza
              a câmera traseira com foco contínuo para leitura de QR Code e códigos de barras EAN-13.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-6 py-3.5 bg-slate-850/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="border-slate-800 text-slate-400 hover:text-white text-xs"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
