#!/bin/bash
set -euo pipefail

# .env 파일에서 환경변수 불러오기
if [ -f .env ]; then
  source .env
else
  echo ".env 파일이 존재하지 않습니다."
  exit 1
fi

# NGROK_AUTH_TOKEN이 설정되었는지 확인
if [ -z "$NGROK_AUTH_TOKEN" ]; then
  echo "NGROK_AUTH_TOKEN이 .env 파일에 설정되지 않았습니다."
  echo ".env 파일에 NGROK_AUTH_TOKEN=your_token을 추가하세요."
  exit 1
fi

# Docker 컨테이너 시작
docker compose up -d

# ngrok URL 가져오기 (약간의 시간이 필요할 수 있음)
echo "ngrok을 시작하는 중... 10초 후 URL을 확인합니다."
sleep 10

# ngrok API에서 URL 가져오기
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https:[^"]*' | sed 's/"public_url":"//g')

if [ -n "$NGROK_URL" ]; then
  echo "========================================"
  echo "애플리케이션이 다음 URL에서 실행 중입니다:"
  echo "$NGROK_URL"
  echo "========================================"
  echo "로컬 개발 서버: http://localhost:3000"
  echo "ngrok 관리 패널: http://localhost:4040"
else
  echo "ngrok URL을 가져올 수 없습니다. 직접 http://localhost:4040에서 확인하세요."
fi

echo "로그를 보려면 다음 명령어를 실행하세요: docker compose logs -f"
