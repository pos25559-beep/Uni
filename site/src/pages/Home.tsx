import { Faq, FinalCta } from '../sections/Closing';
import Hero from '../sections/Hero';
import How, { PromiseStrip } from '../sections/How';
import Moments from '../sections/Moments';
import { Principles, Privacy, Uni } from '../sections/Story';
import { Explore } from './Feature';

export default function Home() {
  return (
    <>
      <Hero />
      <PromiseStrip />
      <How />
      <Moments />
      <Principles />
      <Uni />
      <Privacy />
      <Explore />
      <Faq />
      <FinalCta />
    </>
  );
}
