// 파일 위치: /scripts/simple-twitter-monitor.js
// 외부 의존성 없이 Node.js 기본 모듈만 사용

const fs = require('fs');
const path = require('path');
const https = require('https');

class SimpleCookieMonitor {
    constructor() {
        this.envPath = path.join(__dirname, '../.env');
        this.logPath = path.join(__dirname, '../logs/simple-monitor.log');
        
        // 로그 디렉토리 생성
        const logsDir = path.dirname(this.logPath);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(logMessage.trim());
        fs.appendFileSync(this.logPath, logMessage);
    }

    // .env 파일에서 값 추출
    extractEnvValue(content, key) {
        const regex = new RegExp(`^${key}=(.*)$`, 'm');
        const match = content.match(regex);
        return match ? match[1].trim() : null;
    }

    // 쿠키 기본 유효성 검사
    validateCookieFormat() {
        try {
            const envContent = fs.readFileSync(this.envPath, 'utf8');
            const authToken = this.extractEnvValue(envContent, 'TWITTER_COOKIES_AUTH_TOKEN');
            const ct0 = this.extractEnvValue(envContent, 'TWITTER_COOKIES_CT0');

            if (!authToken || !ct0) {
                this.log('❌ 쿠키가 누락되었습니다.');
                return false;
            }

            // 기본 형식 검증
            if (authToken.length < 30) {
                this.log('⚠️ auth_token이 너무 짧습니다.');
                return false;
            }

            if (ct0.length < 50) {
                this.log('⚠️ ct0 토큰이 너무 짧습니다.');
                return false;
            }

            this.log('✅ 쿠키 형식이 유효합니다.');
            return true;

        } catch (error) {
            this.log(`❌ 쿠키 검증 실패: ${error.message}`);
            return false;
        }
    }

    // ElizaOS 프로세스 상태 확인
    checkElizaStatus() {
        const { exec } = require('child_process');
        
        return new Promise((resolve) => {
            exec('ps aux | grep eliza', (error, stdout) => {
                if (error) {
                    this.log('⚠️ ElizaOS 프로세스 상태 확인 실패');
                    resolve(false);
                    return;
                }

                const processes = stdout.split('\n').filter(line => 
                    line.includes('eliza') && !line.includes('grep')
                );

                if (processes.length > 0) {
                    this.log(`✅ ElizaOS 프로세스 실행 중 (${processes.length}개)`);
                    resolve(true);
                } else {
                    this.log('❌ ElizaOS 프로세스가 실행되지 않고 있습니다.');
                    resolve(false);
                }
            });
        });
    }

    // 로그 파일 확인으로 활동 상태 체크
    checkRecentActivity() {
        try {
            // ElizaOS 로그 파일들 확인
            const possibleLogPaths = [
                path.join(__dirname, '../logs/eliza.log'),
                path.join(__dirname, '../logs/twitter.log'),
                path.join(__dirname, '../eliza.log'),
                path.join(__dirname, '../twitter.log')
            ];

            let latestActivity = null;
            let activeLogPath = null;

            for (const logPath of possibleLogPaths) {
                if (fs.existsSync(logPath)) {
                    const stats = fs.statSync(logPath);
                    if (!latestActivity || stats.mtime > latestActivity) {
                        latestActivity = stats.mtime;
                        activeLogPath = logPath;
                    }
                }
            }

            if (!latestActivity) {
                this.log('⚠️ ElizaOS 로그 파일을 찾을 수 없습니다.');
                return false;
            }

            const now = new Date();
            const timeDiff = (now - latestActivity) / (1000 * 60); // 분 단위

            this.log(`📊 마지막 활동: ${latestActivity.toLocaleString()}`);
            this.log(`⏰ 비활성 시간: ${Math.round(timeDiff)}분`);
            this.log(`📁 활성 로그: ${activeLogPath}`);

            // 30분 이상 비활성시 경고
            if (timeDiff > 30) {
                this.log('🚨 Twitter 에이전트가 30분 이상 비활성 상태입니다!');
                return false;
            }

            return true;

        } catch (error) {
            this.log(`❌ 활동 상태 체크 실패: ${error.message}`);
            return false;
        }
    }

    // 수동 재시작 안내
    suggestManualActions() {
        this.log('🔧 수동 해결 방법:');
        this.log('1. 브라우저에서 twitter.com 로그인');
        this.log('2. 개발자 도구 → Application → Cookies');
        this.log('3. auth_token과 ct0 값 복사');
        this.log('4. .env 파일의 TWITTER_COOKIES_* 값 업데이트');
        this.log('5. ElizaOS 재시작: npm restart 또는 pm2 restart');
        
        // Discord 알림 (웹훅 URL이 있다면)
        this.sendAlertNotification();
    }

    // 알림 전송 (옵션)
    sendAlertNotification() {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
        
        if (!webhookUrl) return;

        const message = {
            content: '🚨 Twitter 에이전트 쿠키 갱신 필요!\n수동으로 쿠키를 업데이트해주세요.'
        };

        const postData = JSON.stringify(message);
        const url = new URL(webhookUrl);

        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode === 200 || res.statusCode === 204) {
                this.log('📨 알림이 전송되었습니다.');
            }
        });

        req.on('error', (error) => {
            this.log(`⚠️ 알림 전송 실패: ${error.message}`);
        });

        req.write(postData);
        req.end();
    }

    // 메인 모니터링 루프
    async startMonitoring() {
        this.log('🚀 간단한 Twitter 모니터링을 시작합니다...');
        
        const checkInterval = 10 * 60 * 1000; // 10분마다 체크
        
        const runCheck = async () => {
            this.log('🔍 시스템 상태를 확인합니다...');
            
            const cookieValid = this.validateCookieFormat();
            const elizaRunning = await this.checkElizaStatus();
            const recentActivity = this.checkRecentActivity();
            
            if (!cookieValid || !elizaRunning || !recentActivity) {
                this.log('⚠️ 문제가 감지되었습니다.');
                this.suggestManualActions();
            } else {
                this.log('✅ 모든 시스템이 정상 작동 중입니다.');
            }
            
            this.log('-----------------------------------');
        };

        // 즉시 한 번 실행
        await runCheck();
        
        // 정기적으로 실행
        setInterval(runCheck, checkInterval);
    }

    // 일회성 상태 체크
    async checkOnce() {
        this.log('🔍 일회성 상태 체크를 실행합니다...');
        
        const cookieValid = this.validateCookieFormat();
        const elizaRunning = await this.checkElizaStatus();
        const recentActivity = this.checkRecentActivity();
        
        if (cookieValid && elizaRunning && recentActivity) {
            this.log('✅ 모든 시스템이 정상입니다.');
            process.exit(0);
        } else {
            this.log('❌ 문제가 감지되었습니다.');
            this.suggestManualActions();
            process.exit(1);
        }
    }
}

// 실행 파라미터 처리
if (require.main === module) {
    const monitor = new SimpleCookieMonitor();
    
    if (process.argv.includes('--check-once')) {
        monitor.checkOnce();
    } else {
        monitor.startMonitoring();
    }
}

module.exports = SimpleCookieMonitor;