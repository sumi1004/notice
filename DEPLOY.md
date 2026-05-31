# 배포 가이드 — 공개 신청폼(이메일 자동발송 + Supabase 명단)

> 결과물: 누구나 접속하는 공개 URL → 신청하면 ① Supabase에 명단 저장 ② 신청자에게 안내 이메일 자동발송. (솔라피/알림톡 없음, 무료)

---

## 0. 준비물
- GitHub 계정 (코드 올릴 곳)
- Supabase 계정 (DB, 무료)
- Railway 또는 Render 계정 (호스팅, 무료/저가)
- Gmail 앱 비밀번호 (이메일 발송용)

---

## 1. Supabase 설정 (DB)

1. https://supabase.com → 새 프로젝트 생성 (Region: Northeast Asia(Seoul) 권장)
2. 좌측 **SQL Editor** → `supabase_schema.sql` 내용 붙여넣고 **Run** → `applications` 테이블 생성
3. 좌측 **Project Settings → API** 에서 두 값 복사:
   - **Project URL** → 환경변수 `SUPABASE_URL`
   - **service_role** 키(secret) → 환경변수 `SUPABASE_KEY`
   - ⚠️ service_role 키는 **서버에서만** 쓰는 비공개 키입니다. 절대 외부 노출 금지.

## 2. Gmail 앱 비밀번호
1. Google 계정 → 보안 → **2단계 인증 ON**
2. **앱 비밀번호** 16자리 생성 → 환경변수 `GMAIL_USER`, `GMAIL_APP_PASSWORD`

## 3. GitHub에 코드 올리기
이 `webapp/` 폴더를 GitHub 저장소로 push.
```bash
cd webapp
git init
git add .
git commit -m "워크숍 신청폼 배포본"
git branch -M main
git remote add origin https://github.com/<your>/<repo>.git
git push -u origin main
```
> `.gitignore`가 `.env` 등 비밀파일을 제외합니다. **비밀값은 코드가 아니라 호스팅 환경변수로** 넣습니다.

## 4. Railway 배포 (추천)
1. https://railway.app → **New Project → Deploy from GitHub repo** → 위 저장소 선택
2. **Variables** 탭에서 환경변수 등록 (`.env.example` 참고):
   `SUPABASE_URL`, `SUPABASE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM_NAME`, `LIVE_LINK`
   - (PORT는 Railway가 자동 주입 — 등록 불필요)
3. 배포 완료 후 **Settings → Networking → Generate Domain** → 공개 URL 생성 🎉
4. 그 URL 접속 → 폼 제출 → Supabase에 행 추가 + 이메일 도착 확인

### (대안) Render 배포
- New **Web Service** → GitHub 연결 → Build: 비움 / Start: `python server.py` → 환경변수 동일 등록

## 5. (선택) 커스텀 도메인
- Railway/Render의 도메인 설정에서 보유 도메인 연결 (CNAME). 없으면 기본 제공 URL 사용.

---

## 로컬 테스트(배포 전 확인)
```powershell
# PowerShell 예시
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_KEY="service_role키"
$env:GMAIL_USER="you@gmail.com"
$env:GMAIL_APP_PASSWORD="앱비밀번호"
python server.py
# → http://localhost:8000 접속해 폼 제출 테스트
```

## 운영 메모
- **딜리버러빌리티**: Gmail은 소규모(수백 통)엔 충분. 발송량이 커지면 Resend/SES로 교체 권장.
- **중복방지**: `supabase_schema.sql`의 unique index 주석 해제 시 같은 이메일 재신청 차단.
- **나중에 알림톡 추가**: 발송 시점에 `alimtalk_send.py` 호출만 끼우면 됨(예산 확보 후).
- **보안**: 노출된 카카오 REST키/시크릿은 재발급. 모든 키는 환경변수로만.
