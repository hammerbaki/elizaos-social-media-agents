# Discord/Telegram 봇 최소 수정 가이드 (최종본)

## 수정 요약
- **새 파일 생성**: 1개 (`/src/patches/minimal-embedding-fix.ts`)
- **기존 파일 수정**: 2개 (`/src/index.ts`, `/.env`)

## 단계별 수정 방법

### 1단계: 빈 임베딩 패치 파일 생성

**파일 경로**: `/Users/jj/eliza-starter TEST/src/patches/minimal-embedding-fix.ts`

**작업**: 새 파일 생성

**파일 내용 (두 가지 버전 중 선택)**:

### 옵션 A: 기본 버전
```typescript
// 최소한의 수정으로 빈 임베딩 오류 해결
import { elizaLogger } from "@elizaos/core";

export function fixEmptyEmbedding(runtime: any) {
    // runtime의 getEmbedding 메서드만 패치
    if (runtime.getEmbedding) {
        const original = runtime.getEmbedding.bind(runtime);
        runtime.getEmbedding = async function(input: string) {
            // 빈 입력은 즉시 1024 크기 zero vector 반환
            if (!input || input.trim().length === 0) {
                return new Array(1024).fill(0);
            }
            
            try {
                const result = await original(input);
                // 빈 배열이 반환되면 1024 크기로 변환
                if (Array.isArray(result) && result.length === 0) {
                    return new Array(1024).fill(0);
                }
                return result;
            } catch (error) {
                // 에러 시에도 1024 크기 배열 반환
                elizaLogger.error('Embedding error, returning zero vector:', error);
                return new Array(1024).fill(0);
            }
        };
        elizaLogger.info('Empty embedding fix applied');
    }
}
```

### 옵션 B: 더 안전한 버전 (권장)
```typescript
// 최소한의 수정으로 빈 임베딩 오류 해결 - 안전 강화 버전
import { elizaLogger } from "@elizaos/core";

export function fixEmptyEmbedding(runtime: any) {
    try {
        // runtime과 getEmbedding 존재 여부를 더 안전하게 확인
        if (runtime?.getEmbedding && typeof runtime.getEmbedding === 'function') {
            const original = runtime.getEmbedding.bind(runtime);
            runtime.getEmbedding = async function(input: string) {
                // 빈 입력은 즉시 1024 크기 zero vector 반환
                if (!input || input.trim().length === 0) {
                    return new Array(1024).fill(0);
                }
                
                try {
                    const result = await original(input);
                    // 빈 배열이 반환되면 1024 크기로 변환
                    if (Array.isArray(result) && result.length === 0) {
                        return new Array(1024).fill(0);
                    }
                    return result;
                } catch (error) {
                    // 에러 시에도 1024 크기 배열 반환
                    elizaLogger.error('Embedding error, returning zero vector:', error);
                    return new Array(1024).fill(0);
                }
            };
            elizaLogger.info('Empty embedding fix applied');
        }
    } catch (error) {
        elizaLogger.error('Failed to apply embedding patch:', error);
        // 패치 실패해도 봇은 계속 실행됨
    }
}
```

**버전 선택 가이드**:
- **옵션 A (기본 버전)**: 빠른 적용, 일반적인 경우 충분
- **옵션 B (안전한 버전)**: runtime 객체가 예상과 다를 가능성이 있는 경우 권장

### 2단계: index.ts 수정

**파일 경로**: `/Users/jj/eliza-starter TEST/src/index.ts`

#### 수정 1: import 구문 추가

**위치**: 파일 상단 import 구문들 (약 26번 라인 근처)

**수정 전**:
```typescript
import { autoLog } from "./logging/simple-auto-logger.ts";
import { initializeDatabase } from "./database/index.ts";

const __filename = fileURLToPath(import.meta.url);
```

**수정 후**:
```typescript
import { autoLog } from "./logging/simple-auto-logger.ts";
import { initializeDatabase } from "./database/index.ts";
import { fixEmptyEmbedding } from "./patches/minimal-embedding-fix.ts";

const __filename = fileURLToPath(import.meta.url);
```

#### 수정 2: createAgent 함수 내부

**위치**: createAgent 함수 내부 (약 73번 라인 근처)

**수정 전**:
```typescript
  // 2. 로깅 활성화
  autoLog(runtime);

  // 3. runtime 반환
  return runtime;
```

**수정 후**:
```typescript
  // 2. 로깅 활성화
  autoLog(runtime);
  
  // 3. 빈 임베딩 문제 해결
  fixEmptyEmbedding(runtime);

  // 4. runtime 반환
  return runtime;
```

### 3단계: 환경 변수 중복 제거

**파일 경로**: `/Users/jj/eliza-starter TEST/.env`

**위치**: 155번 라인

**수정 전**:
```
USE_OPENAI_EMBEDDING=  #TRUE
```

**수정 후**:
```
# USE_OPENAI_EMBEDDING=  #TRUE  # Removed - duplicate with line 4
```

## 적용 방법

```bash
# 1. patches 디렉토리 생성
mkdir -p /Users/jj/eliza-starter\ TEST/src/patches

# 2. 환경 변수 백업
cp /Users/jj/eliza-starter\ TEST/.env /Users/jj/eliza-starter\ TEST/.env.backup

# 3. 봇 재시작
cd /Users/jj/eliza-starter\ TEST
pm2 restart discord-mentor
pm2 restart telegram-info

# 4. 수정 확인
pm2 logs --lines 50 | grep -E "Empty embedding fix applied|Invalid embedding"
```

## 예상 결과

### 수정 전 로그:
```
[WARN] Invalid embedding input:
    input: ""
    type: "string"
    length: 0
```

### 수정 후 로그:
```
[INFO] Empty embedding fix applied
```

## 검증 방법

1. **빈 임베딩 오류 확인**:
   ```bash
   # 오류가 더 이상 나타나지 않아야 함
   pm2 logs --lines 100 | grep "Invalid embedding input"
   ```

2. **Discord/Telegram 응답 테스트**:
   - Discord: 봇에게 DM 보내기 또는 채널에서 @멘션
   - Telegram: 봇에게 개인 메시지 보내기

3. **봇 활동 확인**:
   ```bash
   # AutoLog Status에서 활동 시간 확인
   pm2 logs | grep "AutoLog Status"
   ```

## 안전성 평가

이 수정은 POC에 안전합니다:
- **실패 시**: 단순히 빈 임베딩 오류가 계속 발생 (현재와 동일)
- **치명적 위험**: 없음 (특히 옵션 B 사용 시)
- **다른 봇 영향**: 없음 (Twitter는 독립적으로 작동)
- **복구**: 매우 간단 (import 라인 1줄 제거)

## 롤백 방법

```bash
# 1. 환경 변수 복원
cp /Users/jj/eliza-starter\ TEST/.env.backup /Users/jj/eliza-starter\ TEST/.env

# 2. index.ts 원복 (git 사용 시)
git checkout src/index.ts

# 3. 생성한 파일 삭제
rm -rf src/patches/minimal-embedding-fix.ts

# 4. 봇 재시작
pm2 restart all
```