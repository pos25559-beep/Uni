import { Faq, FinalCta } from '../sections/Closing';
import Hero from '../sections/Hero';
import How, { PromiseStrip } from '../sections/How';
import Moments from '../sections/Moments';
import { Principles, Uni } from '../sections/Story';
import { Explore } from './Feature';

/** Página inicial: hero, promessa, como funciona, os Unis, momentos, princípios, áreas, perguntas e convite. */
export default function Home() {
  return (
    <>
      <Hero />
      <PromiseStrip />
      <How />
      <Uni />
      <Moments />
      <Principles />
      <Explore />
      <Faq />
      <FinalCta />
    </>
  );
}
