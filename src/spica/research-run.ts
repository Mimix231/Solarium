import { uid, type ChatSource } from '../domain/types';
import type { SourceScope } from '../foundation/types';
import { matchesSearchQuery, rankCandidates, sceneIntent, type ResearchPage, type SearchProvider } from '../research/research';
import { DuplicateSourceError, SourceRepository, words } from '../sources/repository';

const searchLimit = 4;
const readLimit = 12;

export interface Observation extends ChatSource {
  id: string;
  query: string;
  status: 'candidate' | 'read' | 'unavailable';
  origin: 'search' | 'reference' | 'provided';
  parentId?: string;
  page?: ResearchPage;
  diagnostic?: string;
}

export interface SearchObservation {
  kind: 'web_search'; searchId: string; query: string; provider: string; retrievedAt: string; returned: number; shortlisted: number;
  relevance: 'matched' | 'weak';
  attempts: { provider: string; returned?: number; diagnostic?: string }[];
  results: { id: string; url: string; title: string; snippet: string }[];
}

function https(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    if (/^(?:localhost|.*\.(?:localhost|local|internal)|127(?:\.|$)|10\.|192\.168\.|169\.254\.|0\.|::1$|\[::1\]$)/i.test(url.hostname)) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

function publicQuery(input: string) {
  const query = input.trim();
  if (!query || new TextEncoder().encode(query).length > 280) throw Error('Use a short, nonempty public search query (at most 280 UTF-8 bytes).');
  return query;
}

/** A project evidence session over the existing native search and reader. */
export class SpicaResearchRun {
  private readonly sources = new Map<string, Observation>();
  private readonly queries = new Set<string>();
  private searches = 0;
  private reads = 0;
  private pending = false;
  private stopped = false;

  constructor(private provider: () => Promise<SearchProvider>, private webEnabled: () => boolean) {}

  snapshot() {
    return { sources: [...this.sources.values()], searchesLeft: searchLimit - this.searches, readsLeft: readLimit - this.reads, stopped:this.stopped };
  }

  private guard(signal: AbortSignal) {
    if (this.stopped) throw Error('This research run was stopped. Start a new run.');
    if (signal.aborted) throw new DOMException('Research stopped.', 'AbortError');
    if (!this.webEnabled()) throw Error('Web Search is OFF. Saved Sources remain available.');
  }

  private async observe<T>(signal: AbortSignal, action: (provider: SearchProvider) => Promise<T>) {
    this.guard(signal);
    if (this.pending) throw Error('Wait for the current research action to finish.');
    this.pending = true;
    try {
      const provider = await this.provider();
      this.guard(signal);
      return await action(provider);
    } finally { this.pending = false; }
  }

  private add(source: ChatSource, query: string, origin: Observation['origin'], parentId?: string) {
    const url = https(source.url)?.href;
    if (!url) throw Error('Choose a public HTTPS source.');
    const prior = this.sources.get(url) ?? [...this.sources.values()].find(item => item.page?.url === url);
    if (prior) return prior;
    const next: Observation = { ...source, url, query, id: url, status: 'candidate', origin, parentId };
    this.sources.set(url, next);
    return next;
  }

  inspect(id:string): Observation { return this.source(id); }

  stop() { this.stopped = true; }

  private source(id: string): Observation {
    const source = this.sources.get(id);
    if (!source) throw Error('Choose a source from this research run.');
    return source;
  }

  /** Only lexical evidence coverage: the Spark must judge actual semantic support and contradictions. */
  assessClaim(claim: string, id: string) {
    const source = this.source(id);
    if (!source.page?.text) throw Error('Retrieve the source page before assessing a claim.');
    const tokens = [...new Set(words(claim).filter(token=>token.length>3))].slice(0,30);
    const lower = (source.page.title+' '+source.page.text).toLowerCase();
    const matched = tokens.filter(token=>lower.includes(token.toLowerCase()));
    const rankedPassages=source.page.text.split(/\n\s*\n/).map((passage,index)=>({passage,index,
      score:matched.reduce((n,token)=>n+Number(passage.toLowerCase().includes(token.toLowerCase())),0)}))
      .sort((a,b)=>b.score-a.score).slice(0,3).map(item=>({index:item.index,text:item.passage.slice(0,450)}));
    const claimId='claim-'+[...claim].reduce((hash,ch)=>Math.imul(hash^ch.charCodeAt(0),16777619)>>>0,2166136261).toString(16);
    return { claimId, claim, sourceId:id, url:source.page.url, contentHash:source.page.contentHash,
      publicationDate:null,publicationDateStatus:'not supplied by provider',passages:rankedPassages,
      retrievedAt:source.page.retrievedAt, matchedTerms:matched,missingTerms:tokens.filter(t=>!matched.includes(t)),
      coverage:tokens.length?Number((matched.length/tokens.length).toFixed(3)):0,
      verdict:'unverified',notice:'Token overlap alone cannot establish truth, version support, or logical entailment. Inspect the passage.' };
  }

  /** Deterministic candidate operation ranking; never performs a network call or pretends to verify a claim. */
  nextActions(goal:string) {
    const sources=[...this.sources.values()];
    const read=sources.filter(s=>s.page?.text);
    const unread=sources.filter(s=>s.status==='candidate');
    const links=read.flatMap(s=>this.links(s.id).map(link=>({sourceId:s.id,url:link.url,title:link.title}))).slice(0,6);
    const hashes=new Set(read.map(s=>s.page!.contentHash));
    const recommendations:Array<{tool:string;arguments:Record<string,string>;reason:string;rank:number}>=[];
    if(this.stopped)return {status:'stopped',goal,remaining:this.snapshot(),recommendations:[]};
    if(unread.length&&this.reads<readLimit) recommendations.push({tool:'spica_research_read',arguments:{sourceId:unread[0]!.id},reason:'Unretrieved search hit: read the actual passage before citing.',rank:100});
    if(read.length&&links.length&&this.reads<readLimit) recommendations.push({tool:'spica_research_follow',arguments:{sourceId:links[0]!.sourceId,url:links[0]!.url},reason:'Follow a returned reference to inspect primary evidence or API/version details.',rank:85});
    if(read.length>=2) recommendations.push({tool:'spica_research_compare',arguments:{first:read[0]!.id,second:read[1]!.id},reason:'Check source independence, provenance and contradictions.',rank:78});
    if(read.length) recommendations.push({tool:'spica_research_claim',arguments:{claim:goal||read[0]!.query,sourceId:read[0]!.id},reason:'Assess explicit claim against a retrieved passage. Lexical overlap is not proof.',rank:72});
    if(!read.length && !unread.length && this.searches<searchLimit && goal.trim()) recommendations.push({tool:'spica_research_search',arguments:{query:goal.trim().slice(0,200)},reason:'No evidence gathered for this goal.',rank:95});
    if(read.length)recommendations.push({tool:'spica_research_save',arguments:{sourceId:read[0]!.id},reason:'Persist retrieved evidence with its content hash and provenance.',rank:50});
    const status=this.searches>=searchLimit&&this.reads>=readLimit?'budget_exhausted':
      read.length>1&&hashes.size===1?'repeated_content':read.length?'evidence_collected':'need_evidence';
    return {status,goal,readCount:read.length,independentContentHashes:hashes.size,unreadCount:unread.length,
      remaining:{searches:searchLimit-this.searches,reads:readLimit-this.reads},recommendations:recommendations.sort((a,b)=>b.rank-a.rank),
      stopReasons:['goal substantiated by independently checked passages','budget exhausted','repeated content','contradictory or insufficient evidence','user cancellation'],
      note:'The model must decide when to stop; recommendations never initiate hidden search, redirects or automatic retries.'};
  }

  async search(input: string, signal: AbortSignal, strategy: 'primary' | 'fallback' | 'relevant' = 'primary'): Promise<SearchObservation> {
    const query = publicQuery(input);
    const queryKey = query.toLowerCase().replace(/\s+/g, ' ');
    const match = (result: ChatSource) => matchesSearchQuery(query, `${result.title} ${result.excerpt ?? ''} ${new URL(result.url).pathname}`);
    return this.observe(signal, async provider => {
      if (this.searches >= searchLimit) throw Error('Search budget reached. Inspect or save the available evidence.');
      const attempts: SearchObservation['attempts'] = [];
      const fetchResults = async (fallback: boolean) => {
        const name = fallback ? 'duckduckgo' : provider.kind ?? 'configured';
        const key = name + ':' + queryKey;
        if (this.queries.has(key)) throw Error('This query already ran with this provider. Refine it or inspect a returned source.');
        const search = fallback ? provider.fallbackSearch : provider.search;
        if (!search) throw Error('The selected provider has no fallback.');
        this.guard(signal);
        this.queries.add(key);
        this.searches++;
        try {
          const seen = new Set<string>();
          const results = (await search(query, signal)).filter(result => {
            const url = https(result.url)?.href;
            if (!url || seen.has(url)) return false;
            seen.add(url);
            return true;
          });
          this.guard(signal);
          attempts.push({ provider: name, returned: results.length });
          return { name, results };
        } catch (error) {
          this.guard(signal);
          attempts.push({ provider: name, diagnostic: String(error).slice(0, 220) });
          return undefined;
        }
      };
      let selected = await fetchResults(strategy === 'fallback');
      if (!selected) throw Error(attempts.map(attempt => `${attempt.provider}: ${attempt.diagnostic}`).join(' '));
      const { results } = selected;
      const ranked = rankCandidates(results, { ...sceneIntent(query), query });
      const candidates = strategy === 'relevant' ? [...results].sort((a, b) => Number(match(b)) - Number(match(a))) : ranked.length ? ranked : results;
      const shortlist = candidates.slice(0, 8).map(item =>
        this.add({ title: item.title, url: item.url, excerpt: item.excerpt }, query, 'search'));
      return { kind: 'web_search', searchId: uid(), query, provider: selected.name, attempts,
        relevance: candidates.some(match) ? 'matched' : 'weak',
        retrievedAt: new Date().toISOString(), returned: results.length, shortlisted: shortlist.length,
        results: shortlist.map((source, index) => ({ id: source.id, url: source.url, title: candidates[index]!.title.slice(0, 200), snippet: candidates[index]!.excerpt?.slice(0, 240) ?? '' })) };
    });
  }

  links(id: string) {
    const source = this.source(id);
    const origin = source.page && https(source.page.url)?.origin;
    if (!origin) return [];
    const visited = new Set([...this.sources.values()].flatMap(item => [item.url, item.page?.url]));
    const terms = words(source.query);
    const references = (source.page?.links ?? []).flatMap(link => {
      const url = https(link.url);
      if (!url || visited.has(url.href)) return [];
      visited.add(url.href);
      const label = link.title.toLowerCase();
      const path = url.pathname.toLowerCase();
      const relevance = terms.reduce((score, term) => score + Number(label.includes(term)) * 2 + Number(path.includes(term)), 0) + Number(url.origin !== origin);
      return [{ link, relevance }];
    });
    return references.sort((a, b) => b.relevance - a.relevance).slice(0, 8).map(item => item.link);
  }

  async follow(id: string, linkUrl: string, signal: AbortSignal) {
    this.guard(signal);
    const parent = this.source(id);
    const link = this.links(id).find(item => item.url === linkUrl);
    if (!link) throw Error('Choose a returned reference from this retrieved page.');
    if (this.pending) throw Error('Wait for the current research action to finish.');
    if (this.reads >= readLimit) throw Error('Page-read budget reached.');
    const child = this.add(link, parent.query, 'reference', parent.id);
    await this.read(child.id, signal);
    return child.id;
  }

  async readUrl(input: string, query: string, signal: AbortSignal) {
    this.guard(signal);
    const url = https(input.trim());
    if (!url) throw Error('Enter a public HTTPS page URL.');
    if (this.pending) throw Error('Wait for the current research action to finish.');
    if (this.reads >= readLimit) throw Error('Page-read budget reached.');
    const source = this.add({ url: url.href, title: url.hostname }, publicQuery(query), 'provided');
    await this.read(source.id, signal);
    return source.id;
  }

  async read(id: string, signal: AbortSignal) {
    this.guard(signal);
    const source = this.source(id);
    if (source.page) return source.page;
    return this.observe(signal, async provider => {
      if (this.reads >= readLimit) throw Error('Page-read budget reached.');
      this.reads++;
      try {
        const page = await provider.read(source.url, source.query, signal);
        this.guard(signal);
        if (!https(page.url)) throw Error('The reader did not return a permitted HTTPS URL.');
        this.sources.set(id, { ...source, status: 'read', page, diagnostic: undefined });
        return page;
      } catch (error) {
        this.guard(signal);
        this.sources.set(id, { ...source, status: 'unavailable', diagnostic: String(error) });
        throw error;
      }
    });
  }

  compare(first: string, second: string) {
    const a = this.source(first);
    const b = this.source(second);
    if (first === second || !a.page?.text || !b.page?.text) throw Error('Choose two different retrieved sources with passages.');
    const versions=(text:string)=>[...new Set([...text.matchAll(/\b(?:version\s*|v)(\d+(?:\.\d+){0,3})\b/gi)].map(m=>m[1]!))].slice(0,8);
    const aVersions=versions(a.page.title+' '+a.page.text);
    const bVersions=versions(b.page.title+' '+b.page.text);
    const aPrimary=versions(a.page.title)[0];
    const bPrimary=versions(b.page.title)[0];
    return {
      a: a.page, b: b.page,
      explicitVersionMentions:{first:aVersions,second:bVersions},
      versionMentionMismatch:Boolean(aPrimary&&bPrimary ? aPrimary!==bPrimary : aVersions.length&&bVersions.length&&!aVersions.some(v=>bVersions.includes(v))),
      titleVersions:{first:aPrimary??null,second:bPrimary??null},
      warning:'Different mentions may reflect history, not a direct contradiction. Read full passages to verify applicability.',
      sameExcerpt: a.page.contentHash === b.page.contentHash,
      sameHost: new URL(a.page.url).hostname === new URL(b.page.url).hostname,
      linked: a.parentId === b.id || b.parentId === a.id || (!!a.parentId && a.parentId === b.parentId),
    };
  }

  async save(id: string, projectId: string, repository = new SourceRepository({ projectId, sessionId: null })) {
    return this.saveSource(id, { kind: 'project', id: projectId }, repository);
  }

  async saveSource(id: string, scope: SourceScope, repository: SourceRepository, metadata?: { arc?: number; chapter?: number; continuity?: string }) {
    const source = this.source(id);
    const page = source.page;
    if (!page?.text.trim()) throw Error('Read a source with a retrieved passage before saving evidence.');
    const existing = (await repository.list(scope)).find(item => item.data.contentHash === page.contentHash &&
      item.data.origin.kind === 'web' && item.data.origin.url === page.url);
    if (existing) return existing;
    const input = {
      scope, title: page.title || page.url, content: page.text, kind: 'webpage' as const, tags: ['web research'], ...metadata,
      origin: {
        kind: 'web' as const, url: page.url, title: page.title, accessedAt: page.retrievedAt, readState: 'read' as const,
        locator: page.locator, requestedUrl: source.url, parentUrl: source.parentId ? this.source(source.parentId).page?.url : undefined,
      },
    };
    try { return await repository.create(input); }
    catch (error) {
      if (!(error instanceof DuplicateSourceError)) throw error;
      const duplicate = (await repository.get(error.sourceId)).source;
      if (duplicate.data.origin.kind === 'web' && duplicate.data.origin.url === page.url) return duplicate;
      return repository.create({ ...input, keepBoth: true });
    }
  }
}
