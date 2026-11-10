'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUp, BarChart3, Banknote, Boxes, Building2, Check, CircleHelp, ClipboardList,
  CreditCard, Download, PackagePlus, Plus, Search, ShieldCheck, ShoppingCart, Store,
  Tag, Trash2, Truck, UserRound, Users, Wallet,
} from 'lucide-react';
import { Button } from '../ui/button';

type Section = 'overview' | 'pos' | 'inventory' | 'purchasing' | 'customers' | 'employees' | 'expenses' | 'branches' | 'offers' | 'reports' | 'controls';

const navigation: Array<{ id: Section; label: string; icon: typeof Store }> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'pos', label: 'Point of sale', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'purchasing', label: 'Purchasing', icon: Truck },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'employees', label: 'Employees', icon: UserRound },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'branches', label: 'Branches', icon: Building2 },
  { id: 'offers', label: 'Loyalty & offers', icon: Tag },
  { id: 'reports', label: 'Reports', icon: ClipboardList },
  { id: 'controls', label: 'Controls', icon: ShieldCheck },
];

const products = [
  { id: 'chocolate', name: 'Imported dark chocolate 100g', sku: 'CHO-1001', barcode: '4791001001001', type: 'Packaged', category: 'Confectionery', branch: 'Colombo Fort', stock: 18, reorder: 20, price: 1250, expiry: '—' },
  { id: 'perfume', name: 'Imported perfume 50ml', sku: 'FRA-0050', barcode: '4791001001002', type: 'Packaged', category: 'Fragrance', branch: 'Colombo Fort', stock: 7, reorder: 10, price: 18500, expiry: '—' },
  { id: 'chips', name: 'Imported potato chips 150g', sku: 'SNK-0150', barcode: '4791001001003', type: 'Packaged', category: 'Snacks', branch: 'Colombo Fort', stock: 7, reorder: 10, price: 950, expiry: '—' },
  { id: 'wafers', name: 'Chocolate wafer box', sku: 'CHO-0020', barcode: '4791001001004', type: 'Packaged', category: 'Confectionery', branch: 'Colombo Fort', stock: 42, reorder: 15, price: 1450, expiry: '30 Dec 2026' },
  { id: 'cologne', name: 'Imported cologne 100ml', sku: 'FRA-0100', barcode: '4791001001005', type: 'Packaged', category: 'Fragrance', branch: 'Kandy City', stock: 56, reorder: 14, price: 24500, expiry: '—' },
  { id: 'cookies', name: 'Imported butter cookies 200g', sku: 'SNK-0200', barcode: '4791001001006', type: 'Packaged', category: 'Snacks', branch: 'Kandy City', stock: 9, reorder: 12, price: 1250, expiry: '15 Jan 2027' },
  { id: 'delivery', name: 'Local delivery', sku: 'SRV-0001', barcode: null, type: 'Service', category: 'Services', branch: 'All branches', stock: 0, reorder: null, price: 1200, expiry: '—' },
];

const orders = [
  ['PO-1048', 'Ceylon Imports', 'Today · 09:25', 'Awaiting delivery', 'LKR 84,260.00'],
  ['PO-1047', 'Serendib Distributors', 'Yesterday', 'Part received', 'LKR 32,640.00'],
  ['PO-1046', 'Lanka Trade House', '24 Oct 2026', 'Received', 'LKR 120,800.00'],
];
const customers = [
  ['Amelia Brown', 'C-00128', 'amelia.brown@example.test', '12', 'LKR 28,460.00'],
  ['Oliver Shah', 'C-00127', 'oliver.shah@example.test', '8', 'LKR 16,320.00'],
  ['Sofia Patel', 'C-00126', 'sofia.patel@example.test', '24', 'LKR 52,110.00'],
  ['Noah Wilson', 'C-00125', 'noah.wilson@example.test', '3', 'LKR 7,245.00'],
];
const employees = [
  ['Mia Johnson', 'Store manager', 'Colombo Fort', 'On shift'],
  ['Ethan Clarke', 'Cashier', 'Colombo Fort', 'On shift'],
  ['Grace Ahmed', 'Stock associate', 'Kandy City', 'Off shift'],
  ['Leo Martin', 'Cashier', 'Kandy City', 'On shift'],
];
const expenses = [
  ['EXP-2081', 'Store supplies', 'Today · 10:12', 'Petty cash', 'LKR 3,850.00'],
  ['EXP-2080', 'Local delivery fuel', 'Yesterday', 'Card', 'LKR 6,420.00'],
  ['EXP-2079', 'Cleaning service', '25 Oct 2026', 'Bank transfer', 'LKR 12,500.00'],
];
const branches = [
  ['Colombo Fort', 'LON-01', 'Open', 'LKR 428,640.00', '3'],
  ['Kandy City', 'MAN-02', 'Open', 'LKR 291,480.00', '2'],
];
const offers = [
  ['FRESH10', '10% off fresh produce', 'Produce', 'Until 31 Oct', 'Active'],
  ['LOYAL5', 'LKR 500.00 reward after 500 points', 'Loyalty members', 'Ongoing', 'Active'],
  ['BREAD2', '2 for LKR 200.00 bakery offer', 'Bakery', 'Ended 25 Oct', 'Expired'],
];

const money = (value: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(value);

export function SupermarketDemoWorkspace({ initialSection = 'overview' }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  const [query, setQuery] = useState('');
  const [itemType, setItemType] = useState('All item types');
  const [branch, setBranch] = useState('All branches');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState('');

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku} ${product.barcode ?? ''} ${product.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (itemType === 'All item types' || product.type === itemType) && (branch === 'All branches' || product.branch === branch || product.branch === 'All branches');
  }), [query, itemType, branch]);
  const posProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku} ${product.barcode ?? ''} ${product.category}`.toLowerCase().includes(query.toLowerCase())), [query]);

  const filteredRows = useMemo(() => {
    const rows = section === 'purchasing' ? orders : section === 'customers' ? customers : section === 'employees' ? employees : section === 'expenses' ? expenses : section === 'branches' ? branches : offers;
    return rows.filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase()));
  }, [query, section]);

  const cartItems = products.filter((product) => cart[product.id]);
  const cartTotal = cartItems.reduce((total, item) => total + item.price * cart[item.id], 0);
  const addToCart = (id: string) => setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  const changeQuantity = (id: string, delta: number) => setCart((current) => {
    const next = (current[id] ?? 0) + delta;
    if (next <= 0) {
      const rest = { ...current };
      delete rest[id];
      return rest;
    }
    return { ...current, [id]: next };
  });

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-brand-line pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0"><p className="eyebrow mb-2">Retail &amp; E-Commerce · Sri Lankan retail demo</p><h1 className="break-words text-3xl font-semibold tracking-[-0.045em] text-brand-navy">Retail & E-Commerce operations</h1><p className="mt-2 text-sm text-slate-600">Explore how daily store operations could work.</p></div>
        <span className="inline-flex min-h-10 items-center gap-2 border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-950"><CircleHelp aria-hidden="true" className="h-4 w-4" /> Demo only</span>
      </header>

      <div role="status" className="border-l-2 border-violet-500 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-950"><strong>Sample data only.</strong> This preview uses fictional data and is not connected to your account. Nothing is saved. VAT/SSCL is not calculated, and no payments, orders, or messages are sent.</div>

      <nav aria-label="Retail &amp; E-Commerce demo sections" className="max-w-full border-b border-brand-line">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{navigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setSection(id); setQuery(''); setNotice(''); }} aria-current={section === id ? 'page' : undefined} className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 border-b-2 px-2 py-2 text-center text-sm leading-5 sm:justify-start sm:px-3 sm:text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-blue ${section === id ? 'border-brand-blue font-semibold text-brand-navy' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}><Icon aria-hidden="true" className="h-4 w-4" />{label}</button>)}</div>
      </nav>

      {notice && <p role="status" className="border border-brand-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{notice}</p>}
      {section === 'overview' && <Overview onSelect={setSection} />}
      {section === 'pos' && <section aria-labelledby="demo-pos-title" className="space-y-5"><PageHeading eyebrow="Checkout demo" title="Point of sale" description="Search the sample catalog and build a basket. Checkout is deliberately unavailable in this preview." />
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"><div className="min-w-0 space-y-4 border border-brand-line bg-white p-4 sm:p-5"><SearchBox value={query} onChange={setQuery} label="Search sample products" placeholder="Scan a barcode or search by name or SKU" />
          <div className="max-h-[410px] space-y-2 overflow-y-auto">{posProducts.map((product) => <div key={product.id} className="flex min-w-0 items-center justify-between gap-3 border-b border-brand-line py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-brand-navy">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.sku} · {product.branch}</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-sm font-semibold">{money(product.price)}</span><Button type="button" size="sm" variant="outline" onClick={() => addToCart(product.id)} aria-label={`Add ${product.name} to sample basket`}><Plus aria-hidden="true" className="h-4 w-4" />Add</Button></div></div>)}</div>
        </div><aside aria-label="Sample basket" className="min-w-0 space-y-4 border border-brand-line bg-white p-4 sm:p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-brand-navy">Current sale</h3><p className="mt-1 text-xs text-slate-600">{cartItems.reduce((n, item) => n + cart[item.id], 0)} sample items</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setCart({})} disabled={!cartItems.length}>Clear</Button></div>
          {cartItems.length === 0 ? <p className="border border-dashed border-brand-line bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">Add sample products to start a basket.</p> : <ul className="divide-y divide-brand-line">{cartItems.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-slate-500">{money(item.price)} each</p></div><div className="flex shrink-0 items-center gap-1"><Button type="button" variant="outline" size="sm" aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item.id, -1)}>−</Button><span className="min-w-6 text-center text-sm">{cart[item.id]}</span><Button type="button" variant="outline" size="sm" aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item.id, 1)}>+</Button><button type="button" className="ml-1 rounded-sm p-2 text-slate-500 hover:bg-slate-100" aria-label={`Remove ${item.name} from basket`} onClick={() => changeQuantity(item.id, -cart[item.id])}><Trash2 aria-hidden="true" className="h-4 w-4" /></button></div></li>)}</ul>}
          <div className="flex justify-between border-t border-brand-line pt-4 text-sm"><span className="font-medium">Sample total</span><strong>{money(cartTotal)}</strong></div><div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled><Banknote aria-hidden="true" className="h-4 w-4" /> Cash</Button><Button type="button" variant="outline" disabled><CreditCard aria-hidden="true" className="h-4 w-4" /> Card</Button></div><Button type="button" className="w-full" disabled aria-describedby="demo-safety-note">Checkout unavailable</Button><p id="demo-safety-note" className="text-xs leading-5 text-slate-500">Payments and inventory changes are not enabled in a demo.</p>
        </aside></div>
      </section>}
      {section === 'inventory' && <section className="min-w-0 space-y-5"><PageHeading eyebrow="Sample catalog" title="Products & stock" description="Search SKUs, compare locations and spot items that need replenishing." /><div className="flex flex-col gap-3 sm:flex-row"><SearchBox value={query} onChange={setQuery} label="Search inventory" placeholder="Search products, SKU, barcode" /><label className="block text-sm"><span className="sr-only">Filter by item type</span><select aria-label="Filter by item type" value={itemType} onChange={(event) => setItemType(event.target.value)} className="min-h-11 w-full border border-brand-line bg-white px-3 sm:w-48"><option>All item types</option><option>Packaged</option><option>Variable weight</option><option>Perishable</option><option>Service</option></select></label><label className="block text-sm"><span className="sr-only">Filter by branch</span><select aria-label="Filter by branch" value={branch} onChange={(event) => setBranch(event.target.value)} className="min-h-11 w-full border border-brand-line bg-white px-3 sm:w-52"><option>All branches</option><option>Colombo Fort</option><option>Kandy City</option></select></label></div><div className="overflow-hidden border border-brand-line bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line p-4"><p className="text-sm text-slate-600">{filteredProducts.length} sample products</p><Button type="button" variant="outline" onClick={() => setNotice('Product creation is a preview-only action. No SKU has been saved.')}><PackagePlus aria-hidden="true" className="h-4 w-4" />Preview add product</Button></div><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{['Product / SKU','Type','Location','On hand','Reorder at','Retail price','Expiry'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-brand-line">{filteredProducts.map((product) => <tr key={product.id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-medium text-brand-navy">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.sku}{product.barcode ? ` · ${product.barcode}` : ''}</p></td><td className="px-4 py-3">{product.type}</td><td className="px-4 py-3">{product.branch}</td><td className="px-4 py-3"><span className={product.reorder !== null && product.stock < product.reorder ? 'font-semibold text-amber-800' : ''}>{product.stock} units</span></td><td className="px-4 py-3">{product.reorder ?? '—'}</td><td className="px-4 py-3">{money(product.price)}</td><td className="px-4 py-3">{product.expiry}</td></tr>)}</tbody></table>{filteredProducts.length === 0 && <p className="p-8 text-center text-sm text-slate-600">No sample products match those filters.</p>}</div></div></section>}
      {['purchasing','customers','employees','expenses','branches','offers'].includes(section) && <RecordsPanel section={section as Section} query={query} setQuery={setQuery} rows={filteredRows} onPreviewAction={setNotice} />}
      {section === 'reports' && <Reports />}
      {section === 'controls' && <Controls />}
    </div>
  );
}

function Overview({ onSelect }: { onSelect: (section: Section) => void }) {
  const shortcuts: Array<{ section: Section; title: string; summary: string; icon: typeof Store }> = [
    { section: 'pos', title: 'Start a sample sale', summary: 'Explore a cashier basket and payment summary.', icon: ShoppingCart },
    { section: 'inventory', title: 'Find a product', summary: 'Search SKUs and compare branch stock.', icon: Boxes },
    { section: 'purchasing', title: 'Review purchasing', summary: 'See supplier orders and delivery statuses.', icon: Truck },
    { section: 'reports', title: 'View reports', summary: 'Explore sales and stock summaries.', icon: BarChart3 },
  ];
  return <section aria-labelledby="demo-overview-title" className="space-y-7"><PageHeading eyebrow="Two locations · Demo data" title="Good morning, store team" description="An example view of today’s retail activity. All figures below are fictional." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Sales today','LKR 428,640.00','+8.2% vs prior day'],['Transactions','186','Sample receipts'],['Active products','1,248','Across 2 locations'],['Replenishment alerts','12','5 need attention']].map(([label,value,caption], index) => <div key={label} className="border border-brand-line bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-brand-navy">{value}</p><p className={`mt-2 inline-flex items-center gap-1 text-xs ${index===0?'text-emerald-800':'text-slate-500'}`}>{index===0&&<ArrowUp aria-hidden="true" className="h-3 w-3"/>}{caption}</p></div>)}</div><div><h3 id="demo-overview-title" className="mb-3 text-lg font-semibold text-brand-navy">Quick access</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.map(({section,title,summary,icon:Icon})=><button type="button" key={section} onClick={()=>onSelect(section)} className="flex min-h-32 min-w-0 flex-col items-start border border-brand-line bg-white p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"><Icon aria-hidden="true" className="mb-4 h-5 w-5 text-brand-blue"/><span className="font-semibold text-brand-navy">{title}</span><span className="mt-1 text-xs leading-5 text-slate-600">{summary}</span></button>)}</div></div><div className="grid gap-6 lg:grid-cols-2"><section className="border border-brand-line bg-white p-4"><div className="mb-4 flex items-start justify-between"><div><h3 className="font-semibold text-brand-navy">Sales through the day</h3><p className="mt-1 text-xs text-slate-500">Illustrative hourly totals</p></div><button type="button" onClick={()=>onSelect('reports')} className="text-xs font-medium text-brand-blue hover:underline">View report</button></div><Bars values={[22,38,31,57,47,76,64,89,70,100,82,61]} labels={['8am','10am','12pm','2pm','4pm','6pm']}/></section><section className="border border-brand-line bg-white p-4"><div className="mb-4 flex items-start justify-between"><div><h3 className="font-semibold text-brand-navy">Needs replenishment</h3><p className="mt-1 text-xs text-slate-500">Sample branch stock below reorder level</p></div><button type="button" onClick={()=>onSelect('inventory')} className="text-xs font-medium text-brand-blue hover:underline">View stock</button></div><ul className="divide-y divide-brand-line">{products.filter(p=>p.reorder!==null&&p.stock<p.reorder).slice(0,4).map((item)=><li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate font-medium">{item.name}<span className="block text-xs font-normal text-slate-500">{item.branch}</span></span><span className="shrink-0 text-amber-800">{item.stock} / {item.reorder}</span></li>)}</ul></section></div></section>;
}

function RecordsPanel({ section, query, setQuery, rows, onPreviewAction }: { section: Section; query: string; setQuery: (value: string) => void; rows: string[][]; onPreviewAction: (value: string) => void }) {
  const config: Record<string,{title:string;description:string;search:string;columns:string[];action:string}> = {
    purchasing:{title:'Purchasing & suppliers',description:'Track supplier orders, expected deliveries and goods received.',search:'Search orders or suppliers',columns:['Order','Supplier','Order date','Status','Total'],action:'Draft purchase order'},
    customers:{title:'Customers & loyalty',description:'Review customer profiles, sample spend and loyalty balances.',search:'Search name, code or email',columns:['Customer','Account','Email','Points','Sample spend'],action:'Preview new customer'},
    employees:{title:'Employees & shifts',description:'See example team roles, store assignments and shift status.',search:'Search team members',columns:['Team member','Role','Location','Shift status'],action:'Preview invite'},
    expenses:{title:'Expenses & petty cash',description:'Review example outgoings and payment channels.',search:'Search expense or category',columns:['Reference','Category','Recorded','Payment','Amount'],action:'Preview expense'},
    branches:{title:'Branches & locations',description:'Compare example store activity and low-stock items.',search:'Search store or code',columns:['Location','Code','Status','Sample sales','Alerts'],action:'Preview location'},
    offers:{title:'Loyalty & offers',description:'Review sample promotions and customer rewards.',search:'Search offer or audience',columns:['Offer','Details','Audience','Period','Status'],action:'Preview offer'},
  };
  const view = config[section] ?? config.purchasing;
  return <section className="min-w-0 space-y-5"><PageHeading eyebrow="Sample records" title={view.title} description={view.description}/><div className="grid gap-3 sm:grid-cols-3">{(section==='purchasing'?['3 open orders','2 awaiting delivery','18 suppliers']:section==='customers'?['2,408 customers','186 recent visits','4,621 loyalty points']:section==='employees'?['24 team members','6 cashiers','2 locations']:section==='expenses'?['LKR 22,800.00 today','LKR 481,200.00 this month','3 payment methods']:section==='branches'?['2 locations','12 stock alerts','186 sales today']:['2 active offers','384 loyalty members','1 offer expired']).map((metric)=><div key={metric} className="border border-brand-line bg-white p-4 text-sm font-semibold text-brand-navy">{metric}<span className="mt-1 block text-xs font-normal text-slate-500">Example data</span></div>)}</div><div className="overflow-hidden border border-brand-line bg-white"><div className="flex flex-col gap-3 border-b border-brand-line p-4 sm:flex-row sm:items-center sm:justify-between"><SearchBox value={query} onChange={setQuery} label={view.search} placeholder={view.search}/><Button type="button" variant="outline" onClick={()=>onPreviewAction(`${view.action} is a local preview only. No information was saved or sent.`)}><Plus aria-hidden="true" className="h-4 w-4"/>{view.action}</Button></div><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{view.columns.map(c=><th key={c} scope="col" className="px-4 py-3 font-medium">{c}</th>)}</tr></thead><tbody className="divide-y divide-brand-line">{rows.map((row,index)=><tr key={`${row[0]}-${index}`} className="hover:bg-slate-50">{row.map((cell,i)=><td key={`${i}-${cell}`} className={`px-4 py-3 ${i===0?'font-medium text-brand-navy':''}`}>{cell}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="p-8 text-center text-sm text-slate-600">No sample records match your search.</p>}</div></div></section>;
}

function Reports() { return <section className="space-y-5"><PageHeading eyebrow="Example reporting" title="Store reports" description="Explore the kind of operational summaries available after secure data integration."/><div className="flex flex-wrap items-center justify-between gap-3 border border-brand-line bg-white p-4"><label className="flex items-center gap-2 text-sm">Period<select aria-label="Report period" className="min-h-10 border border-brand-line bg-white px-3"><option>Today</option><option>This week</option><option>This month</option></select></label><Button type="button" variant="outline" onClick={()=>window.print()}><Download aria-hidden="true" className="h-4 w-4"/>Print this demo</Button></div><div className="grid gap-3 sm:grid-cols-3">{[['Sales','LKR 2,841,620.00','+6.4%'],['Gross margin','LKR 725,410.00','25.5% sample'],['Stock value','LKR 4,280,600.00','Across 2 stores']].map(([a,b,c])=><div key={a} className="border border-brand-line bg-white p-4"><p className="text-sm text-slate-600">{a}</p><p className="mt-3 text-2xl font-semibold text-brand-navy">{b}</p><p className="mt-2 text-xs text-slate-500">{c}</p></div>)}</div><div className="grid gap-5 lg:grid-cols-2"><section className="border border-brand-line bg-white p-4"><h3 className="font-semibold text-brand-navy">Weekly sales</h3><p className="mb-5 mt-1 text-xs text-slate-500">Illustrative totals · LKR</p><Bars values={[48,63,51,82,72,100,89]} labels={['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}/></section><section className="border border-brand-line bg-white p-4"><h3 className="font-semibold text-brand-navy">Category mix</h3><p className="mb-5 mt-1 text-xs text-slate-500">Example share of sales</p><div className="space-y-4">{[['Grocery',78,'78%'],['Produce',61,'61%'],['Dairy',46,'46%'],['Household',32,'32%']].map(([name,width,value])=><div key={String(name)}><div className="mb-1 flex justify-between text-sm"><span>{name}</span><span>{value}</span></div><div className="h-2 bg-slate-100"><div className="h-full bg-brand-blue" style={{width:`${width}%`}}/></div></div>)}</div></section></div></section>; }

function Controls() { return <section className="space-y-5"><PageHeading eyebrow="Example operating controls" title="Business controls" description="A preview of till procedures, access checks and audit visibility."/><div className="grid gap-4 lg:grid-cols-2"><section className="space-y-4 border border-brand-line bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><Banknote aria-hidden="true" className="mt-0.5 h-5 w-5 text-brand-blue"/><div><h3 className="font-semibold text-brand-navy">Till reconciliation</h3><p className="mt-1 text-sm text-slate-600">Sample shift · Colombo Fort · 08:00–16:00</p></div></div><dl className="space-y-3 border-t border-brand-line pt-4 text-sm">{[['Opening float','LKR 10,000.00'],['Cash sales','LKR 68,420.00'],['Cash paid out','LKR 3,850.00'],['Expected drawer','LKR 74,570.00'],['Counted drawer','LKR 74,570.00']].map(([label,value])=><div key={label} className="flex justify-between gap-3"><dt className="text-slate-600">{label}</dt><dd className="font-medium text-brand-navy">{value}</dd></div>)}</dl><div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check aria-hidden="true" className="h-4 w-4"/>Sample variance: LKR 0.00</div><Button type="button" disabled aria-describedby="controls-demo-note">Close live shift unavailable</Button><p id="controls-demo-note" className="text-xs text-slate-500">Till controls require a verified backend connection.</p></section><section className="border border-brand-line bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 text-brand-blue"/><div><h3 className="font-semibold text-brand-navy">Access &amp; audit</h3><p className="mt-1 text-sm text-slate-600">Example controls for accountable store operations.</p></div></div><ul className="mt-4 divide-y divide-brand-line">{[['Primary Owner','Full organization access','Protected'],['Store manager','Assigned locations','Example role'],['Cashier','Till and checkout','Example role'],['Stock associate','Inventory tasks','Example role']].map(([role,detail,status])=><li key={role} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-medium text-brand-navy">{role}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className="text-xs text-slate-600">{status}</span></li>)}</ul></section></div><section className="border border-brand-line bg-white p-4"><h3 className="font-semibold text-brand-navy">Recent sample activity</h3><ol className="mt-3 divide-y divide-brand-line">{[['10:42','Stock received','PO-1045 · Colombo Fort'],['10:18','Till shift opened','Ethan Clarke · LON-01'],['09:56','Inventory adjusted','Milk 2L · +24 units'],['09:31','Offer redeemed','FRESH10 · Sample receipt']].map(([time,title,detail])=><li key={time} className="flex gap-4 py-3 text-sm"><time className="w-12 shrink-0 text-slate-500">{time}</time><div><p className="font-medium text-brand-navy">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div></li>)}</ol></section></section>; }

function PageHeading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}) { return <header><p className="eyebrow mb-2">{eyebrow}</p><h2 className="break-words text-2xl font-semibold tracking-tight text-brand-navy">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></header>; }
function SearchBox({value,onChange,label,placeholder}:{value:string;onChange:(value:string)=>void;label:string;placeholder:string}) { return <label className="relative block min-w-0 flex-1"><span className="sr-only">{label}</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input type="search" value={value} onChange={(event)=>onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full min-w-0 border border-brand-line bg-white py-2 pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"/></label>; }
function Bars({values,labels}:{values:number[];labels:string[]}) { return <><div className="flex h-40 items-end gap-2 border-b border-l border-brand-line px-2">{values.map((value,index)=><div key={`${value}-${index}`} title={`${value}% example`} className="flex h-full min-w-0 flex-1 items-end"><div className="w-full bg-blue-100 hover:bg-brand-blue" style={{height:`${value}%`}}/></div>)}</div><div className="flex justify-between pl-3 pt-2 text-[10px] text-slate-500">{labels.map(label=><span key={label}>{label}</span>)}</div></>; }
