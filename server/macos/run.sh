#!/bin/zsh
# 로또 찐번호 후기 서버 실행 (launchd 가 부른다)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export LOTTO_DATA="$HOME/LottoData"
export PORT=3400
cd "$HOME/LottoServer" || exit 1
exec /opt/homebrew/bin/fnm exec --using=24 node --disable-warning=ExperimentalWarning reviews-server.mjs
