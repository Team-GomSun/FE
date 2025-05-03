export const saveUserId = (userId: number | string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userId', userId.toString());
    console.log('사용자 ID 저장 완료:', userId);
  }
};

export const getUserId = (): number | null => {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('userId');
    return userId ? parseInt(userId, 10) : null;
  }
  return null;
};

export const hasUserId = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('userId') !== null;
  }
  return false;
};

export const clearUserId = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('userId');
    console.log('사용자 ID 삭제 완료');
  }
};

export const saveBusNumber = (busNumber: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('busNumber', busNumber);
    console.log('버스 번호 저장 완료:', busNumber);
  }
};

export const getBusNumber = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('busNumber');
  }
  return null;
};

export const hasBusNumber = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('busNumber') !== null;
  }
  return false;
};

export const clearBusNumber = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('busNumber');
    console.log('버스 번호 삭제 완료');
  }
};

export const clearUserData = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('userId');
    localStorage.removeItem('busNumber');
    console.log('사용자 데이터 삭제 완료');
  }
};
