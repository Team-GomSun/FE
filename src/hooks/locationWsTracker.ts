import { getUserId } from '@/app/api/userUtils';

export interface LocationData {
  userId?: number;
  latitude: number;
  longitude: number;
}

export interface WebSocketResponse {
  isSuccess: boolean;
  code: number;
  message: string;
}

export type WebSocketErrorEvent = Event;

interface WebSocketState {
  ws: WebSocket | null;
  reconnectTimeoutRef: NodeJS.Timeout | null;
  reconnectAttempts: number;
  isConnected: boolean;
  onMessageCallback: ((response: WebSocketResponse) => void) | null;
  onErrorCallback: ((error: WebSocketErrorEvent | Error) => void) | null;
  onConnectCallback: (() => void) | null;
  onDisconnectCallback: (() => void) | null;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const SERVER_URL = 'wss://api.gooroomi.p-e.kr/ws/location';

const state: WebSocketState = {
  ws: null,
  reconnectTimeoutRef: null,
  reconnectAttempts: 0,
  isConnected: false,
  onMessageCallback: null,
  onErrorCallback: null,
  onConnectCallback: null,
  onDisconnectCallback: null,
};

export function setOnMessageCallback(callback: (response: WebSocketResponse) => void): void {
  state.onMessageCallback = callback;
}

export function setOnErrorCallback(callback: (error: WebSocketErrorEvent | Error) => void): void {
  state.onErrorCallback = callback;
}

export function setOnConnectCallback(callback: () => void): void {
  state.onConnectCallback = callback;
}

export function setOnDisconnectCallback(callback: () => void): void {
  state.onDisconnectCallback = callback;
}

export function connect(): boolean {
  if (state.isConnected) {
    return true;
  }

  try {
    state.reconnectAttempts = 0;
    console.log('WebSocket 연결 시도 중...');
    state.ws = new WebSocket(SERVER_URL);

    state.ws.onopen = () => {
      console.log('WebSocket 연결 성공');
      state.isConnected = true;
      if (state.onConnectCallback) {
        state.onConnectCallback();
      }
    };

    state.ws.onclose = (event: CloseEvent) => {
      console.log('WebSocket 연결 종료:', event);
      state.isConnected = false;
      if (state.onDisconnectCallback) {
        state.onDisconnectCallback();
      }

      if (!event.wasClean && state.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        state.reconnectAttempts += 1;
        console.log(
          `${RECONNECT_DELAY / 1000}초 후 재연결 시도 (${state.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
        );

        if (state.reconnectTimeoutRef) {
          clearTimeout(state.reconnectTimeoutRef);
        }

        state.reconnectTimeoutRef = setTimeout(() => {
          console.log('재연결 시도 중...');
          connect();
        }, RECONNECT_DELAY);
      } else if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('최대 재연결 시도 횟수 초과. 수동으로 연결해주세요.');
      }
    };

    state.ws.onerror = (event: Event) => {
      console.error('WebSocket 에러 발생:', event);
      if (state.onErrorCallback) {
        state.onErrorCallback(event);
      }
    };

    state.ws.onmessage = (event: MessageEvent) => {
      console.log('메시지 수신:', event.data);
      try {
        const response = JSON.parse(event.data) as WebSocketResponse;
        if (state.onMessageCallback) {
          state.onMessageCallback(response);
        }
      } catch (error) {
        console.error('메시지 파싱 오류:', error);
        if (state.onErrorCallback && error instanceof Error) {
          state.onErrorCallback(error);
        }
      }
    };

    return true;
  } catch (error) {
    console.error('WebSocket 연결 중 예외 발생:', error);
    if (state.onErrorCallback && error instanceof Error) {
      state.onErrorCallback(error);
    }
    return false;
  }
}

export function sendLocation(data: LocationData): boolean {
  if (!state.isConnected || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket이 연결되어 있지 않습니다.');
    return false;
  }

  try {
    const userId = getUserId();
    if (!userId) {
      console.error('사용자 ID를 찾을 수 없습니다.');
      return false;
    }

    const locationData = {
      ...data,
      userId,
    };

    state.ws.send(JSON.stringify(locationData));
    console.log('위치 정보 전송:', locationData);
    return true;
  } catch (error) {
    console.error('위치 정보 전송 실패:', error);
    if (state.onErrorCallback && error instanceof Error) {
      state.onErrorCallback(error);
    }
    return false;
  }
}

export function disconnect(): void {
  if (state.ws) {
    state.ws.close();
    state.isConnected = false;
  }

  if (state.reconnectTimeoutRef) {
    clearTimeout(state.reconnectTimeoutRef);
    state.reconnectTimeoutRef = null;
  }
}

export function isConnectedToServer(): boolean {
  return state.isConnected;
}

const locationWebSocket = {
  setOnMessageCallback,
  setOnErrorCallback,
  setOnConnectCallback,
  setOnDisconnectCallback,
  connect,
  sendLocation,
  disconnect,
  isConnectedToServer,
};

export default locationWebSocket;
