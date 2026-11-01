#!/bin/zsh
# 맥미니에서 후기 서버 켜기/끄기/다시 시작
#   zsh ~/LottoServer/macos/install.sh on       자동 실행 등록하고 켜기
#   zsh ~/LottoServer/macos/install.sh restart  코드 바꾼 뒤 다시 시작
#   zsh ~/LottoServer/macos/install.sh off      끄고 자동 실행 해제
set -e
LABEL=com.sobunmart.lotto-reviews
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/LottoData/logs" "$HOME/LottoData/backups"

case "$1" in
  on)
    sed "s|__HOME__|$HOME|g" "$HOME/LottoServer/macos/$LABEL.plist" > "$PLIST"
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "켰어요: $LABEL"
    ;;
  restart)
    launchctl kickstart -k "gui/$(id -u)/$LABEL"
    echo "다시 시작했어요"
    ;;
  off)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "껐어요"
    ;;
  *)
    echo "사용법: install.sh on | restart | off"
    ;;
esac
