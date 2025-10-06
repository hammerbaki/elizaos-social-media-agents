# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the Eliza Starter project - a TypeScript-based AI agent framework that deploys customizable AI personalities across Discord, Twitter, Telegram, and direct chat platforms. It's built on the ElizaOS ecosystem and requires Node.js v22+.

## 답변 지연 문제 해결 (Response Delay Issues)

### 현재 상황
디스코드와 텔레그램에서 봇의 답변이 지연되는 문제가 발생하고 있습니다. `src/patches/` 디렉토리의 여러 패치 시도들은 이 문제를 해결하기 위한 노력의 기록입니다.

### 확인된 근본 원인
1. **빈 임베딩 문제**: 빈 문자열이나 null 값이 임베딩 함수에 전달되어 오류 발생
2. **차원 불일치**: 시스템은 1024차원 벡터를 기대하지만 빈 배열이 반환됨
3. **비동기 패치 타이밍**: 현재 패치가 런타임 시작 후에 적용되어 효과가 없을 수 있음

### 가능한 원인들

#### 1. 임베딩 시스템 문제
- **빈 메시지 처리**: 사용자가 빈 메시지나 특수 문자만 보낼 때 텍스트 추출 실패
- **멀티바이트 문자 처리**: 한글이나 이모지 등이 제대로 처리되지 않음
- **임베딩 프로바이더 지연**: OpenAI나 로컬 임베딩 모델의 응답 지연

#### 2. 메모리/컨텍스트 시스템
- **대화 기록 검색 실패**: 임베딩 오류로 인한 관련 대화 검색 실패
- **컨텍스트 빌드 지연**: 긴 대화 기록에서 관련 컨텍스트 구성 시간 증가
- **메모리 캐시 미스**: 자주 사용되는 임베딩이 캐싱되지 않음

#### 3. 플랫폼별 특성
- **Discord**: 3초 이내 응답하지 않으면 "상호작용 실패" 오류
- **Telegram**: 웹훅 타임아웃으로 인한 메시지 중복 처리
- **Rate Limiting**: API 호출 제한으로 인한 지연

#### 4. 시스템 아키텍처
- **동기식 임베딩 호출**: 비동기 처리가 필요한 곳에서 동기식 호출
- **PM2 재시작 루프**: 오류 발생 시 30초 재시작 지연
- **다중 에이전트 간섭**: 여러 에이전트가 동시에 같은 리소스 접근

### 왜 기존 패치들이 효과가 없었는가

1. **패치 적용 시점 문제**
   ```typescript
   // 현재 방식 - 비동기로 나중에 적용됨
   import("@elizaos/core").then((coreModule) => {
       // 패치 코드
   });
   ```
   - 런타임이 이미 시작된 후 패치가 적용되어 효과 없음

2. **잘못된 타겟**
   - 여러 레이어(runtime, provider, database adapter, core)를 시도했으나 실제 호출 경로 파악 실패
   - 임베딩 함수가 여러 경로로 호출되어 일부만 패치됨

3. **근본 원인 미해결**
   - 왜 빈 텍스트가 전달되는지 해결하지 않고 증상만 처리

### 권장 해결 방안

#### 즉시 적용 가능한 수정사항

1. **동기식 패치 적용**
   ```typescript
   // src/patches/sync-embedding-fix.ts
   import { elizaLogger } from "@elizaos/core";
   
   export function applySyncEmbeddingPatch() {
       // require를 사용하여 동기식으로 모듈 로드
       const core = require("@elizaos/core");
       
       if (core.embed) {
           const originalEmbed = core.embed;
           core.embed = async function(runtime: any, input: string) {
               // 입력 전처리
               const cleanInput = input?.toString().trim() || "";
               
               if (cleanInput.length === 0) {
                   elizaLogger.warn('[PATCH] 빈 입력 감지, 기본 벡터 반환');
                   return new Array(1024).fill(0);
               }
               
               try {
                   return await originalEmbed(runtime, cleanInput);
               } catch (error) {
                   elizaLogger.error('[PATCH] 임베딩 오류:', error);
                   return new Array(1024).fill(0);
               }
           };
       }
   }
   
   // index.ts의 맨 위에서 즉시 실행
   applySyncEmbeddingPatch();
   ```

2. **입력 검증 강화**
   ```typescript
   // 각 클라이언트에서 메시지 전처리
   function preprocessMessage(message: string): string {
       if (!message || typeof message !== 'string') return '';
       
       // 특수 문자와 공백 정리
       const cleaned = message
           .replace(/[\u200B-\u200D\uFEFF]/g, '') // 제로 너비 문자 제거
           .trim();
       
       // 최소 길이 보장
       return cleaned.length > 0 ? cleaned : '안녕하세요';
   }
   ```

3. **응답 시간 모니터링 개선**
   ```typescript
   // 각 단계별 시간 측정
   const metrics = {
       messageReceived: Date.now(),
       embeddingStart: 0,
       embeddingEnd: 0,
       llmStart: 0,
       llmEnd: 0,
       responseStart: 0,
       responseEnd: 0
   };
   ```

#### 장기적 개선사항

1. **임베딩 캐싱 구현**
   - Redis나 인메모리 캐시로 자주 사용되는 임베딩 저장
   - 동일한 입력에 대해 재계산 방지

2. **비동기 처리 최적화**
   - Discord의 경우 즉시 "처리 중" 응답 후 실제 답변 전송
   - Telegram 웹훅 응답 최적화

3. **에러 복구 메커니즘**
   - 임베딩 실패 시 폴백 전략
   - 중요 함수에 재시도 로직 추가

4. **로깅 및 모니터링 강화**
   - 각 단계별 상세 로깅
   - Prometheus 메트릭 수집
   - 실시간 대시보드 구축

## Essential Commands

### Development
```bash
# 의존성 설치 (pnpm 사용 필수)
pnpm i

# 단일 에이전트 시작 (기본 캐릭터)
pnpm start

# 특정 캐릭터 파일로 시작
pnpm start --characters="characters/ceo_agilethoughtleader.v5R.json"

# 여러 캐릭터 동시 실행
pnpm start --characters="characters/ceo_agilethoughtleader.v5R.json,characters/ceo_communitymentor.v2R.json"

# 프로젝트 빌드
pnpm build
```

### Production Deployment
```bash
# 모든 에이전트를 PM2 서비스로 시작
pnpm start:service:all

# 모든 PM2 서비스 중지
pnpm stop:service:all

# PM2 로그 확인
pm2 logs

# PM2 프로세스 모니터링
pm2 monit

# ecosystem.config.cjs 사용하여 직접 실행 (현재 사용 중인 방식)
pm2 start ecosystem.config.cjs

# ecosystem.config.cjs 사용하여 재시작
pm2 restart ecosystem.config.cjs
```

**참고**: 현재 프로덕션 환경에서는 `ecosystem.config.cjs` 파일을 통해 PM2로 에이전트를 관리하고 있습니다. 이 파일에는 세 개의 에이전트(`agile-thought-leader`, `community-mentor`, `information-concierge`)와 Discord 웹훅 모니터링 설정이 포함되어 있습니다.

### Monitoring & Analysis
```bash
# 성능 분석 실행
pnpm analyze
./run-analysis.sh

# 실시간 로그 확인
pnpm logs

# 로그 파일 초기화
pnpm logs:clear

# 성능 대시보드 서버 시작
./start-dashboard.sh

# Twitter 모니터 실행 (쿠키 유효성 검사)
node scripts/simple-twitter-monitor.js
```

### Maintenance
```bash
# 빌드 아티팩트 및 의존성 정리
./scripts/clean.sh

# 로그 백업
./backup-logs.sh
```

## Architecture Overview

### Core Structure
- **Entry Point**: `src/index.ts` - 캐릭터 설정에 따른 에이전트 초기화
- **Character System**: `characters/` 디렉토리의 JSON 파일로 에이전트 성격, 지식, 행동 정의
- **Multi-Client Architecture**: `src/clients/`의 플랫폼별 클라이언트 (Discord, Twitter, Telegram, Direct)
- **Plugin System**: `@elizaos` 패키지의 모듈식 플러그인으로 추가 기능 제공
- **Performance Monitoring**: 응답 시간 추적 커스텀 로거, CSV 출력, HTML 대시보드 시각화

### Key Architectural Decisions
1. **Character-Driven Design**: 각 에이전트는 포괄적인 캐릭터 JSON 파일로 정의
2. **Multi-Agent Support**: PM2 프로세스 관리로 여러 에이전트 동시 실행 가능
3. **Plugin Architecture**: `@elizaos/plugin-*` 패키지로 확장 가능
4. **Database Abstraction**: SQLite 기본, 어댑터를 통한 PostgreSQL 지원

### Character File Structure
캐릭터 파일 필수 요소:
- `name`: 에이전트 식별자
- `modelProvider`: AI 제공자 (openai, openrouter, anthropic, ollama 등)
- `clients`: 배포 플랫폼 배열 ["discord", "twitter", "telegram", "direct"]
- `bio`, `lore`, `knowledge`: 배경 정보 배열
- `topics`, `adjectives`: 성격 특성
- `style`: 응답 형식 선호사항

### Available Plugins
- `@elizaos/plugin-bootstrap`: 핵심 기능
- `@elizaos/plugin-node`: Node.js 특화 기능
- `@elizaos/plugin-solana`: 블록체인 통합
- `@elizaos/plugin-image-generation`: AI 이미지 생성
- `@elizaos/plugin-web-search`: 웹 검색 기능
- `@elizaos/plugin-twitter`, `@elizaos/plugin-news`: 플랫폼별 기능

### Database
- 기본: SQLite (`data/db.sqlite`)
- PostgreSQL: `DATABASE_URL` 환경 변수로 설정
- 초기화: `src/index.ts`의 `initializeDatabase()`로 자동 처리

## Important Patterns

### Environment Configuration
필수 `.env` 변수:
```bash
# AI 제공자 (최소 하나 필수)
OPENAI_API_KEY=sk-*
ANTHROPIC_API_KEY=
GROQ_API_KEY=gsk_*
OLLAMA_SERVER_URL=  # 로컬 모델용

# 플랫폼 인증 정보
DISCORD_APPLICATION_ID=
DISCORD_API_TOKEN=
TWITTER_USERNAME=
TWITTER_PASSWORD=
TWITTER_EMAIL=
TWITTER_COOKIES=  # 또는 개별 TWITTER_COOKIES_AUTH_TOKEN과 TWITTER_COOKIES_CT0
TELEGRAM_BOT_TOKEN=

# 모델 선택 (선택적 오버라이드)
OPENROUTER_MODEL=
SMALL_OLLAMA_MODEL=
MEDIUM_OLLAMA_MODEL=
LARGE_OLLAMA_MODEL=
```

### PM2 Configuration
`ecosystem.config.cjs` 파일에 사전 설정된 세 에이전트:
- `agile-thought-leader`: 포트 3000
- `community-mentor`: 포트 3001
- `information-concierge`: 포트 3002

각 에이전트는 메모리 제한(1GB), 재시작 정책, Discord 웹훅 모니터링 설정 포함.

### Performance Monitoring
성능 추적 시스템:
- `SimpleAutoLogger` 클래스로 플랫폼별 응답 시간 측정
- `logs/all_platforms_performance.csv`로 CSV 출력
- 분석 스크립트가 통계와 백분위수 생성
- HTML 대시보드로 시각적 성능 인사이트 제공

### Twitter Cookie Management
Twitter 통합을 위해:
1. 환경 변수로 쿠키 제공 필요
2. `scripts/simple-twitter-monitor.js`가 쿠키 형식 검증
3. 모니터가 ElizaOS 프로세스 상태와 최근 활동 확인
4. 인증 만료 시 수동 쿠키 갱신 필요

## Common Tasks

### Creating a New Character
1. `characters/characters_example/`에서 템플릿 복사
2. 성격, 지식, 스타일 섹션 수정
3. 고유한 이름과 적절한 모델 제공자 설정
4. `.env`에 필요한 API 키 설정

### Debugging
```bash
# 특정 에이전트의 PM2 로그 확인
pm2 logs agile-thought-leader

# 모든 PM2 프로세스 확인
pm2 list

# 성능 메트릭 확인
cat logs/all_platforms_performance.csv

# Twitter 인증 모니터링
node scripts/simple-twitter-monitor.js --check-once
```

### Running Multiple Agents
```bash
# PM2 사용 (프로덕션)
pnpm start:service:all

# CLI 사용 (개발)
pnpm start --characters="char1.json,char2.json,char3.json"
```

## TypeScript Configuration
- Target: ESNext with ESM modules
- Module resolution: Bundler
- Strict mode: Disabled
- Allows direct `.ts` imports and JSON modules

## Security Notes
- API 키나 인증 정보를 절대 커밋하지 마세요
- 모든 민감한 데이터는 환경 변수 사용
- 캐릭터 파일에 API 키를 포함하지 마세요
- `ecosystem.config.cjs`의 Discord 웹훅 URL을 환경 변수로 이동 권장

## Testing
**참고**: 현재 테스트 프레임워크가 구현되지 않음. 다음 추가 고려:
- 핵심 기능의 단위 테스트
- 플랫폼 클라이언트의 통합 테스트
- package.json에 테스트 명령어 추가

## 패치 시스템 분석 (2025-07-25)

### 패치가 응답 속도를 저하시킨 이유

1. **런타임 오버헤드**
   - 모든 메시지마다 여러 레이어의 함수 래핑
   - `getEmbedding`, `generateText`, `processActions` 각각에 추가 검증 로직
   - 빈 메시지도 여전히 패치 로직을 거쳐야 함

2. **패치 적용 실패**
   - 로그에 패치 적용 메시지가 없음 (`[EMBEDDING-FIX]`, `[LLM-BLOCKER]` 등)
   - 패치가 제대로 작동하지 않아 빈 임베딩 경고는 계속 발생
   - 오버헤드만 추가하고 실제 문제는 해결하지 못함

3. **복잡한 의존성**
   - ElizaOS 내부 구조에 대한 깊은 의존
   - 런타임 메서드를 동적으로 교체하는 불안정한 방식
   - 버전 업데이트 시 쉽게 깨질 수 있는 구조

4. **잘못된 문제 접근**
   - 증상(빈 임베딩)만 처리하려 함
   - 근본 원인(왜 빈 텍스트가 들어오는지) 해결 안 함
   - 특히 한글 처리 문제는 preprocess 단계에서 발생

### 성능 영향 분석

- **Discord/Telegram**: 자체 빈 메시지 필터링이 있어 영향 적음
- **Twitter**: 필터링이 없어 가장 큰 영향 (최대 51분 지연)
- **빈 임베딩 경고**: 실제로는 성능에 치명적이지 않음 (로그만 남김)
- **패치 오버헤드**: 모든 메시지 처리에 추가 지연 발생

### 권장 방향

1. **패치 완전 제거** ✅
   - 현재 적용됨
   - 단순하고 안정적인 원본 ElizaOS 동작 유지
   - 유지보수와 디버깅 용이

2. **클라이언트 레벨 필터링**
   - Discord/Telegram은 이미 구현됨
   - Twitter 클라이언트만 수정 필요
   - `simple-message-filter.ts` 활용 가능

3. **장기 개선 방향**
   - ElizaOS 프로젝트에 PR 제출 (한글 지원)
   - 임베딩 캐싱 시스템 구현
   - 클라이언트별 최적화

### 교훈

- **복잡한 패치보다 단순한 해결책이 낫다**
- **런타임 패치는 최후의 수단**
- **성능 문제는 근본 원인부터 해결**
- **플랫폼별 특성을 고려한 최적화 필요**