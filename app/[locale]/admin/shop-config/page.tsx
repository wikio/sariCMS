'use client';

import { useState, useEffect } from 'react';
import { Save, Truck, Tag, MapPin, FileText, Globe, RefreshCw, AlertTriangle, CheckCircle, Settings, Download, Plus, Trash2, Eye, EyeOff, Pencil, Search, Banknote } from 'lucide-react';
import { loadShopConfig, saveShopConfig, DEFAULT_ZONES, formatZoneLabel, type ShopConfig, type ShippingZoneFee, type SaleZone } from '@/lib/shop-config';
import { loadCurrencies, type Currency } from '@/lib/currencies';
import { loadTaxes, saveTaxes, type TaxRule } from '@/lib/shop-store';

export default function ShopConfigPage() {
  const [cfg, setCfg] = useState<ShopConfig | null>(null);
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'global'|'zones'|'cgv'|'import'>('global');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [showCurrencyList, setShowCurrencyList] = useState(false);

  useEffect(() => {
    setCfg(loadShopConfig());
    setTaxes(loadTaxes());
    setCurrencies(loadCurrencies());
    const onTaxChanged = () => setTaxes(loadTaxes());
    const onCfgChanged = () => setCfg(loadShopConfig());
    const onCurrencyChanged = () => setCurrencies(loadCurrencies());
    window.addEventListener('sari-shop-config-changed', onCfgChanged);
    window.addEventListener('storage', onCfgChanged);
    window.addEventListener('sari-currencies', onCurrencyChanged as EventListener);
    window.addEventListener('storage', onCurrencyChanged as EventListener);
    return () => {
      window.removeEventListener('sari-shop-config-changed', onCfgChanged);
      window.removeEventListener('storage', onCfgChanged);
      window.removeEventListener('sari-currencies', onCurrencyChanged as EventListener);
      window.removeEventListener('storage', onCurrencyChanged as EventListener);
    };
  }, []);

  const update = (patch: Partial<ShopConfig>) => { if (cfg) setCfg({ ...cfg, ...patch }); };
  const save = () => {
    if (!cfg) return;
    saveShopConfig(cfg);
    // Synchronise le défaut TVA : si globalTaxId a changé, mettre isDefault côté taxes
    if (cfg.globalTaxId) {
      const nextTaxes = taxes.map(t => ({ ...t, isDefault: t.id === cfg.globalTaxId }));
      // seulement si différent
      const changed = nextTaxes.some((t,i)=> t.isDefault !== taxes[i]?.isDefault);
      if (changed) { saveTaxes(nextTaxes); setTaxes(nextTaxes); }
    }
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const updateZoneFee = (code: string, field: keyof ShippingZoneFee, value: any) => {
    if (!cfg) return;
    const fees = cfg.shipping.zoneFees.map(f => f.zone===code ? { ...f, [field]: value } : f);
    if (!fees.find(f=>f.zone===code)) fees.push({ zone: code, fee: 600, perQty: 0 } as any);
    update({ shipping: { ...cfg.shipping, zoneFees: fees } });
  };
  const toggleSaleZone = (code: string) => {
    if (!cfg) return;
    const zones = cfg.saleZones.map(z => z.code===code ? { ...z, active: !z.active } : z);
    update({ saleZones: zones, deliveryZones: zones });
  };

  // CRUD zones complet
  const updateZone = (code: string, patch: Partial<SaleZone>) => {
    if (!cfg) return;
    const zones = cfg.saleZones.map(z => z.code===code ? { ...z, ...patch } : z);
    update({ saleZones: zones, deliveryZones: zones });
  };
  const removeZone = (code: string) => {
    if (!cfg) return;
    const zones = cfg.saleZones.filter(z => z.code !== code);
    const fees = cfg.shipping.zoneFees.filter(f => f.zone !== code);
    update({ saleZones: zones, deliveryZones: zones, shipping: { ...cfg.shipping, zoneFees: fees } });
  };
  const addZone = () => {
    if (!cfg) return;
    const baseCode = `DZ-${String(cfg.saleZones.length + 16).padStart(2,'0')}`;
    let code = baseCode;
    let idx = 1;
    while (cfg.saleZones.some(z=>z.code===code)) { code = `DZ-NEW${idx}`; idx++; }
    const newZone: SaleZone = { code, label: 'Nouvelle zone', wilaya: 'Nouvelle wilaya', active: true, deliveryDays: '48-72h', codAllowed: false };
    const zones = [...cfg.saleZones, newZone];
    update({ saleZones: zones, deliveryZones: zones });
  };
  const duplicateZone = (code: string) => {
    if (!cfg) return;
    const src = cfg.saleZones.find(z=>z.code===code);
    if (!src) return;
    let newCode = `${src.code}-COPY`;
    let i=1;
    while (cfg.saleZones.some(z=>z.code===newCode)) { newCode = `${src.code}-COPY${i}`; i++; }
    const nz: SaleZone = { ...src, code: newCode, label: `${src.label} (copie)` };
    const zones = [...cfg.saleZones, nz];
    update({ saleZones: zones, deliveryZones: zones });
  };

  const handleImport = async () => {
    if (!cfg) return;
    setImportLoading(true);
    setImportResult('');
    try {
      const url = cfg.importApi?.url || cfg.importApi?.csvUrl;
      if (!url) throw new Error('Aucune URL configurée');
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (cfg.importApi?.authHeader && cfg.importApi.authHeader !== 'none' && cfg.importApi.apiKey) headers[cfg.importApi.authHeader] = cfg.importApi.apiKey;
      // Si CSV, on fetch et parse côté client
      if (cfg.importApi?.csvUrl) {
        const res = await fetch(cfg.importApi.csvUrl, { headers });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const lines = text.split('\n').filter(l=>l.trim());
        const header = lines[0]?.split(',').map(s=>s.trim().toLowerCase())||[];
        const required = ['name','price'];
        const missing = required.filter(r=>!header.includes(r));
        if (missing.length) throw new Error(`CSV header manquant: ${missing.join(', ')}`);
        const dataLines = lines.slice(1);
        const invalid: number[] = [];
        dataLines.forEach((line,i)=>{
          const cols = line.split(',');
          const row: any = {};
          header.forEach((h,idx)=> row[h]=cols[idx]);
          if (!row.name || isNaN(parseFloat(row.price))) invalid.push(i+2);
          if (row.quantity && isNaN(parseInt(row.quantity))) invalid.push(i+2);
        });
        if (invalid.length) throw new Error(`Lignes invalides: ${invalid.slice(0,5).join(', ')}${invalid.length>5?'...':''}`);
        const imported = dataLines.length;
        localStorage.setItem('sari_import_log', JSON.stringify({ date: new Date().toISOString(), imported, source: cfg.importApi.csvUrl }));
        setImportResult(`✓ ${imported} produits validés (lots OK). Import simulé — branchez ici votre persistence (data/products.json ou API).`);
      } else {
        const res = await fetch(cfg.importApi.url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const arr = Array.isArray(json) ? json : (json.data || json.products || []);
        if (!Array.isArray(arr)) throw new Error('Format JSON attendu : tableau');
        const invalid = arr.filter((p:any)=>!p.name || typeof p.price === 'undefined' || (p.quantity!==undefined && isNaN(Number(p.quantity))));
        if (invalid.length) throw new Error(`${invalid.length} produits invalides (name/price/quantity)`);
        const totalQty = arr.reduce((s:number,p:any)=>s+Number(p.quantity||0),0);
        if (totalQty>100000) throw new Error(`Quantité totale trop élevée: ${totalQty}`);
        localStorage.setItem('sari_import_log', JSON.stringify({ date: new Date().toISOString(), imported: arr.length, source: cfg.importApi.url }));
        setImportResult(`✓ ${arr.length} produits validés et prêts à l'import. (Mapping: ${JSON.stringify(cfg.importApi.mapping||{})})`);
      }
    } catch (e:any) {
      setImportResult(`✗ Erreur: ${e.message}`);
    } finally { setImportLoading(false); }
  };

  if (!cfg) return <div className="p-8">Chargement…</div>;

  const filteredZones = cfg.saleZones.filter(z=>{
    if (!zoneFilter) return true;
    const q = zoneFilter.toLowerCase();
    return z.label.toLowerCase().includes(q) || z.code.toLowerCase().includes(q) || (z.wilaya||'').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black flex items-center gap-2"><Settings className="w-6 h-6"/> Boutique — Configuration globale</h1>
        <button onClick={save} className="ad-btn ad-btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4"/> Enregistrer</button>
      </div>
      {saved && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Configuration enregistrée</div>}

      <div className="flex gap-2 border-b overflow-x-auto" style={{borderColor:'var(--ad-line)'}}>
        {[
          {k:'global',l:'Frais & Remises',i:Truck},
          {k:'zones',l:'Zones',i:MapPin},
          {k:'cgv',l:'CGV & Notes',i:FileText},
          {k:'import',l:'Import API',i:Download},
        ].map(t=>{
          const Icon=t.i;
          return <button key={t.k} onClick={()=>setTab(t.k as any)} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap ${tab===t.k?'border-[var(--ad-accent)] text-[var(--ad-accent)]':'border-transparent opacity-60'}`}><Icon className="w-4 h-4"/>{t.l}</button>
        })}
      </div>

      {tab==='global' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="ad-card p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Truck className="w-5 h-5"/> Livraison globale</h3>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Devise</span>
              <div className="relative">
                <div className="relative">
                  <Banknote className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--ad-muted)'}} />
                  <input
                    className="ad-input pl-9 pr-8"
                    placeholder="DZD — Dinar algérien"
                    value={showCurrencyList && currencyQuery !== '' ? currencyQuery : cfg.currency}
                    onChange={e=>{ setCurrencyQuery(e.target.value.toUpperCase()); setShowCurrencyList(true); }}
                    onFocus={()=>{ setCurrencyQuery(cfg.currency); setShowCurrencyList(true); }}
                    onBlur={()=> setTimeout(()=>setShowCurrencyList(false), 200)}
                  />
                  <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 opacity-40" />
                </div>
                {showCurrencyList && (
                  <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#1a1a1a] border rounded-xl shadow-xl max-h-56 overflow-auto" style={{borderColor:'var(--ad-line)'}}>
                    {currencies
                      .filter(c=> {
                        const q = currencyQuery.toLowerCase();
                        if (!q) return c.active;
                        return `${c.code} ${c.name} ${c.symbol}`.toLowerCase().includes(q);
                      })
                      .map(c=>(
                        <button
                          key={c.id}
                          type="button"
                          onClick={()=>{ update({currency: c.code}); setCurrencyQuery(c.code); setShowCurrencyList(false); }}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[var(--ad-surface-2)] ${cfg.currency===c.code ? 'bg-[var(--ad-surface-2)] font-bold' : ''} ${!c.active ? 'opacity-50' : ''}`}
                        >
                          <span><span className="font-mono font-black">{c.code}</span> <span className="opacity-60">{c.symbol}</span> — {c.name}</span>
                          {cfg.currency===c.code && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{background:'var(--ad-accent)', color:'#fff'}}>Actuelle</span>}
                        </button>
                      ))}
                    {currencies.filter(c=> {
                      const q = currencyQuery.toLowerCase();
                      if (!q) return c.active;
                      return `${c.code} ${c.name} ${c.symbol}`.toLowerCase().includes(q);
                    }).length===0 && (
                      <div className="px-3 py-3 text-xs" style={{color:'var(--ad-muted)'}}>
                        Aucune devise ne correspond. Vérifiez dans <a href="../currencies" className="underline" style={{color:'var(--ad-accent)'}}>Devises</a> ou saisissez un code ISO (ex: DZD, EUR).
                      </div>
                    )}
                    <div className="border-t p-2 flex gap-2" style={{borderColor:'var(--ad-line)'}}>
                      <button type="button" onClick={()=>{ if(currencyQuery.trim()) { update({currency: currencyQuery.trim().toUpperCase()}); setShowCurrencyList(false); } }} className="ad-btn ad-btn-ghost text-xs flex-1">Utiliser « {currencyQuery || cfg.currency} »</button>
                      <a href="../currencies" className="ad-btn ad-btn-ghost text-xs">Gérer les devises</a>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px]" style={{color:'var(--ad-muted)'}}>Tapez pour filtrer (code, nom ou symbole). La devise active par défaut est <strong>{currencies.find(c=>c.isDefault)?.code || 'DZD'}</strong>. Gérée dans <a href="../currencies" className="underline" style={{color:'var(--ad-accent)'}}>Devises</a>.</p>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Mode livraison</span>
              <select className="ad-select" value={cfg.shipping.mode} onChange={e=>update({shipping:{...cfg.shipping, mode:e.target.value as any}})}>
                <option value="fixed">Forfait fixe</option>
                <option value="per_qty">Par quantité</option>
                <option value="by_zone">Par zone (wilaya)</option>
                <option value="weight">Au poids</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Forfait par défaut (DA)</span>
                <input type="number" className="ad-input" value={cfg.shipping.defaultFee} onChange={e=>update({shipping:{...cfg.shipping, defaultFee:Number(e.target.value)}})}/>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>+ par article supp. (DA)</span>
                <input type="number" className="ad-input" value={cfg.shipping.perQtyFee} onChange={e=>update({shipping:{...cfg.shipping, perQtyFee:Number(e.target.value)}})}/>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Par kg (si au poids)</span>
                <input type="number" className="ad-input" value={cfg.shipping.perKgFee} onChange={e=>update({shipping:{...cfg.shipping, perKgFee:Number(e.target.value)}})}/>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Franco à partir de (DA)</span>
                <input type="number" className="ad-input" value={cfg.shipping.freeThreshold||0} onChange={e=>update({shipping:{...cfg.shipping, freeThreshold:Number(e.target.value)||undefined}})} placeholder="50000"/>
              </label>
            </div>
            {cfg.shipping.mode==='by_zone' && (
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Tarifs par zone</div>
                <div className="max-h-64 overflow-auto border rounded-lg" style={{borderColor:'var(--ad-line)'}}>
                  <div className="sticky top-0 z-10 bg-[var(--ad-surface)] border-b flex items-center gap-2 p-2 text-[11px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)', borderColor:'var(--ad-line)', background:'var(--ad-surface-2)'}}>
                    <span className="w-20">Zone</span>
                    <span className="w-24 text-center">Forfait</span>
                    <span className="w-20 text-center">+ / article</span>
                    <span className="w-28 text-center">Franco dès</span>
                    <span className="flex-1 text-right opacity-0">actions</span>
                  </div>
                  <div className="divide-y" style={{borderColor:'var(--ad-line)'}}>
                  {cfg.shipping.zoneFees.map(f=>(
                    <div key={f.zone} className="flex items-center gap-2 p-2 text-sm">
                      <span className="font-mono w-20 text-xs font-bold">{f.zone}</span>
                      <input type="number" className="ad-input w-24 text-center" value={f.fee} onChange={e=>updateZoneFee(f.zone,'fee',Number(e.target.value))} title="Forfait fixe (DA)" placeholder="0"/>
                      <input type="number" className="ad-input w-20 text-center" value={f.perQty||0} onChange={e=>updateZoneFee(f.zone,'perQty',Number(e.target.value))} title="Supplément par article supplémentaire (DA)" placeholder="0"/>
                      <input type="number" className="ad-input w-28 text-center" value={f.freeFrom||''} onChange={e=>updateZoneFee(f.zone,'freeFrom', Number(e.target.value)||undefined)} placeholder="—" title="Franco à partir de (DA) — vide = jamais franco"/>
                    </div>
                  ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">Ces tarifs s'appliquent selon la zone choisie par le client dans le tunnel. Utilisez l'onglet Zones pour activer/désactiver des wilayas.</p>
              </div>
            )}
          </div>

          <div className="ad-card p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Tag className="w-5 h-5"/> Remise globale & TVA</h3>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!cfg.globalDiscount.active} onChange={e=>update({globalDiscount:{...cfg.globalDiscount, active:e.target.checked}})} />
                <span className="text-sm font-bold">Activer remise panier automatique</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Type</span>
                  <select className="ad-select" value={cfg.globalDiscount.type} onChange={e=>update({globalDiscount:{...cfg.globalDiscount, type:e.target.value as any}})}>
                    <option value="percent">%</option>
                    <option value="fixed">Fixe DA</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Valeur</span>
                  <input type="number" className="ad-input" value={cfg.globalDiscount.value} onChange={e=>update({globalDiscount:{...cfg.globalDiscount, value:Number(e.target.value)}})}/>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Min commande (DA)</span>
                  <input type="number" className="ad-input" value={cfg.globalDiscount.minOrder||0} onChange={e=>update({globalDiscount:{...cfg.globalDiscount, minOrder:Number(e.target.value)||undefined}})} placeholder="0"/>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Max remise (DA)</span>
                  <input type="number" className="ad-input" value={cfg.globalDiscount.maxDiscount||''} onChange={e=>update({globalDiscount:{...cfg.globalDiscount, maxDiscount:Number(e.target.value)||undefined}})} placeholder="optionnel"/>
                </label>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t" style={{borderColor:'var(--ad-line)'}}>
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>TVA globale par défaut</span>
              <p className="text-xs" style={{color:'var(--ad-muted)'}}>Cette taxe est ajoutée automatiquement à chaque commande (si aucun TVA produit). Gérez-la dans <a href="../taxes" className="underline text-[var(--ad-accent)]">Taxes</a> ou sélectionnez ici. La taxe marquée « par défaut » dans Taxes est synchronisée.</p>
              <select className="ad-select w-full" value={cfg.globalTaxId||''} onChange={e=>update({globalTaxId: e.target.value || null})}>
                <option value="">Aucune (pas de TVA globale)</option>
                {taxes.map(tx=>(
                  <option key={tx.id} value={tx.id}>{tx.name} — {tx.mode==='percent'? `${tx.rate}%` : `${tx.rate} DA`} {tx.isDefault ? '★ par défaut' : ''} {tx.active? '' : '(inactive)'} </option>
                ))}
              </select>
              {cfg.globalTaxId && (
                <div className="text-xs p-2 rounded-lg border flex items-center gap-2" style={{borderColor:'var(--ad-line)', background:'var(--ad-surface-2)'}}>
                  <Tag className="w-4 h-4 text-[var(--ad-accent)]"/>
                  <span>Sélection actuelle : <strong>{taxes.find(t=>t.id===cfg.globalTaxId)?.name || cfg.globalTaxId}</strong> — sera ajoutée automatiquement dans le tunnel panier → commande. Pour changer le taux, éditez la taxe dans <a className="underline" href="../taxes">Taxes</a> et cochez « Par défaut ».</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={()=>{
                  // raccourci : ouvrir taxes avec creation ? on navigue
                  window.location.href = '../taxes';
                }} className="ad-btn ad-btn-ghost text-xs">Gérer les taxes</button>
                {cfg.globalTaxId && <button onClick={()=>update({globalTaxId: null})} className="ad-btn ad-btn-ghost text-xs">Retirer TVA globale</button>}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0"/>
              <span>Taxes détaillées et coupons se configurent dans <a href="../taxes" className="underline">Taxes</a> et <a href="../coupons" className="underline">Coupons</a>. La TVA produit (fiche produit) est prioritaire et s'additionne aux taxes globales.</span>
            </div>
          </div>
        </div>
      )}

      {tab==='zones' && (
        <div className="ad-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold flex items-center gap-2"><MapPin className="w-5 h-5"/> Zones disponibles (vente / livraison)</h3>
            <div className="flex items-center gap-2">
              <input className="ad-input w-48" placeholder="Filtrer code / label" value={zoneFilter} onChange={e=>setZoneFilter(e.target.value)} />
              <button onClick={addZone} className="ad-btn ad-btn-primary text-xs inline-flex items-center gap-1"><Plus className="w-4 h-4"/> Ajouter zone</button>
            </div>
          </div>
          <p className="text-xs" style={{color:'var(--ad-muted)'}}>Gérez ici la liste complète des wilayas / pays livrables. Décochez « Actif » pour interdire la vente, éditez code/label/délai/COD, supprimez ou dupliquez. Un produit peut restreindre davantage via son champ Zones.</p>
          <div className="flex gap-2">
            <button onClick={()=>{const all=cfg.saleZones.map(z=>({...z,active:true})); update({saleZones:all, deliveryZones:all});}} className="ad-btn ad-btn-ghost text-xs">Tout activer</button>
            <button onClick={()=>{const none=cfg.saleZones.map(z=>({...z,active:false})); update({saleZones:none, deliveryZones:none});}} className="ad-btn ad-btn-ghost text-xs">Tout désactiver</button>
            <span className="text-xs self-center opacity-60">{cfg.saleZones.length} zones · {cfg.saleZones.filter(z=>z.active).length} actives</span>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredZones.map(z=>(
              <div key={z.code} className={`border p-3 rounded-xl space-y-3 ${z.active ? 'bg-white dark:bg-[#111]' : 'bg-gray-100 dark:bg-[#1a1a1a] opacity-60'}`} style={{borderColor:'var(--ad-line)'}}>
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!z.active} onChange={()=>toggleSaleZone(z.code)} />
                    <span className="text-xs font-black uppercase" style={{color: z.active ? 'var(--ad-accent)' : 'var(--ad-muted)'}}>{z.active ? 'Active' : 'Inactive'}</span>
                  </label>
                  <div className="flex gap-1">
                    <button onClick={()=>duplicateZone(z.code)} className="ad-btn ad-btn-ghost p-1" title="Dupliquer"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>removeZone(z.code)} className="ad-btn ad-btn-danger p-1" title="Supprimer"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Label (wilaya / pays)</span>
                    <input className="ad-input" value={z.label} onChange={e=>updateZone(z.code,{label:e.target.value})} placeholder="Alger"/>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Code</span>
                      <input className="ad-input font-mono text-sm" value={z.code} onChange={e=>updateZone(z.code,{code:e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g,'')})} placeholder="DZ-16"/>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Wilaya / Région</span>
                      <input className="ad-input" value={z.wilaya||''} onChange={e=>updateZone(z.code,{wilaya:e.target.value})} placeholder="Alger"/>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Délai</span>
                      <input className="ad-input" value={z.deliveryDays||''} onChange={e=>updateZone(z.code,{deliveryDays:e.target.value})} placeholder="24-48h"/>
                    </label>
                    <label className="flex items-center gap-2 pt-5">
                      <input type="checkbox" checked={!!z.codAllowed} onChange={e=>updateZone(z.code,{codAllowed:e.target.checked})}/> <span className="text-xs font-bold">COD</span>
                    </label>
                  </div>
                </div>
                <div className="text-[11px] font-mono opacity-50">{z.code} · {z.wilaya || '—'} {z.codAllowed ? '· COD' : ''} {z.deliveryDays ? `· ${z.deliveryDays}` : ''}</div>
              </div>
            ))}
          </div>
          {filteredZones.length===0 && <div className="text-sm opacity-60 text-center py-8">Aucune zone ne correspond au filtre « {zoneFilter} »</div>}
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-xs border border-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0"/>
            <span>Supprimer une zone la retire aussi des tarifs par zone (onglet Frais). Les produits déjà restreints à cette zone resteront affichés mais ne seront plus commandables pour les clients de cette zone.</span>
          </div>
        </div>
      )}

      {tab==='cgv' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="ad-card p-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5"/> Conditions de vente (CGV)</h3>
            <textarea className="ad-textarea" rows={10} value={cfg.saleConditions} onChange={e=>update({saleConditions:e.target.value})} placeholder="Ex: Paiement à la livraison, retour sous 14j..."/>
            <p className="text-xs text-gray-500">Affichées dans le tunnel (étape 2) avec case à cocher obligatoire.</p>
          </div>
          <div className="ad-card p-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><Globe className="w-5 h-5"/> Notes de livraison</h3>
            <textarea className="ad-textarea" rows={10} value={cfg.deliveryNotes} onChange={e=>update({deliveryNotes:e.target.value})} placeholder="Ex: Livraison du lundi au samedi..."/>
            <p className="text-xs text-gray-500">Rappel affiché à côté de l'adresse et du choix de zone.</p>
          </div>
        </div>
      )}

      {tab==='import' && (
        <div className="ad-card p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Download className="w-5 h-5"/> Import / Mise à jour produits — API distante</h3>
          <p className="text-xs" style={{color:'var(--ad-muted)'}}>Configurez une source REST JSON (tableau) ou un CSV. Le système valide les lots et quantités avant d'importer.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>API REST URL (JSON)</span>
              <input className="ad-input" placeholder="https://api.fournisseur.com/products" value={cfg.importApi?.url||''} onChange={e=>update({importApi:{...cfg.importApi!, url:e.target.value}})}/>
            </label>
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Authentification</span>
              <select className="ad-select w-full" value={cfg.importApi?.authHeader || 'X-API-Key'} onChange={e=>update({importApi:{...cfg.importApi!, authHeader: e.target.value as any, apiKey: e.target.value==='none' ? '' : cfg.importApi!.apiKey}})}>
                <option value="none">Sans clé (public)</option>
                <option value="X-API-Key">X-API-Key</option>
                <option value="Authorization">Authorization (Bearer)</option>
              </select>
            </div>
            {cfg.importApi?.authHeader !== 'none' && (
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Clé API</span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input className="ad-input w-full pr-10" placeholder="clé" type={showApiKey ? 'text' : 'password'} value={cfg.importApi?.apiKey||''} onChange={e=>update({importApi:{...cfg.importApi!, apiKey:e.target.value}})} />
                    <button type="button" onClick={()=>setShowApiKey(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100">
                      {showApiKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                  {cfg.importApi?.apiKey && <span className="self-center text-xs text-green-600">● renseignée</span>}
                </div>
                <p className="text-[11px] text-gray-500">Envoyée dans l'en-tête <code>{cfg.importApi?.authHeader}</code>. Laissez vide si l'API est publique.</p>
              </label>
            )}
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>CSV URL (alternative)</span>
              <input className="ad-input" placeholder="https://.../export.csv" value={cfg.importApi?.csvUrl||''} onChange={e=>update({importApi:{...cfg.importApi!, csvUrl:e.target.value}})}/>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Mapping (JSON)</span>
              <input className="ad-input font-mono text-xs" placeholder='{"name":"title","price":"prix_ht"}' value={JSON.stringify(cfg.importApi?.mapping||{})} onChange={e=>{try{const m=JSON.parse(e.target.value); update({importApi:{...cfg.importApi!, mapping:m}});}catch{}}}/>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleImport} disabled={importLoading} className="ad-btn ad-btn-primary inline-flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${importLoading?'animate-spin':''}`}/> Tester & Valider lots</button>
            <button onClick={save} className="ad-btn ad-btn-ghost">Enregistrer config</button>
          </div>
          {importResult && <div className={`p-3 rounded-lg text-sm border ${importResult.startsWith('✓')?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{importResult}</div>}
          <div className="bg-gray-50 dark:bg-[#111] p-3 rounded-lg text-xs border" style={{borderColor:'var(--ad-line)'}}>
            <div className="font-bold mb-1">Validation lots/quantités effectuée :</div>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>CSV : header doit contenir name, price — quantités numériques</li>
              <li>JSON : chaque produit name+price requis, quantity numérique</li>
              <li>Totaux aberrants (&gt;100k unités) rejetés</li>
              <li>Produits invalides listés avec numéro de ligne</li>
            </ul>
            <p className="mt-2 text-gray-500">L'import réel persiste ensuite via votre API/FS (data/products.json). Le mapping permet d'adapter les champs fournisseurs (ex: prix_ht → price).</p>
          </div>
        </div>
      )}
    </div>
  );
}
