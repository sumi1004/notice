# -*- coding: utf-8 -*-
"""
호서대 AI 워크숍 — 공개 신청폼 (배포용)
흐름: 신청폼 제출 → Supabase에 명단 저장 → 신청자에게 이메일 자동발송
- 의존성 없음(표준 라이브러리만) → Railway/Render에 그대로 배포 가능
- 모든 비밀값은 '환경변수'로 주입 (코드에 하드코딩 금지)

[필요 환경변수]
  PORT                 호스팅이 자동 주입 (없으면 8000)
  SUPABASE_URL         예: https://xxxx.supabase.co
  SUPABASE_KEY         service_role 키 (서버에서만 사용, 비공개)
  GMAIL_USER           발신 Gmail 주소
  GMAIL_APP_PASSWORD   Gmail 앱 비밀번호(16자)
  MAIL_FROM_NAME       (선택) 발신자 표시명, 기본 "호서대 AI 워크숍"
  LIVE_LINK            (선택) 라이브 링크, 기본 유튜브
"""
import json
import os
import re
import smtplib
import ssl
import threading
import urllib.parse
import urllib.request
import urllib.error
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8000"))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
MAIL_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "호서대 AI 워크숍")
LIVE_LINK = os.environ.get("LIVE_LINK", "https://www.youtube.com")
SCHEDULE_TEXT = os.environ.get("SCHEDULE_TEXT", "매주 토요일 15:30 시작 (10분 전 입장 가능, 2026.6.13 ~ 8.8, 총 8회)")
MEETING_ID = os.environ.get("MEETING_ID", "848 6459 9988 (암호 : 1)")
# Google Apps Script 웹앱 URL: 시트 기록 + 이메일 발송(MailApp)을 Google에 위임
# (Railway가 SMTP를 차단하므로 메일은 이 웹훅으로 처리)
SHEET_WEBHOOK_URL = os.environ.get("SHEET_WEBHOOK_URL", "")


# ── 휴대폰 번호 정규화 ────────────────────────────────────────
def normalize_phone(p):
    """숫자만 추출 → 앞 0 보정 → 010-XXXX-XXXX 형식(텍스트)로.
    시트에서 앞 0이 사라지는 문제 방지 + 하이픈 자동 부여."""
    d = re.sub(r"\D", "", p or "")
    if len(d) == 10 and d.startswith("10"):   # 0이 빠진 010 → 보정
        d = "0" + d
    if len(d) == 11 and d.startswith("01"):   # 01012345678
        return f"{d[:3]}-{d[3:7]}-{d[7:]}"
    if len(d) == 10 and d.startswith("01"):    # 011/016 등 구형
        return f"{d[:3]}-{d[3:6]}-{d[6:]}"
    return (p or "").strip()                   # 형식 불명: 원본 유지


# ── Supabase 저장 ────────────────────────────────────────────
def save_application(name, phone, email):
    if not (SUPABASE_URL and SUPABASE_KEY):
        return False, "Supabase 미설정"
    body = json.dumps({"name": name, "phone": phone, "email": email}).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/applications",
        data=body, method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return (r.status in (200, 201)), f"status {r.status}"
    except urllib.error.HTTPError as e:
        return False, f"{e.code}: {e.read().decode('utf-8')[:200]}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


# ── 이메일 발송 ──────────────────────────────────────────────
def email_html(name, link):
    return f"""\
<!doctype html><html><body style="margin:0;background:#f4f6fb;padding:24px;font-family:'Malgun Gothic',Apple SD Gothic Neo,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06)">
    <div style="background:#1a3c7a;color:#fff;padding:22px 26px">
      <div style="font-size:12px;opacity:.8;letter-spacing:1px">호서대 2026 AI 활용 8주 완성 실전 워크숍</div>
      <div style="font-size:20px;font-weight:700;margin-top:6px">신청이 완료되었습니다 🎉</div>
    </div>
    <div style="padding:26px">
      <p style="font-size:15px;color:#222"><b>{name}</b>님, 안녕하세요.</p>
      <p style="font-size:14px;color:#444;line-height:1.7">아래 일정으로 진행되는 라이브에 입장하실 수 있습니다.</p>
      <div style="background:#f4f6fb;border-radius:10px;padding:16px 18px;margin:18px 0;font-size:13px;color:#333;line-height:2">
        <div>📅 <b>일시</b> &nbsp; {SCHEDULE_TEXT}</div>
        <div>💻 <b>방식</b> &nbsp; Zoom 온라인 라이브</div>
        <div>🔗 <b>회의 ID</b> &nbsp; {MEETING_ID}</div>
        <div>🔑 <b>입장</b> &nbsp; 아래 버튼 클릭 시 자동 입장(비밀번호 포함)</div>
      </div>
      <p style="text-align:center;margin:24px 0">
        <a href="{link}" style="display:inline-block;background:#ffe14d;color:#1a1a1a;font-weight:700;
           text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px">▶ Zoom 라이브 입장하기</a>
      </p>
      <p style="font-size:12px;color:#888;line-height:1.6">버튼이 안 보이면 링크를 복사하세요:<br>{link}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:22px 0">
      <p style="font-size:12px;color:#999">본 메일은 워크숍 신청자에게 발송되는 정보성 안내입니다.</p>
    </div>
  </div>
</body></html>"""


def send_email(to_email, name, link):
    if not (GMAIL_USER and GMAIL_APP_PASSWORD):
        return False, "이메일 미설정"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[호서대 2026 AI 워크숍] 신청이 완료되었습니다"
    msg["From"] = formataddr((MAIL_FROM_NAME, GMAIL_USER))
    msg["To"] = to_email
    msg.attach(MIMEText(email_html(name, link), "html", "utf-8"))
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx, timeout=20) as s:
            s.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            s.sendmail(GMAIL_USER, [to_email], msg.as_string())
        return True, "sent"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def notify_webhook(name, phone, email):
    """Apps Script 웹앱으로 신청정보 전송 → 구글시트 기록 + 이메일 발송(MailApp).
    Railway가 SMTP를 차단하므로 메일 발송을 Google(Apps Script)에 위임한다."""
    if not SHEET_WEBHOOK_URL:
        return False, "웹훅 미설정"
    payload = json.dumps({
        "name": name, "phone": phone, "email": email,
        "link": LIVE_LINK, "schedule": SCHEDULE_TEXT, "meetingId": MEETING_ID,
    }).encode("utf-8")
    req = urllib.request.Request(
        SHEET_WEBHOOK_URL, data=payload, method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return True, f"status {r.status}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def _notify_bg(name, phone, email):
    """백그라운드: 웹훅(시트+메일) 호출. 웹훅 미설정 시(로컬 등) SMTP로 폴백."""
    ok, info = notify_webhook(name, phone, email)
    print(f"[웹훅] {email} -> {ok} ({info})", flush=True)
    if not SHEET_WEBHOOK_URL and GMAIL_USER and GMAIL_APP_PASSWORD:
        ok2, info2 = send_email(email, name, LIVE_LINK)
        print(f"[메일-폴백] {email} -> {ok2} ({info2})", flush=True)


# ── 페이지 ───────────────────────────────────────────────────
FORM_HTML = """<!doctype html><html lang=ko><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>호서대 2026 AI 워크숍 신청</title>
<style>
body{font-family:'Malgun Gothic',sans-serif;background:#0b1020;color:#eee;display:flex;justify-content:center;padding:40px}
.card{background:#161c2e;max-width:460px;width:100%;padding:32px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.4)}
h1{font-size:20px;margin:0 0 4px}p.sub{color:#9aa4bf;margin:0 0 22px;font-size:13px;line-height:1.6}
label{display:block;margin:14px 0 6px;font-size:13px;color:#cdd5ee}
input{width:100%;padding:12px;border:1px solid #2a3350;border-radius:8px;background:#0e1322;color:#fff;box-sizing:border-box;font-size:14px}
.chk{margin-top:18px;font-size:12px;color:#9aa4bf;display:flex;gap:8px;align-items:flex-start}
.chk input{width:auto;margin-top:2px}
button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:10px;background:#ffe14d;color:#1a1a1a;font-weight:700;font-size:15px;cursor:pointer}
.tag{display:inline-block;background:#243b8a;color:#cfe0ff;font-size:11px;padding:3px 8px;border-radius:6px;margin-bottom:12px}
</style></head><body><div class=card>
<span class=tag>실전 워크숍 · 8주 완성</span>
<h1>호서대 2026 AI 활용 8주 완성 실전 워크숍</h1>
<p class=sub>신청하시면 입력하신 이메일로 1주차 라이브 링크를 자동 발송해 드립니다.</p>
<form method=post action=/apply>
<label>이름</label><input name=name required placeholder="홍길동">
<label>휴대폰</label><input name=phone placeholder="010-1234-5678">
<label>이메일</label><input name=email type=email required placeholder="you@example.com">
<div class=chk><input type=checkbox required id=agree><label for=agree style="margin:0">개인정보 수집·이용 및 안내 메일 수신에 동의합니다. (필수)</label></div>
<button type=submit>신청하고 라이브 링크 받기</button>
</form></div></body></html>"""


def result_html(saved, mailed, name, detail):
    s_line = "✅ 신청 명단 저장 완료" if saved else f"⚠️ 저장 실패 — {detail}"
    m_line = "📧 안내 이메일을 발송했습니다 (잠시 후 메일함 확인)" if mailed else "ℹ️ 이메일 미발송(설정 확인)"
    return ("<!doctype html><html lang=ko><head><meta charset=utf-8>"
            "<style>body{font-family:'Malgun Gothic',sans-serif;background:#0b1020;color:#eee;"
            "display:flex;justify-content:center;padding:60px}.card{background:#161c2e;max-width:460px;"
            "padding:32px;border-radius:16px}h1{font-size:22px}p.sub{color:#9aa4bf;font-size:14px;line-height:1.8}"
            "a{color:#ffe14d}</style></head><body><div class=card>"
            f"<h1>🎉 {name}님, 신청 완료!</h1><p class=sub>{s_line}<br>{m_line}</p>"
            "<p><a href=/>← 다시 신청</a></p></div></body></html>")


class H(BaseHTTPRequestHandler):
    def _send(self, html, code=200):
        b = html.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(FORM_HTML)
        elif self.path == "/health":
            self._send("ok")
        else:
            self._send("<h1>404</h1>", 404)

    def do_POST(self):
        if self.path != "/apply":
            return self._send("<h1>404</h1>", 404)
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n)
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", "replace")
        data = urllib.parse.parse_qs(text)
        name = (data.get("name", [""])[0]).strip()
        phone = normalize_phone((data.get("phone", [""])[0]).strip())
        email = (data.get("email", [""])[0]).strip()
        saved, detail = save_application(name, phone, email)
        # 시트기록+이메일은 백그라운드(웹훅)로 → 폼은 즉시 응답
        if email:
            threading.Thread(target=_notify_bg, args=(name, phone, email), daemon=True).start()
        print(f"[신청] {name}/{email} -> save {saved}({detail}) | notify: background", flush=True)
        self._send(result_html(saved, True, name, detail))

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"서버 시작: 0.0.0.0:{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
