import { Joyride, STATUS, type Step } from 'react-joyride'
import { useTheme } from '../contexts/ThemeContext'

export type { Step }

/**
 * Themed, pt-BR wrapper around react-joyride (v3). Reusable across pages:
 * pass a `steps` array and control visibility with `run` / `onClose`.
 */
export default function ProductTour({ steps, run, onClose }: {
  steps: Step[]
  run: boolean
  onClose: () => void
}) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      options={{
        skipBeacon: true,
        buttons: ['back', 'skip', 'primary'],
        showProgress: false,
        arrowColor:      dark ? '#1e293b' : '#ffffff',
        backgroundColor: dark ? '#1e293b' : '#ffffff',
        primaryColor:    '#0079C8',
        textColor:       dark ? '#e2e8f0' : '#334155',
        overlayColor:    'rgba(0,0,0,0.55)',
        zIndex:          10000,
      }}
      locale={{ back: 'Voltar', close: 'Fechar', last: 'Concluir', next: 'Próximo', skip: 'Pular' }}
      onEvent={data => {
        if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) onClose()
      }}
    />
  )
}
