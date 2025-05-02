export const saveUserId = (userId: number | string): void => {
  localStorage.setItem('userId', userId.toString());
  console.log('사용자 ID 저장 완료:', userId);
};

export const getUserId = (): number | null => {
  const userId = localStorage.getItem('userId');
  return userId ? parseInt(userId, 10) : null;
};

export const hasUserId = (): boolean => {
  return localStorage.getItem('userId') !== null;
};

export const clearUserId = (): void => {
  localStorage.removeItem('userId');
  console.log('사용자 ID 삭제 완료');
};
