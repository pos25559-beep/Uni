import { PageHeader } from '../components/ui';
import ClipCard from '../components/settings/ClipCard';
import DataCard from '../components/settings/DataCard';
import GeminiCard from '../components/settings/GeminiCard';
import GoogleCard from '../components/settings/GoogleCard';
import MicrosoftCard from '../components/settings/MicrosoftCard';
import NotebookCard from '../components/settings/NotebookCard';
import ProfileCard from '../components/settings/ProfileCard';

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Definições"
        subtitle="Perfil, semestre e as ligações às tuas fontes de dados."
      />

      <div className="space-y-8">
        <ProfileCard />

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Fontes de dados</h2>
            <p className="mt-1 text-sm text-muted">Liga o que usas. Cada fonte mostra o estado e como configurar.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <GoogleCard />
            <MicrosoftCard />
            <GeminiCard />
            <ClipCard />
            <NotebookCard />
          </div>
        </section>

        <DataCard />
      </div>
    </>
  );
}
