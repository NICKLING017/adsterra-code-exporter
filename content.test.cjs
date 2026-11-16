const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const script = fs.readFileSync(require('node:path').join(__dirname, 'content.js'), 'utf8');
const pause = ms => new Promise(r => setTimeout(r, ms));
async function scenario(failIndex = -1, stagger = false) {
  const dom = new JSDOM('<body><main></main></body>', {runScripts:'outside-only', url:'https://beta.publishers.adsterra.com/websites'});
  const w = dom.window;
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
  let copied = null;
  Object.defineProperty(w.navigator, 'clipboard', {value:{writeText: async text => {copied = text;}}});
  const main = w.document.querySelector('main');
  const site = w.document.createElement('section');
  // No role=row or table markup; no whitespace between cell text nodes.
  site.innerHTML = '<div><button aria-label="see children"></button><span>sample.wiki</span></div><div>4 Ad Units</div><div>6204146</div>';
  main.append(site);
  const other = w.document.createElement('section');
  other.innerHTML = '<div><button aria-label="see children"></button><span>other.wiki</span></div><div>1 Ad Units</div>';
  main.append(other);
  const snippets = [
    '<script src="https://example.test/native.js"></script><div id="container-native"></div>',
    '<script src="https://example.test/social.js"></script>',
    '<script>atOptions = {key:"banner1"};</script><script src="https://example.test/invoke.js"></script>',
    '<script>atOptions = {key:"banner2"};</script><script src="https://example.test/invoke.js"></script>'
  ];
  site.querySelector('button').onclick = event => {
    event.target.setAttribute('aria-label', 'hide children');
    snippets.forEach((code, i) => {
      const row = w.document.createElement('div');
      const action = w.document.createElement('button');
      action.textContent = 'Get code';
      action.onclick = () => {
        assert.equal(w.document.querySelectorAll('[role="dialog"]').length, 0, 'Previous dialog must close');
        const modal = w.document.createElement('div');
        modal.setAttribute('role', 'dialog');
        const paragraph = w.document.createElement('p');
        paragraph.textContent = i === failIndex ? 'Unavailable' : code;
        const close = w.document.createElement('button');
        close.textContent = 'Close';
        close.onclick = () => modal.remove();
        modal.append(paragraph, close);
        w.document.body.append(modal);
      };
      row.append(action);
      if (stagger && i > 0) w.setTimeout(() => main.insertBefore(row, other), i * 150);
      else main.insertBefore(row, other);
    });
  };
  w.eval(script);
  assert.equal(w.document.querySelectorAll('.ace-row-btn').length, 2, 'Collapsed websites each get a button');
  assert.equal(site.querySelector('span').nextElementSibling.className, 'ace-row-btn', 'Button follows domain');
  const button = site.querySelector('.ace-row-btn');
  button.click();
  const deadline = Date.now() + (failIndex < 0 ? 3000 : 12000);
  while (button.disabled && Date.now() < deadline) await pause(50);
  assert.equal(button.disabled, false, 'Run completes and unlocks UI');
  if (failIndex < 0) {
    assert.match(button.textContent, /已复制 4\/4/);
    snippets.forEach(code => assert.ok(copied.includes(code), 'Full snippet preserved'));
    assert.equal((copied.match(/container-native/g) || []).length, 1);
    assert.equal(w.document.querySelectorAll('.ace-row-btn').length, 2, 'No duplicate buttons after mutations');
    // Actual production failure: the button shares the ad-count cell, so
    // its success label and count concatenate as "已复制 4/44 Ad Units".
    site.children[1].prepend(button);
    for (let repeat = 0; repeat < 2; repeat++) {
      copied = null;
      button.click();
      const repeatDeadline = Date.now() + 3000;
      while (button.disabled && Date.now() < repeatDeadline) await pause(50);
      assert.match(button.textContent, /已复制 4\/4/, button.title);
      assert.ok(copied.includes(snippets[0]), 'Repeat copies complete code');
    }
  } else {
    assert.equal(copied, null, 'Failure must not overwrite clipboard with partial output');
    assert.match(button.textContent, /失败/);
  }
  assert.equal(w.document.querySelectorAll('[role="dialog"]').length, 0);
  dom.window.close();
}
(async () => {
  await scenario();
  console.log('PASS: collapsed sites, non-table rows, adjacent button, auto-expand, 4 complete snippets, closing dialogs, no duplicates');
  await scenario(-1, true);
  console.log('PASS: staggered loading succeeds on first click; repeated copy ignores own 4/4 label');
  await scenario(1);
  console.log('PASS: timeout does not copy partial output; dialog cleaned up; retry enabled');
})().catch(error => {console.error(error); process.exitCode = 1;});
