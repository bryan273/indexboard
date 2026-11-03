// Saves and loads this app's data through the suite-data edge function (Supabase), so the app works on any static host.
const URL = 'https://wzdkroxbfrlqijbeiwpk.supabase.co/functions/v1/suite-data';

export class SuiteError extends Error {
  status: number;
  data: { detail: string };
  response: { status: number; data: { detail: string } };
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.data = { detail: message };
    this.response = { status, data: { detail: message } };
  }
}

export async function suiteCall<T = any>(body: Record<string, unknown>, adminToken?: string): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let res: Response;
  try {
    res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'x-admin-token': adminToken } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SuiteError(0, 'Network error, please check your connection and try again.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new SuiteError(res.status, String(out?.error ?? out?.detail ?? `Request failed (${res.status})`));
  return out as T;
}
