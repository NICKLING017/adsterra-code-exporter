(() => {
  'use strict';
  if (window.__aceContentLoaded) return;
  window.__aceContentLoaded = true;
  const all = (s, r = document) => [...r.querySelectorAll(s)];
  const rowOf = el => el.closest('[role="row"], tr');
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let busy = false;
  async function until(fn, message) {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      const result = fn();
      if (result) return result;
      await wait(100);
    }
    throw new Error(message);
  }
  function groups() {
    // Locate a website by its actual expand control. Not every visual grid
    // row/cell has an ARIA role, so do not depend on table markup here.
    return all('button[aria-label="see children"], button[aria-label="hide children"]').map(toggle => {
      let row = toggle.parentElement;
      while (row && !/\d+\s*Ad\s*Units?/i.test(row.textContent)) row = row.parentElement;
      if (!row || row.querySelectorAll('button[aria-label="see children"], button[aria-label="hide children"]').length !== 1) return null;
      const domainPattern = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
      const cell = all('a, span, p, div', row).find(el => domainPattern.test(el.textContent.trim()) && ![...el.children].some(child => domainPattern.test(child.textContent.trim())));
      const domain = cell?.textContent.trim();
      const cleanRow = row.cloneNode(true);
      all('.ace-row-btn, .ace-toast', cleanRow).forEach(el => el.remove());
      const count = Number(cleanRow.textContent.match(/(\d+)\s*Ad\s*Units?/i)?.[1]);
      return domain ? {row, cell, domain, count} : null;
    }).filter(Boolean);
  }
  function units(domain) {
    const sites = groups();
    const target = sites.find(g => g.domain === domain);
    if (!target) throw new Error('网站行已变化，请重试');
    const next = sites[sites.indexOf(target) + 1];
    return all('button').filter(b => visible(b) && /^get\s*code$/i.test(b.textContent.trim()) &&
      (target.row.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (!next || (b.compareDocumentPosition(next.row) & Node.DOCUMENT_POSITION_FOLLOWING)));
  }
  function dialog() {
    return all('[role="dialog"]').find(visible) || all('[class*="MuiModal-root"]').find(visible);
  }
  function codeIn(root) {
    if (!root) return '';
    const candidates = all('textarea, pre, code, p, [role="textbox"]', root).map(el => String(el.value ?? el.textContent ?? '').trim())
      .filter(text => /^(?:<script\b|<iframe\b|<div\b|atOptions\s*=|https?:\/\/)/i.test(text));
    return [...new Set(candidates)].filter(text => !candidates.some(other => other !== text && other.includes(text))).join('\n');
  }
  async function close(root) {
    const button = all('button', root).find(b => /^close$/i.test(b.textContent.trim()) || /close/i.test(b.getAttribute('aria-label') || ''));
    if (!button) throw new Error('找不到代码弹窗的关闭按钮');
    button.click();
    await until(() => !visible(root), '代码弹窗未关闭');
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
      document.body.append(area);
      area.select();
      try { if (!document.execCommand('copy')) throw new Error('剪贴板写入失败'); }
      finally { area.remove(); }
    }
  }
  async function run(domain, button) {
    if (busy) return;
    busy = true;
    all('.ace-row-btn').forEach(b => b.disabled = true);
    let ownedDialog;
    try {
      if (dialog()) throw new Error('请先关闭当前弹窗');
      const site = groups().find(g => g.domain === domain);
      const expand = site?.row.querySelector('[aria-label="see children"]');
      if (expand) expand.click();
      if (!site || !site.count) throw new Error('该网站没有广告位');
      button.textContent = '等待广告位加载';
      const initial = await until(() => {
        const list = units(domain).filter(action => !action.disabled);
        return list.length === site.count ? list : null;
      }, `广告位未全部就绪（应有 ${site.count} 个），请检查是否有待审核广告位`);
      const codes = [];
      for (let i = 0; i < initial.length; i++) {
        button.textContent = `读取 ${i + 1}/${initial.length}`;
        const action = units(domain)[i];
        if (!action) throw new Error('广告位列表已变化，请重试');
        const label = rowOf(action)?.textContent.replace(/Get code/gi, '').trim() || `广告位 ${i + 1}`;
        action.click();
        ownedDialog = await until(dialog, '代码弹窗未打开');
        const code = await until(() => codeIn(ownedDialog), '弹窗中未找到完整代码');
        codes.push(`<!-- ${label.replace(/--/g, ' ').replace(/\s+/g, ' ')} -->\n${code}`);
        await close(ownedDialog);
        ownedDialog = null;
      }
      await copy(`<!-- Adsterra: ${domain} -->\n\n${codes.join('\n\n')}`);
      button.textContent = `已复制 ${codes.length}/${initial.length}`;
      button.title = '全部广告位代码已写入剪贴板';
    } catch (error) {
      button.textContent = '复制失败，点击重试';
      button.title = error.message;
      const toast = document.createElement('div');
      toast.className = 'ace-toast';
      toast.setAttribute('role', 'status');
      toast.textContent = error.message;
      document.body.append(toast);
      setTimeout(() => toast.remove(), 8000);
    } finally {
      if (ownedDialog && visible(ownedDialog)) { try { await close(ownedDialog); } catch (_) {} }
      busy = false;
      all('.ace-row-btn').forEach(b => b.disabled = false);
      inject();
    }
  }
  function inject() {
    if (busy) return;
    for (const site of groups()) {
      if (site.row.querySelector('.ace-row-btn')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ace-row-btn';
      button.textContent = '复制全部广告代码';
      button.title = `复制 ${site.domain} 的全部广告代码`;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        run(site.domain, button);
      });
      site.cell.insertAdjacentElement('afterend', button);
    }
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled || busy) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; inject(); }, 150);
  }).observe(document.body, {childList: true, subtree: true});
  inject();
})();
