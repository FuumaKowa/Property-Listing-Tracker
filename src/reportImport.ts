import { PublicationValidationError, validatePublicationInput, type PublicationChannel } from './publications';

export interface ReportEntry {
  label: string;
  url: string | null;
  issue?: string;
}
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Record<string, string[]> = {
  propertyguru: ['propertyguru', 'propguru', 'pg'],
  iproperty: ['iproperty', 'iprop'],
  propmall: ['propmall'],
  telegram: ['telegram', 'tele'],
  facebook: ['facebook', 'fb'],
  marketplace: ['marketplace', 'marketplacefb', 'facebookmarketplace', 'fbmarketplace'],
  instagram: ['instagram', 'insta', 'ig'],
  threads: ['threads'],
  tiktok: ['tiktok'],
  mudah: ['mudah', 'mudahmy'],
};
function labelPlatform(label: string): string | undefined {
  const normalized = key(label);
  const exact = Object.entries(aliases).find(([, values]) => values.includes(normalized))?.[0];
  if (exact) return exact;
  if (/\bmarketplace\b/i.test(label)) return 'marketplace';
  if (/\b(?:telegram|tele)\b/i.test(label)) return 'telegram';
  if (/\b(?:facebook|fb)\b/i.test(label)) return 'facebook';
}
function urlPlatform(value: string | null): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    const domains: Record<string, string[]> = {
      propertyguru: ['propertyguru.com.my'], iproperty: ['iproperty.com.my'],
      propmall: ['propmall.my'], telegram: ['t.me', 'telegram.me'],
      facebook: ['facebook.com', 'fb.com', 'fb.watch'], instagram: ['instagram.com'],
      threads: ['threads.com', 'threads.net'], tiktok: ['tiktok.com'], mudah: ['mudah.my'],
    };
    const platform = Object.entries(domains).find(([, names]) => names.some(name => host === name || host.endsWith('.' + name)))?.[0];
    return platform === 'facebook' && url.pathname.startsWith('/marketplace/') ? 'marketplace' : platform;
  } catch { return; }
}

// Only an exact custom name or a single generic platform channel is selected automatically.
export function matchReportChannel(entry: ReportEntry, channels: PublicationChannel[]): number | null {
  const active = channels.filter(channel => !channel.archivedAt);
  const fromLabel = labelPlatform(entry.label), fromUrl = urlPlatform(entry.url);
  if (fromLabel && fromUrl && fromLabel !== fromUrl) return null;
  const exact = active.filter(channel => key(channel.name) === key(entry.label));
  if (exact.length === 1) return exact[0].id;
  const platform = fromUrl || fromLabel;
  const generic = platform ? active.filter(channel => aliases[platform].includes(key(channel.name))) : [];
  return generic.length === 1 ? generic[0].id : null;
}

export function parsePublicationReport(report: string): ReportEntry[] {
  if (report.length > 50000) throw new PublicationValidationError('Keep the report under 50,000 characters.');
  const entries: ReportEntry[] = [];
  let label = '', hasLink = false;
  const flush = () => {
    if (label && !hasLink) entries.push({ label, url: null, issue: 'No valid URL supplied' });
    label = ''; hasLink = false;
  };
  const lines = report.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    const numbered = /^\s*\d+\s*[.)\-]\s*(.*)$/.exec(line);
    const content = numbered ? numbered[1] : line;
    // Markdown links, angle-bracket URLs and plain URLs; keep query strings intact.
    const urls = [...content.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s]+?)\)|https?:\/\/[^\s<>]+/gi)];
    const prefix = (urls.length ? content.slice(0, urls[0].index) : content).replace(/^[*#_<>\s]+|[*_<>:\s]+$/g, '');
    if (!urls.length && !numbered && !labelPlatform(prefix)) {
      // A free-form heading must never inherit the previous section's category.
      flush();
      let next = index + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      const isMetadata = /^(?:owner\s+listing|name\s*:|tel\s*:|phone\s*:)/i.test(prefix);
      if (!isMetadata && /^(?:<?https?:\/\/|\[[^\]]*\]\(https?:\/\/)/i.test(lines[next]?.trim() || '')) label = prefix;
      continue;
    }
    if (numbered || (prefix && (urls.length || labelPlatform(prefix)))) {
      flush(); label = prefix;
    }
    for (const match of urls) {
      const candidate = (match[1] || match[0]).replace(/[.,;!]+$/, '');
      let url: string | null = candidate, issue: string | undefined;
      try {
        validatePublicationInput({channelId: 1, url: candidate, label: label || undefined});
        url = new URL(candidate).href;
      } catch (error) { issue = (error as Error).message; }
      entries.push({label: label || urlPlatform(url) || 'Unlabelled link', url, issue});
      hasLink = true;
    }
  }
  flush();
  if (entries.length > 100) throw new PublicationValidationError('Import up to 100 report entries at a time.');
  return entries;
}
