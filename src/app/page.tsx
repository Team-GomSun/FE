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
    const timer = setTimeout(() => setShowOnboarding(true), 3000); // 3초 후 온보딩
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (onboardingDone) {
      router.push('/BusSearch');
    }
  }, [onboardingDone, router]);

  if (!showOnboarding) {
    return <HeroSection />;
  }

  return <OnboardingSlides onDone={() => setOnboardingDone(true)} />;
}
