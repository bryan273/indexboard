/** One language choice for the whole suite. Every app keeps its own storage key; this mirrors it to `repro.lang`, which all apps share. */
export function shareLang(ownKey: string): void {
  try {
    const shared = localStorage.getItem('repro.lang');
    if (shared === 'en' || shared === 'zh') localStorage.setItem(ownKey, shared);
    const set = Storage.prototype.setItem;
    if ((Storage.prototype as unknown as { __suiteLang?: boolean }).__suiteLang) return;
    Storage.prototype.setItem = function (k: string, v: string) {
      set.call(this, k, v);
      if (this === localStorage && k === ownKey && (v === 'en' || v === 'zh')) set.call(this, 'repro.lang', v);
    };
    (Storage.prototype as unknown as { __suiteLang?: boolean }).__suiteLang = true;
  } catch {
    /* storage can be blocked; the app then simply keeps its own choice */
  }
}
