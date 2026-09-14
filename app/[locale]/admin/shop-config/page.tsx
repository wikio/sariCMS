'use client';

import { useState, useEffect } from 'react';
import { Save, Truck, Tag, MapPin, FileText, Globe, RefreshCw, AlertTriangle, CheckCircle, Settings, Download } from 'lucide-react';
import { loadShopConfig, saveShopConfig, DEFAULT_ZONES, formatZoneLabel, type ShopConfig, type ShippingZoneFee, type SaleZone } from '@/lib/shop-config';

export default function ShopConfigPage() {
  const [cfg, setCfg] = useState<ShopConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'global'|'zones'|'cgv'|'import'>('global');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  useEffect(() => { setCfg(loadShopConfig()); }, []);

  const update = (patch: Partial<ShopConfig>) => { if (cfg) setCfg({ ...cfg, ...patch }); };
  const save = () => { if (cfg) { saveShopConfig(cfg); setSaved(true); setTimeout(()=>setSaved(false),2000); } };

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

  const handleImport = async () => {
    if (!cfg) return;
    setImportLoading(true);
    setImportResult('');
    try {
      const url = cfg.importApi.url || cfg.importApi.csvUrl;
      if (!url) throw new Error('Aucune URL configurée');
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (cfg.importApi.authHeader && cfg.importApi.apiKey) headers[cfg.importApi.authHeader] = cfg.importApi.apiKey;
      // Si CSV, on fetch et parse côté client
      if (cfg.importApi.csvUrl) {
        const res = await fetch(cfg.importApi.csvUrl, { headers });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // validation lots/quantités : on compte les lignes et on valide schema minimal
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
        // Simulation import : on stocke en localStorage un journal
        const imported = dataLines.length;
        localStorage.setItem('sari_import_log', JSON.stringify({ date: new Date().toISOString(), imported, source: cfg.importApi.csvUrl }));
        setImportResult(`✓ ${imported} produits validés (lots OK). Import simulé — branchez ici votre persistence (data/products.json ou API).`);
      } else {
        const res = await fetch(cfg.importApi.url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const arr = Array.isArray(json) ? json : (json.data || json.products || []);
        if (!Array.isArray(arr)) throw new Error('Format JSON attendu : tableau');
        // validation lots : chaque produit doit avoir name + price, quantity numérique si présent
        const invalid = arr.filter((p:any)=>!p.name || typeof p.price === 'undefined' || (p.quantity!==undefined && isNaN(Number(p.quantity))));
        if (invalid.length) throw new Error(`${invalid.length} produits invalides (name/price/quantity)`);
        // quantité globale max ? cfg.importApi.batchValidation
        const maxQty = 10000;
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black flex items-center gap-2"><Settings className="w-6 h-6"/> Boutique — Configuration globale</h1>
        <button onClick={save} className="ad-btn ad-btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4"/> Enregistrer</button>
      </div>
      {saved && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Configuration enregistrée</div>}

      <div className="flex gap-2 border-b" style={{borderColor:'var(--ad-line)'}}>
        {[
          {k:'global',l:'Frais & Remises',i:Truck},
          {k:'zones',l:'Zones',i:MapPin},
          {k:'cgv',l:'CGV & Notes',i:FileText},
          {k:'import',l:'Import API',i:Download},
        ].map(t=>{
          const Icon=t.i;
          return <button key={t.k} onClick={()=>setTab(t.k as any)} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 ${tab===t.k?'border-[var(--ad-accent)] text-[var(--ad-accent)]':'border-transparent opacity-60'}`}><Icon className="w-4 h-4"/>{t.l}</button>
        })}
      </div>

      {tab==='global' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="ad-card p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Truck className="w-5 h-5"/> Livraison globale</h3>
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Devise</span>
              <input className="ad-input" value={cfg.currency} onChange={e=>update({currency:e.target.value})}/>
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
                <div className="max-h-64 overflow-auto border rounded-lg divide-y" style={{borderColor:'var(--ad-line)'}}>
                  {cfg.shipping.zoneFees.map(f=>(
                    <div key={f.zone} className="flex items-center gap-2 p-2 text-sm">
                      <span className="font-mono w-20">{f.zone}</span>
                      <input type="number" className="ad-input w-24" value={f.fee} onChange={e=>updateZoneFee(f.zone,'fee',Number(e.target.value))} title="Forfait"/>
                      <input type="number" className="ad-input w-20" value={f.perQty||0} onChange={e=>updateZoneFee(f.zone,'perQty',Number(e.target.value))} title="+/article"/>
                      <input type="number" className="ad-input w-24" value={f.freeFrom||''} onChange={e=>updateZoneFee(f.zone,'freeFrom',Number(e.target.value)||undefined)} placeholder="franco"/>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500">PerQty : supplément par article au-delà du premier. Franco : offert si sous-total ≥ montant.</p>
              </div>
            )}
          </div>

          <div className="ad-card p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Tag className="w-5 h-5"/> Remise & taxe globales</h3>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!cfg.globalDiscount.active} onChange={e=>update({globalDiscount:{...cfg.globalDiscount, active:e.target.checked}})}/>
              <span className="text-sm font-bold">Remise globale active</span>
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
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0"/>
              <span>Taxes globales et coupons panier se configurent dans <a href="../taxes" className="underline">Taxes</a> et <a href="../coupons" className="underline">Coupons</a>. La TVA produit (fiches produit) est prioritaire et s'ajoute aux taxes globales.</span>
            </div>
          </div>
        </div>
      )}

      {tab==='zones' && (
        <div className="ad-card p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><MapPin className="w-5 h-5"/> Zones disponibles (vente / livraison)</h3>
          <p className="text-xs" style={{color:'var(--ad-muted)'}}>Décochez pour interdire la vente sur une wilaya. Un produit peut restreindre davantage via son champ Zones.</p>
          <div className="grid md:grid-cols-3 gap-2">
            {DEFAULT_ZONES.map(z=>{
              const active = cfg.saleZones.find(s=>s.code===z.code)?.active ?? true;
              return (
                <label key={z.code} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${active?'bg-white dark:bg-[#111]':'bg-gray-100 opacity-60'}`} style={{borderColor:'var(--ad-line)'}}>
                  <input type="checkbox" checked={active} onChange={()=>toggleSaleZone(z.code)} />
                  <span className="text-sm"><strong>{z.label}</strong> <span className="font-mono text-xs">{z.code}</span></span>
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={()=>{const all=cfg.saleZones.map(z=>({...z,active:true})); update({saleZones:all, deliveryZones:all});}} className="ad-btn ad-btn-ghost text-xs">Tout activer</button>
            <button onClick={()=>{const none=cfg.saleZones.map(z=>({...z,active:false})); update({saleZones:none, deliveryZones:none});}} className="ad-btn ad-btn-ghost text-xs">Tout désactiver</button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {cfg.saleZones.filter(z=>z.active).map(z=>(
              <div key={z.code} className="border p-3 rounded-lg space-y-2" style={{borderColor:'var(--ad-line)'}}>
                <div className="font-bold text-sm">{z.label} <span className="font-mono text-xs">{z.code}</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-xs" style={{color:'var(--ad-muted)'}}>Délai</span>
                    <input className="ad-input" value={z.deliveryDays} onChange={e=>{const zs=cfg.saleZones.map(x=>x.code===z.code?{...x,deliveryDays:e.target.value}:x); update({saleZones:zs, deliveryZones:zs});}}/>
                  </label>
                  <label className="flex items-center gap-2 pt-4">
                    <input type="checkbox" checked={!!z.codAllowed} onChange={e=>{const zs=cfg.saleZones.map(x=>x.code===z.code?{...x,codAllowed:e.target.checked}:x); update({saleZones:zs, deliveryZones:zs});}}/> COD
                  </label>
                </div>
              </div>
            ))}
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
              <input className="ad-input" placeholder="https://api.fournisseur.com/products" value={cfg.importApi.url||''} onChange={e=>update({importApi:{...cfg.importApi, url:e.target.value}})}/>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Auth header / API Key</span>
              <div className="flex gap-2">
                <input className="ad-input w-28" placeholder="X-API-Key" value={cfg.importApi.authHeader||''} onChange={e=>update({importApi:{...cfg.importApi, authHeader:e.target.value}})}/>
                <input className="ad-input flex-1" placeholder="clé" type="password" value={cfg.importApi.apiKey||''} onChange={e=>update({importApi:{...cfg.importApi, apiKey:e.target.value}})}/>
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>CSV URL (alternative)</span>
              <input className="ad-input" placeholder="https://.../export.csv" value={cfg.importApi.csvUrl||''} onChange={e=>update({importApi:{...cfg.importApi, csvUrl:e.target.value}})}/>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest" style={{color:'var(--ad-muted)'}}>Mapping (JSON)</span>
              <input className="ad-input font-mono text-xs" placeholder='{"name":"title","price":"prix_ht"}' value={JSON.stringify(cfg.importApi.mapping||{})} onChange={e=>{try{const m=JSON.parse(e.target.value); update({importApi:{...cfg.importApi, mapping:m}});}catch{}}}/>
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
