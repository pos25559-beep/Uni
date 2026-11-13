import { useNavigate } from 'react-router-dom';
import OnboardingExperience from '../components/onboarding/OnboardingExperience';

export default function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <OnboardingExperience
      fullScreen
      onClose={() => navigate('/', { replace: true })}
    />
  );
}
