import { LocationResponse } from '@/app/api/postUsersLocation';
import { getUserId } from '@/app/api/userUtils';
import locationWebSocket, { WebSocketErrorEvent, WebSocketResponse } from './locationWebSocket';

class SimpleLocationTracker {
  private intervalId: number | null = null;
  private updateIntervalMs: number = 100000; // 위치 업데이트 주기 (시간)
  private onNoNearbyBusStops: ((message: string) => void) | null = null;
  private onNearbyBusStopsFound: (() => void) | null = null;
  private _nearbyBusStopsExist: boolean = true;
  private useWebSocket: boolean = false;

  // 성능 측정을 위한 변수들
  private restApiLatencies: number[] = [];
  private websocketLatencies: number[] = [];
  private restApiStartTime: number = 0;
  private websocketStartTime: number = 0;

  public setNoNearbyBusStopsCallback(callback: (message: string) => void): void {
    this.onNoNearbyBusStops = callback;
  }

  public setNearbyBusStopsFoundCallback(callback: () => void): void {
    this.onNearbyBusStopsFound = callback;
  }

  public hasNearbyBusStops(): boolean {
    return this._nearbyBusStopsExist;
  }

  public enableWebSocket(enable: boolean = true): void {
    this.useWebSocket = enable;

    // WebSocket 사용 시 설정
    if (this.useWebSocket) {
      locationWebSocket.setOnMessageCallback((response: WebSocketResponse) => {
        this.handleServerResponse(response);
      });

      locationWebSocket.setOnErrorCallback((error: WebSocketErrorEvent | Error) => {
        console.error('WebSocket 에러:', error);
      });

      // WebSocket 연결
      if (this.isTracking()) {
        locationWebSocket.connect();
      }
    } else {
      // WebSocket 중지
      locationWebSocket.disconnect();
    }
  }

  public isUsingWebSocket(): boolean {
    return this.useWebSocket;
  }

  public startTracking(): boolean {
    if (this.intervalId !== null) {
      return true;
    }

    const userId = getUserId();
    if (!userId) {
      console.error('사용자 ID가 없어 위치 추적을 시작할 수 없습니다.');
      return false;
    }

    if (!navigator.geolocation) {
      console.error('이 브라우저는 위치 정보를 지원하지 않습니다.');
      return false;
    }

    // WebSocket 사용 시 연결
    if (this.useWebSocket) {
      locationWebSocket.connect();
    }

    this.sendLocationToServer();
    this.intervalId = window.setInterval(() => {
      this.sendLocationToServer();
    }, this.updateIntervalMs);

    console.log('위치 추적이 시작되었습니다.');
    return true;
  }

  public stopTracking(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('위치 추적이 중지되었습니다.');
    }

    // WebSocket 연결 중지
    if (this.useWebSocket) {
      locationWebSocket.disconnect();
    }
  }

  private sendLocationToServer(): void {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        if (this.useWebSocket) {
          // WebSocket을 통한 위치 전송
          if (!locationWebSocket.isConnectedToServer()) {
            locationWebSocket.connect();
          }

          const success = locationWebSocket.sendLocation({ latitude, longitude });
          if (!success) {
            console.error('WebSocket을 통한 위치 정보 전송 실패');
            // 실패 시 REST API 폴백
            this.sendLocationViaREST({ latitude, longitude });
          }
        } else {
          // REST API를 통한 위치 전송
          this.sendLocationViaREST({ latitude, longitude });
        }
      },
      (error: GeolocationPositionError) => {
        console.error('위치 정보 가져오기 실패:', error.message);
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

  private async sendLocationViaREST(coords: {
    latitude: number;
    longitude: number;
  }): Promise<void> {
    /* API 요청 부분 주석 처리
    try {
      // 기존 REST API 사용 코드
      const response = await postUserLocation(coords);
      this.handleServerResponse(response);
    } catch (error) {
      console.error('위치 정보 전송 중 오류 발생:', error);
    }
    */

    // 대신 콘솔에 로그만 출력
    console.log('REST API로 위치 정보 전송 (주석 처리됨):', coords);
  }

  // 서버 응답 처리 공통 메서드
  private handleServerResponse(response: WebSocketResponse | LocationResponse): void {
    if (!response.isSuccess) {
      console.error('위치 정보 전송 실패:', response.message);
      if (response.code === 400) {
        this.stopTracking();
      }
    } else {
      console.log('위치 정보가 성공적으로 전송되었습니다.', new Date().toLocaleTimeString());
      if (response.code === 20001) {
        console.log('주변에 버스 정류소가 존재하지 않습니다.');
        this._nearbyBusStopsExist = false;
        if (this.onNoNearbyBusStops) {
          this.onNoNearbyBusStops(response.message);
        }
      } else {
        console.log('주변에 버스 정류장이 존재합니다.');
        this._nearbyBusStopsExist = true;
        if (this.onNearbyBusStopsFound) {
          this.onNearbyBusStopsFound();
        }
      }
    }
  }

  public isTracking(): boolean {
    return this.intervalId !== null;
  }

  private measureRestApiPerformance(startTime: number) {
    const latency = Date.now() - startTime;
    this.restApiLatencies.push(latency);
    console.log(`REST API 요청 지연시간: ${latency}ms`);
    const avgLatency =
      this.restApiLatencies.reduce((a, b) => a + b, 0) / this.restApiLatencies.length;
    console.log(`REST API 평균 지연시간: ${avgLatency.toFixed(2)}ms`);
  }

  private measureWebSocketPerformance(startTime: number) {
    const latency = Date.now() - startTime;
    this.websocketLatencies.push(latency);
    console.log(`WebSocket 메시지 지연시간: ${latency}ms`);
    const avgLatency =
      this.websocketLatencies.reduce((a, b) => a + b, 0) / this.websocketLatencies.length;
    console.log(`WebSocket 평균 지연시간: ${avgLatency.toFixed(2)}ms`);
  }

  // REST API 요청 메서드 수정
  private async fetchLocationRestApi() {
    this.restApiStartTime = Date.now();
    // ... 기존 REST API 요청 코드 ...
    this.measureRestApiPerformance(this.restApiStartTime);
  }

  // WebSocket 메시지 핸들러 수정
  // private handleWebSocketMessage(event: MessageEvent) {
  //   this.websocketStartTime = Date.now();
  //   // ... 기존 WebSocket 메시지 처리 코드 ...
  //   this.measureWebSocketPerformance(this.websocketStartTime);
  // }
}

const locationTracker = new SimpleLocationTracker();
export default locationTracker;

/* 기존 코드 주석 처리
import { postUserLocation } from '@/app/api/postUsersLocation';
import { getUserId } from '@/app/api/userUtils';
class SimpleLocationTracker {
  private intervalId: number | null = null;
  private updateIntervalMs: number = 100000; // 위치 업데이트 주기 (시간)
  private onNoNearbyBusStops: ((message: string) => void) | null = null;
  private onNearbyBusStopsFound: (() => void) | null = null;
  private _nearbyBusStopsExist: boolean = true;
  public setNoNearbyBusStopsCallback(callback: (message: string) => void): void {
    this.onNoNearbyBusStops = callback;
  }
  public setNearbyBusStopsFoundCallback(callback: () => void): void {
    this.onNearbyBusStopsFound = callback;
  }
  public hasNearbyBusStops(): boolean {
    return this._nearbyBusStopsExist;
  }
  public startTracking(): boolean {
    if (this.intervalId !== null) {
      return true;
    }
    const userId = getUserId();
    if (!userId) {
      console.error('사용자 ID가 없어 위치 추적을 시작할 수 없습니다.');
      return false;
    }
    if (!navigator.geolocation) {
      console.error('이 브라우저는 위치 정보를 지원하지 않습니다.');
      return false;
    }
    this.sendLocationToServer();
    this.intervalId = window.setInterval(() => {
      this.sendLocationToServer();
    }, this.updateIntervalMs);
    console.log('위치 추적이 시작되었습니다.');
    return true;
  }
  public stopTracking(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('위치 추적이 중지되었습니다.');
    }
  }
  private sendLocationToServer(): void {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await postUserLocation({ latitude, longitude });
          if (!response.isSuccess) {
            console.error('위치 정보 전송 실패:', response.message);
            if (response.code === 400) {
              this.stopTracking();
            }
          } else {
            console.log('위치 정보가 성공적으로 전송되었습니다.', new Date().toLocaleTimeString());
            if (response.code === 20001) {
              console.log('주변에 버스 정류소가 존재하지 않습니다.');
              this._nearbyBusStopsExist = false;
              if (this.onNoNearbyBusStops) {
                this.onNoNearbyBusStops(response.message);
              }
            } else {
              console.log('주변에 버스 정류장이 존재합니다.');
              this._nearbyBusStopsExist = true;
              if (this.onNearbyBusStopsFound) {
                this.onNearbyBusStopsFound();
              }
            }
          }
        } catch (error) {
          console.error('위치 정보 전송 중 오류 발생:', error);
        }
      },
      (error) => {
        console.error('위치 정보 가져오기 실패:', error.message);
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
}
const locationTracker = new SimpleLocationTracker();
export default locationTracker;
*/
