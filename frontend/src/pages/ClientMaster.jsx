import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle2, ChevronDown, FileCheck2, FileText, FolderCheck, MapPin, Plus, ShieldCheck, Upload, UserRound } from 'lucide-react';
import DashboardShell from '../components/dashboard/DashboardShell';
import ProfileModal from '../components/dashboard/ProfileModal';
import { adminRoles } from '../constants/dashboard';
import api from '../services/api';

const tabs = [
  { id: 'basic', label: 'Client Basic Info', icon: Building2 },
  { id: 'address', label: 'Address Details', icon: MapPin },
  { id: 'compliance', label: 'Compliance & MSME', icon: FileCheck2 },
  { id: 'cte', label: 'CTE / CTO / CCA', icon: FolderCheck },
  { id: 'cpcb', label: 'CPCB Details', icon: ShieldCheck },
  { id: 'validation', label: 'Validation Documents', icon: FileText },
  { id: 'contacts', label: 'OTP & People', icon: UserRound }
];

const selectOptions = {
  approvalStatus: ['PENDING', 'APPROVED', 'REJECTED', 'ON HOLD'],
  visibilityStatus: ['LIVE', 'HIDDEN', 'ARCHIVED'],
  piboCategory: ['Producer', 'Importer', 'Brand Owner', 'Recycler', 'PWP', 'Refurbisher'],
  eprCategory: ['EPR - Plastic Waste', 'EPR - E-Waste', 'EPR - Battery Waste', 'EPR - Tyre Waste', 'EPR - Used Oil Waste'],
  years: Array.from({ length: 12 }, (_, index) => String(new Date().getFullYear() - index)),
  states: ['Gujarat', 'Maharashtra', 'Karnataka', 'Delhi', 'Rajasthan', 'Uttar Pradesh', 'Haryana', 'Tamil Nadu', 'Telangana'],
  cities: ['Ahmedabad', 'Surat', 'Mumbai', 'Pune', 'Bengaluru', 'Delhi', 'Jaipur', 'Noida', 'Gurugram', 'Chennai', 'Hyderabad'],
  cpcbStatus: ['Not Started', 'Applied', 'Under Review', 'Approved', 'Rejected'],
  msmeStatus: ['Micro', 'Small', 'Medium', 'Not Applicable'],
  msmeActivity: ['Manufacturing', 'Service', 'Trading']
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
  cte: {},
  cteProductionRows: [],
  ctoProductRows: [],
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
  const [staff, setStaff] = useState([]);
  const [client, setClient] = useState(emptyClient);
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const canSeeAdminControls = adminRoles.includes(currentUser?.role);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const leadOptions = useMemo(() => leads.map((lead) => ({ value: lead._id || lead.id, label: `${lead.company || 'Untitled lead'} - ${lead.status || 'Draft'}` })), [leads]);
  const staffOptions = useMemo(() => staff.map((user) => ({ value: user._id || user.id, label: `${user.name || user.email} (${user.role})` })), [staff]);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      const meResponse = await api.get('/auth/me');
      setCurrentUser(meResponse.data.user);
      const leadsResponse = await api.get('/leads');
      setLeads(leadsResponse.data.leads || []);
      try {
        const usersResponse = await api.get('/auth/admin/users');
        setStaff(usersResponse.data.users || []);
      } catch {
        setStaff([meResponse.data.user]);
      }
    } catch {
      navigate('/', { replace: true });
    }
  }

  function setValue(section, field, value) {
    setClient((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  }

  function setRoot(field, value) {
    setClient((current) => ({ ...current, [field]: value }));
  }

  function setAdmin(field, value) {
    setClient((current) => ({ ...current, adminControls: { ...current.adminControls, [field]: value } }));
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
      await api.post('/clients', {
        selectedLead: client.selectedLead,
        adminControls: client.adminControls,
        data: client,
        workflowStatus
      });
      setNotice(workflowStatus === 'submitted' ? 'Client submitted successfully.' : 'Client draft saved successfully.');
      if (workflowStatus === 'submitted') setClient(emptyClient);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to save client');
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
                <h1 className="mt-1 text-3xl font-black text-slate-950">Client Master</h1>
              </div>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Active Tab</p>
              <p className="mt-1 font-black text-[#30737B]">{activeIndex + 1}. {tabs[activeIndex]?.label}</p>
            </div>
          </div>

          <Card title="Select Lead" className="mt-6">
            <SelectLike required label="Choose Existing Lead" value={client.selectedLead} options={leadOptions} placeholder="Search and select a lead" onChange={(value) => setRoot('selectedLead', value)} />
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

          <section className="mt-6 rounded-2xl border border-teal-100 bg-white/80 p-3 shadow-lg shadow-teal-900/5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
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
            {activeTab === 'cte' && <CteTab client={client} setValue={setValue} addRow={addRow} updateRow={updateRow} removeRow={removeRow} />}
            {activeTab === 'cpcb' && <CpcbTab client={client} setValue={setValue} />}
            {activeTab === 'validation' && <ValidationTab client={client} setValue={setValue} />}
            {activeTab === 'contacts' && <ContactsTab client={client} setValue={setValue} />}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={saving} onClick={() => saveClient('draft')} className="btn-lift min-h-11 rounded-xl border border-orange-200 bg-white px-8 font-black text-orange-600 hover:bg-orange-50">Save Draft</button>
            <button type="button" disabled={saving} onClick={() => saveClient('submitted')} className="btn-lift min-h-11 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 font-black text-white shadow-lg shadow-orange-600/20">Submit</button>
          </div>
        </div>
      </div>
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
              <Field label={dateLabel}><input type="date" className="form-input" value={client.compliance[`${key}Date`] || ''} onChange={(event) => setValue('compliance', `${key}Date`, event.target.value)} /></Field>
              <Field label={fileLabel}><UploadButton onChange={(value) => setValue('compliance', `${key}File`, value)} /></Field>
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

function CteTab({ client, setValue, addRow, updateRow, removeRow }) {
  return (
    <Card title="CTE & CTO/CCA Details">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="CTE Consent No."><input className="form-input" value={client.cte.cteConsentNo || ''} onChange={(event) => setValue('cte', 'cteConsentNo', event.target.value)} /></Field>
        <Field label="CTE Category"><input className="form-input" value={client.cte.cteCategory || ''} onChange={(event) => setValue('cte', 'cteCategory', event.target.value)} /></Field>
        <Field label="CTE Issued Date"><input type="date" className="form-input" value={client.cte.cteIssuedDate || ''} onChange={(event) => setValue('cte', 'cteIssuedDate', event.target.value)} /></Field>
        <Field label="CTE Valid upto Date"><input type="date" className="form-input" value={client.cte.cteValidDate || ''} onChange={(event) => setValue('cte', 'cteValidDate', event.target.value)} /></Field>
        <Field label="Plant Location"><input className="form-input" value={client.cte.plantLocation || ''} onChange={(event) => setValue('cte', 'plantLocation', event.target.value)} /></Field>
        <Field label="CTE Document Upload"><UploadButton onChange={(value) => setValue('cte', 'cteDocument', value)} /></Field>
      </div>
      <DynamicTable
        title="CTE Production Quantity per Year"
        rows={client.cteProductionRows}
        columns={[['productName', 'Product Name'], ['capacity', 'Maximum Production Capacity / Year']]}
        onAdd={() => addRow('cteProductionRows', { productName: '', capacity: '' })}
        onUpdate={(index, field, value) => updateRow('cteProductionRows', index, field, value)}
        onRemove={(index) => removeRow('cteProductionRows', index)}
      />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="CTO/CCA Consent Order No."><input className="form-input" value={client.cte.ctoOrderNo || ''} onChange={(event) => setValue('cte', 'ctoOrderNo', event.target.value)} /></Field>
        <Field label="CTO/CCA Date of Issue"><input type="date" className="form-input" value={client.cte.ctoIssueDate || ''} onChange={(event) => setValue('cte', 'ctoIssueDate', event.target.value)} /></Field>
        <Field label="CTO/CCA Valid upto Date"><input type="date" className="form-input" value={client.cte.ctoValidDate || ''} onChange={(event) => setValue('cte', 'ctoValidDate', event.target.value)} /></Field>
        <Field label="CTO/CCA Document Upload"><UploadButton onChange={(value) => setValue('cte', 'ctoDocument', value)} /></Field>
      </div>
      <DynamicTable
        title="CTO/CCA Product Quantity"
        rows={client.ctoProductRows}
        columns={[['productName', 'Name Of The Product'], ['quantity', 'Quantity']]}
        onAdd={() => addRow('ctoProductRows', { productName: '', quantity: '' })}
        onUpdate={(index, field, value) => updateRow('ctoProductRows', index, field, value)}
        onRemove={(index) => removeRow('ctoProductRows', index)}
      />
    </Card>
  );
}

function CpcbTab({ client, setValue }) {
  return (
    <Card title="CPCB Details">
      <div className="grid gap-5 md:grid-cols-2">
        <SelectLike required label="CPCB Status" value={client.cpcb.status || ''} options={selectOptions.cpcbStatus} onChange={(value) => setValue('cpcb', 'status', value)} />
        <Field label="Remark"><textarea className="form-input min-h-[92px] resize-y py-3" value={client.cpcb.remark || ''} onChange={(event) => setValue('cpcb', 'remark', event.target.value)} /></Field>
        <Field label="CPCB Home page"><UploadButton onChange={(value) => setValue('cpcb', 'homePageFile', value)} /></Field>
        <Field label="CPCB Registration Number"><input className="form-input" value={client.cpcb.registrationNumber || ''} onChange={(event) => setValue('cpcb', 'registrationNumber', event.target.value)} /></Field>
        <Field label="Date of Application"><input type="date" className="form-input" value={client.cpcb.applicationDate || ''} onChange={(event) => setValue('cpcb', 'applicationDate', event.target.value)} /></Field>
        <Field label="Date of Application Approval"><input type="date" className="form-input" value={client.cpcb.approvalDate || ''} onChange={(event) => setValue('cpcb', 'approvalDate', event.target.value)} /></Field>
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
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Quotation Number"><input className="form-input" value={client.validation.quotationNumber || ''} onChange={(event) => setValue('validation', 'quotationNumber', event.target.value)} /></Field>
        <Field label="Quotation Date"><input type="date" className="form-input" value={client.validation.quotationDate || ''} onChange={(event) => setValue('validation', 'quotationDate', event.target.value)} /></Field>
        <Field label="Quotation Document"><UploadButton onChange={(value) => setValue('validation', 'quotationDocument', value)} /></Field>
        <Field label="Initial Purchase Order Number"><input className="form-input" value={client.validation.poNumber || ''} onChange={(event) => setValue('validation', 'poNumber', event.target.value)} /></Field>
        <Field label="Initial Purchase Order Date"><input type="date" className="form-input" value={client.validation.poDate || ''} onChange={(event) => setValue('validation', 'poDate', event.target.value)} /></Field>
        <Field label="Initial Purchase Order Document"><UploadButton onChange={(value) => setValue('validation', 'poDocument', value)} /></Field>
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
        {includePan && <Field label={`${title} PAN Document`}><UploadButton onChange={(value) => setValue(section, 'panDocument', value)} /></Field>}
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
                {uploadColumn && <td className="px-4 py-3"><UploadButton onChange={(value) => onUpdate(index, 'file', value)} /></td>}
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

function UploadButton({ onChange }) {
  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  }

  return (
    <label className="btn-lift inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-700 hover:bg-slate-50">
      <Upload className="h-4 w-4" /> Upload
      <input type="file" className="sr-only" onChange={handleFile} />
    </label>
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
