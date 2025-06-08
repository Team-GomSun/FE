'use client';

import HeroSection from '@/components/HeroSection';
import OnboardingSlides from '@/components/OnboardingSlides';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');

    if (hasSeenOnboarding === 'true') {
      router.push('/BusSearch');
    } else {
      const timer = setTimeout(() => setShowOnboarding(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [router]);

  useEffect(() => {
    if (onboardingDone) {
      localStorage.setItem('hasSeenOnboarding', 'true');
      router.push('/BusSearch');
    }
  }, [onboardingDone, router]);

  if (!showOnboarding) {
    return <HeroSection />;
  }

  return <OnboardingSlides onDone={() => setOnboardingDone(true)} />;
}
