// Turns the `url` of a source from /meta into links for the footer.

// The portal is not a listings site and never links to one (REQUIREMENTS.md). These sources are named, not linked.
const LISTING_HOSTS = ['otodom.pl', 'olx.pl']
// A link that points at a data file would start a download. Such a source links to the site that publishes the file.
const FILE = /\.(zip|gz|xz|tar|7z|csv|json|xml)$/i

/** The links of one source. The API can send several addresses in one string, separated by " ; ". */
export function sourceLinks(url: string | undefined): string[] {
  if (!url) return []
  const links: string[] = []
  for (const part of url.split(';')) {
    let parsed: URL
    try {
      parsed = new URL(part.trim())
    } catch {
      continue
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
    const host = parsed.hostname.replace(/^www\./, '')
    if (LISTING_HOSTS.some((listing) => host === listing || host.endsWith(`.${listing}`))) continue
    const link = FILE.test(parsed.pathname) ? parsed.origin : parsed.href
    if (!links.includes(link)) links.push(link)
  }
  return links
}
