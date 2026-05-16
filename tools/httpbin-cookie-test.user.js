// ==UserScript==
// @name         Pace Tracker — HttpOnly Cookie Diagnostic
// @namespace    https://github.com/rad-orlowski/claude-pace-tracker
// @version      1.0.0
// @description  Diagnoses whether Tampermonkey can read HttpOnly cookies via GM.cookie.list. Sets a test cookie on httpbin.org with HttpOnly flag, then tries to read it back. Compare results to determine whether the "Allow scripts to access cookies: All" setting is actually working.
// @match        https://httpbin.org/*
// @run-at       document-end
// @grant        GM.xmlHttpRequest
// @grant        GM.cookie
// @connect      httpbin.org
// ==/UserScript==

(async () => {
  const LOG = (...args) => console.log('%c[pace-cookie-test]', 'color:#7c3aed;font-weight:bold', ...args);

  LOG('starting HttpOnly cookie diagnostic on httpbin.org');

  const stamp = Date.now().toString(36);
  const expires = encodeURIComponent('Wed, 21 Sep 2033 15:59:37 GMT');

  // Set two cookies via httpbin's response-headers endpoint: one HttpOnly, one plain.
  // Same value (stamp) so we can verify they came from this run.
  const setUrl = (name, extra) =>
    `https://httpbin.org/response-headers?set-cookie=${name}=${stamp};path=/;expires=${expires};secure;samesite=none${extra}`;

  LOG('setting httponlytest (with HttpOnly flag)…');
  await GM.xmlHttpRequest({ url: setUrl('httponlytest', ';httponly') });

  LOG('setting plaintest (no HttpOnly flag)…');
  await GM.xmlHttpRequest({ url: setUrl('plaintest', '') });

  await new Promise(r => setTimeout(r, 300));   // tiny gap so cookies are committed

  // Read back via two GM.cookie.list call shapes.
  const basic       = await GM.cookie.list({ url: 'https://httpbin.org/' }).catch(() => []);
  const partitioned = await GM.cookie.list({ url: 'https://httpbin.org/', partitionKey: {} }).catch(() => []);

  const summarize = (label, list) => {
    const names = list.map(c => c.name);
    LOG(`${label} → count=${list.length}`, {
      hasHttpOnly:  names.includes('httponlytest'),
      hasPlain:     names.includes('plaintest'),
      names,
    });
  };

  summarize('GM.cookie.list { url }',                   basic);
  summarize('GM.cookie.list { url, partitionKey:{} }',  partitioned);

  // document.cookie sanity check — HttpOnly should NEVER appear here.
  const docNames = (document.cookie || '').split(/;\s*/).map(p => p.split('=')[0]).filter(Boolean);
  LOG('document.cookie:', { hasHttpOnly: docNames.includes('httponlytest'), hasPlain: docNames.includes('plaintest'), names: docNames });

  LOG('done. expected: HttpOnly→true in at least one GM.cookie.list, HttpOnly→false in document.cookie.');
})();
