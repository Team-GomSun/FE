/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client';

import LogRocket from 'logrocket';
import { useEffect, useRef } from 'react';

export default function LogRocketProvider() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      LogRocket.init('tquw2v/groomi', {
        maxMemoryUsage: 60,

        dom: {
          isEnabled: false,
        },

        network: {
          isEnabled: false,
        },

        // 콘솔 로깅 - fields 관련 로그만 필터링
        console: {
          isEnabled: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          logFilter: (log: { args: string | any[] }) => {
            if (!log.args || !Array.isArray(log.args) || log.args.length === 0) {
              return false;
            }

            const firstArg = log.args[0];
            if (typeof firstArg !== 'string' && !(firstArg instanceof String)) {
              return false;
            }

            return firstArg.includes('fields 전체 내용');
          },
        },

        react: {
          isEnabled: false,
        },

        redux: {
          isEnabled: false,
        },
      });

      console.log('LogRocket 초기화 완료 - fields 로깅에만 최적화됨');
    } catch (error) {
      console.error('LogRocket 초기화 오류:', error);
    }
  }, []);

  return null;
}
