import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ImagePlus, Link2, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Upload, X } from 'lucide-react';

type PreviewListing = {
  id: number; version?: number; reference: string; property: string; category: string; location: string;
  price: number | null; copy: string; images: Array<{ id: string; fileKey?: string; name: string; url: string }>;
};

const sampleListings: PreviewListing[] = [
  { id: 801, reference: 'WTS-PREVIEW-001', property: 'Laman Seri, Seksyen 27', category: 'Subsale Direct Listing', location: 'Shah Alam, Selangor', price: 1550000, copy: 'Semi-detached home in Laman Seri, Shah Alam. Contact us to arrange a viewing and receive further details.', images: [] },
  { id: 802, reference: 'WTL-PREVIEW-002', property: 'Suria Jelutong', category: 'Rental', location: 'Bukit Jelutong, Shah Alam', price: 2850, copy: 'Fully furnished three-bedroom home available for rent in Suria Jelutong. Contact us for viewing availability.', images: [] },
  { id: 803, reference: 'WTS-PREVIEW-003', property: 'Tangerine Suites', category: 'Rental', location: 'Sunsuria City, Sepang', price: null, copy: '', images: [] },
];

const money = (value: number | null) => value === null ? 'Price needed' : `RM ${value.toLocaleString('en-MY')}`;

export function IclickWorkspace({preview=false}:{preview?:boolean}) {
  const [listings, setListings] = useState<PreviewListing[]>(preview?sampleListings:[]);
  const [selected, setSelected] = useState(sampleListings[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [completeness, setCompleteness] = useState<'all' | 'incomplete' | 'ready'>('all');
  const [category, setCategory] = useState<'all' | 'rental' | 'subsale'>('all');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [priceDraft, setPriceDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [loading,setLoading]=useState(!preview),[loadingMore,setLoadingMore]=useState(false),[loadError,setLoadError]=useState(''),[nextCursor,setNextCursor]=useState<string|null>(null),[hasMore,setHasMore]=useState(false);
  const objectUrls = useRef<string[]>([]);
  const visibleListings = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return listings.filter(item => {
      const ready = item.price !== null && item.copy.trim().length > 0 && item.images.length > 0;
      const matchesSearch = !query || [item.property, item.reference, item.location].some(value => value.toLocaleLowerCase().includes(query));
      const matchesCompleteness = completeness === 'all' || (completeness === 'ready' ? ready : !ready);
      const matchesCategory = category === 'all' || (category === 'rental' ? item.category.toLocaleLowerCase().includes('rental') : item.category.toLocaleLowerCase().includes('subsale'));
      return matchesSearch && matchesCompleteness && matchesCategory;
    });
  }, [category, completeness, listings, searchQuery]);
  const active = visibleListings.find(item => item.id === selected) ?? visibleListings[0] ?? null;
  const priceValid = priceDraft.trim() !== '' && Number.isFinite(Number(priceDraft)) && Number(priceDraft) > 0;
  const complete = Boolean(active && active.price !== null && active.copy.trim().length > 0 && active.images.length > 0);
  const readyCount = useMemo(() => listings.filter(item => item.price !== null && item.copy.trim() && item.images.length).length, [listings]);

  async function loadPage(append=false,cursor:string|null=null){
    if(preview)return;
    const params=new URLSearchParams({limit:'50',category,completeness,q:searchQuery.trim(),...(cursor?{cursor}:{})});
    const response=await fetch(`/api/iclick-workspace/listings?${params}`,{headers:{Accept:'application/json'}});
    const payload=await response.json();if(!response.ok||!payload.success)throw new Error(payload.error||'Unable to load category listings.');
    const mapped:PreviewListing[]=payload.data.map((row:any)=>({id:row.id,version:row.version,reference:row.reference||'No reference',property:row.property,category:row.category,location:row.location||'Location pending',price:row.askingPrice,copy:row.copywriting||'',images:(row.images||[]).map((image:any)=>({id:String(image.fileKey),fileKey:image.fileKey,name:image.title||'Listing image',url:image.url}))}));
    setListings(current=>append?[...current,...mapped]:mapped);setNextCursor(payload.nextCursor||null);setHasMore(Boolean(payload.hasMore));
    setSelected(current=>append?current:(mapped.some(row=>row.id===current)?current:mapped[0]?.id||0));
  }
  useEffect(()=>{if(preview)return;let cancelled=false;setLoading(true);setLoadError('');void loadPage().catch(error=>{if(!cancelled)setLoadError(error.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[category,completeness,preview,searchQuery]);

  useEffect(() => {
    if (visibleListings.length && !visibleListings.some(item => item.id === selected)) {
      setSelected(visibleListings[0].id);
      setPriceDraft('');
    }
  }, [selected, visibleListings]);

  useEffect(() => () => { objectUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  async function savePrice() {
    if (!active || !priceValid) return;
    if(preview){setListings(current => current.map(item => item.id === active.id ? { ...item, price: Number(priceDraft) } : item));setPriceDraft('');setNotice('Price updated in this local preview. It has not been saved to the tracker.');return;}
    try{const response=await fetch(`/api/listings/${active.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({askingPrice:Number(priceDraft),version:active.version})});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Unable to save price.');setListings(current=>current.map(item=>item.id===active.id?{...item,version:result.data.version,price:Number(result.data.askingPrice)}:item));setPriceDraft('');setNotice('Numeric asking price saved to the listing.');}catch(error){setNotice((error as Error).message);}
  }
  async function addImages(files: FileList | null) {
    if (!active || !files?.length) return;
    const supported = [...files].filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (!supported.length) { setNotice('Choose JPEG, PNG or WebP images.'); return; }
    if(preview){const next=supported.map(file => { const url = URL.createObjectURL(file); objectUrls.current.push(url); return { id: crypto.randomUUID(), name: file.name, url }; });setListings(current => current.map(item => item.id === active.id ? { ...item, images: [...item.images, ...next] } : item));setNotice(`${next.length} image${next.length === 1 ? '' : 's'} added to this local preview.`);return;}
    try{for(const file of supported){const response=await fetch(`/api/iclick-workspace/listings/${active.id}/images`,{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':file.name},body:file});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||`Could not upload ${file.name}.`);}await loadPage();setNotice(`${supported.length} image${supported.length===1?'':'s'} uploaded and saved to private listing storage.`);}catch(error){setNotice((error as Error).message);}
  }
  async function removeImage(imageId: string) {
    if (!active) return;
    const image=active.images.find(photo=>photo.id===imageId);if(!image)return;
    if(preview){setListings(current => current.map(item => item.id === active.id ? { ...item, images: item.images.filter(photo => photo.id !== imageId) } : item));return;}
    try{const response=await fetch(`/api/iclick-workspace/listings/${active.id}/images/${image.fileKey}`,{method:'DELETE'});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Unable to remove image.');setListings(current=>current.map(item=>item.id===active.id?{...item,images:item.images.filter(photo=>photo.id!==imageId)}:item));}catch(error){setNotice((error as Error).message);}
  }

  return <section className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4 md:p-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-indigo-600">Publishing data workspace</p><h1 className="mt-1 text-2xl font-bold text-slate-900">IClick listings</h1><p className="mt-1 text-sm text-slate-600">Complete prices and images on existing rental and subsale listings before sharing them with IClick.</p></div>
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900"><ShieldCheck size={17}/> Partner feed stays read-only</div>
      </div>

      {preview?<div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span><strong>Local preview.</strong> Changes here are temporary and do not update your tracker or database.</span><span className="font-semibold">{readyCount} of {listings.length} ready in sample data</span></div>:<div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><span>Active rental and subsale listings, connected to the tracker.</span><span className="font-semibold">{readyCount} ready · {listings.length} loaded</span></div>}

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-[440px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold">Existing category listings</h2><p className="mt-0.5 text-xs text-slate-500">{visibleListings.length} of {listings.length}{preview?' sample':''} listings · no owner rows</p></div>
          <div className="border-b border-slate-100 p-3">
            <button type="button" aria-expanded={filtersOpen} aria-label={filtersOpen ? 'Hide search and filters' : 'Show search and filters'} onClick={() => setFiltersOpen(open => !open)} className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <span className="flex items-center gap-2"><SlidersHorizontal size={15}/> Search &amp; filters</span>{filtersOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
            </button>
            {filtersOpen && <div className="mt-2 space-y-2">
              <label className="relative block"><span className="sr-only">Search listings</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Search listings" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Property, reference or location" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"/></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0"><span className="sr-only">Listing completeness</span><select aria-label="Listing completeness" value={completeness} onChange={event => setCompleteness(event.target.value as typeof completeness)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs"><option value="all">All statuses</option><option value="incomplete">Needs information</option><option value="ready">Ready for IClick</option></select></label>
                <label className="min-w-0"><span className="sr-only">Listing category</span><select aria-label="Listing category" value={category} onChange={event => setCategory(event.target.value as typeof category)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs"><option value="all">All categories</option><option value="rental">Rental</option><option value="subsale">Subsale</option></select></label>
              </div>
            </div>}
          </div>
          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">{loading?<p className="p-5 text-sm text-slate-500">Loading listings…</p>:loadError?<p role="alert" className="p-4 text-sm text-rose-700">{loadError}</p>:visibleListings.map(item => {
            const ready = item.price !== null && item.copy.trim() && item.images.length > 0;
            return <button key={item.id} onClick={() => { setSelected(item.id); setPriceDraft(''); setNotice(''); }} className={`block w-full px-4 py-3 text-left transition ${selected === item.id ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-2"><span className="font-semibold text-slate-900">{item.property}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{ready ? 'Ready' : 'Needs info'}</span></div>
              <p className="mt-1 text-xs text-slate-500">{item.category} · {item.reference}</p><p className="mt-2 text-sm font-medium text-slate-700">{money(item.price)}</p>
            </button>;
          })}
            {!visibleListings.length && <div className="px-4 py-10 text-center"><p className="text-sm font-semibold text-slate-700">No matching listings</p><p className="mt-1 text-xs text-slate-500">Try another search or adjust the filters.</p><button type="button" onClick={() => { setSearchQuery(''); setCompleteness('all'); setCategory('all'); }} className="mt-3 text-xs font-semibold text-indigo-700 hover:text-indigo-900">Clear search and filters</button></div>}
            {hasMore&&<div className="p-3 text-center"><button disabled={loadingMore} onClick={async()=>{setLoadingMore(true);try{await loadPage(true,nextCursor);}catch(error){setLoadError((error as Error).message);}finally{setLoadingMore(false);}}} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">{loadingMore?'Loading…':'Load 50 more'}</button></div>}
          </div>
        </aside>

        {active ? <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div><h2 className="text-xl font-bold text-slate-900">{active.property}</h2><p className="mt-1 text-sm text-slate-600">{active.category} · {active.location}</p><p className="mt-1 font-mono text-xs text-slate-500">{active.reference} · listing #{active.id}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{complete ? 'Ready for IClick' : 'Missing required information'}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4"><label htmlFor="iclick-price" className="block text-sm font-semibold">Numeric asking price</label><p className="mt-1 text-xs text-slate-500">Current price: {money(active.price)}</p><div className="mt-3 flex gap-2"><span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">RM</span><input id="iclick-price" value={priceDraft} onChange={event => setPriceDraft(event.target.value)} type="number" min="1" step="0.01" placeholder={active.price === null ? 'Enter price' : String(active.price)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"/><button onClick={savePrice} disabled={!priceValid} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Save</button></div></div>
            <div className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Listing images</h3><p className="mt-1 text-xs text-slate-500">{active.images.length} attached · JPEG, PNG, WebP</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"><Upload size={15}/> Add images<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={event => { addImages(event.target.files); event.currentTarget.value = ''; }}/></label></div>
              {active.images.length ? <div className="mt-3 grid grid-cols-3 gap-2">{active.images.map(image => <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100"><img src={image.url} alt={image.name} className="h-full w-full object-cover"/><button aria-label={`Remove ${image.name}`} onClick={() => removeImage(image.id)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow opacity-100 md:opacity-0 md:group-hover:opacity-100"><X size={14}/></button><span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/60 px-1.5 py-1 text-[10px] text-white">{image.name}</span></div>)}</div> : <div className="mt-3 flex min-h-20 items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 text-xs text-slate-500"><ImagePlus size={17}/> Add at least one image to complete the sample listing</div>}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Approved copywriting</h3>{active.copy && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Available</span>}</div>{active.copy ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{active.copy}</p> : <p className="mt-2 text-sm text-amber-800">No approved copywriting yet. It will appear here when it is available on the listing workflow.</p>}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><Link2 size={14}/> Only active rental/subsale category listings are included. Owner master records are excluded.</div>
          {notice && <p role="status" className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p>}
        </article> : <div className="flex min-h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"><div><Search className="mx-auto text-slate-400" size={22}/><p className="mt-2 text-sm font-semibold text-slate-700">Choose a listing to continue</p><p className="mt-1 text-xs text-slate-500">Clear or change the filters to see matching listings.</p></div></div>}
      </div>
      {preview&&<div className="flex justify-end"><button onClick={() => { setListings(sampleListings); setSelected(sampleListings[0].id); setPriceDraft(''); setNotice('Sample preview restored.'); }} className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800"><RotateCcw size={14}/> Reset sample preview</button></div>}
    </div>
  </section>;
}
