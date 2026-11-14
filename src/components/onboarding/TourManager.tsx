import { driver, type DriveStep } from 'driver.js';
import { useStore } from '../../store/useStore';

let activeTourInstance: ReturnType<typeof driver> | null = null;

export function startUnipediaGuidedTour(onComplete?: () => void): void {
  if (activeTourInstance) {
    activeTourInstance.destroy();
    activeTourInstance = null;
  }

  const steps: DriveStep[] = [
    {
      popover: {
        title: 'Bem-vindo à nova Unipedia',
        description:
          'Este é o teu painel «Hoje»: junta sequência de estudo, alertas de exames e as tuas aulas do dia num relance.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="bento-overview"]',
      popover: {
        title: 'Progresso em tempo real',
        description:
          'Acompanha prontidão, horas estudadas na semana, média do percurso e tarefas pendentes.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-cadeiras"]',
      popover: {
        title: 'Cadeiras e Disciplinas',
        description:
          'Gere tópicos, confiança (1–5), notas necessárias e ligações diretas ao teu curso.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="nav-plano"]',
      popover: {
        title: 'Plano de 14 dias & Foco',
        description:
          'Blocos gerados automaticamente por prioridade de avaliações, com temporizador integrado.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="nav-assistente"]',
      popover: {
        title: 'Uni · O teu Tutor IA',
        description:
          'Tira dúvidas com base nas tuas cadeiras e apontamentos sempre que quiseres.',
        side: 'top',
        align: 'center',
      },
    },
  ];

  const availableSteps = steps.filter(
    (step) => !step.element || Boolean(document.querySelector(String(step.element))),
  );

  const instance = driver({
    showProgress: true,
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    allowClose: true,
    overlayOpacity: 0.42,
    popoverClass: 'unipedia-tour-popover',
    nextBtnText: 'Seguinte',
    prevBtnText: 'Anterior',
    doneBtnText: 'Começar a estudar',
    progressText: '{{current}} / {{total}}',
    steps: availableSteps,
    onDestroyed: () => {
      activeTourInstance = null;
      useStore.getState().updateSettings({ tourCompleted: true });
      onComplete?.();
    },
  });

  activeTourInstance = instance;
  instance.drive();
}

export default function TourManager() {
  // Tour guiado apenas manual (a partir das Definições → Ajuda) para não interromper a primeira entrada.
  return null;
}
