#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 필요해요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요."
  open "https://nodejs.org/"
  exit 1
fi
if [ ! -d node_modules/electron ]; then
  echo "처음 실행이라 설치하는 중이에요 (1~3분)..."
  npm install --no-audit --no-fund || { echo "설치에 실패했어요. 인터넷 연결을 확인해 주세요."; exit 1; }
fi
nohup ./node_modules/.bin/electron . >/dev/null 2>&1 &
echo "몬스터 둥지를 실행했어요. 이 창은 닫아도 돼요."
