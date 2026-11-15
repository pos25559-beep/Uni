import { driver, type DriveStep } from 'driver.js';
import { useStore } from '../store/useStore';

let activeTourInstance: ReturnType<typeof driver> | null = null;

function findVisibleTourTarget(selector: string): Element | undefined {
  const matches = Array.from(document.querySelectorAll(selector));
  return matches.find((el) => {
    const rect = el.getBoundingClientRect();
    return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  });
}

export function startUnipediaGuidedTour(onComplete?: () => void): void {
  if (activeTourInstance) {
    activeTourInstance.destroy();
    activeTourInstance = null;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const stepConfigs: Array<{
    selector?: string;
    popover: NonNullable<DriveStep['popover']>;
  }> = [
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
      selector: '[data-tour="bento-overview"]',
      popover: {
        title: 'Progresso em tempo real',
        description:
          'Acompanha prontidão, horas estudadas na semana, média do percurso e sessões agendadas.',
        side: 'bottom',
        align: isMobile ? 'center' : 'start',
      },
    },
    {
      selector: '[data-tour="nav-cadeiras"]',
      popover: {
        title: 'Cadeiras e Disciplinas',
        description:
          'Gere tópicos, confiança (1–5), notas necessárias e ligações diretas ao teu curso.',
        side: isMobile ? 'top' : 'right',
        align: 'center',
      },
    },
    {
      selector: '[data-tour="nav-plano"]',
      popover: {
        title: 'Plano de 14 dias & Foco',
        description:
          'Blocos gerados automaticamente por prioridade de avaliações, com temporizador integrado.',
        side: isMobile ? 'top' : 'right',
        align: 'center',
      },
    },
    {
      selector: '[data-tour="nav-assistente"]',
      popover: {
        title: 'Uni · O teu Tutor IA',
        description:
          'Tira dúvidas com base nas tuas cadeiras e apontamentos sempre que quiseres.',
        side: isMobile ? 'top' : 'right',
        align: 'center',
      },
    },
  ];

  const availableSteps: DriveStep[] = [];
  for (const cfg of stepConfigs) {
    if (!cfg.selector) {
      availableSteps.push({ popover: cfg.popover });
      continue;
    }
    const target = findVisibleTourTarget(cfg.selector);
    if (target) {
      availableSteps.push({
        element: target,
        popover: cfg.popover,
      });
    }
  }

  const instance = driver({
    showProgress: true,
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    smoothScroll: true,
    stagePadding: isMobile ? 6 : 10,
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
