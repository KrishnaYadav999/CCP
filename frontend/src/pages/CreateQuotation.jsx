import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, IndianRupee, ClipboardList,
  Copy, Eye, FileText, GripVertical, Loader2, LockKeyhole, PackageOpen, Pencil,
  Plus, Save, Search, Trash2, UserRound, X
} from 'lucide-react';
import DashboardShell from '../components/dashboard/DashboardShell';
import ProfileModal from '../components/dashboard/ProfileModal';
import { apiService, getApiErrorMessage } from '../services/api';

const CircleIndianRupee = IndianRupee;

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 8 }, (_, i) => `${currentYear - 2 + i}-${String(currentYear - 1 + i).slice(-2)}`);
const serviceOptions = ['Consultancy Fee', 'Registration', 'Annual Return', 'Compliance Audit', 'EPR Advisory'];
const eprOptions = ['EPR - Plastic Waste', 'EPR - E-Waste', 'EPR - Battery Waste', 'EPR - Tyre Waste', 'EPR - Used Oil Waste'];
const piboParents = ['PIBO', 'SIMP', 'PWP'];
const piboOptions = [
  { parent: 'PIBO', name: 'Producer' }, { parent: 'PIBO', name: 'Brand Owner' }, { parent: 'PIBO', name: 'Importer' },
  { parent: 'SIMP', name: 'Producer (Small & Micro)' }, { parent: 'SIMP', name: 'Importer of Raw Material' },
  { parent: 'SIMP', name: 'Manufacturer of Raw Material' }, { parent: 'SIMP', name: 'Seller' },
  { parent: 'PWP', name: 'Recycler' }, { parent: 'PWP', name: 'Waste to Energy' },
  { parent: 'PWP', name: 'Waste to Oil' }, { parent: 'PWP', name: 'Cement Co-processing' }
];
const emptyItem = { serviceCategory: '', servicesForYear: '', eprCategory: '', piboCategory: '', unit: 1, basicAmount: '' };

const autoFields = [
  ['referredBy', 'Referred By'], ['salutation', 'Salutation'], ['contactPerson', 'Contact Person'], ['designation', 'Designation'],
  ['mobileNo1', 'Mobile No. 1'], ['mobileNo2', 'Mobile No. 2'], ['company', 'Company Name'], ['addressLine1', 'Address Line 1'],
  ['addressLine2', 'Address Line 2'], ['addressLine3', 'Address Line 3'], ['state', 'State'], ['city', 'City'], ['pinCode', 'Pincode'],
  ['gstNumber', 'GST Number']
];

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const today = new Date().toISOString().slice(0, 10);
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizeCompany = (value) => String(value || '').toLowerCase().replace(/&/g, 'and').replace(/\b(private|pvt|limited|ltd|llp)\b/g, '').replace(/[^a-z0-9]/g, '');
const readAmount = (value) => Number(String(value || '').replace(/[^0-9.-]/g, '')) || 0;
const readUnit = (value) => Math.max(1, Number.parseFloat(String(value || '').replace(/[^0-9.]/g, '')) || 1);

function excelDate(value) {
  if (!value) return '';
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : '';
  }
  const match = String(value).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : String(value).slice(0, 10);
}

export default function CreateQuotation() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState([]);
  const [terms, setTerms] = useState([]);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [customPiboCategories, setCustomPiboCategories] = useState([]);
  const [customServiceCategories, setCustomServiceCategories] = useState([]);
  const bulkInputRef = useRef(null);

  useEffect(() => { loadPage(); }, []);

  useEffect(() => {
    if (!notice && !error) return undefined;
    const timer = window.setTimeout(() => {
      setNotice('');
      setError('');
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

  async function loadPage() {
    setLoading(true);
    try {
      const [me, leadResponse, clientResponse, piboResponse, serviceResponse] = await Promise.all([
        apiService.auth.getMe(), apiService.leads.getList(), apiService.clients.getList(), apiService.quotations.getPiboCategories(), apiService.quotations.getServiceCategories()
      ]);
      setCurrentUser(me.data.user);
      setLeads(leadResponse.data.leads || []);
      setClients(clientResponse.data.clients || []);
      setCustomPiboCategories(piboResponse.data.categories || []);
      setCustomServiceCategories(serviceResponse.data.categories || []);
      serviceResponse.data.categories?.forEach((category) => {
        if (!serviceOptions.includes(category)) serviceOptions.push(category);
      });
    } catch (err) {
      if (err?.response?.status === 401) navigate('/', { replace: true });
      else setError(getApiErrorMessage(err, 'Unable to load quotation details'));
    } finally { setLoading(false); }
  }

  const selectedLead = useMemo(() => leads.find((lead) => String(lead._id || lead.id) === String(leadId)), [leadId, leads]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.unit) || 0) * (Number(item.basicAmount) || 0), 0), [items]);

  function selectLead(value) {
    setLeadId(value);
    setErrors((current) => ({ ...current, leadId: '' }));
    const existing = clients.find((client) => String(client.selectedLead?._id || client.selectedLead?.id || client.selectedLead) === String(value));
    const quotation = existing?.data?.quotation;
    if (quotation) {
      setValidUntil(quotation.validUntil || '');
      setItems((quotation.items || []).map((item) => ({ ...item, id: item.id || id(), editing: false })));
      setTerms((quotation.terms || []).map((text) => ({ id: id(), text: typeof text === 'string' ? text : text.text || '' })));
      setNotice('Existing quotation details loaded for this client.');
    } else {
      setValidUntil(''); setItems([]); setTerms([]); setNotice('');
    }
  }

  function addItem() { setItems((current) => [...current, { ...emptyItem, id: id(), editing: true }]); }
  function updateItem(itemId, field, value) {
    const safe = ['unit', 'basicAmount'].includes(field) && Number(value) < 0 ? 0 : value;
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, [field]: safe } : item));
  }
  function saveItem(itemId) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item.serviceCategory || !item.servicesForYear || Number(item.unit) < 1 || Number(item.basicAmount) < 0 || item.basicAmount === '') {
      setErrors((current) => ({ ...current, [`item-${itemId}`]: 'Complete the required item fields with valid amounts.' })); return;
    }
    setErrors((current) => ({ ...current, [`item-${itemId}`]: '' }));
    setItems((current) => current.map((entry) => entry.id === itemId ? { ...entry, editing: false } : entry));
  }
  function removeItem(itemId) {
    if (window.confirm('Delete this quotation item?')) setItems((current) => current.filter((item) => item.id !== itemId));
  }
  function duplicateItem(item) { setItems((current) => [...current, { ...item, id: id(), editing: true }]); }
  function addTerm() { setTerms((current) => [...current, { id: id(), text: '' }]); }

  async function addPiboCategory(name, parent = 'PIBO') {
    const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
    if (!cleanName) return '';
    try {
      const response = await apiService.quotations.createPiboCategory(cleanName, parent);
      const savedCategory = response.data.category || { name: cleanName, parent };
      setCustomPiboCategories((current) => [...current.filter((item) => !(item.parent === savedCategory.parent && item.name === savedCategory.name)), savedCategory]);
      setNotice(`${savedCategory.parent} category “${savedCategory.name}” saved for future quotations.`);
      return savedCategory;
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to save PIBO category'));
      return '';
    }
  }

  async function addServiceCategory(name) {
    const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
    if (!cleanName) return '';
    try {
      const response = await apiService.quotations.createServiceCategory(cleanName);
      const savedName = response.data.category || cleanName;
      setCustomServiceCategories((current) => [...new Set([...current, savedName])].sort((a, b) => a.localeCompare(b)));
      setNotice(`Service category “${savedName}” saved for future quotations.`);
      return savedName;
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to save service category'));
      return '';
    }
  }

  function validate() {
    const next = {};
    if (!leadId) next.leadId = 'Please select a lead.';
    if (!validUntil) next.validUntil = 'Quotation validity date is required.';
    if (!items.length) next.items = 'Add at least one quotation item.';
    if (items.some((item) => item.editing)) next.items = 'Save all quotation items before submitting.';
    terms.forEach((term) => { if (!term.text.trim()) next[`term-${term.id}`] = 'Term cannot be empty.'; });
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function importBulkQuotations(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBulkImporting(true); setError(''); setNotice('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      if (!rows.length) throw new Error('Excel file has no quotation rows.');

      const grouped = new Map();
      rows.forEach((row, rowIndex) => {
        const company = String(row['Company Name'] || '').trim();
        const quotationNumber = String(row['Quotation Number'] || '').trim();
        if (!company || !quotationNumber) return;
        const key = `${normalizeCompany(company)}::${quotationNumber.toLowerCase()}`;
        if (!grouped.has(key)) grouped.set(key, { company, quotationNumber, source: row, items: [], rowIndex: rowIndex + 2 });
        const group = grouped.get(key);
        group.items.push({
          id: id(),
          serviceCategory: String(row['Item Service Category'] || row['Service Category'] || '').trim(),
          servicesForYear: String(row['Services for the Year'] || '').trim(),
          eprCategory: String(row['Item EPR Category'] || row['EPR Category'] || '').trim(),
          piboCategory: String(row['Item PIBO Category'] || row['PIBO Category'] || '').trim(),
          unit: readUnit(row['Item Unit'] || row['Quantity/Unit']),
          unitLabel: String(row['Item Unit'] || row['Quantity/Unit'] || '').trim(),
          basicAmount: readAmount(row['Item Basic Amount (INR)'] || row['Basic Amount (INR)'])
        });
      });

      const workingLeads = [...leads];
      const createdLeads = [];
      const leadCreationFailures = [];
      for (const group of grouped.values()) {
        const companyKey = normalizeCompany(group.company);
        if (workingLeads.some((entry) => normalizeCompany(entry.company) === companyKey)) continue;
        const sourceLeadRow = String(group.source['Lead Row'] || '').trim();
        if (!sourceLeadRow) continue;
        try {
          const source = group.source;
          const response = await apiService.leads.create({
            sourceLeadId: `QUOTATION-XLSX-${sourceLeadRow}`,
            company: group.company,
            salutation: String(source.Salutation || '').trim(),
            contactPerson: String(source['Contact Person'] || '').trim(),
            designation: String(source.Designation || '').trim(),
            addressLine1: String(source['Address Line 1'] || '').trim(),
            addressLine2: String(source['Address Line 2'] || '').trim(),
            addressLine3: String(source['Address Line 3'] || '').trim(),
            city: String(source.City || '').trim(),
            state: String(source.State || '').trim(),
            pinCode: String(source.Pincode || '').trim(),
            referredBy: String(source['Referred By'] || '').trim(),
            source: 'Quotation Excel Import',
            workflowStatus: 'draft'
          });
          const savedLead = response.data.lead;
          workingLeads.push(savedLead);
          createdLeads.push(savedLead);
        } catch (leadError) {
          leadCreationFailures.push(`${group.company} (row ${group.rowIndex}): ${getApiErrorMessage(leadError, 'Unable to create CCP lead')}`);
        }
      }
      if (createdLeads.length) setLeads(workingLeads);

      const byLead = new Map();
      const unmatched = [];
      grouped.forEach((group) => {
        const companyKey = normalizeCompany(group.company);
        const lead = workingLeads.find((entry) => normalizeCompany(entry.company) === companyKey);
        if (!lead) { unmatched.push(`${group.company} (row ${group.rowIndex})`); return; }
        const leadKey = String(lead._id || lead.id);
        const source = group.source;
        const termsText = String(source['Terms and Conditions'] || '');
        const quotation = {
          quotationNumber: group.quotationNumber,
          quotationDate: excelDate(source['Quotation Date']),
          validUntil: excelDate(source['Quotation Valid Until']),
          items: group.items,
          terms: termsText.split(/\r?\n/).map((term) => term.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean),
          subtotal: group.items.reduce((sum, item) => sum + item.unit * item.basicAmount, 0)
        };
        quotation.grandTotal = quotation.subtotal;
        if (!byLead.has(leadKey)) byLead.set(leadKey, { lead, quotations: [] });
        byLead.get(leadKey).quotations.push(quotation);
      });

      const quotationRecords = [...byLead.values()].flatMap(({ lead, quotations }) => quotations.map((quotation) => ({
        ...quotation,
        selectedLead: lead._id || lead.id,
        companyName: lead.company || '',
        status: 'submitted',
        source: 'bulk'
      })));
      if (!quotationRecords.length) throw new Error(`No company names matched existing leads.${unmatched.length ? ` First unmatched: ${unmatched[0]}` : ''}`);
      const quotationResponse = await apiService.quotations.bulkUpsert(quotationRecords);
      let imported = Number(quotationResponse.data.imported || 0);
      const failed = Number(quotationResponse.data.failed || 0);
      for (const { lead, quotations } of byLead.values()) {
        const leadKey = String(lead._id || lead.id);
        const existing = clients.find((client) => String(client.selectedLead?._id || client.selectedLead?.id || client.selectedLead) === leadKey);
        const data = existing?.data || {};
        const previous = Array.isArray(data.quotations) ? data.quotations : (data.quotation ? [data.quotation] : []);
        const merged = [...previous];
        quotations.forEach((quotation) => {
          const at = merged.findIndex((entry) => entry.quotationNumber === quotation.quotationNumber);
          if (at >= 0) merged[at] = quotation; else merged.push(quotation);
        });
        const latest = quotations[quotations.length - 1];
        const payload = {
          selectedLead: leadKey,
          adminControls: existing?.adminControls || {},
          data: {
            ...data,
            basic: { ...(data.basic || {}), clientLegalName: data.basic?.clientLegalName || lead.company || '' },
            quotation: latest,
            quotations: merged
          },
          workflowStatus: 'submitted'
        };
        if (existing) await apiService.clients.update(existing._id || existing.id, payload);
        else await apiService.clients.create(payload);
      }
      if (!imported) throw new Error(`No company names matched existing leads.${unmatched.length ? ` First unmatched: ${unmatched[0]}` : ''}`);
      setNotice([
        `${imported} imported`, `${failed} failed`, `${unmatched.length} unmatched`,
        `${createdLeads.length} missing CCP lead${createdLeads.length === 1 ? '' : 's'} created`,
        unmatched.length ? `Unmatched: ${unmatched.slice(0, 3).join(', ')}` : '',
        leadCreationFailures.length ? `Lead creation failed: ${leadCreationFailures.slice(0, 2).join(', ')}` : ''
      ].filter(Boolean).join('. '));
      await loadPage();
    } catch (err) { setError(getApiErrorMessage(err, err.message || 'Unable to import quotation Excel')); }
    finally { setBulkImporting(false); }
  }

  async function submitQuotation() {
    if (!validate()) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const existing = clients.find((client) => String(client.selectedLead?._id || client.selectedLead?.id || client.selectedLead) === String(leadId));
      const existingData = existing?.data || {};
      const payload = {
        selectedLead: leadId,
        adminControls: existing?.adminControls || {},
        data: {
          ...existingData,
          basic: { ...(existingData.basic || {}), clientLegalName: existingData.basic?.clientLegalName || selectedLead?.company || '' },
          quotation: {
            ...(existingData.quotation || {}), validUntil,
            items: items.map(({ editing, ...item }) => item),
            terms: terms.map((term) => term.text.trim()), subtotal, grandTotal: subtotal
          }
        },
        workflowStatus: 'submitted'
      };
      if (existing) await apiService.clients.update(existing._id || existing.id, payload);
      else await apiService.clients.create(payload);
      setNotice('Quotation saved successfully.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await loadPage();
    } catch (err) { setError(getApiErrorMessage(err, 'Unable to save quotation')); }
    finally { setSaving(false); }
  }

  function logout() {
    ['token', 'user', 'login_email'].forEach((key) => localStorage.removeItem(key));
    navigate('/', { replace: true });
  }

  return (
    <DashboardShell currentUser={currentUser} onOpenProfile={() => setProfileOpen(true)} onLogout={logout}>
      {profileOpen && <ProfileModal currentUser={currentUser} onClose={() => setProfileOpen(false)} onUpdated={setCurrentUser} />}
      <div className="min-h-[calc(100vh-76px)] bg-[#f1f8f7] pb-28">
        {(notice || error) && (
          <div className={`fixed right-4 top-24 z-[70] flex w-[min(440px,calc(100vw-2rem))] items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl shadow-slate-900/20 animate-toast-in ${error ? 'border-red-200' : 'border-teal-200'}`} role="status" aria-live="polite">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${error ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}`}>{error ? <X className="h-5 w-5" /> : <Check className="h-5 w-5" />}</span>
            <div className="min-w-0 flex-1"><p className={`font-black ${error ? 'text-red-700' : 'text-teal-800'}`}>{error ? 'Upload failed' : 'Upload successful'}</p><p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-600">{error || notice}</p></div>
            <button type="button" onClick={() => { setNotice(''); setError(''); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close notification"><X className="h-4 w-4" /></button>
          </div>
        )}
        <header className="sticky top-[76px] z-10 border-b border-slate-200/80 bg-[#f1f8f7]/95 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => navigate('/sales/client-master')} className="btn-lift grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-teal-100 bg-white text-orange-600 shadow-sm" aria-label="Back to client master"><ArrowLeft className="h-5 w-5" /></button>
              <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[.23em] text-teal-700">Quotation Desk</p><h1 className="truncate text-2xl font-black text-slate-950 sm:text-3xl">Create Quotation</h1><p className="hidden text-sm font-semibold text-slate-500 sm:block">Create and configure a quotation for the selected client.</p></div>
            </div>
            <div className="shrink-0"><input ref={bulkInputRef} type="file" accept=".xlsx,.xls" onChange={importBulkQuotations} className="hidden" /><button onClick={() => bulkInputRef.current?.click()} disabled={bulkImporting || loading} className="btn-lift inline-flex h-11 items-center gap-2 rounded-xl bg-teal-700 px-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 disabled:opacity-60 sm:px-5">{bulkImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}<span className="hidden sm:inline">Bulk Quotation Upload</span><span className="sm:hidden">Bulk Upload</span></button></div>
          </div>
        </header>

        <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <Section icon={UserRound} title="Lead & Client Details" subtitle="Select a lead to automatically populate the available client information.">
            <LeadSelect leads={leads} loading={loading} value={leadId} onChange={selectLead} error={errors.leadId} />
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {autoFields.map(([key, label]) => <ReadOnlyField key={key} label={label} value={selectedLead?.[key]} />)}
            </div>
          </Section>

          <Section icon={CalendarDays} title="Quotation Settings" subtitle="Configure quotation validity and commercial details.">
            <div className="grid items-end gap-4 md:grid-cols-2">
              <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">Quotation Valid Until <span className="text-red-500">*</span></span><span className="relative block"><input type="date" min={today} value={validUntil} onChange={(e) => { setValidUntil(e.target.value); setErrors((c) => ({ ...c, validUntil: '' })); }} className={`form-input pr-11 ${errors.validUntil ? '!border-red-400 !ring-red-100' : ''}`} /><CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-700" /></span>{errors.validUntil && <ErrorText>{errors.validUntil}</ErrorText>}</label>
              {selectedLead && <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-teal-700">Selected client</p><p className="mt-1 font-black text-slate-900">{selectedLead.company || selectedLead.contactPerson || 'Unnamed lead'}</p><p className="text-xs font-bold text-slate-500">{selectedLead.leadCode || 'Lead code unavailable'}</p></div>}
            </div>
          </Section>

          <Section icon={ClipboardList} title="Quotation Items" subtitle="Add services and commercial details to this quotation" action={<><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">{items.length} {items.length === 1 ? 'item' : 'items'}</span><button onClick={addItem} className="btn-lift inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-black text-white"><Plus className="h-4 w-4" />Add Item</button></>}>
            {!items.length ? <EmptyItems onAdd={addItem} /> : <ItemsEditor items={items} errors={errors} updateItem={updateItem} saveItem={saveItem} setItems={setItems} duplicateItem={duplicateItem} removeItem={removeItem} serviceCategories={[...new Set([...serviceOptions, ...customServiceCategories])]} addServiceCategory={addServiceCategory} piboCategories={[...new Set([...piboOptions, ...customPiboCategories])]} addPiboCategory={addPiboCategory} />}
            {errors.items && <ErrorText>{errors.items}</ErrorText>}
            <div className="ml-auto mt-5 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex justify-between px-4 py-3 text-sm font-bold text-slate-600"><span>Subtotal</span><span>{inr.format(subtotal)}</span></div>
              <div className="flex justify-between border-t border-slate-200 bg-teal-50 px-4 py-4 font-black text-slate-950"><span>Grand Total</span><span className="text-teal-800">{inr.format(subtotal)}</span></div>
            </div>
          </Section>

          <Section icon={FileText} title="Terms & Conditions" subtitle="Add the commercial or service conditions applicable to this quotation.">
            {!terms.length ? <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center"><div><FileText className="mx-auto h-9 w-9 text-teal-600" /><p className="mt-3 font-black text-slate-900">No terms added</p><p className="mt-1 text-sm font-semibold text-slate-500">Add conditions that the client should review with this quotation.</p><button onClick={addTerm} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-black text-white"><Plus className="h-4 w-4" />Add First Term</button></div></div> : <div className="space-y-3">{terms.map((term, index) => <div key={term.id}><div className="flex items-start gap-2"><span className="mt-3 inline-flex items-center gap-1 text-sm font-black text-slate-500"><GripVertical className="h-4 w-4" />{index + 1}.</span><textarea rows="2" value={term.text} onChange={(e) => setTerms((current) => current.map((entry) => entry.id === term.id ? { ...entry, text: e.target.value } : entry))} className={`form-input min-h-[72px] py-3 ${errors[`term-${term.id}`] ? '!border-red-400' : ''}`} placeholder="Enter term or condition" /><button onClick={() => setTerms((current) => current.filter((entry) => entry.id !== term.id))} className="mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50" title="Remove term"><Trash2 className="h-4 w-4" /></button></div>{errors[`term-${term.id}`] && <ErrorText>{errors[`term-${term.id}`]}</ErrorText>}</div>)}</div>}
            <button onClick={addTerm} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 font-black text-teal-800 transition hover:bg-teal-50"><Plus className="h-4 w-4" />Add Another Term</button>
          </Section>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,.08)] backdrop-blur-xl lg:left-[296px]">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3"><div className="hidden sm:block"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Quotation total</p><p className="text-xl font-black text-slate-950">{inr.format(subtotal)}</p></div><div className="ml-auto flex w-full gap-3 sm:w-auto"><button onClick={() => navigate('/sales/client-master')} className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-5 font-black text-slate-700 sm:flex-none">Cancel</button><button onClick={submitQuotation} disabled={saving} className="btn-lift inline-flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 font-black text-white shadow-lg shadow-orange-600/20 disabled:opacity-60 sm:flex-none">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}Save Quotation</button></div></div>
        </div>
      </div>
    </DashboardShell>
  );
}

function Section({ icon: Icon, title, subtitle, action, children }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5"><div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mt-0.5 text-sm font-semibold text-slate-500">{subtitle}</p></div></div>{action && <div className="flex items-center gap-2">{action}</div>}</div><div className="p-5">{children}</div></section>;
}

function LeadSelect({ leads, loading, value, onChange, error }) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const root = useRef(null);
  useEffect(() => { const close = (e) => { if (!root.current?.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  const selected = leads.find((lead) => String(lead._id || lead.id) === String(value));
  const filtered = leads.filter((lead) => `${lead.contactPerson || ''} ${lead.company || ''} ${lead.leadCode || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div ref={root} className="relative"><label className="mb-2 block text-sm font-black text-slate-700">Select Lead <span className="text-red-500">*</span></label><button type="button" onClick={() => !loading && setOpen((v) => !v)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border bg-white px-4 text-left transition focus:outline-none focus:ring-4 focus:ring-teal-100 ${error ? 'border-red-400' : 'border-slate-200 hover:border-teal-300'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}</span><span className="min-w-0 flex-1">{loading ? <span className="font-bold text-slate-500">Fetching leads...</span> : selected ? <><span className="block truncate font-black text-slate-900">{selected.contactPerson || selected.company || 'Unnamed lead'}</span><span className="block truncate text-xs font-bold text-slate-500">{selected.company || 'Company unavailable'} · {selected.leadCode || 'No lead code'}</span></> : <><span className="block text-[10px] font-black uppercase tracking-wider text-teal-700">Choose a lead</span><span className="font-bold text-slate-700">Search and select a lead</span></>}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} /></button>{error && <ErrorText>{error}</ErrorText>}{open && <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"><div className="border-b border-slate-100 p-3"><span className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 font-bold outline-none focus:border-teal-400" placeholder="Search lead, company or code..." /></span></div><div className="max-h-64 overflow-y-auto p-2">{!filtered.length ? <div className="p-8 text-center"><PackageOpen className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-black text-slate-700">No leads available</p><p className="text-sm font-semibold text-slate-400">Try a different search.</p></div> : filtered.map((lead) => <button key={lead._id || lead.id} type="button" onClick={() => { onChange(lead._id || lead.id); setOpen(false); setQuery(''); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-teal-50"><FileText className="h-5 w-5 shrink-0 text-teal-600" /><span className="min-w-0"><span className="block truncate font-black text-slate-900">{lead.contactPerson || lead.company || 'Unnamed lead'}</span><span className="block truncate text-xs font-bold text-slate-500">{lead.company || 'Company unavailable'} · {lead.leadCode || 'No lead code'}</span></span>{String(value) === String(lead._id || lead.id) && <Check className="ml-auto h-4 w-4 text-teal-600" />}</button>)}</div></div>}</div>;
}

function ReadOnlyField({ label, value }) { return <label className="min-w-0"><span className="mb-2 flex items-center justify-between gap-2 text-xs font-black text-slate-600"><span>{label}</span><span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9px] uppercase tracking-wide text-teal-700 ring-1 ring-teal-100"><LockKeyhole className="h-2.5 w-2.5" />Auto-fetched</span></span><div className="flex min-h-12 items-center rounded-xl border border-teal-100 bg-slate-50 px-4 font-bold text-slate-700">{value || <span className="text-slate-400">Not available</span>}</div></label>; }
function ErrorText({ children }) { return <p className="mt-1.5 text-xs font-bold text-red-600">{children}</p>; }
function EmptyItems({ onAdd }) { return <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700"><PackageOpen className="h-7 w-7" /></span><p className="mt-4 font-black text-slate-900">No quotation items added</p><p className="mt-1 text-sm font-semibold text-slate-500">Add services and pricing details to build this quotation.</p><button onClick={onAdd} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-black text-white"><Plus className="h-4 w-4" />Add First Item</button></div></div>; }

function ItemsEditor({ items, errors, updateItem, saveItem, setItems, duplicateItem, removeItem, serviceCategories, addServiceCategory, piboCategories, addPiboCategory }) {
  return <><div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block"><table className="w-full min-w-[1180px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr>{['Sr.No', 'Service Category', 'Services for the Year', 'EPR Category', 'PIBO Category', 'Unit', 'Basic Amount (INR)', 'Line Total', 'Actions'].map((h) => <th key={h} className={`px-3 py-3 ${h === 'Actions' ? 'sticky right-0 bg-slate-50' : ''}`}>{h}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-4 text-center font-black text-slate-500">{index + 1}</td><ItemCells item={item} updateItem={updateItem} piboCategories={piboCategories} addPiboCategory={addPiboCategory} /><td className="px-3 py-4 font-black text-slate-900">{inr.format((Number(item.unit) || 0) * (Number(item.basicAmount) || 0))}</td><td className="sticky right-0 bg-white px-3 py-4"><Actions item={item} saveItem={saveItem} setItems={setItems} duplicateItem={duplicateItem} removeItem={removeItem} /></td></tr>)}</tbody></table></div><div className="space-y-4 lg:hidden">{items.map((item, index) => <div key={item.id} className="rounded-xl border border-slate-200 p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">Item {index + 1}</span><span className="font-black text-slate-900">{inr.format((Number(item.unit) || 0) * (Number(item.basicAmount) || 0))}</span></div><div className="grid gap-3 sm:grid-cols-2"><MobileField label="Service Category"><SelectInput disabled={!item.editing} value={item.serviceCategory} options={serviceOptions} onChange={(v) => updateItem(item.id, 'serviceCategory', v)} /></MobileField><MobileField label="Services for the Year"><SelectInput disabled={!item.editing} value={item.servicesForYear} options={yearOptions} onChange={(v) => updateItem(item.id, 'servicesForYear', v)} /></MobileField><MobileField label="EPR Category"><SelectInput disabled={!item.editing} value={item.eprCategory} options={eprOptions} onChange={(v) => updateItem(item.id, 'eprCategory', v)} /></MobileField><MobileField label="PIBO Category"><SelectInput disabled={!item.editing} value={item.piboCategory} options={piboCategories} onChange={(v) => updateItem(item.id, 'piboCategory', v)} onAdd={addPiboCategory} /></MobileField><MobileField label="Unit"><input disabled={!item.editing} type="number" min="1" value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className="form-input !min-h-11" /></MobileField><MobileField label="Basic Amount (INR)"><div className="relative"><CircleIndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input disabled={!item.editing} type="number" min="0" value={item.basicAmount} onChange={(e) => updateItem(item.id, 'basicAmount', e.target.value)} className="form-input !min-h-11 !pl-10" /></div></MobileField></div><div className="mt-4 flex justify-end border-t border-slate-100 pt-3"><Actions item={item} saveItem={saveItem} setItems={setItems} duplicateItem={duplicateItem} removeItem={removeItem} /></div>{errors[`item-${item.id}`] && <ErrorText>{errors[`item-${item.id}`]}</ErrorText>}</div>)}</div></>;
}
function ItemCells({ item, updateItem, piboCategories, addPiboCategory }) { return <><td className="px-2 py-3"><SelectInput disabled={!item.editing} value={item.serviceCategory} options={serviceOptions} onChange={(v) => updateItem(item.id, 'serviceCategory', v)} /></td><td className="px-2 py-3"><SelectInput disabled={!item.editing} value={item.servicesForYear} options={yearOptions} onChange={(v) => updateItem(item.id, 'servicesForYear', v)} /></td><td className="px-2 py-3"><SelectInput disabled={!item.editing} value={item.eprCategory} options={eprOptions} onChange={(v) => updateItem(item.id, 'eprCategory', v)} /></td><td className="px-2 py-3"><SelectInput disabled={!item.editing} value={item.piboCategory} options={piboCategories} onChange={(v) => updateItem(item.id, 'piboCategory', v)} onAdd={addPiboCategory} /></td><td className="px-2 py-3"><input disabled={!item.editing} type="number" min="1" value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className="h-11 w-20 rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-teal-400 disabled:bg-slate-50" /></td><td className="px-2 py-3"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-500">₹</span><input disabled={!item.editing} type="number" min="0" value={item.basicAmount} onChange={(e) => updateItem(item.id, 'basicAmount', e.target.value)} className="h-11 w-36 rounded-lg border border-slate-200 pl-8 pr-3 font-bold outline-none focus:border-teal-400 disabled:bg-slate-50" /></div></td></>; }
function SelectInput({ value, options, onChange, disabled, onAdd }) {
  if (onAdd) {
    const legacyChild = typeof value === 'string' ? value : '';
    const matchedLegacy = options.find((option) => option.name === legacyChild);
    const parent = value?.parent || matchedLegacy?.parent || '';
    const child = value?.child || legacyChild;
    const children = options.filter((option) => option.parent === parent);
    async function handleChildChange(event) {
      if (event.target.value !== '__add_new__') return onChange({ parent, child: event.target.value });
      const name = window.prompt(`Enter a new child category under ${parent}:`);
      if (!name) return;
      const saved = await onAdd(name, parent);
      if (saved) onChange({ parent: saved.parent, child: saved.name });
    }
    return <div className="grid min-w-44 gap-2">
      <select disabled={disabled} value={parent} onChange={(event) => onChange({ parent: event.target.value, child: '' })} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-teal-400 disabled:bg-slate-50">
        <option value="">Select PIBO / SIMP / PWP</option>
        {piboParents.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {parent && <select disabled={disabled} value={child} onChange={handleChildChange} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-teal-400 disabled:bg-slate-50">
        <option value="">Select {parent} category</option>
        {children.map((option) => <option key={`${option.parent}-${option.name}`} value={option.name}>{option.name}</option>)}
        <option value="__add_new__">＋ Add New {parent} Category</option>
      </select>}
    </div>;
  }
  const isServiceCategory = options === serviceOptions;
  const addCategory = onAdd || (isServiceCategory ? async (name) => {
    try {
      const response = await apiService.quotations.createServiceCategory(name);
      const savedName = response.data.category || String(name).trim();
      if (!serviceOptions.includes(savedName)) serviceOptions.push(savedName);
      return savedName;
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Unable to save service category'));
      return '';
    }
  } : null);
  const categoryLabel = isServiceCategory ? 'Service Category' : 'PIBO Category';
  async function handleChange(event) {
    if (event.target.value !== '__add_new__') return onChange(event.target.value);
    const name = window.prompt(`Enter new ${categoryLabel} name:`);
    if (!name) return;
    const savedName = await addCategory(name);
    if (savedName) onChange(savedName);
  }
  const available = value && !options.includes(value) ? [value, ...options] : options;
  return <select disabled={disabled} value={value} onChange={handleChange} className="h-11 w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-teal-400 disabled:bg-slate-50"><option value="">Select option</option>{available.map((option) => <option key={option}>{option}</option>)}{addCategory && <option value="__add_new__">＋ Add New {categoryLabel}</option>}</select>;
}
function Actions({ item, saveItem, setItems, duplicateItem, removeItem }) { return <div className="flex items-center gap-1">{item.editing ? <button onClick={() => saveItem(item.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-xs font-black text-white" title="Save row"><Save className="h-4 w-4" />Save</button> : <button onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, editing: true } : entry))} className="grid h-9 w-9 place-items-center rounded-lg text-teal-700 hover:bg-teal-50" title="Edit row"><Pencil className="h-4 w-4" /></button>}<button onClick={() => duplicateItem(item)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Duplicate row"><Copy className="h-4 w-4" /></button><button onClick={() => removeItem(item.id)} className="grid h-9 w-9 place-items-center rounded-lg text-red-500 hover:bg-red-50" title="Delete row"><Trash2 className="h-4 w-4" /></button></div>; }
function MobileField({ label, children }) { return <label><span className="mb-1.5 block text-xs font-black text-slate-500">{label}</span>{children}</label>; }
