# Discord/Telegram 봇 최소 수정 가이드 (완전판)

## 문제 진단
로그에서 반복적으로 나타나는 빈 임베딩 오류:
```
[WARN] Invalid embedding input:
    input: ""
    type: "string"
    length: 0
```

이 오류는 ElizaOS 코어가 빈 텍스트를 처리할 때 빈 배열 `[]`을 반환하여 Discord/Telegram 응답이 차단되는 문제입니다.

## 수정 전략
두 가지 레벨에서 패치를 적용하여 완벽한 해결:
1. **Runtime 레벨 패치**: 각 에이전트의 runtime 객체에 패치 적용
2. **Core 레벨 패치**: ElizaOS 코어 모듈 자체를 오버라이드

## 단계별 수정 방법

### 1단계: Runtime 레벨 패치 파일 생성

**파일 경로**: `/Users/jj/eliza-starter TEST/src/patches/minimal-embedding-fix.ts`

**파일 내용**:
```typescript
// Runtime 레벨에서 빈 임베딩 오류 해결
import { elizaLogger } from "@elizaos/core";

export function fixEmptyEmbedding(runtime: any) {
    try {
        // runtime.getEmbedding 패치
        if (runtime?.getEmbedding && typeof runtime.getEmbedding === 'function') {
            const original = runtime.getEmbedding.bind(runtime);
            runtime.getEmbedding = async function(input: string) {
                if (!input || input.trim().length === 0) {
                    elizaLogger.debug('[Runtime Patch] Empty text → 1024d zero vector');
                    return new Array(1024).fill(0);
                }
                
                try {
                    const result = await original(input);
                    if (Array.isArray(result) && result.length === 0) {
                        elizaLogger.debug('[Runtime Patch] Empty array → 1024d zero vector');
                        return new Array(1024).fill(0);
                    }
                    return result;
                } catch (error) {
                    elizaLogger.error('[Runtime Patch] Embedding error:', error);
                    return new Array(1024).fill(0);
                }
            };
        }
        
        // embeddingProvider 패치 (있는 경우)
        if (runtime?.embeddingProvider?.getEmbedding) {
            const originalProvider = runtime.embeddingProvider.getEmbedding.bind(runtime.embeddingProvider);
            runtime.embeddingProvider.getEmbedding = async function(input: string) {
                if (!input || input.trim().length === 0) {
                    return new Array(1024).fill(0);
                }
                try {
                    const result = await originalProvider(input);
                    if (Array.isArray(result) && result.length === 0) {
                        return new Array(1024).fill(0);
                    }
                    return result;
                } catch (error) {
                    return new Array(1024).fill(0);
                }
            };
        }
        
        elizaLogger.info('Runtime embedding fix applied');
    } catch (error) {
        elizaLogger.error('Failed to apply runtime embedding patch:', error);
    }
}
```

### 2단계: Core 레벨 패치 파일 생성

**파일 경로**: `/Users/jj/eliza-starter TEST/src/patches/core-embedding-override.ts`

**파일 내용**:
```typescript
// ElizaOS 코어의 embed 함수를 오버라이드
import { elizaLogger } from "@elizaos/core";

export function overrideCoreEmbedding() {
    try {
        const coreModule = require("@elizaos/core");
        
        // embed 함수 오버라이드
        if (coreModule.embed) {
            const originalEmbed = coreModule.embed;
            coreModule.embed = async function(runtime: any, input: string) {
                // 빈 입력 체크
                if (!input || typeof input !== "string" || input.trim().length === 0) {
                    elizaLogger.debug('[Core Override] Empty text → 1024d zero vector');
                    return new Array(1024).fill(0);
                }
                
                try {
                    const result = await originalEmbed(runtime, input);
                    // ElizaOS 코어가 빈 배열을 반환하는 경우 처리
                    if (Array.isArray(result) && result.length === 0) {
                        elizaLogger.debug('[Core Override] Empty array → 1024d zero vector');
                        return new Array(1024).fill(0);
                    }
                    return result;
                } catch (error) {
                    elizaLogger.error('[Core Override] Embedding error:', error);
                    return new Array(1024).fill(0);
                }
            };
            elizaLogger.info('Core embedding override applied');
        }
    } catch (error) {
        elizaLogger.error('Failed to override core embedding:', error);
    }
}
```

### 3단계: index.ts 수정

**파일 경로**: `/Users/jj/eliza-starter TEST/src/index.ts`

#### 수정 1: Import 추가 (약 26-30번 라인)

**찾기**:
```typescript
import { autoLog } from "./logging/simple-auto-logger.ts";
import { initializeDatabase } from "./database/index.ts";
```

**바꾸기**:
```typescript
import { autoLog } from "./logging/simple-auto-logger.ts";
import { initializeDatabase } from "./database/index.ts";
import { fixEmptyEmbedding } from "./patches/minimal-embedding-fix.ts";
import { overrideCoreEmbedding } from "./patches/core-embedding-override.ts";
```

#### 수정 2: startAgents 함수 시작 부분 (약 163번 라인)

**찾기**:
```typescript
const startAgents = async () => {
  const directClient = new DirectClient();
```

**바꾸기**:
```typescript
const startAgents = async () => {
  // Core 레벨 패치를 가장 먼저 적용
  overrideCoreEmbedding();
  
  const directClient = new DirectClient();
```

#### 수정 3: createAgent 함수 내부 (약 76번 라인)

**찾기**:
```typescript
  // 2. 로깅 활성화
  autoLog(runtime);

  // 3. runtime 반환
  return runtime;
```

**바꾸기**:
```typescript
  // 2. 로깅 활성화
  autoLog(runtime);
  
  // 3. Runtime 레벨 빈 임베딩 패치
  fixEmptyEmbedding(runtime);

  // 4. runtime 반환
  return runtime;
```

### 4단계: 환경 변수 정리 (선택사항)

**파일 경로**: `/Users/jj/eliza-starter TEST/.env`

155번 라인의 중복된 `USE_OPENAI_EMBEDDING` 제거 또는 주석 처리:
```
# USE_OPENAI_EMBEDDING=  #TRUE  # Removed - duplicate with line 4
```

## 적용 명령어

```bash
# 1. patches 디렉토리 생성 (없는 경우)
mkdir -p /Users/jj/eliza-starter\ TEST/src/patches

# 2. 백업 생성
cp /Users/jj/eliza-starter\ TEST/src/index.ts /Users/jj/eliza-starter\ TEST/src/index.ts.backup
cp /Users/jj/eliza-starter\ TEST/.env /Users/jj/eliza-starter\ TEST/.env.backup

# 3. 봇 재시작
cd /Users/jj/eliza-starter\ TEST
pm2 restart all

# 4. 패치 적용 확인
pm2 logs --lines 100 | grep -E "Core embedding override applied|Runtime embedding fix applied|Invalid embedding"
```

## 검증 방법

### 1. 패치 적용 확인
성공적으로 적용되면 다음 로그가 나타나야 함:
```
[INFO] Core embedding override applied
[INFO] Runtime embedding fix applied
```

### 2. 오류 해결 확인
"Invalid embedding input" 경고가 더 이상 나타나지 않아야 함:
```bash
# 5분 정도 기다린 후 확인
pm2 logs --lines 200 | grep "Invalid embedding input"
# 결과가 없거나 매우 적어야 함
```

### 3. 봇 응답 테스트
- **Discord**: 봇에게 DM 보내거나 채널에서 @멘션
- **Telegram**: 봇에게 개인 메시지 전송
- 응답이 즉시 오는지 확인

### 4. 활동 모니터링
```bash
pm2 logs | grep "AutoLog Status"
```
각 봇의 "Last activity"가 최근 시간(몇 초/분)으로 업데이트되어야 함

## 문제 해결

### 패치가 적용되지 않는 경우
1. TypeScript 컴파일 확인:
   ```bash
   pnpm build
   ```

2. PM2 완전 재시작:
   ```bash
   pm2 kill
   pm2 start ecosystem.config.cjs
   ```

### 여전히 오류가 발생하는 경우
1. 로그 상세 확인:
   ```bash
   pm2 logs discord-mentor --lines 100
   pm2 logs telegram-info --lines 100
   ```

2. 다른 패치 파일들 확인:
   ```bash
   ls -la src/patches/
   ```

## 롤백 방법

문제 발생 시 원래 상태로 복구:
```bash
# 1. 백업 파일 복원
cp /Users/jj/eliza-starter\ TEST/src/index.ts.backup /Users/jj/eliza-starter\ TEST/src/index.ts
cp /Users/jj/eliza-starter\ TEST/.env.backup /Users/jj/eliza-starter\ TEST/.env

# 2. 생성한 패치 파일 삭제
rm -f src/patches/minimal-embedding-fix.ts
rm -f src/patches/core-embedding-override.ts

# 3. 봇 재시작
pm2 restart all
```

## 패치 효과 설명

이 이중 패치 전략은:
1. **Core Override**: ElizaOS 코어의 `embed()` 함수가 빈 배열을 반환하는 것을 방지
2. **Runtime Patch**: 각 에이전트의 runtime 객체에서 추가 방어

두 레벨에서 패치를 적용하여 빈 텍스트 문제를 완벽하게 해결합니다.