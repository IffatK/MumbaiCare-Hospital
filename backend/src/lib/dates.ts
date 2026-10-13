export const todayStr = () => new Date().toLocaleDateString('en-CA');
export const dateKey = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return y * 10000 + m * 100 + d; };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
