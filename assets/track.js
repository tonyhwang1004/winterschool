/* 김엄마 홈페이지 — 방문·클릭 기록 (2026-10-27)
 *
 * 왜 만들었나
 *   지금은 누가 들어와서 무엇을 누르는지 전혀 모릅니다.
 *   어느 글을 읽고 상담으로 가는지 알아야 홈페이지를 고칠 수 있습니다.
 *
 * ── 개인정보 3중 방어 ──
 *   1차  모을 때   입력칸 근처는 아예 안 읽고, 주소의 물음표 뒤는 버립니다
 *   2차  보낼 때   보내기 직전에 전체를 한 번 더 훑어 전화·이메일·주민번호를 가립니다
 *   3차  저장할 때 서버가 똑같은 기준으로 다시 한 번 가리고 저장합니다
 *   → 세 군데 중 하나만 뚫려도 나머지 둘이 막습니다.
 *
 *   사람을 구분하는 것은 브라우저가 스스로 만든 임의 번호 하나뿐입니다.
 *   이름·연락처는 보내지 않고, 보낼 수도 없습니다.
 *
 * 홈페이지를 느리게 하지 않습니다
 *   sendBeacon 으로 던지고 답을 기다리지 않습니다. 서버가 죽어도 화면은 그대로입니다.
 */
(function () {
  'use strict';
  if (window.__track붙음) return;
  window.__track붙음 = true;

  var 보낼곳 = 'https://asia-northeast3-kimsmom-reading-room.cloudfunctions.net/api/track';
  var 사이트 = 'kimmom';

  /* ───────── 개인정보 지우개 ───────── */
  var 가릴것 = [
    [/\d{6}\s*[-–]\s*[1-4]\d{6}/g, '[주민번호가림]'],
    [/\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '[전화번호가림]'],
    [/\b0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}\b/g, '[전화번호가림]'],
    [/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[카드번호가림]'],
    [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[이메일가림]'],
    [/\b\d{8,}\b/g, '[숫자가림]']
  ];
  /* 「○○님」·「○○ 학생」 같은 이름 자리. 직책은 그대로 둡니다 */
  var 이름아님 = ['원장','선생','강사','실장','대표','사장','고객','손님','회원','학부모',
                  '어머','아버','부모','관리','담임','조교','상담'];
  function 이름가리기(s) {
    return String(s).replace(/([가-힣]{2,4})\s*(님|학생|어머님|아버님)/g, function (전체, 앞) {
      return 이름아님.indexOf(앞) >= 0 ? 전체 : '[이름가림]';
    });
  }
  function 지우개(s) {
    s = String(s == null ? '' : s);
    for (var i = 0; i < 가릴것.length; i++) s = s.replace(가릴것[i][0], 가릴것[i][1]);
    return 이름가리기(s);
  }
  /* 아직도 남아 있으면 통째로 버립니다 (막는 쪽으로 실패) */
  function 안전한가(s) {
    for (var i = 0; i < 가릴것.length; i++) { 가릴것[i][0].lastIndex = 0;
      if (가릴것[i][0].test(String(s))) return false; }
    return true;
  }
  /* 주소에서 물음표 뒤와 우물정 뒤는 버립니다 — 거기에 개인정보가 실릴 수 있습니다 */
  function 주소만(u) {
    try {
      if (!u) return '';
      var a = new URL(u, location.href);
      return (a.origin === location.origin ? '' : a.origin) + a.pathname;
    } catch (e) { return String(u).split('?')[0].split('#')[0]; }
  }

  /* ───────── 방문자 번호: 사람이 아니라 "같은 브라우저"만 묶습니다 ───────── */
  function 방문자번호() {
    try {
      var k = 'km_v', v = localStorage.getItem(k);
      if (!v) { v = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                localStorage.setItem(k, v); }
      return v;
    } catch (e) { return ''; }
  }

  /* ───────── 들어온 길(utm)은 첫 쪽에서만 붙고, 속 쪽으로 가도 기억합니다 ───────── */
  function 유입기억() {
    var out = { utmSource: '', utmMedium: '', utmCampaign: '' }, q;
    try { q = new URLSearchParams(location.search); } catch (e) { return out; }
    var 새것 = q.get('utm_source') || '';
    if (새것) {
      out.utmSource = 새것.slice(0, 40);
      out.utmMedium = (q.get('utm_medium') || '').slice(0, 40);
      out.utmCampaign = (q.get('utm_campaign') || '').slice(0, 40);
      try { sessionStorage.setItem('km_utm', JSON.stringify(out)); } catch (e) {}
      return out;
    }
    try { var 담긴 = JSON.parse(sessionStorage.getItem('km_utm') || 'null'); if (담긴) return 담긴; } catch (e) {}
    return out;
  }

  var 유입 = 유입기억();
  var 번호 = 방문자번호();

  function 보내기(행동, 무엇) {
    try {
      /* 2차 방어 — 보내기 직전에 전체를 한 번 더 훑습니다 */
      var 짐덩이 = {
        site: 사이트,
        event: 행동,
        path: 주소만(location.pathname),
        label: 지우개(무엇).slice(0, 100),
        utmSource: 지우개(유입.utmSource),
        utmMedium: 지우개(유입.utmMedium),
        utmCampaign: 지우개(유입.utmCampaign),
        referrer: 주소만(document.referrer || ''),
        visitor: 번호
      };
      for (var k in 짐덩이) {
        if (!Object.prototype.hasOwnProperty.call(짐덩이, k)) continue;
        if (k === 'visitor') continue;
        if (!안전한가(짐덩이[k])) 짐덩이[k] = '[가림]';
      }
      var 짐 = JSON.stringify(짐덩이);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(보낼곳, new Blob([짐], { type: 'text/plain;charset=UTF-8' }));
      } else {
        fetch(보낼곳, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                       body: 짐, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* 기록 실패가 화면을 막지 않습니다 */ }
  }

  /* ───────── 쪽을 열었다 ───────── */
  보내기('page_view', document.title || '');

  /* ───────── 누른 것 ─────────
     1차 방어가 여기에 있습니다.
     · 입력칸·글쓰기칸 안에서 일어난 누름은 아예 보지 않습니다
     · data-비공개 가 붙은 곳(상담 내용, 신청자 목록 등)도 건너뜁니다
     · 주소는 물음표 앞까지만 붙입니다
  */
  function 숨길곳인가(el) {
    for (var p = el; p && p !== document.body; p = p.parentElement) {
      var t = (p.tagName || '').toLowerCase();
      if (t === 'input' || t === 'textarea' || t === 'select' || t === 'form') return true;
      if (p.isContentEditable) return true;
      if (p.hasAttribute && p.hasAttribute('data-비공개')) return true;
    }
    return false;
  }
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (숨길곳인가(el)) return;
    for (var i = 0; i < 4 && el && el !== document.body; i++) {
      var 태그 = (el.tagName || '').toLowerCase();
      if (태그 === 'a' || 태그 === 'button' || el.getAttribute('role') === 'button') {
        var 이름 = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
        var h = el.getAttribute && el.getAttribute('href');
        if (태그 === 'a' && h && h.charAt(0) !== '#') 이름 = 이름 + ' → ' + 주소만(h);
        보내기('click', 이름);
        return;
      }
      el = el.parentElement;
    }
  }, true);

  /* ───────── 끝까지 읽었다 (한 쪽에 한 번만) ───────── */
  var 끝봤다 = false;
  window.addEventListener('scroll', function () {
    if (끝봤다) return;
    var 바닥 = document.documentElement.scrollHeight - window.innerHeight;
    if (바닥 > 0 && window.scrollY / 바닥 > 0.9) { 끝봤다 = true; 보내기('scroll_end', document.title || ''); }
  }, { passive: true });
})();
