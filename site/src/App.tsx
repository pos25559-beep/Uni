import { MotionConfig } from 'motion/react';
import { LangContext, type Lang } from './i18n';
import { Faq, FinalCta, Footer } from './sections/Closing';
import Hero from './sections/Hero';
import How, { PromiseStrip } from './sections/How';
import Moments from './sections/Moments';
import Nav from './sections/Nav';
import { Principles, Privacy, Uni } from './sections/Story';

export default function App({ lang }: { lang: Lang }) {
  return (
    <LangContext.Provider value={lang}>
      <MotionConfig reducedMotion="user">
        <Nav />
        <main>
          <Hero />
          <PromiseStrip />
          <How />
          <Moments />
          <Principles />
          <Uni />
          <Privacy />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </MotionConfig>
    </LangContext.Provider>
  );
}
