module.exports = {
  apps: [
    // --- 기존 에이전트 설정 ---
    {
      name: "agile-thought-leader",
      script: "node",
      args: "--loader ts-node/esm src/index.ts --character=characters/ceo_agilethoughtleader.v5R.json",
      cwd: "/Users/jj/eliza-starter",
      max_memory_restart: "1000M",
      autorestart: true,
      watch: false,
      max_restarts: 4,          // 추가
      restart_delay: 30000,     // 추가
      min_uptime: "5m",        // 추가
      env: {
        PORT: 3000
    }
    },
    {
      name: "community-mentor",
      script: "node",
      args: "--loader ts-node/esm src/index.ts --character=characters/ceo_communitymentor.v2R.json",
      cwd: "/Users/jj/eliza-starter",
      max_memory_restart: "1000M",
      autorestart: true,
      watch: false,
      max_restarts: 4,          // 추가
      restart_delay: 30000,     // 추가
      min_uptime: "5m",        // 추가
      env: {
        PORT: 3001
    }
    },
    {
      name: "information-concierge",
      script: "node",
      args: "--loader ts-node/esm src/index.ts --character=characters/ceo_informationconcierge.v2R.json",
      cwd: "/Users/jj/eliza-starter",
      max_memory_restart: "1000M",
      autorestart: true,
      watch: false,
      max_restarts: 4,          // 추가
      restart_delay: 30000,     // 추가
      min_uptime: "5m",        // 추가
      env: {
        PORT: 3002
    }
    },
    
    // --- 2. 알림 모듈 앱 설정 ---
    {
      name: "pm2-discord-webhook",
      // 프로젝트 내부에 설치된 스크립트의 상대 경로를 직접 지정
      script: "./node_modules/pm2-discord-webhook/app.js",
      watch: false,
      autorestart: true,
      // ★★★★★ 이 부분이 모든 설정을 담당합니다 ★★★★★
      env: {
        // --- 공식 문서에 따른 필수 URL 설정 ---
        "webhook_url_logs": "https://discord.com/api/webhooks/1390918934571520051/g5RVy-DfAs4Gq4sJ8hAuSQwfQniRps3oNSBDRbmISB3PZMfSW-dBM9AodnSHZZV_6hnc",
        "webhook_url_errors": "https://discord.com/api/webhooks/1390918934571520051/g5RVy-DfAs4Gq4sJ8hAuSQwfQniRps3oNSBDRbmISB3PZMfSW-dBM9AodnSHZZV_6hnc",

        // --- 이벤트 알림 활성화 ---
        "start": true,
        "stop": true,
        "restart": true,
        "exception": true,
        "restart_overlimit": true,

        // --- 성능 최적화 ---
        "buffer": true,
        "buffer_seconds": 2,
        "queue_max": 100,
      },
    },
  ],
};