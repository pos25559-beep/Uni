import { driver, type DriveStep } from 'driver.js';
import { tr } from '../i18n/tr';
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
        title: tr('onboarding:tour.welcomeTitle'),
        description: tr('onboarding:tour.welcomeDesc'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      selector: '[data-tour="bento-overview"]',
      popover: {
        title: tr('onboarding:tour.progressTitle'),
        description: tr('onboarding:tour.progressDesc'),
        side: 'bottom',
        align: isMobile ? 'center' : 'start',
      },
    },
    {
      selector: '[data-tour="nav-cadeiras"]',
      popover: {
        title: tr('onboarding:tour.coursesTitle'),
        description: tr('onboarding:tour.coursesDesc'),
        side: isMobile ? 'top' : 'right',
        align: 'center',
      },
    },
    {
      selector: '[data-tour="nav-plano"]',
      popover: {
        title: tr('onboarding:tour.planTitle'),
        description: tr('onboarding:tour.planDesc'),
        side: isMobile ? 'top' : 'right',
        align: 'center',
      },
    },
    {
      selector: '[data-tour="nav-assistente"]',
      popover: {
        title: tr('onboarding:tour.tutorTitle'),
        description: tr('onboarding:tour.tutorDesc'),
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
    nextBtnText: tr('onboarding:tour.next'),
    prevBtnText: tr('onboarding:tour.prev'),
    doneBtnText: tr('onboarding:tour.done'),
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
