// import { postUserLocation } from '@/app/api/postUsersLocation';
// import { getUserId } from '@/app/api/userUtils';

// class SimpleLocationTracker {
//   private intervalId: number | null = null;
//   private updateIntervalMs: number = 100000; // 위치 업데이트 주기 (시간)
//   private onNoNearbyBusStops: ((message: string) => void) | null = null;
//   private onNearbyBusStopsFound: (() => void) | null = null;
//   private _nearbyBusStopsExist: boolean = true;

//   public setNoNearbyBusStopsCallback(callback: (message: string) => void): void {
//     this.onNoNearbyBusStops = callback;
//   }

//   public setNearbyBusStopsFoundCallback(callback: () => void): void {
//     this.onNearbyBusStopsFound = callback;
//   }

//   public hasNearbyBusStops(): boolean {
//     return this._nearbyBusStopsExist;
//   }

//   public startTracking(): boolean {
//     if (this.intervalId !== null) {
//       return true;
//     }

//     const userId = getUserId();
//     if (!userId) {
//       console.error('사용자 ID가 없어 위치 추적을 시작할 수 없습니다.');
//       return false;
//     }

//     if (!navigator.geolocation) {
//       console.error('이 브라우저는 위치 정보를 지원하지 않습니다.');
//       return false;
//     }

//     this.sendLocationToServer();

//     this.intervalId = window.setInterval(() => {
//       this.sendLocationToServer();
//     }, this.updateIntervalMs);

//     console.log('위치 추적이 시작되었습니다.');
//     return true;
//   }

//   public stopTracking(): void {
//     if (this.intervalId !== null) {
//       window.clearInterval(this.intervalId);
//       this.intervalId = null;
//       console.log('위치 추적이 중지되었습니다.');
//     }
//   }

//   private sendLocationToServer(): void {
//     navigator.geolocation.getCurrentPosition(
//       async (position) => {
//         const { latitude, longitude } = position.coords;
//         try {
//           const response = await postUserLocation({ latitude, longitude });
//           if (!response.isSuccess) {
//             console.error('위치 정보 전송 실패:', response.message);
//             if (response.code === 400) {
//               this.stopTracking();
//             }
//           } else {
//             console.log('위치 정보가 성공적으로 전송되었습니다.', new Date().toLocaleTimeString());

//             if (response.code === 20001) {
//               console.log('주변에 버스 정류소가 존재하지 않습니다.');
//               this._nearbyBusStopsExist = false;
//               if (this.onNoNearbyBusStops) {
//                 this.onNoNearbyBusStops(response.message);
//               }
//             } else {
//               console.log('주변에 버스 정류장이 존재합니다.');
//               this._nearbyBusStopsExist = true;
//               if (this.onNearbyBusStopsFound) {
//                 this.onNearbyBusStopsFound();
//               }
//             }
//           }
//         } catch (error) {
//           console.error('위치 정보 전송 중 오류 발생:', error);
//         }
//       },
//       (error) => {
//         console.error('위치 정보 가져오기 실패:', error.message);

//         if (error.code === error.PERMISSION_DENIED) {
//           this.stopTracking();
//         }
//       },
//       {
//         enableHighAccuracy: true,
//         maximumAge: 0,
//         timeout: 5000,
//       },
//     );
//   }

//   public isTracking(): boolean {
//     return this.intervalId !== null;
//   }
// }

// const locationTracker = new SimpleLocationTracker();

// export default locationTracker;
// hooks/locationTracker.ts
// hooks/locationTracker.ts
import { getUserId } from '@/app/api/userUtils';
import locationWebSocket from './locationWsTracker';
class SimpleLocationTracker {
  private intervalId: NodeJS.Timeout | null = null;
  private updateIntervalMs: number = 100000; // 위치 업데이트 주기 (시간)
  private onNoNearbyBusStops: ((message: string) => void) | null = null;
  private onNearbyBusStopsFound: (() => void) | null = null;
  private _nearbyBusStopsExist: boolean = true;
  private isWebSocketInitialized: boolean = false;

  public setNoNearbyBusStopsCallback(callback: (message: string) => void): void {
    this.onNoNearbyBusStops = callback;
  }

  public setNearbyBusStopsFoundCallback(callback: () => void): void {
    this.onNearbyBusStopsFound = callback;
  }

  public hasNearbyBusStops(): boolean {
    return this._nearbyBusStopsExist;
  }

  private initializeWebSocket(): void {
    if (this.isWebSocketInitialized) return;

    locationWebSocket.setOnMessageCallback((response) => {
      if (!response.isSuccess) {
        if (response.code === 400) {
          this.stopTracking();
        }
        return;
      }

      if (response.code === 20001) {
        this._nearbyBusStopsExist = false;
        if (this.onNoNearbyBusStops) {
          this.onNoNearbyBusStops(response.message);
        }
      } else {
        this._nearbyBusStopsExist = true;
        if (this.onNearbyBusStopsFound) {
          this.onNearbyBusStopsFound();
        }
      }
    });

    locationWebSocket.setOnErrorCallback((error) => {
      console.error('WebSocket 에러:', error);
    });

    locationWebSocket.setOnConnectCallback(() => {});

    locationWebSocket.setOnDisconnectCallback(() => {});

    this.isWebSocketInitialized = true;
  }

  public startTracking(): boolean {
    if (this.intervalId !== null) {
      return true;
    }

    const userId = getUserId();
    if (!userId) {
      return false;
    }

    if (!navigator.geolocation) {
      return false;
    }

    this.initializeWebSocket();
    locationWebSocket.connect();

    this.sendLocationToServer();

    this.intervalId = setInterval(() => {
      this.sendLocationToServer();
    }, this.updateIntervalMs) as NodeJS.Timeout;

    return true;
  }

  public stopTracking(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    locationWebSocket.disconnect();
  }

  private sendLocationToServer(): void {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const isConnected = locationWebSocket.isConnectedToServer();

          if (!isConnected) {
            locationWebSocket.connect();
            return;
          }

          const success = locationWebSocket.sendLocation({
            latitude,
            longitude,
          });

          if (success) {
          } else {
            if (!locationWebSocket.isConnectedToServer()) {
              locationWebSocket.connect();
            }
          }
        } catch (error) {
          console.error(error);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          this.stopTracking();
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      },
    );
  }

  public isTracking(): boolean {
    return this.intervalId !== null;
  }

  public isWebSocketConnected(): boolean {
    return locationWebSocket.isConnectedToServer();
  }
}

const locationTracker = new SimpleLocationTracker();

export default locationTracker;
