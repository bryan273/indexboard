import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Eye, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SiteHeader, { SiteFooter } from '@/components/board/SiteHeader';
import BoardView from '@/components/board/BoardView';
import {
  docToDraft,
  draftToDoc,
  emptyCell,
  emptyDraft,
  exampleDoc,
  ImportError,
  importCsv,
  importJson,
  itemsToDraft,
  makeId,
  type Draft,
  type DraftCell,
  type DraftIssue,
  type Metric,
} from '@/lib/board';
import {
  createBoard,
  errorMessage,
  errorStatus,
  getBoard,
  getStoredKey,
  shareUrl,
  storeKey,
  updateBoard,
  verifyKey,
} from '@/lib/boardApi';
import { useI18n } from '@/lib/i18n';
import { BoardStateNotice } from './BoardPage';

const AUTO = '__auto__';
const NONE = 'none';
const CELL_FIELDS: (keyof DraftCell)[] = ['value', 'low', 'high', 'runs'];

function Section({ title, hint, children, aside }: { title: string; hint?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif-display text-xl font-semibold">{title}</h2>
          {hint && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const { t } = useI18n();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error(t('b.copyFailed'));
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className={`h-11 ${mono ? 'font-mono-plex' : ''}`} onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" className="h-11 w-11 shrink-0 !bg-transparent p-0 hover:!bg-muted" onClick={copy} aria-label={label}>
          <Copy className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const isEdit = Boolean(slug);

  const [draft, setDraft] = useState<Draft>(() => (params.get('example') && !slug ? docToDraft(exampleDoc(lang)) : emptyDraft()));
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [pasteJson, setPasteJson] = useState('');
  const [pasteCsv, setPasteCsv] = useState('');
  const [importErr, setImportErr] = useState('');
  const [dataTab, setDataTab] = useState('table');
  const [published, setPublished] = useState<{ slug: string; key: string } | null>(null);

  const [editKey, setEditKey] = useState('');
  const [unlock, setUnlock] = useState<'loading' | 'locked' | 'ready' | 'missing' | 'error'>(isEdit ? 'loading' : 'ready');
  const [keyInput, setKeyInput] = useState('');
  const [keyErr, setKeyErr] = useState('');
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      try {
        const board = await getBoard(slug);
        if (!alive) return;
        setDraft(docToDraft(board));
        const stored = getStoredKey(slug);
        if (stored && (await verifyKey(slug, stored))) {
          if (!alive) return;
          setEditKey(stored);
          setUnlock('ready');
        } else if (alive) setUnlock('locked');
      } catch (e) {
        if (!alive) return;
        if (errorStatus(e) === 404) setUnlock('missing');
        else {
          setLoadErr(errorMessage(e, t('b.loadError')));
          setUnlock('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const preview = useMemo(() => (mode === 'preview' ? draftToDoc(draft).doc : null), [mode, draft]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const patchMetric = (id: string, p: Partial<Metric>) =>
    setDraft((d) => ({ ...d, metrics: d.metrics.map((m) => (m.id === id ? { ...m, ...p } : m)) }));
  const addMetric = () =>
    setDraft((d) => {
      const m: Metric = { id: makeId('m'), name: '', unit: '', direction: 'higher' };
      return { ...d, metrics: [...d.metrics, m], items: d.items.map((it) => ({ ...it, cells: { ...it.cells, [m.id]: emptyCell() } })) };
    });
  const removeMetric = (id: string) =>
    setDraft((d) => ({
      ...d,
      metrics: d.metrics.filter((m) => m.id !== id),
      primary_metric_id: d.primary_metric_id === id ? '' : d.primary_metric_id,
      cost_metric_id: d.cost_metric_id === id ? '' : d.cost_metric_id,
    }));
  const addItem = () =>
    setDraft((d) => ({
      ...d,
      items: [...d.items, { id: makeId('i'), name: '', cells: Object.fromEntries(d.metrics.map((m) => [m.id, emptyCell()])) }],
    }));
  const removeItem = (id: string) => setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  const setCell = (itemId: string, metricId: string, field: keyof DraftCell, value: string) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) =>
        it.id === itemId ? { ...it, cells: { ...it.cells, [metricId]: { ...(it.cells[metricId] ?? emptyCell()), [field]: value } } } : it,
      ),
    }));

  const loadExample = () => {
    setDraft(docToDraft(exampleDoc(lang)));
    setIssues([]);
    setDataTab('table');
  };

  const runImport = (kind: 'json' | 'csv') => {
    setImportErr('');
    try {
      if (kind === 'csv') {
        const { metrics, items } = importCsv(pasteCsv);
        setDraft((d) => ({ ...d, metrics, items: itemsToDraft(items, metrics), primary_metric_id: '', cost_metric_id: '' }));
        toast.success(t('ed.imported', { items: items.length, metrics: metrics.length }));
      } else {
        const res = importJson(pasteJson);
        const p = res.payload;
        setDraft((d) => ({
          ...d,
          title: res.title ?? d.title,
          description: res.description ?? d.description,
          metrics: p.metrics,
          items: itemsToDraft(p.items, p.metrics),
          primary_metric_id: p.primary_metric_id ?? '',
          cost_metric_id: p.cost_metric_id ?? '',
          formula: p.methodology?.formula ?? d.formula,
          worked_example: p.methodology?.worked_example ?? d.worked_example,
          held_fixed: p.methodology ? p.methodology.held_fixed.join('\n') : d.held_fixed,
        }));
        toast.success(t('ed.imported', { items: p.items.length, metrics: p.metrics.length }));
      }
      setDataTab('table');
    } catch (e) {
      if (e instanceof ImportError) setImportErr(t(e.key, { detail: e.detail }));
      else setImportErr(String(e));
    }
  };

  const validate = () => {
    const res = draftToDoc(draft);
    setIssues(res.issues);
    if (!res.doc) window.scrollTo({ top: 0, behavior: 'smooth' });
    return res.doc;
  };

  const showPreview = () => {
    if (validate()) {
      setMode('preview');
      window.scrollTo({ top: 0 });
    }
  };

  const save = async () => {
    const doc = validate();
    if (!doc) return;
    setSaving(true);
    try {
      if (isEdit && slug) {
        await updateBoard(slug, doc, editKey);
        toast.success(t('ed.saveChanges'));
        navigate(`/b/${slug}`);
      } else {
        const res = await createBoard(doc);
        storeKey(res.slug, res.edit_key);
        setPublished({ slug: res.slug, key: res.edit_key });
      }
    } catch (e) {
      if (errorStatus(e) === 403) setUnlock('locked');
      toast.error(t('err.saveFailed', { detail: errorMessage(e, '') }));
    } finally {
      setSaving(false);
    }
  };

  const tryUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!slug || !keyInput.trim()) return;
    setKeyErr('');
    try {
      if (await verifyKey(slug, keyInput.trim())) {
        storeKey(slug, keyInput.trim());
        setEditKey(keyInput.trim());
        setUnlock('ready');
      } else setKeyErr(t('key.wrong'));
    } catch (err) {
      setKeyErr(errorMessage(err, t('key.wrong')));
    }
  };

  const metricOptions = draft.metrics.filter((m) => m.name.trim());
  const saveLabel = saving ? t('ed.saving') : isEdit ? t('ed.saveChanges') : t('ed.publish');

  const body = () => {
    if (unlock === 'loading') return <BoardStateNotice state={{ kind: 'loading' }} onRetry={() => undefined} />;
    if (unlock === 'missing') return <BoardStateNotice state={{ kind: 'missing' }} onRetry={() => undefined} />;
    if (unlock === 'error') return <BoardStateNotice state={{ kind: 'error', message: loadErr }} onRetry={() => window.location.reload()} />;
    if (unlock === 'locked')
      return (
        <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
          <form onSubmit={tryUnlock} className="panel flex flex-col gap-4 p-6">
            <h1 className="font-serif-display text-2xl font-semibold">{t('key.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('key.desc')}</p>
            <Input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={t('key.ph')}
              aria-label={t('key.ph')}
              className="font-mono-plex h-11"
              aria-invalid={Boolean(keyErr)}
            />
            {keyErr && (
              <p role="alert" className="text-sm text-destructive">
                {keyErr}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="h-11">
                {t('key.submit')}
              </Button>
              <Button asChild variant="ghost" className="h-11">
                <Link to={`/b/${slug}`}>{t('pr.back')}</Link>
              </Button>
            </div>
          </form>
        </div>
      );

    if (mode === 'preview' && preview)
      return (
        <>
          <div className="no-print border-b bg-accent">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <p className="text-sm font-medium text-accent-foreground">{t('ed.unsaved')}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="h-10 !bg-transparent hover:!bg-background" onClick={() => setMode('edit')}>
                  {t('ed.backToEdit')}
                </Button>
                <Button className="h-10" onClick={save} disabled={saving}>
                  {saveLabel}
                </Button>
              </div>
            </div>
          </div>
          <BoardView doc={preview} />
        </>
      );

    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-serif-display text-[34px] font-semibold leading-tight sm:text-[42px]">
            {isEdit ? t('ed.editTitle') : t('ed.newTitle')}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 !bg-transparent hover:!bg-muted" onClick={loadExample}>
              {t('ed.loadExample')}
            </Button>
            {!isEdit && (
              <Button
                variant="ghost"
                className="h-10"
                onClick={() => {
                  setDraft(emptyDraft());
                  setIssues([]);
                }}
              >
                {t('ed.reset')}
              </Button>
            )}
          </div>
        </div>

        {issues.length > 0 && (
          <div role="alert" className="rounded-[10px] border border-destructive/40 bg-destructive/5 px-5 py-4">
            <p className="font-medium text-destructive">{t('ed.fixIssues')}</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
              {issues.slice(0, 12).map((iss, i) => (
                <li key={i}>{t(iss.key, iss.params)}</li>
              ))}
              {issues.length > 12 && <li>…</li>}
            </ul>
          </div>
        )}

        <Section title={t('ed.basics')}>
          <div className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-title">{t('ed.title')}</Label>
              <Input id="b-title" className="h-11" value={draft.title} maxLength={200} placeholder={t('ed.titlePh')} onChange={(e) => patch({ title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-desc">{t('ed.description')}</Label>
              <Textarea
                id="b-desc"
                rows={3}
                value={draft.description}
                maxLength={8000}
                placeholder={t('ed.descriptionPh')}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          </div>
        </Section>

        <Section title={t('ed.data')} hint={t('ed.dataHint')}>
          <Tabs value={dataTab} onValueChange={setDataTab}>
            <TabsList className="mb-5 h-11 w-full justify-start sm:w-auto">
              <TabsTrigger value="table" className="h-9 flex-1 px-4 sm:flex-none">
                {t('ed.tab.table')}
              </TabsTrigger>
              <TabsTrigger value="json" className="h-9 flex-1 px-4 sm:flex-none">
                {t('ed.tab.json')}
              </TabsTrigger>
              <TabsTrigger value="csv" className="h-9 flex-1 px-4 sm:flex-none">
                {t('ed.tab.csv')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {draft.metrics.map((m, i) => (
                  <div key={m.id} className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular text-xs text-muted-foreground">#{i + 1}</span>
                      <Input
                        className="h-10 flex-1"
                        value={m.name}
                        placeholder={t('ed.metricName')}
                        aria-label={t('ed.metricName')}
                        onChange={(e) => patchMetric(m.id, { name: e.target.value })}
                      />
                      <Input
                        className="h-10 w-20"
                        value={m.unit}
                        placeholder={t('ed.unit')}
                        aria-label={t('ed.unit')}
                        onChange={(e) => patchMetric(m.id, { unit: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 w-10 shrink-0 p-0 text-muted-foreground"
                        disabled={draft.metrics.length <= 1}
                        onClick={() => removeMetric(m.id)}
                        aria-label={t('ed.removeMetric', { name: m.name || `#${i + 1}` })}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    <Select value={m.direction} onValueChange={(v) => patchMetric(m.id, { direction: v as Metric['direction'] })}>
                      <SelectTrigger className="h-10" aria-label={m.name || t('ed.metricName')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="higher">{t('ed.dir.higher')}</SelectItem>
                        <SelectItem value="lower">{t('ed.dir.lower')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button type="button" variant="outline" className="h-auto min-h-[96px] border-dashed !bg-transparent hover:!bg-muted" onClick={addMetric}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t('ed.addMetric')}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="sticky left-0 z-10 min-w-[150px] border-b bg-muted px-2 py-2 text-left font-medium">
                        {t('ed.item')}
                      </th>
                      {draft.metrics.map((m, i) => (
                        <th key={m.id} colSpan={4} className="border-b border-l bg-muted px-2 py-2 text-left font-medium">
                          {m.name || `#${i + 1}`}
                          {m.unit && <span className="font-normal text-muted-foreground"> ({m.unit})</span>}
                        </th>
                      ))}
                      <th rowSpan={2} className="border-b bg-muted" />
                    </tr>
                    <tr>
                      {draft.metrics.map((m) =>
                        CELL_FIELDS.map((f, fi) => (
                          <th key={`${m.id}-${f}`} className={`border-b bg-muted px-2 pb-2 text-left text-xs font-normal text-muted-foreground ${fi === 0 ? 'border-l' : ''}`}>
                            {t(`ed.${f}`)}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((it, ri) => (
                      <tr key={it.id}>
                        <td className="sticky left-0 z-[5] border-b bg-card p-1.5">
                          <Input
                            className="h-9"
                            value={it.name}
                            placeholder={t('ed.itemPh')}
                            aria-label={`${t('ed.item')} ${ri + 1}`}
                            onChange={(e) => setDraft((d) => ({ ...d, items: d.items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)) }))}
                          />
                        </td>
                        {draft.metrics.map((m) =>
                          CELL_FIELDS.map((f, fi) => (
                            <td key={`${m.id}-${f}`} className={`border-b p-1.5 ${fi === 0 ? 'border-l' : ''}`}>
                              <Input
                                className={`tabular h-9 ${f === 'runs' ? 'w-16' : 'w-[84px]'} px-2`}
                                inputMode="decimal"
                                value={it.cells[m.id]?.[f] ?? ''}
                                aria-label={`${it.name || ri + 1} ${m.name} ${t(`ed.${f}`)}`}
                                onChange={(e) => setCell(it.id, m.id, f, e.target.value)}
                              />
                            </td>
                          )),
                        )}
                        <td className="border-b p-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-muted-foreground"
                            onClick={() => removeItem(it.id)}
                            aria-label={t('ed.removeItem', { name: it.name || ri + 1 })}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <Button type="button" variant="outline" className="h-10 !bg-transparent hover:!bg-muted" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t('ed.addItem')}
                </Button>
              </div>
            </TabsContent>

            {(['json', 'csv'] as const).map((kind) => (
              <TabsContent key={kind} value={kind} className="flex flex-col gap-3">
                <p className="break-words text-sm text-muted-foreground">{kind === 'json' ? t('ed.jsonHelp') : t('ed.csvHelp')}</p>
                <Textarea
                  rows={12}
                  className="font-mono-plex text-[13px]"
                  value={kind === 'json' ? pasteJson : pasteCsv}
                  aria-label={kind === 'json' ? t('ed.tab.json') : t('ed.tab.csv')}
                  placeholder={
                    kind === 'json'
                      ? '{ "metrics": [...], "items": [...] }'
                      : 'Model,Accuracy (%),Accuracy low,Accuracy high,Accuracy runs,Cost (CNY)\nLumen Pro,78.4,75.9,80.8,5,1.84'
                  }
                  onChange={(e) => (kind === 'json' ? setPasteJson(e.target.value) : setPasteCsv(e.target.value))}
                />
                {importErr && (
                  <p role="alert" className="text-sm text-destructive">
                    {importErr}
                  </p>
                )}
                <div>
                  <Button type="button" className="h-10" onClick={() => runImport(kind)}>
                    {t('ed.import')}
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Section>

        <Section title={t('ed.roles')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t('ed.primary')}</Label>
              <Select value={draft.primary_metric_id && metricOptions.some((m) => m.id === draft.primary_metric_id) ? draft.primary_metric_id : AUTO} onValueChange={(v) => patch({ primary_metric_id: v === AUTO ? '' : v })}>
                <SelectTrigger className="h-11" aria-label={t('ed.primary')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>{t('ed.auto')}</SelectItem>
                  {metricOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[13px] text-muted-foreground">{t('ed.primaryHint')}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('ed.cost')}</Label>
              <Select
                value={draft.cost_metric_id === NONE ? NONE : draft.cost_metric_id && metricOptions.some((m) => m.id === draft.cost_metric_id) ? draft.cost_metric_id : AUTO}
                onValueChange={(v) => patch({ cost_metric_id: v === AUTO ? '' : v })}
              >
                <SelectTrigger className="h-11" aria-label={t('ed.cost')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>{t('ed.auto')}</SelectItem>
                  <SelectItem value={NONE}>{t('ed.costNone')}</SelectItem>
                  {metricOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[13px] text-muted-foreground">{t('ed.costHint')}</p>
            </div>
          </div>
        </Section>

        <Section title={t('ed.method')} hint={t('ed.markdownHint')}>
          <div className="grid gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-formula">{t('ed.formula')}</Label>
              <Textarea id="b-formula" rows={7} value={draft.formula} placeholder={t('ed.formulaPh')} onChange={(e) => patch({ formula: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-worked">{t('ed.worked')}</Label>
              <Textarea id="b-worked" rows={5} value={draft.worked_example} placeholder={t('ed.workedPh')} onChange={(e) => patch({ worked_example: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-fixed">{t('ed.fixed')}</Label>
              <Textarea id="b-fixed" rows={5} value={draft.held_fixed} placeholder={t('ed.fixedPh')} onChange={(e) => patch({ held_fixed: e.target.value })} />
            </div>
          </div>
        </Section>

        <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {isEdit && (
            <Button asChild variant="ghost" className="h-11">
              <Link to={`/b/${slug}`}>{t('pr.back')}</Link>
            </Button>
          )}
          <Button variant="outline" className="h-11 !bg-transparent hover:!bg-muted" onClick={showPreview}>
            <Eye className="mr-2 h-4 w-4" aria-hidden />
            {t('ed.preview')}
          </Button>
          <Button className="h-11" onClick={save} disabled={saving}>
            {saveLabel}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>{body()}</main>
      <SiteFooter />
      <Dialog open={Boolean(published)} onOpenChange={(o) => !o && published && navigate(`/b/${published.slug}`)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-2xl">{t('ed.publishedTitle')}</DialogTitle>
            <DialogDescription>{t('ed.publishedDesc')}</DialogDescription>
          </DialogHeader>
          {published && (
            <div className="flex min-w-0 flex-col gap-4">
              <CopyField label={t('ed.shareLink')} value={shareUrl(published.slug)} />
              <CopyField label={t('ed.editKey')} value={published.key} mono />
              <p className="text-[13px] text-muted-foreground">{t('ed.keyStored')}</p>
            </div>
          )}
          <DialogFooter>
            <Button className="h-11" onClick={() => published && navigate(`/b/${published.slug}`)}>
              {t('ed.openBoard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
