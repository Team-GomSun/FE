'use client';
import logo from '@/assets/logo.svg';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-2">
      <div className="flex w-full max-w-2xl flex-row items-center justify-center gap-4 md:gap-12">
        <div className="w-auto flex-shrink text-center md:text-left">
          <div className="font-blackhansans text-6xl leading-tight font-light tracking-tight text-[#353535] md:text-7xl">
            뻐미
          </div>
          <div className="font-blackhansans font-light tracking-tight text-[#353535] md:text-xl">
            나의 버스 도우미
          </div>
        </div>
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="flex w-auto items-center justify-center"
        >
          <Image
            src={logo}
            alt="뻐미 로고"
            width={80}
            height={80}
            className="h-20 w-20 md:h-52 md:w-52"
            priority
          />
        </motion.div>
      </div>
    </div>
  );
}
