import { MotionConfig } from 'motion/react';
import { LangContext } from './i18n';
import Feature from './pages/Feature';
import Home from './pages/Home';
import { RouteContext, type Route } from './routes';
import { Footer } from './sections/Closing';
import Nav from './sections/Nav';

export default function App({ route }: { route: Route }) {
  return (
    <RouteContext.Provider value={route}>
      <LangContext.Provider value={route.lang}>
        <MotionConfig reducedMotion="user">
          <Nav />
          <main>{route.page === 'home' ? <Home /> : <Feature id={route.page} />}</main>
          <Footer />
        </MotionConfig>
      </LangContext.Provider>
    </RouteContext.Provider>
  );
}
