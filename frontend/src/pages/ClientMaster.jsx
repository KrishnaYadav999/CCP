import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle2, ChevronDown, Download, Eye, FileCheck2, FileText, FolderCheck, MapPin, Pencil, Plus, RefreshCw, Search, ShieldCheck, Upload, UserRound, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import DashboardShell from '../components/dashboard/DashboardShell';
import ProfileModal from '../components/dashboard/ProfileModal';
import { brand } from '../constants/brand';
import { adminRoles } from '../constants/dashboard';
import { apiService, getApiErrorMessage } from '../services/api';

const tabs = [
  { id: 'basic', label: 'Client Basic Info', icon: Building2 },
  { id: 'address', label: 'Address Details', icon: MapPin },
  { id: 'compliance', label: 'Compliance & MSME', icon: FileCheck2 },
  { id: 'cte', label: 'CTE / CTO / CCA', icon: FolderCheck },
  { id: 'cpcb', label: 'CPCB Details', icon: ShieldCheck },
  { id: 'validation', label: 'Validation Documents', icon: FileText },
  { id: 'contacts', label: 'OTP & People', icon: UserRound }
];

const financialYears = Array.from({ length: 12 }, (_, index) => {
  const startYear = new Date().getFullYear() - 8 + index;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
});

const selectOptions = {
  approvalStatus: ['PENDING', 'APPROVED', 'REJECTED'],
  visibilityStatus: ['LIVE', 'SUSPENDED', 'DISCONTINUED'],
  piboCategory: ['Producer', 'Importer', 'Brand Owner', 'Recycler', 'PWP', 'Refurbisher'],
  eprCategory: ['EPR - Plastic Waste', 'EPR - E-Waste', 'EPR - Battery Waste', 'EPR - Tyre Waste', 'EPR - Used Oil Waste'],
  years: financialYears,
  states: ['Gujarat', 'Maharashtra', 'Karnataka', 'Delhi', 'Rajasthan', 'Uttar Pradesh', 'Haryana', 'Tamil Nadu', 'Telangana'],
  cities: ['Ahmedabad', 'Surat', 'Mumbai', 'Pune', 'Bengaluru', 'Delhi', 'Jaipur', 'Noida', 'Gurugram', 'Chennai', 'Hyderabad'],
  cpcbStatus: ['Not Started', 'Applied', 'Under Review', 'Approved', 'Rejected'],
  msmeStatus: ['Micro', 'Small', 'Medium', 'Not Applicable'],
  msmeActivity: ['Manufacturing', 'Service', 'Trading'],
  ctoCcaType: ['CTO', 'CCA']
};

const complianceRows = [
  ['gst', 'GST Number', 'GST Certificate Date', 'GST Certificate'],
  ['cin', 'CIN', 'CIN Document Date', 'CIN Document'],
  ['pan', 'PAN', 'PAN Document Date', 'PAN Document'],
  ['factoryLicense', 'Factory License No', 'Factory License Document Date', 'Factory License Document'],
  ['eprCertificate', 'EPR Certificate No', 'EPR Certificate File Date', 'EPR Certificate File'],
  ['iec', 'IEC Certificate', 'IEC Certificate Date', 'IEC Certificate File'],
  ['dicDcssi', 'DIC/DCSSI Certificate No', 'DIC/DCSSI Certificate Date', 'DIC/DCSSI Certificate File']
];

const emptyClient = {
  selectedLead: '',
  adminControls: { approvalStatus: 'PENDING', visibilityStatus: 'LIVE', assignedTo: '' },
  basic: { clientLegalName: '', tradeName: '', piboCategory: '', eprCategory: '', onboardingYear: '', firstAnnualReturnYear: '' },
  registeredAddress: {},
  communicationAddress: {},
  compliance: {},
  msmeRows: [],
  cte: { numberOfPlantsLocations: '', plantWiseDetails: [] },
  cpcb: {},
  validation: {},
  otp: {},
  authorised: {},
  coordinating: {}
};

export default function ClientMaster() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [client, setClient] = useState(emptyClient);
  const [editingClientId, setEditingClientId] = useState('');
  const [viewClient, setViewClient] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [viewMode, setViewMode] = useState('form');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelRows, setExcelRows] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const canSeeAdminControls = adminRoles.includes(currentUser?.role);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const isFirstStep = activeIndex <= 0;
  const isLastStep = activeIndex === tabs.length - 1;
  const leadOptions = useMemo(() => leads.map((lead) => ({
    value: lead._id || lead.id,
    label: `${lead.leadCode || 'ATPL-LEAD-0001'} - ${lead.company || 'Untitled lead'} - ${lead.piboCategory || lead.status || 'Draft'}`
  })), [leads]);
  const staffOptions = useMemo(() => staff.map((user) => ({ value: user._id || user.id, label: `${user.name || user.email} (${user.role})` })), [staff]);

  useEffect(() => {
    loadPage();
  }, [location.search]);

  useEffect(() => {
    if (!notice && !error) return undefined;
    const timer = window.setTimeout(() => {
      setNotice('');
      setError('');
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  async function loadPage() {
    setLoading(true);
    try {
      const meResponse = await apiService.auth.getMe();
      setCurrentUser(meResponse.data.user);
      const [leadsResponse, clientsResponse] = await Promise.all([
        apiService.leads.getList(),
        apiService.clients.getList()
      ]);
      const loadedLeads = leadsResponse.data.leads || [];
      const loadedClients = clientsResponse.data.clients || [];
      setLeads(loadedLeads);
      setClients(loadedClients);
      openClientFromQuery(loadedClients);
      try {
        const usersResponse = await apiService.auth.getUsers();
        setStaff(usersResponse.data.users || []);
      } catch {
        setStaff([meResponse.data.user]);
      }
    } catch {
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  function normalizeLookup(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeIdentityLookup(value) {
    return normalizeLookup(readIdentityValue(value));
  }

  function readClientFormData(item) {
    const data = item?.data || {};
    return {
      ...emptyClient,
      ...data,
      basic: {
        ...emptyClient.basic,
        ...(data.basic || {}),
        onboardingYear: data.basic?.onboardingYear || item?.onboardingYear || '',
        firstAnnualReturnYear: data.basic?.firstAnnualReturnYear || item?.firstAnnualReturnYear || ''
      }
    };
  }

  function findClientByLead(value, selectedLead) {
    const leadId = String(value || '').trim();
    const leadCode = String(selectedLead?.leadCode || '').trim().toLowerCase();
    return clients.find((item) => {
      const itemLeadId = String(item.selectedLead?._id || item.selectedLead?.id || item.selectedLead || '').trim();
      const itemLeadCode = String(item.selectedLead?.leadCode || item.data?.importMeta?.leadNumber || '').trim().toLowerCase();
      return (leadId && itemLeadId === leadId) || (leadCode && itemLeadCode === leadCode);
    });
  }

  function hydrateClientForEdit(item, message) {
    const formData = readClientFormData(item);
    console.debug('[ClientMaster] hydrate client', {
      clientId: item?._id || item?.id,
      selectedLead: item?.selectedLead?._id || item?.selectedLead?.id || item?.selectedLead || '',
      onboardingYear: formData.basic.onboardingYear,
      firstAnnualReturnYear: formData.basic.firstAnnualReturnYear
    });
    setClient({
      ...formData,
      selectedLead: item.selectedLead?._id || item.selectedLead?.id || item.selectedLead || '',
      adminControls: {
        ...emptyClient.adminControls,
        ...(item.adminControls || {}),
        assignedTo: item.adminControls?.assignedTo?._id || item.adminControls?.assignedTo?.id || item.adminControls?.assignedTo || ''
      }
    });
    setEditingClientId(item._id || item.id);
    setActiveTab('basic');
    setViewMode('form');
    if (message) showToast(message);
  }

  function findClientForEdit(clientList, params) {
    const editId = normalizeLookup(params.get('edit'));
    const uniqueId = normalizeIdentityLookup(params.get('uniqueId'));
    const name = normalizeLookup(params.get('name'));

    if (editId) {
      const match = clientList.find((item) => {
        const data = readClientData(item);
        return [
          item._id,
          item.id,
          data.importMeta?.clientId,
          data.importMeta?.crmClientId,
          data.importMeta?.sourceClientId
        ].some((value) => normalizeLookup(value) === editId);
      });
      if (match) return match;
    }

    if (uniqueId) {
      const match = clientList.find((item) => {
        const data = readClientData(item);
        return [
          data.importMeta?.uniqueId,
          data.importMeta?.leadNumber,
          item.selectedLead?.leadCode
        ].some((value) => normalizeIdentityLookup(value) === uniqueId);
      });
      if (match) return match;
    }

    if (name) {
      return clientList.find((item) => {
        const data = readClientData(item);
        return [
          data.basic?.clientLegalName,
          data.basic?.tradeName,
          item.selectedLead?.company
        ].some((value) => normalizeLookup(value) === name);
      });
    }

    return null;
  }

  function openClientFromQuery(clientList) {
    const params = new URLSearchParams(location.search);
    const hasEditRequest = ['edit', 'uniqueId', 'name'].some((key) => params.get(key));
    if (!hasEditRequest) return;

    const matchedClient = findClientForEdit(clientList, params);
    if (!matchedClient) {
      setEditingClientId('');
      setViewMode('form');
      setActiveTab('basic');
      setError('Client not found for edit');
      return;
    }

    hydrateClientForEdit(matchedClient, 'Client loaded for edit.');
  }

  function setValue(section, field, value) {
    setClient((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  }

  function setRoot(field, value) {
    setClient((current) => ({ ...current, [field]: value }));
  }

  function handleLeadSelect(value) {
    const selectedLead = leads.find((leadItem) => String(leadItem._id || leadItem.id) === String(value));
    if (!selectedLead) {
      setRoot('selectedLead', value);
      return;
    }

    const existingClient = findClientByLead(value, selectedLead);
    if (existingClient) {
      const formData = readClientFormData(existingClient);
      console.debug('[ClientMaster] existing client loaded for lead', {
        clientId: existingClient._id || existingClient.id,
        leadId: value,
        leadCode: selectedLead.leadCode,
        onboardingYear: formData.basic.onboardingYear,
        firstAnnualReturnYear: formData.basic.firstAnnualReturnYear
      });
      setClient((current) => ({
        ...formData,
        selectedLead: value,
        basic: {
          ...formData.basic
        },
        adminControls: {
          ...emptyClient.adminControls,
          ...(existingClient.adminControls || {}),
          assignedTo: existingClient.adminControls?.assignedTo?._id || existingClient.adminControls?.assignedTo?.id || existingClient.adminControls?.assignedTo || ''
        }
      }));
      setEditingClientId(existingClient._id || existingClient.id);
      showToast('Existing client loaded for this lead.');
      return;
    }

    setClient((current) => ({
      ...current,
      selectedLead: value,
      basic: {
        ...current.basic,
        clientLegalName: current.basic.clientLegalName || selectedLead.company || '',
        tradeName: current.basic.tradeName || selectedLead.company || '',
        piboCategory: current.basic.piboCategory || selectedLead.piboCategory || '',
        eprCategory: current.basic.eprCategory || selectedLead.eprCategory || ''
      },
      registeredAddress: {
        ...current.registeredAddress,
        address1: current.registeredAddress.address1 || selectedLead.addressLine1 || '',
        address2: current.registeredAddress.address2 || selectedLead.addressLine2 || '',
        address3: current.registeredAddress.address3 || selectedLead.addressLine3 || '',
        state: current.registeredAddress.state || selectedLead.state || '',
        city: current.registeredAddress.city || selectedLead.city || '',
        pincode: current.registeredAddress.pincode || selectedLead.pinCode || ''
      },
      communicationAddress: {
        ...current.communicationAddress,
        address1: current.communicationAddress.address1 || selectedLead.addressLine1 || '',
        address2: current.communicationAddress.address2 || selectedLead.addressLine2 || '',
        address3: current.communicationAddress.address3 || selectedLead.addressLine3 || '',
        state: current.communicationAddress.state || selectedLead.state || '',
        city: current.communicationAddress.city || selectedLead.city || '',
        pincode: current.communicationAddress.pincode || selectedLead.pinCode || ''
      },
      otp: {
        ...current.otp,
        mobile: current.otp.mobile || selectedLead.mobileNo1 || '',
        personName: current.otp.personName || selectedLead.contactPerson || '',
        designation: current.otp.designation || selectedLead.designation || ''
      },
      authorised: {
        ...current.authorised,
        name: current.authorised.name || selectedLead.contactPerson || '',
        designation: current.authorised.designation || selectedLead.designation || '',
        mobile: current.authorised.mobile || selectedLead.mobileNo1 || '',
        email: current.authorised.email || selectedLead.emails || ''
      },
      coordinating: {
        ...current.coordinating,
        name: current.coordinating.name || selectedLead.contactPerson || '',
        designation: current.coordinating.designation || selectedLead.designation || '',
        mobile: current.coordinating.mobile || selectedLead.mobileNo1 || '',
        email: current.coordinating.email || selectedLead.emails || ''
      }
    }));
    setEditingClientId('');
  }

  function setAdmin(field, value) {
    setClient((current) => ({ ...current, adminControls: { ...current.adminControls, [field]: value } }));
  }

  function showToast(message, type = 'success') {
    setError(type === 'error' ? message : '');
    setNotice(type === 'success' ? message : '');
  }

  function goToStep(index) {
    const nextIndex = Math.min(Math.max(index, 0), tabs.length - 1);
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    showToast(`${nextTab.label} opened.`);
  }

  function validateCteStep() {
    if (activeTab !== 'cte') return true;

    const plants = client.cte?.plantWiseDetails || [];
    const invalidPlantIndex = plants.findIndex((plant) => (
      String(plant.ctoCcaType || '').trim().toUpperCase() === 'CTO' &&
      ['cteConsentNo', 'cteCategory', 'cteIssuedDate', 'cteValidDate', 'plantLocation'].some((field) => !String(plant[field] || '').trim())
    ));

    if (invalidPlantIndex === -1) return true;
    setError(`Plant ${invalidPlantIndex + 1}: CTO is selected. Please fill CTE Consent No., Category, Issued Year, Valid Upto, and Plant Location before moving to the next step.`);
    setNotice('');
    return false;
  }

  function goToNextStep() {
    if (isLastStep) return;
    if (!validateCteStep()) return;
    showToast(`${tabs[activeIndex]?.label || 'Step'} completed.`);
    window.setTimeout(() => {
      setActiveTab(tabs[activeIndex + 1].id);
    }, 0);
  }

  function goToPreviousStep() {
    if (isFirstStep) return;
    goToStep(activeIndex - 1);
  }

  function resolveUserId(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const match = staff.find((user) => String(user.email || '').toLowerCase() === raw) ||
      staff.find((user) => String(user.name || '').toLowerCase() === raw);
    return match ? (match._id || match.id) : '';
  }

  function resolveLeadId(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const match = leads.find((leadItem) => String(leadItem.leadCode || '').toLowerCase() === raw) ||
      leads.find((leadItem) => String(leadItem.company || '').toLowerCase() === raw);
    return match ? (match._id || match.id) : '';
  }

  async function handleExcelUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setNotice('');
    setExcelFileName(file.name);
    setExcelRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        setError('No sheet found in this file.');
        return;
      }
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      const parsed = rows
        .map((row) => mapExcelRowToClient(row, staff, leads))
        .filter((row) => Object.values(row.data || {}).some((value) => JSON.stringify(value || '').replace(/["{}[\],:]/g, '').trim() !== ''));

      if (!parsed.length) {
        setError('Excel has no usable client rows.');
        return;
      }

      setExcelRows(parsed);
      const first = parsed[0];
      setClient({
        ...emptyClient,
        ...(first.data || {}),
        selectedLead: first.selectedLead || '',
        adminControls: { ...emptyClient.adminControls, ...(first.adminControls || {}) }
      });
      setNotice(`${parsed.length} client row${parsed.length === 1 ? '' : 's'} loaded. First row applied to form.`);
    } catch (err) {
      console.error(err);
      setError('Unable to read Excel file. Please upload a valid .xlsx file.');
    }
  }

  async function importExcelRows() {
    if (!excelRows.length) return;
    setImporting(true);
    setError('');
    setNotice('');

    try {
      const payload = excelRows.map((row) => {
        const assignedText = row.data?.importMeta?.assignedTo || '';
        const leadText = row.data?.importMeta?.leadNumber || row.data?.importMeta?.uniqueId || '';
        return {
          ...row,
          selectedLead: row.selectedLead || resolveLeadId(leadText),
          adminControls: {
            ...row.adminControls,
            assignedTo: row.adminControls?.assignedTo || resolveUserId(assignedText)
          },
          workflowStatus: 'draft'
        };
      });
      const response = await apiService.clients.bulkImport(payload);
      const successCount = response.data.imported || 0;
      const failures = response.data.failures || [];

      if (successCount) {
        setNotice(`${successCount} client${successCount === 1 ? '' : 's'} imported as drafts.`);
        await loadPage();
      }
      if (failures.length) {
        setError(`${failures.length} row${failures.length === 1 ? '' : 's'} failed. First: row ${failures[0].row + 1} (${failures[0].error})`);
      }
    } catch (err) {
      const failures = err?.response?.data?.failures || [];
      setError(failures.length
        ? `${failures.length} row${failures.length === 1 ? '' : 's'} failed. First: row ${failures[0].row + 1} (${failures[0].error})`
        : getApiErrorMessage(err, 'Unable to import clients'));
    } finally {
      setImporting(false);
    }
  }

  function addRow(key, row) {
    setClient((current) => ({ ...current, [key]: [...current[key], row] }));
  }

  function updateRow(key, index, field, value) {
    setClient((current) => ({
      ...current,
      [key]: current[key].map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    }));
  }

  function removeRow(key, index) {
    setClient((current) => ({ ...current, [key]: current[key].filter((_, rowIndex) => rowIndex !== index) }));
  }

  function copyRegisteredAddress(checked) {
    if (!checked) return;
    setClient((current) => ({ ...current, communicationAddress: { ...current.registeredAddress } }));
  }

  async function saveClient(workflowStatus) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const normalizedClient = {
        ...client,
        basic: {
          ...client.basic,
          onboardingYear: String(client.basic?.onboardingYear || '').trim(),
          firstAnnualReturnYear: String(client.basic?.firstAnnualReturnYear || '').trim()
        }
      };
      const existingClient = !editingClientId && normalizedClient.selectedLead
        ? findClientByLead(normalizedClient.selectedLead, leads.find((leadItem) => String(leadItem._id || leadItem.id) === String(normalizedClient.selectedLead)))
        : null;
      const targetClientId = editingClientId || existingClient?._id || existingClient?.id || '';
      const payload = {
        selectedLead: normalizedClient.selectedLead,
        adminControls: normalizedClient.adminControls,
        data: normalizedClient,
        onboardingYear: normalizedClient.basic.onboardingYear,
        firstAnnualReturnYear: normalizedClient.basic.firstAnnualReturnYear,
        workflowStatus
      };
      console.debug('[ClientMaster] saving client years', {
        targetClientId: targetClientId || 'new',
        selectedLead: payload.selectedLead,
        onboardingYear: payload.data.basic.onboardingYear,
        firstAnnualReturnYear: payload.data.basic.firstAnnualReturnYear,
        workflowStatus
      });
      const response = targetClientId
        ? await apiService.clients.update(targetClientId, payload)
        : await apiService.clients.create(payload);
      console.debug('[ClientMaster] saved client years', {
        clientId: response.data?.client?._id || response.data?.client?.id,
        onboardingYear: response.data?.client?.data?.basic?.onboardingYear || response.data?.client?.onboardingYear || '',
        firstAnnualReturnYear: response.data?.client?.data?.basic?.firstAnnualReturnYear || response.data?.client?.firstAnnualReturnYear || ''
      });
      setNotice(workflowStatus === 'submitted' ? 'Client submitted successfully.' : 'Client draft saved successfully.');
      await loadPage();
      if (workflowStatus === 'submitted') {
        setClient(emptyClient);
        setEditingClientId('');
        setViewMode('form');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to save client'));
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('login_email');
    navigate('/', { replace: true });
  }

  if (viewMode === 'list') {
    return (
      <DashboardShell currentUser={currentUser} onOpenProfile={() => setProfileOpen(true)} onLogout={handleLogout}>
        <ClientDirectoryView
          clients={clients}
          staff={staff}
          loading={loading}
          onRefresh={loadPage}
          onAddNew={() => {
            setClient(emptyClient);
            setEditingClientId('');
            setActiveTab('basic');
            setViewMode('form');
          }}
          onView={setViewClient}
          onEdit={(item) => {
            hydrateClientForEdit(item);
          }}
        />
        {profileOpen && <ProfileModal user={currentUser} saving={false} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onSave={() => {}} onUpdatePassword={() => {}} />}
        {viewClient && <ClientViewModal client={viewClient} onClose={() => setViewClient(null)} />}
      </DashboardShell>
    );
  }

  return (
    <DashboardShell currentUser={currentUser} onOpenProfile={() => setProfileOpen(true)} onLogout={handleLogout}>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-sm ring-1 ring-emerald-100 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => navigate('/dashboard')} className="btn-lift inline-flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-100 bg-white text-[#30737B] shadow-sm">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#30737B]">Sales</p>
                <h1 className="mt-1 text-3xl font-black text-slate-950">Client Master Generator</h1>
              </div>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Active Tab</p>
              <p className="mt-1 font-black text-[#30737B]">{activeIndex + 1}. {tabs[activeIndex]?.label}</p>
            </div>
          </div>

          <Card title="Select Lead" className="mt-6">
            <Field required label="Choose Existing Lead">
              <div className="relative">
                <select value={client.selectedLead} onChange={(event) => handleLeadSelect(event.target.value)} className="form-input pr-12">
                  <option value="">Search and select a lead</option>
                  {leadOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
          </Card>

          {canSeeAdminControls && (
            <Card title="Admin Controls" className="mt-6">
              <div className="grid gap-5 md:grid-cols-3">
                <SelectLike label="Approval Status" value={client.adminControls.approvalStatus} options={selectOptions.approvalStatus} onChange={(value) => setAdmin('approvalStatus', value)} />
                <SelectLike label="Client Visibility Status" value={client.adminControls.visibilityStatus} options={selectOptions.visibilityStatus} onChange={(value) => setAdmin('visibilityStatus', value)} />
                <SelectLike label="Assigned To" value={client.adminControls.assignedTo} options={staffOptions} placeholder="Search and select admin to assign" onChange={(value) => setAdmin('assignedTo', value)} />
              </div>
            </Card>
          )}

          <Card title="Excel Bulk Import" className="mt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">Client Master Generator Import</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Upload .xlsx with headers like Unique ID, Trade Name, Client Name, State, City with PIN, GST Number, CPCB Reg No, OTP Mobile.
                </p>
                {excelFileName && (
                  <p className="mt-2 text-xs font-black text-slate-700">
                    File: <span className="font-extrabold">{excelFileName}</span> {excelRows.length ? `(${excelRows.length} row${excelRows.length === 1 ? '' : 's'})` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="btn-lift inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-black text-slate-800 hover:bg-slate-50">
                  <Upload className="h-4 w-4" /> Upload Excel
                  <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="sr-only" />
                </label>
                <button
                  type="button"
                  disabled={!excelRows.length || importing || saving}
                  onClick={importExcelRows}
                  className="btn-lift min-h-11 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-6 font-black text-white shadow-lg shadow-emerald-700/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {importing ? 'Importing...' : 'Import Drafts'}
                </button>
              </div>
            </div>
          </Card>

          <section className="mt-6 rounded-2xl border border-teal-100 bg-white/80 p-3 shadow-lg shadow-teal-900/5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => goToStep(tabs.findIndex((item) => item.id === tab.id))}
                    className={`btn-lift flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 font-black transition ${
                      active ? 'bg-[#30737B] text-white shadow-lg shadow-teal-900/15' : 'bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-[#30737B]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
          {notice && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>}

          <div className="mt-6 grid gap-6">
            {activeTab === 'basic' && <BasicTab client={client} setValue={setValue} />}
            {activeTab === 'address' && <AddressTab client={client} setValue={setValue} copyRegisteredAddress={copyRegisteredAddress} />}
            {activeTab === 'compliance' && <ComplianceTab client={client} setValue={setValue} addRow={addRow} updateRow={updateRow} removeRow={removeRow} />}
            {activeTab === 'cte' && <CteTab client={client} setValue={setValue} />}
            {activeTab === 'cpcb' && <CpcbTab client={client} setValue={setValue} />}
            {activeTab === 'validation' && <ValidationTab client={client} setValue={setValue} />}
            {activeTab === 'contacts' && <ContactsTab client={client} setValue={setValue} />}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" disabled={saving || isFirstStep} onClick={goToPreviousStep} className="btn-lift min-h-11 rounded-xl border border-slate-200 bg-white px-8 font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={() => saveClient('draft')} className="btn-lift min-h-11 rounded-xl border border-orange-200 bg-white px-8 font-black text-orange-600 hover:bg-orange-50">Save Draft</button>
              {!isLastStep ? (
                <button type="button" disabled={saving} onClick={goToNextStep} className="btn-lift min-h-11 rounded-xl bg-gradient-to-r from-[#30737B] to-teal-700 px-8 font-black text-white shadow-lg shadow-teal-700/20">Next</button>
              ) : (
                <button type="button" disabled={saving} onClick={() => saveClient('submitted')} className="btn-lift min-h-11 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 font-black text-white shadow-lg shadow-orange-600/20">Submit</button>
              )}
            </div>
          </div>
        </div>
      </div>
      {(notice || error) && (
        <div className="fixed right-4 top-4 z-[90] max-w-sm rounded-xl border bg-white px-4 py-3 text-sm font-black shadow-2xl shadow-slate-900/15">
          <p className={error ? 'text-red-700' : 'text-emerald-700'}>{error || notice}</p>
        </div>
      )}
      {profileOpen && <ProfileModal user={currentUser} saving={false} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onSave={() => {}} onUpdatePassword={() => {}} />}
    </DashboardShell>
  );
}

function BasicTab({ client, setValue }) {
  return (
    <Card title="Client Basic Info">
      <div className="grid gap-5 md:grid-cols-2">
        <Field required label="Client Legal Name"><input className="form-input" value={client.basic.clientLegalName} onChange={(event) => setValue('basic', 'clientLegalName', event.target.value)} /></Field>
        <Field label="Trade Name"><input className="form-input" value={client.basic.tradeName} onChange={(event) => setValue('basic', 'tradeName', event.target.value)} /></Field>
        <SelectLike label="PIBO Category" value={client.basic.piboCategory} options={selectOptions.piboCategory} onChange={(value) => setValue('basic', 'piboCategory', value)} />
        <SelectLike label="EPR Category" value={client.basic.eprCategory} options={selectOptions.eprCategory} onChange={(value) => setValue('basic', 'eprCategory', value)} />
        <SelectLike label="Client Onboarding Year" value={client.basic.onboardingYear} options={selectOptions.years} placeholder="Select onboarding year" onChange={(value) => setValue('basic', 'onboardingYear', value)} />
        <SelectLike label="First Annual Return Year Applicable" value={client.basic.firstAnnualReturnYear} options={selectOptions.years} placeholder="Select first annual return year" onChange={(value) => setValue('basic', 'firstAnnualReturnYear', value)} />
      </div>
    </Card>
  );
}

function readClientData(item) {
  return item?.data || {};
}

const invalidIdentityValues = new Set(['', 'n/a', 'na', '-', 'null', 'none', 'nil', 'not applicable']);

function readIdentityValue(value) {
  const raw = String(value || '').trim();
  if (invalidIdentityValues.has(raw.toLowerCase())) return '';
  return raw;
}

function getClientUniqueId(item) {
  const data = readClientData(item);
  return readIdentityValue(data.importMeta?.uniqueId) ||
    readIdentityValue(item.clientIdentity?.uniqueId) ||
    readIdentityValue(data.importMeta?.leadNumber) ||
    readIdentityValue(item.selectedLead?.leadCode) ||
    String(item._id || item.id || '');
}

function normalizeHeaderKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function formatExcelValue(value, field) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && /date/i.test(field)) return XLSX.SSF.format('yyyy-mm-dd', value);
  return typeof value === 'string' ? value.trim() : value;
}

function splitCityPin(value) {
  const raw = String(value || '').trim();
  const pinMatch = raw.match(/\b\d{5,6}\b/);
  return {
    city: raw.replace(/\b\d{5,6}\b/g, '').replace(/[,\-]+$/g, '').trim(),
    pin: pinMatch ? pinMatch[0] : ''
  };
}

function normalizeVisibility(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'LIVE') return 'LIVE';
  if (raw === 'SUSPENDED') return 'SUSPENDED';
  return 'DISCONTINUED';
}

function normalizeApproval(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'APPROVED') return 'APPROVED';
  if (raw === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

function mapExcelRowToClient(row, staff, leads) {
  const mapping = {
    uniqueid: 'importMeta.uniqueId',
    tradename: 'basic.tradeName',
    leadnote: 'importMeta.leadNote',
    leadnumber: 'importMeta.leadNumber',
    clientstatus: 'importMeta.clientStatus',
    clientvisibilitystatus: 'adminControls.visibilityStatus',
    visibilitystatus: 'adminControls.visibilityStatus',
    createdby: 'importMeta.createdBy',
    creationdate: 'importMeta.creationDate',
    assignedto: 'importMeta.assignedTo',
    clientname: 'basic.clientLegalName',
    clientonboardingyear: 'basic.onboardingYear',
    onboardingyear: 'basic.onboardingYear',
    clientfirstannualreturnyearapplicable: 'basic.firstAnnualReturnYear',
    clientfirstannualreturnyear: 'basic.firstAnnualReturnYear',
    firstannualreturnyearapplicable: 'basic.firstAnnualReturnYear',
    firstannualreturnyearpplicable: 'basic.firstAnnualReturnYear',
    firstannualreturnyear: 'basic.firstAnnualReturnYear',
    annualreturnyearapplicable: 'basic.firstAnnualReturnYear',
    annualreturnyearpplicable: 'basic.firstAnnualReturnYear',
    annualreturnyear: 'basic.firstAnnualReturnYear',
    state: 'registeredAddress.state',
    citywithpin: 'cityWithPin',
    contactperson: 'otp.personName',
    email: 'authorised.email',
    companyindustry: 'basic.companyIndustry',
    pibocategory: 'basic.piboCategory',
    servicesoffered: 'basic.servicesOffered',
    contactno: 'otp.mobile',
    website: 'basic.website',
    gstnumber: 'compliance.gst',
    gstcertificatedate: 'compliance.gstDate',
    cin: 'compliance.cin',
    cindocumentdate: 'compliance.cinDate',
    pan: 'compliance.pan',
    pandocumentdate: 'compliance.panDate',
    factorylicenseno: 'compliance.factoryLicense',
    factorylicensedocumentdate: 'compliance.factoryLicenseDate',
    msme1: 'msmeRows.0.value',
    msme2: 'msmeRows.1.value',
    msme3: 'msmeRows.2.value',
    msme4: 'msmeRows.3.value',
    msme5: 'msmeRows.4.value',
    cpcbregno: 'cpcb.registrationNumber',
    cpcbstatus: 'cpcb.status',
    cepruserid: 'cpcb.ceprUserId',
    ceprpassword: 'cpcb.ceprPassword',
    cpcblogin: 'cpcb.loginId',
    cpcbpassword: 'cpcb.loginPassword',
    eprcategory: 'basic.eprCategory',
    eprcertificateno: 'compliance.eprCertificate',
    approvalstatus: 'adminControls.approvalStatus',
    approvedby: 'importMeta.approvedBy',
    otpmobile: 'otp.mobile',
    otpname: 'otp.personName',
    regaddressline1: 'registeredAddress.address1',
    regaddressline2: 'registeredAddress.address2',
    regaddressline3: 'registeredAddress.address3',
    regcity: 'registeredAddress.city',
    regstate: 'registeredAddress.state',
    regpin: 'registeredAddress.pincode',
    commaddressline1: 'communicationAddress.address1',
    commaddressline2: 'communicationAddress.address2',
    commaddressline3: 'communicationAddress.address3',
    commcity: 'communicationAddress.city',
    commstate: 'communicationAddress.state',
    commpin: 'communicationAddress.pincode',
    documenturlsmax5: 'validation.documentUrls',
    authpersonname: 'authorised.name',
    authpersondesignation: 'authorised.designation',
    authpersonmobile: 'authorised.mobile',
    authpersonemail: 'authorised.email',
    coordpersonname: 'coordinating.name',
    coordpersondesignation: 'coordinating.designation',
    coordpersonmobile: 'coordinating.mobile',
    coordpersonemail: 'coordinating.email'
  };

  const payload = {
    selectedLead: '',
    adminControls: { approvalStatus: 'PENDING', visibilityStatus: 'LIVE', assignedTo: '' },
    data: {
      basic: {},
      registeredAddress: {},
      communicationAddress: {},
      compliance: {},
      msmeRows: [],
      cte: { numberOfPlantsLocations: '', plantWiseDetails: [] },
      cpcb: {},
      validation: {},
      otp: {},
      authorised: {},
      coordinating: {},
      importMeta: {}
    },
    workflowStatus: 'draft'
  };

  function setPath(path, value) {
    if (!path) return;
    if (path === 'cityWithPin') {
      const parsed = splitCityPin(value);
      if (parsed.city && !payload.data.registeredAddress.city) payload.data.registeredAddress.city = parsed.city;
      if (parsed.pin && !payload.data.registeredAddress.pincode) payload.data.registeredAddress.pincode = parsed.pin;
      return;
    }
    if (path === 'adminControls.visibilityStatus') {
      payload.adminControls.visibilityStatus = normalizeVisibility(value);
      return;
    }
    if (path === 'adminControls.approvalStatus') {
      payload.adminControls.approvalStatus = normalizeApproval(value);
      return;
    }
    if (path === 'validation.documentUrls') {
      payload.data.validation.documentUrls = String(value || '').split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
      return;
    }
    if (path.startsWith('msmeRows.')) {
      const index = Number(path.split('.')[1]);
      if (value) payload.data.msmeRows[index] = { label: `MSME ${index + 1}`, value };
      return;
    }

    const target = path.startsWith('adminControls.') ? payload.adminControls : payload.data;
    const parts = path.replace(/^adminControls\./, '').split('.');
    let cursor = target;
    parts.slice(0, -1).forEach((part) => {
      cursor[part] = cursor[part] || {};
      cursor = cursor[part];
    });
    cursor[parts[parts.length - 1]] = value;
  }

  Object.entries(row || {}).forEach(([key, value]) => {
    const field = mapping[normalizeHeaderKey(key)];
    if (!field) return;
    const clean = formatExcelValue(value, field);
    if (clean === '') return;
    setPath(field, clean);
  });

  if (!payload.data.basic.clientLegalName) payload.data.basic.clientLegalName = payload.data.basic.tradeName || payload.data.importMeta.uniqueId || '';
  if (!payload.data.communicationAddress.address1) payload.data.communicationAddress.address1 = payload.data.registeredAddress.address1 || '';
  if (!payload.data.communicationAddress.city) payload.data.communicationAddress.city = payload.data.registeredAddress.city || '';
  if (!payload.data.communicationAddress.state) payload.data.communicationAddress.state = payload.data.registeredAddress.state || '';
  if (!payload.data.communicationAddress.pincode) payload.data.communicationAddress.pincode = payload.data.registeredAddress.pincode || '';
  if (!payload.data.authorised.name) payload.data.authorised.name = payload.data.otp.personName || '';
  if (!payload.data.authorised.mobile) payload.data.authorised.mobile = payload.data.otp.mobile || '';

  const assignedRaw = payload.data.importMeta.assignedTo || '';
  const assignedMatch = staff.find((user) => String(user.email || '').toLowerCase() === String(assignedRaw).toLowerCase()) ||
    staff.find((user) => String(user.name || '').toLowerCase() === String(assignedRaw).toLowerCase());
  if (assignedMatch) payload.adminControls.assignedTo = assignedMatch._id || assignedMatch.id;

  const leadRaw = payload.data.importMeta.leadNumber || payload.data.importMeta.uniqueId || '';
  const leadMatch = leads.find((leadItem) => String(leadItem.leadCode || '').toLowerCase() === String(leadRaw).toLowerCase());
  if (leadMatch) payload.selectedLead = leadMatch._id || leadMatch.id;

  return payload;
}

function ClientDirectoryView({ clients, staff, loading, onRefresh, onAddNew, onView, onEdit }) {
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [metricFilter, setMetricFilter] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter((item) => {
      const data = readClientData(item);
      const assignedId = item.adminControls?.assignedTo?._id || item.adminControls?.assignedTo?.id || item.adminControls?.assignedTo || '';
      const haystack = [
        getClientUniqueId(item),
        data.basic?.clientLegalName,
        data.basic?.tradeName,
        data.registeredAddress?.state,
        item.adminControls?.visibilityStatus,
        data.basic?.piboCategory,
        data.basic?.eprCategory,
        data.compliance?.msmeStatus,
        data.cpcb?.status,
        data.otp?.mobile,
        data.otp?.personName
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const cpcbStatus = readClientData(item).cpcb?.status;
      const visibility = item.adminControls?.visibilityStatus;
      const matchesVisibility = !visibilityFilter || visibility === visibilityFilter;
      const matchesStaff = !staffFilter || String(assignedId) === String(staffFilter);
      const matchesMetric =
        !metricFilter ||
        metricFilter === 'live' ||
        (metricFilter === 'annual' && Boolean(data.basic?.firstAnnualReturnYear)) ||
        (metricFilter === 'processed' && cpcbStatus === 'Approved') ||
        (metricFilter === 'pending' && ['Not Started', 'Applied', 'Under Review'].includes(cpcbStatus)) ||
        (metricFilter === 'progress' && cpcbStatus === 'Under Review') ||
        (metricFilter === 'rejected' && cpcbStatus === 'Rejected') ||
        (metricFilter === 'discontinued' && ['DISCONTINUED', 'SUSPENDED'].includes(visibility));
      return matchesSearch && matchesVisibility && matchesStaff && matchesMetric;
    });
  }, [clients, metricFilter, query, staffFilter, visibilityFilter]);

  useEffect(() => {
    setPage(1);
  }, [metricFilter, query, rowsPerPage, staffFilter, visibilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / rowsPerPage));
  const visibleClients = filteredClients.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const portalApproved = clients.filter((item) => readClientData(item).cpcb?.status === 'Approved').length;
  const pending = clients.filter((item) => ['Not Started', 'Applied', 'Under Review'].includes(readClientData(item).cpcb?.status)).length;
  const inProgress = clients.filter((item) => readClientData(item).cpcb?.status === 'Under Review').length;
  const rejected = clients.filter((item) => readClientData(item).cpcb?.status === 'Rejected').length;
  const discontinued = clients.filter((item) => ['DISCONTINUED', 'SUSPENDED'].includes(item.adminControls?.visibilityStatus)).length;
  const annualReturn = clients.filter((item) => readClientData(item).basic?.firstAnnualReturnYear).length;
  const metricStats = [
    { label: 'Live Applications', value: clients.length, note: 'Active client records', icon: Building2, tone: 'emerald', filter: 'live' },
    { label: 'Annual Return', value: annualReturn, note: 'Return year mapped', icon: FileText, tone: 'violet', filter: 'annual' },
    { label: 'Processed Apps', value: portalApproved, note: 'CPCB approved', icon: CheckCircle2, tone: 'teal', filter: 'processed' },
    { label: 'Pending Apps', value: pending, note: 'ATPL pending', icon: FileCheck2, tone: 'amber', filter: 'pending' },
    { label: 'In Progress', value: inProgress, note: 'Portal review', icon: RefreshCw, tone: 'sky', filter: 'progress' },
    { label: 'Rejected', value: rejected, note: 'Portal rejected', icon: X, tone: 'rose', filter: 'rejected' },
    { label: 'Discontinued', value: discontinued, note: 'Hidden or archived', icon: FolderCheck, tone: 'orange', filter: 'discontinued' }
  ];
  const selectedMetric = metricStats.find((stat) => stat.filter === metricFilter);

  function exportExcel() {
    const rows = filteredClients.map((item) => {
      const data = readClientData(item);
      return {
        'Unique ID': getClientUniqueId(item),
        'Trade Name': data.basic?.tradeName || '',
        'Lead Note': data.importMeta?.leadNote || '',
        'Lead Number': data.importMeta?.leadNumber || item.selectedLead?.leadCode || '',
        'Client Status': data.importMeta?.clientStatus || item.workflowStatus || '',
        'Visibility Status': item.adminControls?.visibilityStatus || '',
        'Created By': data.importMeta?.createdBy || '',
        'Creation Date': data.importMeta?.creationDate || item.createdAt || '',
        'Assigned To': item.adminControls?.assignedTo?.name || data.importMeta?.assignedTo || '',
        'Client Name': data.basic?.clientLegalName || '',
        'Client Onboarding Year': data.basic?.onboardingYear || '',
        'First Annual Return Year Applicable': data.basic?.firstAnnualReturnYear || item.firstAnnualReturnYear || '',
        State: data.registeredAddress?.state || '',
        'City with PIN': `${data.registeredAddress?.city || ''} ${data.registeredAddress?.pincode || ''}`.trim(),
        'Contact Person': data.otp?.personName || data.authorised?.name || '',
        Email: data.authorised?.email || data.coordinating?.email || '',
        'Company Industry': data.basic?.companyIndustry || '',
        'PIBO Category': data.basic?.piboCategory || '',
        'Services Offered': data.basic?.servicesOffered || '',
        'Contact No': data.otp?.mobile || data.authorised?.mobile || '',
        Website: data.basic?.website || '',
        'GST Number': data.compliance?.gst || '',
        'GST Certificate Date': data.compliance?.gstDate || '',
        CIN: data.compliance?.cin || '',
        'CIN Document Date': data.compliance?.cinDate || '',
        PAN: data.compliance?.pan || '',
        'PAN Document Date': data.compliance?.panDate || '',
        'Factory License No': data.compliance?.factoryLicense || '',
        'Factory License Document Date': data.compliance?.factoryLicenseDate || '',
        'MSME 1': data.msmeRows?.[0]?.value || '',
        'MSME 2': data.msmeRows?.[1]?.value || '',
        'MSME 3': data.msmeRows?.[2]?.value || '',
        'MSME 4': data.msmeRows?.[3]?.value || '',
        'MSME 5': data.msmeRows?.[4]?.value || '',
        'CPCB Reg No': data.cpcb?.registrationNumber || '',
        'CPCB Status': data.cpcb?.status || '',
        'CEPR User ID': data.cpcb?.ceprUserId || '',
        'CEPR Password': data.cpcb?.ceprPassword || '',
        'CPCB Login': data.cpcb?.loginId || '',
        'CPCB Password': data.cpcb?.loginPassword || '',
        'EPR Category': data.basic?.eprCategory || '',
        'EPR Certificate No': data.compliance?.eprCertificate || '',
        'Approval Status': item.adminControls?.approvalStatus || '',
        'Approved By': data.importMeta?.approvedBy || '',
        'OTP Mobile': data.otp?.mobile || '',
        'OTP Name': data.otp?.personName || '',
        'Reg Address Line 1': data.registeredAddress?.address1 || '',
        'Reg Address Line 2': data.registeredAddress?.address2 || '',
        'Reg Address Line 3': data.registeredAddress?.address3 || '',
        'Reg City': data.registeredAddress?.city || '',
        'Reg State': data.registeredAddress?.state || '',
        'Reg PIN': data.registeredAddress?.pincode || '',
        'Comm Address Line 1': data.communicationAddress?.address1 || '',
        'Comm Address Line 2': data.communicationAddress?.address2 || '',
        'Comm Address Line 3': data.communicationAddress?.address3 || '',
        'Comm City': data.communicationAddress?.city || '',
        'Comm State': data.communicationAddress?.state || '',
        'Comm PIN': data.communicationAddress?.pincode || '',
        'Document URLs (max 5)': (data.validation?.documentUrls || []).join(', '),
        'Auth Person Name': data.authorised?.name || '',
        'Auth Person Designation': data.authorised?.designation || '',
        'Auth Person Mobile': data.authorised?.mobile || '',
        'Auth Person Email': data.authorised?.email || '',
        'Coord Person Name': data.coordinating?.name || '',
        'Coord Person Designation': data.coordinating?.designation || '',
        'Coord Person Mobile': data.coordinating?.mobile || '',
        'Coord Person Email': data.coordinating?.email || ''
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
    XLSX.writeFile(workbook, 'clients.xlsx');
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-7">
        <ClientStoryStats
          stats={metricStats}
          activeFilter={metricFilter}
          onFilterChange={(filter) => setMetricFilter((current) => (current === filter ? '' : filter))}
        />
        {selectedMetric && <ClientMetricOutputCard stat={selectedMetric} clients={filteredClients} onClose={() => setMetricFilter('')} onExport={exportExcel} />}

        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3 shadow-sm xl:grid-cols-[minmax(220px,1.1fr)_minmax(210px,0.9fr)_minmax(190px,0.9fr)_auto] xl:items-center">
          <div className="relative min-w-0">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="h-12 w-full rounded-lg border border-slate-200 bg-white px-5 pr-12 text-base font-black text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
            <Search className="pointer-events-none absolute right-6 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
          </div>
          <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} className="form-input min-h-12 rounded-lg xl:max-w-none">
            <option value="">All Visibility Status</option>
            {selectOptions.visibilityStatus.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="form-input min-h-12 rounded-lg xl:max-w-none">
            <option value="">All Staff</option>
            {staff.map((user) => <option key={user._id || user.id} value={user._id || user.id}>{user.name || user.email}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:justify-end">
            <button type="button" onClick={onAddNew} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-600 px-4 text-sm font-black text-white shadow-lg shadow-orange-600/20"><Plus className="h-4 w-4" />Add Client</button>
            <button type="button" onClick={() => { setQuery(''); setVisibilityFilter(''); setStaffFilter(''); setMetricFilter(''); setPage(1); }} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" />Clear</button>
            <button type="button" onClick={onRefresh} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-orange-200 bg-white px-4 text-sm font-black text-orange-600 hover:bg-orange-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
            <button type="button" onClick={exportExcel} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20"><Download className="h-4 w-4" />Export</button>
          </div>
        </div>

        <DirectoryTableHeader showing={visibleClients.length} total={filteredClients.length} label="clients" rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} page={page} setPage={setPage} totalPages={totalPages} />
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden-scrollbar max-h-[520px] overflow-auto">
            <table className="crm-data-table w-full min-w-[1480px] table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-black uppercase tracking-[0.06em] text-slate-500 shadow-sm">
                <tr>
                  {['Unique ID', 'Legal Name', 'Trade Name', 'State', 'Assigned To', 'Visibility Status', 'PIBO', 'EPR Category', 'MSME', 'CPCB Approval', 'OTP Mobile', 'OTP Name', 'Action'].map((header) => <th key={header} className="px-5 py-4">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleClients.length === 0 ? (
                  <tr><td colSpan={13} className="px-5 py-12 text-center font-black text-slate-400">No clients found.</td></tr>
                ) : visibleClients.map((item) => {
                  const data = readClientData(item);
                  return (
                    <tr key={item._id || item.id} className="transition hover:bg-orange-50/60">
                      <td className="px-5 py-4 font-black text-slate-900"><span className="cell-clip">{getClientUniqueId(item) || '-'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-600"><span className="cell-clamp">{data.basic?.clientLegalName || '-'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clamp">{data.basic?.tradeName || '-'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clip">{data.registeredAddress?.state || '-'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clip">{item.adminControls?.assignedTo?.name || '-'}</span></td>
                      <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">{item.adminControls?.visibilityStatus || 'LIVE'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clamp">{data.basic?.piboCategory || '-'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clamp">{data.basic?.eprCategory || '-'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clip">{data.compliance?.msmeStatus || 'N/A'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clip">{data.cpcb?.status || '-'}</span></td>
                      <td className="px-5 py-4 font-black text-slate-500"><span className="cell-clip">{data.otp?.mobile || '-'}</span></td>
                      <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clip">{data.otp?.personName || '-'}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => onView(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="View"><Eye className="h-4 w-4" /></button>
                          <button type="button" onClick={() => onEdit(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50" title="Edit"><Pencil className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressTab({ client, setValue, copyRegisteredAddress }) {
  return (
    <Card title="Company Address Details">
      <div className="grid gap-5 xl:grid-cols-2">
        <AddressPanel title="Registered Office Address" section="registeredAddress" data={client.registeredAddress} setValue={setValue} />
        <AddressPanel title="Communication Office Address" section="communicationAddress" data={client.communicationAddress} setValue={setValue} onCopy={copyRegisteredAddress} />
      </div>
    </Card>
  );
}

function AddressPanel({ title, section, data, setValue, onCopy }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      {onCopy && <label className="mb-3 inline-flex items-center gap-2 text-sm font-black text-slate-700"><input type="checkbox" className="h-4 w-4 accent-[#30737B]" onChange={(event) => onCopy(event.target.checked)} /> Same as Registered Address</label>}
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <div className="mt-5 grid gap-4">
        <Field required label="Address 1"><input className="form-input" value={data.address1 || ''} onChange={(event) => setValue(section, 'address1', event.target.value)} /></Field>
        <Field label="Address 2"><input className="form-input" value={data.address2 || ''} onChange={(event) => setValue(section, 'address2', event.target.value)} /></Field>
        <Field label="Address 3"><input className="form-input" value={data.address3 || ''} onChange={(event) => setValue(section, 'address3', event.target.value)} /></Field>
        <SelectLike required label="State" value={data.state || ''} options={selectOptions.states} onChange={(value) => setValue(section, 'state', value)} />
        <SelectLike required label="City" value={data.city || ''} options={selectOptions.cities} placeholder={data.state ? 'Select or type city' : 'Select state first'} disabled={!data.state} onChange={(value) => setValue(section, 'city', value)} />
        <Field required label="Pincode"><input className="form-input" value={data.pincode || ''} onChange={(event) => setValue(section, 'pincode', event.target.value)} /></Field>
      </div>
    </div>
  );
}

function ComplianceTab({ client, setValue, addRow, updateRow, removeRow }) {
  return (
    <>
      <Card title="Compliance Certificate Upload">
        <div className="grid gap-4">
          {complianceRows.map(([key, numberLabel, dateLabel, fileLabel]) => (
            <div key={key} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[1fr_1fr_180px]">
              <Field label={numberLabel}><input className="form-input" value={client.compliance[`${key}Number`] || ''} onChange={(event) => setValue('compliance', `${key}Number`, event.target.value)} /></Field>
              <SelectLike label={dateLabel} value={client.compliance[`${key}Date`] || ''} options={selectOptions.years} placeholder="Select financial year" onChange={(value) => setValue('compliance', `${key}Date`, value)} />
              <Field label={fileLabel}><UploadButton value={client.compliance[`${key}File`]} onChange={(value) => setValue('compliance', `${key}File`, value)} /></Field>
            </div>
          ))}
        </div>
      </Card>

      <Card title="MSME Details">
        <DynamicTable
          rows={client.msmeRows}
          columns={[
            ['classificationYear', 'MSME Classification Year *'],
            ['status', 'MSME Status *'],
            ['majorActivity', 'MSME Major Activity *'],
            ['udyamNumber', 'MSME Udyam Number *'],
            ['turnover', 'TurnOver of the Company (CR.) *']
          ]}
          uploadColumn="MSME Udyam Certificate"
          onAdd={() => addRow('msmeRows', { classificationYear: '', status: '', majorActivity: '', udyamNumber: '', turnover: '', file: '' })}
          onUpdate={(index, field, value) => updateRow('msmeRows', index, field, value)}
          onRemove={(index) => removeRow('msmeRows', index)}
        />
      </Card>
    </>
  );
}

const emptyPlantConsent = {
  plantName: '',
  cteConsentNo: '',
  cteCategory: '',
  cteIssuedDate: '',
  cteValidDate: '',
  plantLocation: '',
  cteDocument: null,
  cteProductionRows: [],
  ctoCcaType: '',
  ctoOrderNo: '',
  ctoIssueDate: '',
  ctoValidDate: '',
  ctoDocument: null,
  ctoProductRows: []
};

function TableInput({ value, onChange, placeholder = '', type = 'text', options }) {
  if (options) {
    return (
      <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="form-input min-h-10 min-w-44">
        <option value="">{placeholder || 'Select'}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  return (
    <input
      type={type}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="form-input min-h-10 min-w-44 uppercase"
    />
  );
}

function TableUpload({ value, onChange }) {
  return (
    <div className="min-w-44">
      <UploadButton value={value} onChange={onChange} />
    </div>
  );
}

function ConsentTable({ title, eyebrow, plants, columns, onPlantChange }) {
  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#30737B]">{eyebrow}</p>
        <h3 className="mt-1 text-2xl font-black text-slate-950">{title}</h3>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-950 text-xs font-black uppercase tracking-[0.08em] text-white">
              <tr>
                <th className="w-20 px-4 py-4 text-center">Sr.No</th>
                <th className="px-4 py-4">Plant Name</th>
                {columns.map((column) => <th key={column.key} className="px-4 py-4">{column.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plants.map((plant, plantIndex) => (
                <tr key={plantIndex} className="transition hover:bg-orange-50/60">
                  <td className="px-4 py-3 text-center font-black text-slate-800">{plantIndex + 1}</td>
                  <td className="px-4 py-3">
                    <TableInput value={plant.plantName} onChange={(value) => onPlantChange(plantIndex, 'plantName', value)} placeholder={`Plant ${plantIndex + 1}`} />
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      {column.type === 'file' ? (
                        <TableUpload value={plant[column.key]} onChange={(value) => onPlantChange(plantIndex, column.key, value)} />
                      ) : (
                        <TableInput
                          type={column.type}
                          value={plant[column.key]}
                          options={column.options}
                          placeholder={column.placeholder}
                          onChange={(value) => onPlantChange(plantIndex, column.key, value)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PlantQuantityTable({ title, plants, quantityKey, columns, rowTemplate, onAddRow, onUpdateRow, onRemoveRow, onPlantNameChange }) {
  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const safePlantIndex = Math.min(selectedPlantIndex, Math.max(plants.length - 1, 0));
  const rows = plants.flatMap((plant, plantIndex) =>
    (plant[quantityKey] || []).map((row, rowIndex) => ({ plant, plantIndex, row, rowIndex }))
  );

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-2xl font-black text-slate-950">{title}</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          {plants.length > 1 && (
            <select value={safePlantIndex} onChange={(event) => setSelectedPlantIndex(Number(event.target.value))} className="form-input min-h-11 min-w-52">
              {plants.map((plant, index) => <option key={index} value={index}>{plant.plantName || `Plant ${index + 1}`}</option>)}
            </select>
          )}
          <button type="button" onClick={() => onAddRow(safePlantIndex, quantityKey, rowTemplate)} className="btn-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 font-black text-white shadow-lg shadow-blue-700/20">
            <Plus className="h-4 w-4" /> Add Row
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-950 text-xs font-black uppercase tracking-[0.08em] text-white">
              <tr>
                <th className="w-20 px-4 py-4 text-center">Sr.No</th>
                {columns.map(([field, label], index) => (
                  <React.Fragment key={field}>
                    <th className="px-4 py-4">{label}</th>
                    {index === 0 && <th className="px-4 py-4">Plant Name</th>}
                  </React.Fragment>
                ))}
                <th className="w-36 px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 3} className="px-4 py-12 text-center font-black text-slate-400">No data</td>
                </tr>
              ) : (
                rows.map(({ plant, plantIndex, row, rowIndex }, index) => (
                  <tr key={`${plantIndex}-${rowIndex}`} className="transition hover:bg-orange-50/60">
                    <td className="px-4 py-3 text-center font-black text-slate-800">{index + 1}</td>
                    {columns.map(([field], columnIndex) => (
                      <React.Fragment key={field}>
                        <td className="px-4 py-3">
                          <TableInput value={row[field]} onChange={(value) => onUpdateRow(plantIndex, quantityKey, rowIndex, field, value)} />
                        </td>
                        {columnIndex === 0 && (
                          <td className="px-4 py-3">
                            <TableInput value={plant.plantName} onChange={(value) => onPlantNameChange(plantIndex, value)} placeholder={`Plant ${plantIndex + 1}`} />
                          </td>
                        )}
                      </React.Fragment>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => onRemoveRow(plantIndex, quantityKey, rowIndex)} className="rounded-lg border border-red-200 px-3 py-2 font-black text-red-600 hover:bg-red-50">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CteTab({ client, setValue }) {
  const plants = client.cte.plantWiseDetails || [];

  function setPlants(nextPlants) {
    setValue('cte', 'plantWiseDetails', nextPlants);
  }

  function setPlantCount(value) {
    const count = Math.max(0, Math.min(Number.parseInt(value, 10) || 0, 25));
    const nextPlants = Array.from({ length: count }, (_, index) => ({
      ...emptyPlantConsent,
      ...(plants[index] || {})
    }));
    setValue('cte', 'numberOfPlantsLocations', value);
    setPlants(nextPlants);
  }

  function updatePlant(plantIndex, field, value) {
    setPlants(plants.map((plant, index) => (index === plantIndex ? { ...plant, [field]: value } : plant)));
  }

  function addPlantRow(plantIndex, key, rowTemplate) {
    setPlants(plants.map((plant, index) => (
      index === plantIndex ? { ...plant, [key]: [...(plant[key] || []), rowTemplate] } : plant
    )));
  }

  function updatePlantRow(plantIndex, key, rowIndex, field, value) {
    setPlants(plants.map((plant, index) => (
      index === plantIndex
        ? { ...plant, [key]: (plant[key] || []).map((row, itemIndex) => (itemIndex === rowIndex ? { ...row, [field]: value } : row)) }
        : plant
    )));
  }

  function removePlantRow(plantIndex, key, rowIndex) {
    setPlants(plants.map((plant, index) => (
      index === plantIndex ? { ...plant, [key]: (plant[key] || []).filter((_, itemIndex) => itemIndex !== rowIndex) } : plant
    )));
  }

  return (
    <Card title="CTE / CTO / CCA Details">
      <div className="space-y-7">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#30737B]">Plant Setup</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Enter number of plant locations first</h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">If user enters 2, complete CTE and CTO/CCA detail tables will appear twice.</p>
            </div>
            <Field label="Number of Plant Locations">
              <input type="number" min="0" max="25" className="form-input" value={client.cte.numberOfPlantsLocations || ''} onChange={(event) => setPlantCount(event.target.value)} placeholder="1 or 2" />
            </Field>
          </div>
        </div>

        {!plants.length ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-5 py-10 text-center">
            <MapPin className="mx-auto h-8 w-8 text-[#30737B]" />
            <h3 className="mt-3 text-lg font-black text-slate-950">Add plant count to begin</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">CTE and CTO/CCA tables unlock after entering plant locations count.</p>
          </div>
        ) : (
          <>
            <ConsentTable
              title="CTE Details"
              eyebrow="Consent Establishment"
              plants={plants}
              columns={[
                { key: 'cteConsentNo', label: 'CTE Consent No.', placeholder: 'Enter consent no.' },
                { key: 'cteCategory', label: 'CTE Category', placeholder: 'Enter category' },
                { key: 'cteIssuedDate', label: 'CTE Issued Year', placeholder: 'Select year', options: selectOptions.years },
                { key: 'cteValidDate', label: 'CTE Valid Upto', placeholder: 'Select year', options: selectOptions.years },
                { key: 'plantLocation', label: 'Plant Location', placeholder: 'Enter location' },
                { key: 'cteDocument', label: 'CTE Document Upload', type: 'file' }
              ]}
              onPlantChange={updatePlant}
            />

            <PlantQuantityTable
              title="CTE Production Quantity per Year"
              plants={plants}
              quantityKey="cteProductionRows"
              columns={[['productName', 'Product Name'], ['capacity', 'Maximum Production Capacity / Year']]}
              rowTemplate={{ productName: '', capacity: '' }}
              onAddRow={addPlantRow}
              onUpdateRow={updatePlantRow}
              onRemoveRow={removePlantRow}
              onPlantNameChange={(plantIndex, value) => updatePlant(plantIndex, 'plantName', value)}
            />

            <ConsentTable
              title="CTO / CCA Details"
              eyebrow="Consent Operation"
              plants={plants}
              columns={[
                { key: 'ctoCcaType', label: 'CTO / CCA Type', placeholder: 'Select CTO or CCA', options: selectOptions.ctoCcaType },
                { key: 'ctoOrderNo', label: 'CTO / CCA Consent Order No.', placeholder: 'Enter order no.' },
                { key: 'ctoIssueDate', label: 'CTO / CCA Date of Issue', placeholder: 'Select year', options: selectOptions.years },
                { key: 'ctoValidDate', label: 'CTO / CCA Valid Upto', placeholder: 'Select year', options: selectOptions.years },
                { key: 'ctoDocument', label: 'CTO / CCA Document Upload', type: 'file' }
              ]}
              onPlantChange={updatePlant}
            />

            <PlantQuantityTable
              title="CTO / CCA Product Quantity"
              plants={plants}
              quantityKey="ctoProductRows"
              columns={[['productName', 'Name Of The Product'], ['quantity', 'Quantity']]}
              rowTemplate={{ productName: '', quantity: '' }}
              onAddRow={addPlantRow}
              onUpdateRow={updatePlantRow}
              onRemoveRow={removePlantRow}
              onPlantNameChange={(plantIndex, value) => updatePlant(plantIndex, 'plantName', value)}
            />
          </>
        )}
      </div>
    </Card>
  );
}

function CpcbTab({ client, setValue }) {
  return (
    <Card title="CPCB Details">
      <div className="grid gap-5 md:grid-cols-2">
        <SelectLike required label="CPCB Status" value={client.cpcb.status || ''} options={selectOptions.cpcbStatus} onChange={(value) => setValue('cpcb', 'status', value)} />
        <Field label="Remark"><textarea className="form-input min-h-[92px] resize-y py-3" value={client.cpcb.remark || ''} onChange={(event) => setValue('cpcb', 'remark', event.target.value)} /></Field>
        <Field label="CPCB Home page"><UploadButton value={client.cpcb.homePageFile} onChange={(value) => setValue('cpcb', 'homePageFile', value)} /></Field>
        <Field label="CPCB Registration Number"><input className="form-input" value={client.cpcb.registrationNumber || ''} onChange={(event) => setValue('cpcb', 'registrationNumber', event.target.value)} /></Field>
        <SelectLike label="Date of Application" value={client.cpcb.applicationDate || ''} options={selectOptions.years} placeholder="Select financial year" onChange={(value) => setValue('cpcb', 'applicationDate', value)} />
        <SelectLike label="Date of Application Approval" value={client.cpcb.approvalDate || ''} options={selectOptions.years} placeholder="Select financial year" onChange={(value) => setValue('cpcb', 'approvalDate', value)} />
        <Field label="Application Number"><input className="form-input" value={client.cpcb.applicationNumber || ''} onChange={(event) => setValue('cpcb', 'applicationNumber', event.target.value)} /></Field>
        <Field label="CEPR User ID"><input className="form-input" value={client.cpcb.ceprUserId || ''} onChange={(event) => setValue('cpcb', 'ceprUserId', event.target.value)} /></Field>
        <Field label="CEPR Password"><input type="password" className="form-input" value={client.cpcb.ceprPassword || ''} onChange={(event) => setValue('cpcb', 'ceprPassword', event.target.value)} /></Field>
        <Field label="CPCB Login ID"><input className="form-input" value={client.cpcb.loginId || ''} onChange={(event) => setValue('cpcb', 'loginId', event.target.value)} /></Field>
        <Field label="CPCB Login Password"><input type="password" className="form-input" value={client.cpcb.loginPassword || ''} onChange={(event) => setValue('cpcb', 'loginPassword', event.target.value)} /></Field>
      </div>
    </Card>
  );
}

function ValidationTab({ client, setValue }) {
  return (
    <Card title="Validation Documents">
      <div className="mb-5 flex items-center gap-4 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <div className="grid h-14 w-16 place-items-center rounded-lg border border-emerald-100 bg-white p-2">
          <img src={brand.logoUrl} alt="Anant Tattva" className="max-h-full max-w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Quotation</p>
          <p className="truncate text-lg font-black text-slate-950">{dataLabel(client.basic?.clientLegalName || client.basic?.tradeName || 'Client quotation')}</p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Quotation Number"><input className="form-input" value={client.validation.quotationNumber || ''} onChange={(event) => setValue('validation', 'quotationNumber', event.target.value)} /></Field>
        <SelectLike label="Quotation Date" value={client.validation.quotationDate || ''} options={selectOptions.years} placeholder="Select financial year" onChange={(value) => setValue('validation', 'quotationDate', value)} />
        <Field label="Quotation Document"><UploadButton value={client.validation.quotationDocument} onChange={(value) => setValue('validation', 'quotationDocument', value)} /></Field>
        <Field label="Initial Purchase Order Number"><input className="form-input" value={client.validation.poNumber || ''} onChange={(event) => setValue('validation', 'poNumber', event.target.value)} /></Field>
        <SelectLike label="Initial Purchase Order Date" value={client.validation.poDate || ''} options={selectOptions.years} placeholder="Select financial year" onChange={(value) => setValue('validation', 'poDate', value)} />
        <Field label="Initial Purchase Order Document"><UploadButton value={client.validation.poDocument} onChange={(value) => setValue('validation', 'poDocument', value)} /></Field>
      </div>
    </Card>
  );
}

function ContactsTab({ client, setValue }) {
  return (
    <>
      <Card title="OTP Contact">
        <div className="grid gap-5 md:grid-cols-2">
          <Field required label="OTP Enabled Mobile No"><input className="form-input" value={client.otp.mobile || ''} onChange={(event) => setValue('otp', 'mobile', event.target.value)} /></Field>
          <Field label="OTP Person Name"><input className="form-input" value={client.otp.personName || ''} onChange={(event) => setValue('otp', 'personName', event.target.value)} /></Field>
          <Field label="OTP Person Designation"><input className="form-input" value={client.otp.designation || ''} onChange={(event) => setValue('otp', 'designation', event.target.value)} /></Field>
        </div>
      </Card>
      <PersonCard title="Authorised Person" section="authorised" client={client} setValue={setValue} includePan />
      <PersonCard title="Coordinating Person" section="coordinating" client={client} setValue={setValue} />
    </>
  );
}

function PersonCard({ title, section, client, setValue, includePan }) {
  const data = client[section];
  return (
    <Card title={title}>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={`${title} Name`}><input className="form-input" value={data.name || ''} onChange={(event) => setValue(section, 'name', event.target.value)} /></Field>
        <Field label={`${title} Designation`}><input className="form-input" value={data.designation || ''} onChange={(event) => setValue(section, 'designation', event.target.value)} /></Field>
        <Field label={`Department of ${title.toLowerCase()}`}><input className="form-input" value={data.department || ''} onChange={(event) => setValue(section, 'department', event.target.value)} /></Field>
        <Field label="Reporting Person Details"><input className="form-input" value={data.reporting || ''} onChange={(event) => setValue(section, 'reporting', event.target.value)} /></Field>
        <Field required label={`${title} Mobile`}><input className="form-input" value={data.mobile || ''} onChange={(event) => setValue(section, 'mobile', event.target.value)} /></Field>
        <Field required label={`${title} Email`}><input className="form-input" value={data.email || ''} onChange={(event) => setValue(section, 'email', event.target.value)} /></Field>
        {includePan && <Field label={`${title} PAN Number`}><input className="form-input" value={data.pan || ''} onChange={(event) => setValue(section, 'pan', event.target.value)} /></Field>}
        {includePan && <Field label={`${title} PAN Document`}><UploadButton value={data.panDocument} onChange={(value) => setValue(section, 'panDocument', value)} /></Field>}
      </div>
    </Card>
  );
}

function DynamicTable({ title, rows, columns, uploadColumn, onAdd, onUpdate, onRemove }) {
  return (
    <div className="mt-6">
      {title && <h3 className="text-xl font-black text-slate-950">{title}</h3>}
      <button type="button" onClick={onAdd} className="btn-lift mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 font-black text-white shadow-lg shadow-blue-700/20">
        <Plus className="h-4 w-4" /> Add Row
      </button>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-4">Sr.No</th>
              {columns.map(([, label]) => <th key={label} className="px-4 py-4">{label}</th>)}
              {uploadColumn && <th className="px-4 py-4">{uploadColumn}</th>}
              <th className="px-4 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (uploadColumn ? 3 : 2)} className="px-4 py-12 text-center font-black text-slate-400">No data</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100">
                <td className="px-4 py-3 font-black">{index + 1}</td>
                {columns.map(([field]) => (
                  <td key={field} className="px-4 py-3">
                    <input className="form-input min-h-10" value={row[field] || ''} onChange={(event) => onUpdate(index, field, event.target.value)} />
                  </td>
                ))}
                {uploadColumn && <td className="px-4 py-3"><UploadButton value={row.file} onChange={(value) => onUpdate(index, 'file', value)} /></td>}
                <td className="px-4 py-3 text-center">
                  <button type="button" onClick={() => onRemove(index)} className="rounded-lg border border-red-200 px-3 py-2 font-black text-red-600 hover:bg-red-50">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UploadButton({ value, onChange }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const nextValue = { name: file.name, dataUrl: reader.result };
      setLocalValue(nextValue);
      onChange(nextValue);
    };
    reader.readAsDataURL(file);
  }

  function viewFile() {
    const url = localValue?.dataUrl || localValue?.url || (typeof localValue === 'string' ? localValue : '');
    if (!url) return;
    const preview = window.open('', '_blank');
    if (!preview) return;
    preview.document.write(`<iframe src="${url}" title="Uploaded file preview" style="border:0;width:100vw;height:100vh;"></iframe>`);
    preview.document.close();
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <label className="btn-lift inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-700 hover:bg-slate-50">
          <Upload className="h-4 w-4" /> Upload
          <input type="file" className="sr-only" onChange={handleFile} />
        </label>
        {(localValue?.dataUrl || localValue?.url || typeof localValue === 'string') && (
          <button type="button" onClick={viewFile} className="btn-lift inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 font-black text-emerald-700 hover:bg-emerald-100">
            <Eye className="h-4 w-4" /> View
          </button>
        )}
      </div>
      {localValue?.name && <p className="max-w-56 truncate text-xs font-bold text-slate-500">{localValue.name}</p>}
    </div>
  );
}

function Card({ title, children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label} {required && <span className="text-red-500">*</span>}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function SelectLike({ label, required, value, options = [], onChange, disabled = false, placeholder = 'Select or type to create new' }) {
  const normalized = Array.isArray(options) ? options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option)) : [];
  const listId = `client-${label.replace(/\s+/g, '-')}`;
  return (
    <Field label={label} required={required}>
      <div className="relative">
        <input value={value} list={listId} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="form-input pr-12 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" />
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <datalist id={listId}>
          {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </datalist>
      </div>
    </Field>
  );
}

function useCountUp(value, active, duration = 850) {
  const [displayValue, setDisplayValue] = useState(active ? value : 0);

  useEffect(() => {
    if (!active) {
      setDisplayValue(0);
      return undefined;
    }

    const start = performance.now();
    const to = Number(value) || 0;
    let frameId;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(to * eased));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, duration, value]);

  return displayValue;
}

function ClientStoryStats({ stats, activeFilter, onFilterChange }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    setVisibleCount(1);
    const timers = stats.slice(1).map((_, index) =>
      window.setTimeout(() => setVisibleCount(index + 2), 500 * (index + 1))
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [stats.length]);

  return (
    <section className="lead-story-panel client-story-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Client Performance Flow</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Live client movement</h2>
        </div>
        <p className="max-w-xl text-sm font-bold text-slate-500">
          Quick client status snapshot for applications, CPCB progress, and visibility state.
        </p>
      </div>

      <div className="client-story-grid mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-7 xl:gap-5">
        {stats.map((stat, index) => (
          <ClientStoryCard
            key={stat.label}
            stat={stat}
            index={index}
            active={index < visibleCount}
            selected={Boolean(stat.filter && activeFilter === stat.filter)}
            onSelect={stat.filter ? () => onFilterChange(stat.filter) : undefined}
            showArrow={index < stats.length - 1}
            arrowActive={index < visibleCount - 1}
          />
        ))}
      </div>
    </section>
  );
}

function ClientStoryCard({ stat, index, active, selected, onSelect, showArrow, arrowActive }) {
  const Icon = stat.icon;
  const value = useCountUp(stat.value, active);
  const Component = onSelect ? 'button' : 'article';

  return (
    <Component type={onSelect ? 'button' : undefined} onClick={onSelect} className={`lead-story-card client-story-card lead-story-${stat.tone} ${active ? 'lead-story-card-active' : ''} ${selected ? 'lead-story-card-selected' : ''}`} style={{ '--delay': `${index * 80}ms` }}>
      {showArrow && <span className={`lead-story-arrow ${arrowActive ? 'lead-story-arrow-active' : ''}`} />}
      <div className="lead-story-topline" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <span className="lead-story-icon">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase leading-4 text-slate-500">{stat.note}</p>
    </Component>
  );
}

function ClientMetricOutputCard({ stat, clients, onClose, onExport }) {
  const Icon = stat.icon;
  const preview = clients.slice(0, 10);

  return (
    <section className={`metric-output-card lead-story-${stat.tone}`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="lead-story-icon"><Icon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Selected Output</p>
            <h3 className="truncate text-xl font-black text-slate-950">{stat.label}</h3>
          </div>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{clients.length} records</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onExport} className="btn-lift inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20"><Download className="h-4 w-4" /> Export</button>
          <button type="button" onClick={onClose} className="btn-lift inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /> Close</button>
        </div>
      </div>
      <div className="hidden-scrollbar max-h-[320px] overflow-auto">
        <table className="crm-data-table w-full min-w-[900px] table-fixed text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-black uppercase tracking-[0.06em] text-slate-500">
            <tr>{['Unique ID', 'Legal Name', 'State', 'Visibility', 'CPCB', 'OTP Mobile'].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center font-black text-slate-400">No records found.</td></tr>
            ) : preview.map((item) => {
              const data = readClientData(item);
              return (
                <tr key={item._id || item.id} className="transition hover:bg-orange-50/60">
                  <td className="px-4 py-3 font-black text-slate-900"><span className="cell-clip">{getClientUniqueId(item) || '-'}</span></td>
                  <td className="px-4 py-3 font-black uppercase text-slate-600"><span className="cell-clamp">{data.basic?.clientLegalName || '-'}</span></td>
                  <td className="px-4 py-3 font-black uppercase text-slate-500"><span className="cell-clip">{data.registeredAddress?.state || '-'}</span></td>
                  <td className="px-4 py-3"><span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{item.adminControls?.visibilityStatus || 'LIVE'}</span></td>
                  <td className="px-4 py-3 font-black uppercase text-slate-500"><span className="cell-clip">{data.cpcb?.status || '-'}</span></td>
                  <td className="px-4 py-3 font-black text-slate-500"><span className="cell-clip">{data.otp?.mobile || '-'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {clients.length > preview.length && <p className="border-t border-slate-100 px-4 py-3 text-sm font-bold text-slate-500">Showing first {preview.length} records here. Export includes all {clients.length} filtered records.</p>}
    </section>
  );
}

function ClientViewModal({ client, onClose }) {
  const data = readClientData(client);
  const cityWithPin = [data.registeredAddress?.city, data.registeredAddress?.pincode].filter(Boolean).join(' ');

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-3 py-5">
      <section className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-14 w-16 shrink-0 place-items-center rounded-lg border border-emerald-100 bg-emerald-50 p-2">
              <img src={brand.logoUrl} alt="Anant Tattva" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Client View</p>
              <h2 className="break-words text-2xl font-black leading-tight text-slate-950">{data.basic?.clientLegalName || 'Client details'}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center self-end rounded-lg text-slate-500 hover:bg-slate-100 sm:self-auto" title="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="hidden-scrollbar max-h-[calc(92vh-104px)] overflow-y-auto bg-slate-50/70 p-4 sm:p-5">
          <DetailSection title="Basic Info">
            <DetailItem icon={Building2} label="Client Name" value={data.basic?.clientLegalName} />
            <DetailItem icon={Building2} label="Trade Name" value={data.basic?.tradeName} />
            <DetailItem icon={MapPin} label="State" value={data.registeredAddress?.state} />
            <DetailItem icon={MapPin} label="City With Pin" value={cityWithPin} />
            <DetailItem icon={FileCheck2} label="PIBO Category" value={data.basic?.piboCategory} />
            <DetailItem icon={FileCheck2} label="EPR Category" value={data.basic?.eprCategory} />
            <DetailItem icon={Building2} label="Company Industry" value={data.basic?.companyIndustry || data.basic?.tradeName} />
            <DetailItem icon={CheckCircle2} label="Services Offered" value={data.basic?.servicesOffered || 'N/A'} />
          </DetailSection>

          <DetailSection title="Registered and communication addresses">
            <DetailItem icon={MapPin} label="Registered Address 1" value={data.registeredAddress?.address1} />
            <DetailItem icon={MapPin} label="Registered Address 2" value={data.registeredAddress?.address2} />
            <DetailItem icon={MapPin} label="Registered Address 3" value={data.registeredAddress?.address3} />
            <DetailItem icon={MapPin} label="Registered State" value={data.registeredAddress?.state} />
            <DetailItem icon={MapPin} label="Registered City" value={data.registeredAddress?.city} />
            <DetailItem icon={MapPin} label="Registered Pin" value={data.registeredAddress?.pincode} />
            <DetailItem icon={MapPin} label="Communication Address 1" value={data.communicationAddress?.address1} />
            <DetailItem icon={MapPin} label="Communication City" value={data.communicationAddress?.city} />
            <DetailItem icon={MapPin} label="Communication State" value={data.communicationAddress?.state} />
            <DetailItem icon={MapPin} label="Communication Pin" value={data.communicationAddress?.pincode} />
          </DetailSection>

          <DetailSection title="Approval and contact">
            <DetailItem icon={ShieldCheck} label="Approval Status" value={client.adminControls?.approvalStatus} />
            <DetailItem icon={CheckCircle2} label="Visibility" value={client.adminControls?.visibilityStatus} />
            <DetailItem icon={ShieldCheck} label="CPCB" value={data.cpcb?.status} />
            <DetailItem icon={UserRound} label="Assigned To" value={client.adminControls?.assignedTo?.name} />
            <DetailItem icon={UserRound} label="OTP Mobile" value={data.otp?.mobile} />
            <DetailItem icon={UserRound} label="OTP Name" value={data.otp?.personName} />
            <DetailItem icon={FileText} label="Unique ID" value={getClientUniqueId(client)} />
            <DetailItem icon={FileText} label="Lead Number" value={data.importMeta?.leadNumber || client.selectedLead?.leadCode} />
          </DetailSection>
        </div>
      </section>
    </div>
  );
}

function dataLabel(value) {
  return String(value || '').trim() || 'N/A';
}

function DetailSection({ title, children }) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm shadow-slate-900/5">
      <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-700" />
          <h3 className="min-w-0 break-words text-base font-black text-slate-900">{title}</h3>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-700 text-white">
          <ChevronDown className="h-4 w-4 rotate-180" />
        </span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex min-h-[116px] min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-emerald-100 bg-emerald-50 text-teal-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm font-black leading-6 text-slate-950">{dataLabel(value)}</p>
      </div>
    </div>
  );
}

function DirectoryMetric({ label, value, note }) {
  return (
    <div className="min-h-36 rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      {note && <p className="mt-6 text-xs font-black uppercase text-slate-500">{note}</p>}
    </div>
  );
}

function DirectoryTableHeader({ showing, total, label, rowsPerPage, setRowsPerPage, page, setPage, totalPages }) {
  const start = total ? (page - 1) * rowsPerPage + 1 : 0;
  const end = total ? start + showing - 1 : 0;
  const [draftPage, setDraftPage] = useState(String(page));

  useEffect(() => {
    setDraftPage(String(page));
  }, [page]);

  function jumpToPage(event) {
    event.preventDefault();
    const nextPage = Math.min(totalPages, Math.max(1, Number.parseInt(draftPage, 10) || 1));
    setPage(nextPage);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-black text-slate-600">Showing {showing} of {total} {label} <span className="ml-2">(Page {page} of {totalPages})</span></p>
      <div className="flex flex-wrap items-center gap-3 font-black text-slate-600">
        <span>{start} - {end} of {total}</span>
        <form onSubmit={jumpToPage} className="inline-flex items-center gap-2">
          <span>Go to:</span>
          <input value={draftPage} onChange={(event) => setDraftPage(event.target.value)} className="h-11 w-20 rounded-lg border border-slate-200 bg-white px-3 text-center font-black outline-none focus:border-emerald-400" inputMode="numeric" />
        </form>
        <span>Rows per page:</span>
        <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))} className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-black outline-none">
          {[10, 25, 50, 100].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </div>
    </div>
  );
}
