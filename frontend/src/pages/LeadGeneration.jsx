import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle2, ChevronDown, ContactRound, Download, Eye, MapPin, Pencil, Plus, RefreshCw, Search, TrendingUp, Upload, UserCheck, UserPlus, UsersRound, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import DashboardShell from '../components/dashboard/DashboardShell';
import CrmConnectButton from '../components/dashboard/CrmConnectButton';
import ProfileModal from '../components/dashboard/ProfileModal';
import { apiService, getApiErrorMessage, uploadMedia, uploadMediaFiles } from '../services/api';
import { adminRoles } from '../constants/dashboard';

const defaultComplianceObservations = [
  { srNo: '1', area: 'Part A General Information', observation: '', potentialRisk: '', screenshotReference: '' },
  { srNo: '2', area: 'Part B Liquid and gaseous emissions', observation: '', potentialRisk: '', screenshotReference: '' },
  { srNo: '3', area: 'Part C Waste', observation: '', potentialRisk: '', screenshotReference: '' },
  { srNo: '4', area: 'Part D Waste Action Plan', observation: '', potentialRisk: '', screenshotReference: '' }
];

const defaultAnnualReturnObservations = [
  { srNo: '1', area: 'Annual Return', observation: '', potentialRisk: '', screenshotReference: '' }
];

const keyProductBrandOptions = [
  'Uploaded in shared folder'
];

const defaultChecklistReview = [
  ['1', 'PART A', 'Legal / Trade Name of Company'],
  ['2', 'PART A', 'Type of Company'],
  ['3', 'PART A', 'Type of Business'],
  ['4', 'PART A', 'CIN'],
  ['5', 'PART A', 'PAN'],
  ['6', 'PART A', 'Registered Address'],
  ['7', 'Authorized Person Details', 'Name'],
  ['8', 'Authorized Person Details', 'Designation'],
  ['9', 'Authorized Person Details', 'PAN'],
  ['10', 'Authorized Person Details', 'Mobile Number'],
  ['11', 'Authorized Person Details', 'Email ID'],
  ['12', 'Operational & Production Details', 'States/UTs where PIBO operates'],
  ['13', 'Operational & Production Details', 'Confirmation of Production Facility'],
  ['14', 'Operational & Production Details', 'Total Capital Invested in the Project'],
  ['15', 'Operational & Production Details', 'Year of Commencement of Operations'],
  ['16', 'Documents Uploaded on Portal', 'Company PAN, CIN & GST'],
  ['17', 'Documents Uploaded on Portal', 'Authorized Person PAN'],
  ['18', 'Documents Uploaded on Portal', 'Product details and quantity'],
  ['19', 'PART B', 'Air / Water Consent'],
  ['20', 'PART C', 'Raw plastic material details'],
  ['21', 'PART C', 'Plastic raw material sold details'],
  ['22', 'PART D', 'Geo-tagged photographs of facility'],
  ['23', 'PART D', 'Picture of machine'],
  ['24', 'PART D', 'Electricity bill'],
  ['25', 'PART D', 'Covering Letter'],
  ['26', 'PART D', 'Scanned Signature'],
  ['27', 'PART D', 'Any other supporting information']
].map(([srNo, part, complianceRequirement]) => ({ srNo, part, complianceRequirement, status: '', remark: '' }));

function createEmptyComplianceReport() {
  return {
    yearOfCommencement: '',
    establishmentDate: '',
    organizationType: '',
    keyProductsBrands: '',
    sharedFolderUploads: [],
    productCategory: '',
    eprRegistrationNumber: '',
    financialYearReviewed: '',
    objectiveReview: '',
    keyObservations: defaultComplianceObservations.map((item) => ({ ...item })),
    annualReturnObservations: defaultAnnualReturnObservations.map((item) => ({ ...item })),
    checklistReview: defaultChecklistReview.map((item) => ({ ...item })),
    conclusion: '',
    recommendations: '',
    finalNotes: [{ conclusion: '', recommendations: '' }],
    screenshotReferences: [],
    reviewedConfirmation: false
  };
}

const emptyLead = {
  sourceLeadId: '',
  communicationMode: '',
  status: '',
  company: '',
  industryType: '',
  eprCategory: '',
  piboParent: '',
  piboCategory: '',
  servicesOffered: '',
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  landmark: '',
  state: '',
  city: '',
  pinCode: '',
  gstNumber: '',
  existingClient: 'No',
  website: '',
  salutation: '',
  contactPerson: '',
  designation: '',
  emails: '',
  emailsSentCount: '',
  lastEmailSent: '',
  mobileNo1: '',
  mobileNo2: '',
  businessCardUrl: '',
  referredBy: '',
  source: '',
  notes: '',
  assignedTo: '',
  assignedToText: '',
  closedBy: '',
  importedCreatedBy: '',
  leadDate: '',
  nextFollowUpDate: '',
  nextFollowUpTime: '',
  followUpRemarks: '',
  importedCreatedAt: '',
  importedUpdatedAt: '',
  complianceHealthReport: createEmptyComplianceReport()
};

const tabs = [
  { id: 'basic', label: 'Company', icon: Building2 },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'contact', label: 'Contact', icon: ContactRound },
  { id: 'assign', label: 'Assign', icon: UserCheck }
];

const options = {
  communicationMode: ['TeleCalling', 'Referral', 'Physical Visit', 'Campaign', 'Existing Client' , 'Web Database'],
  status: ['Potential - Interested', 'Potential - Not Interested', 'Need Assistance', 'Lost', 'Existing Client'],
  industryType: ["Automotive", "Chemicals", "Construction", "Consumer Goods", "E-commerce" , "Electronics" , "Energy" , "FMCG","Financial Services" , "Healthcare" , "Hospitality", "IT & Software" , "Logistics" , "Manufacturing","Pharmaceuticals", "Renewables", "Retail", "Telecom", "Waste Management", "Other" , "Food Manufacturing" , "Mechinical Industry" ,"Petrochemical", "Packaging Manufacture" , "Plastic Recycling" , "E-Waste Recycler" , "E-Waste Recycling"],
  eprCategory:  ["EPR - Plastic Waste", "EPR - E-Waste", "EPR - Battery Waste", "EPR - Paper Waste", "EPR - Water Waste", "EPR - C&D Waste", "EPR - Tyre Waste" , "EPR - Used Oil Waste" , "EPR - End of Life Vehicles" , "EPR - Non Ferrous"],
  piboParent: ['PIBO', 'SIMP', 'PWP'],
  piboCategory: {
    PIBO: ['Producer', 'Brand Owner', 'Importer'],
    SIMP: ['Producer (Small & Micro)', 'Importer of Raw Material', 'Manufacturer of Raw Material', 'Seller'],
    PWP: ['Recycler', 'Waste to Energy', 'Waste to Oil', 'Cement Co-processing']
  },
  servicesOffered:["EPR - Plastic Compliance", "Monthly Patraka", "ISO Certification", "N/A" , "CTE-CTO/CCA" , "EPR - E-Waste Compliance", "EPR - Battery Waste Compliance" , "C & D WASTE CONSULTANCY" , "EPR DIGITAL CREDIT" , "EPR - Used Oil Compliance" , "EPR - Waster Waste Compliance" , "EPR ETP Portal handling" , "Registration for Compositable Plastic"],
  states: [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
  "Puducherry"
],
  cities: ['Ahmedabad', 'Bengaluru', 'Delhi', 'Jaipur', 'Mumbai', 'Noida', 'Pune'],
    salutations: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prfo." , "ER.","CA", "Adv."],
  designation: ["Manager", "Assistant Manager", "Compliance Head", "Compliance Officer", "Director", "Managing Director", "Partner" , "Proprietor" , "Operations Head" , "Sales Head" , "Purchase Head" , "Owner" , "CEO" , "CTO" , "CFO" , "Consultant" , "Executive" , "Officer" , "ASSITANT MANAGER" , "Other" , "Senior Executive - EHS" , "GENERAL MANAGER" , "Assistant Manager -EHS" , "Chief Accountant" , "HR & ACCOUNTS" , "Plant Accounts Manager" , "Company Secratary (CS)" , "Accounts Manager" , "Sales coordination" , "Purchase" , "AGM-Corporate Quality & MR", "HSE" , "Accountant" , "Manager - Environment Health & Safety" , "Sr Manager Procurement" , "HEAD- PRODUCTION & MAINTAINANCE - OPERATIONS" , "FOUNDER & CEO" , "Sr. Manager, Procurement" , "Global Procurement" , "PepsiCo Positive" , "Executive Purchase" , "HEAD-BUSINESS OPERATIONS" , "EHS" , "Sr. Executive Sustainability" , "Asst. Manager (Supply Chain)" , "Manager Environment" , "VICE PRESIDENT" , "Account Executive" , "EHS Manager – MRS" , "PLANT MANAGER" , "FOUNDER" , "Manager, HR & Admin" , "Business Head" , "Global Head-Collaborative ventures" , "General Service and Supplies, Global Procurement & Logistics, India" , "Commercial Executive" , "Sr. Officer (Eng.)" , "Joint Manager – Engineering Procurement"],
  source: ['Referral', 'Website', 'LinkedIn', 'Cold Call', 'Event', 'Existing Client']
};

const stateCities = {
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  Delhi: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'Uttar Pradesh': ['Noida', 'Lucknow', 'Kanpur', 'Ghaziabad', 'Varanasi'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Sonipat'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa']
};

export default function LeadGeneration() {
  const [currentUser, setCurrentUser] = useState(null);
  const canBulkImport = adminRoles.includes(currentUser?.role);
  const [profileOpen, setProfileOpen] = useState(false);
  const [staff, setStaff] = useState([]);
  const [leads, setLeads] = useState([]);
  const [nextLeadCode, setNextLeadCode] = useState('ATPL-0001');
  const [lead, setLead] = useState(emptyLead);
  const [editingLeadId, setEditingLeadId] = useState('');
  const [viewLead, setViewLead] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [viewMode, setViewMode] = useState('form');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelRows, setExcelRows] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [submitPromptOpen, setSubmitPromptOpen] = useState(false);
  const [plainSubmitConfirmed, setPlainSubmitConfirmed] = useState(false);
  const [reportSubmitPromptOpen, setReportSubmitPromptOpen] = useState(false);
  const [reportReviewed, setReportReviewed] = useState(false);
  const navigate = useNavigate();

  const isFirstStepReady = Boolean(lead.status && lead.company && lead.piboParent && lead.piboCategory && lead.servicesOffered);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  const staffOptions = useMemo(() => staff.map((user) => ({
    value: user._id || user.id,
    label: user.name || user.email,
    secondary: `${user.team || 'No team'} · ${user.role || 'User'}`,
    search: `${user.name || ''} ${user.email || ''} ${user.team || ''} ${user.role || ''}`.toLowerCase()
  })), [staff]);
  const cityOptions = lead.state ? stateCities[lead.state] || [] : [];
  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadPage() {
    setLoading(true);
    try {
      const meResponse = await apiService.auth.getMe();
      setCurrentUser(meResponse.data.user);
      const leadsResponse = await apiService.leads.getList();
      setLeads(leadsResponse.data.leads || []);
      setNextLeadCode(leadsResponse.data.nextLeadCode || 'ATPL-0001');
      try {
        const usersResponse = await apiService.auth.getUsers();
        setStaff(usersResponse.data.users || []);
      } catch {
        setStaff([meResponse.data.user]);
      }
    } catch {
      localStorage.removeItem('token');
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setLead((current) => ({
      ...current,
      [field]: value,
      ...(field === 'state' ? { city: '' } : {})
    }));
  }

  function updateReportField(field, value) {
    setLead((current) => ({
      ...current,
      complianceHealthReport: {
        ...createEmptyComplianceReport(),
        ...(current.complianceHealthReport || {}),
        [field]: value
      }
    }));
  }

  function updateReportRow(section, index, field, value) {
    setLead((current) => {
      const report = { ...createEmptyComplianceReport(), ...(current.complianceHealthReport || {}) };
      const rows = (report[section] || []).map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row));
      return { ...current, complianceHealthReport: { ...report, [section]: rows } };
    });
  }

  function addReportRow(section, row) {
    setLead((current) => {
      const report = { ...createEmptyComplianceReport(), ...(current.complianceHealthReport || {}) };
      return { ...current, complianceHealthReport: { ...report, [section]: [...(report[section] || []), row] } };
    });
  }

  function removeReportRow(section, index) {
    setLead((current) => {
      const report = { ...createEmptyComplianceReport(), ...(current.complianceHealthReport || {}) };
      return { ...current, complianceHealthReport: { ...report, [section]: (report[section] || []).filter((_, rowIndex) => rowIndex !== index) } };
    });
  }

  function showToast(message, type = 'info') {
    setToast({ message, type });
  }

  function openTab(tabId) {
    if (tabId !== 'basic' && !isFirstStepReady) {
      showToast('First complete Company, Status, PIBO Category and Services Offered.', 'warning');
      return;
    }
    setActiveTab(tabId);
    showToast(`${tabs.find((tab) => tab.id === tabId)?.label || 'Step'} step opened.`, 'success');
  }

  function nextTab() {
    if (!isFirstStepReady) {
      setError('Complete Company, Status, PIBO Category, and Services Offered before moving ahead.');
      showToast('Complete required first-step fields before next step.', 'warning');
      return;
    }
    setError('');
    const next = tabs[Math.min(activeIndex + 1, tabs.length - 1)];
    setActiveTab(next.id);
    showToast(`${next.label} step unlocked.`, 'success');
  }

  async function handleBusinessCard(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try { const uploaded = await uploadMedia(file, 'lead-business-cards'); updateField('businessCardUrl', uploaded.url); showToast('Business card uploaded to Cloudinary.', 'success'); }
    catch (error) { showToast(getApiErrorMessage(error, error.message || 'Cloudinary upload failed'), 'error'); }
  }

  async function handleScreenshotUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    let uploads;
    try { uploads = await uploadMediaFiles(files, 'lead-compliance-evidence'); }
    catch (error) { showToast(getApiErrorMessage(error, error.message || 'Cloudinary upload failed'), 'error'); return; }

    setLead((current) => {
      const report = { ...createEmptyComplianceReport(), ...(current.complianceHealthReport || {}) };
      return {
        ...current,
        complianceHealthReport: {
          ...report,
          screenshotReferences: [...(report.screenshotReferences || []), ...uploads]
        }
      };
    });
    showToast(`${uploads.length} screenshot${uploads.length === 1 ? '' : 's'} uploaded.`, 'success');
  }

  async function handleSharedFolderUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    let uploads;
    try { const cloudFiles = await uploadMediaFiles(files, 'lead-shared-folders'); uploads = cloudFiles.map((uploaded, index) => ({ ...uploaded, relativePath: files[index].webkitRelativePath || files[index].name })); }
    catch (error) { showToast(getApiErrorMessage(error, error.message || 'Cloudinary upload failed'), 'error'); return; }

    setLead((current) => {
      const report = { ...createEmptyComplianceReport(), ...(current.complianceHealthReport || {}) };
      return {
        ...current,
        complianceHealthReport: {
          ...report,
          sharedFolderUploads: [...(report.sharedFolderUploads || []), ...uploads]
        }
      };
    });
    showToast(`${uploads.length} shared folder file${uploads.length === 1 ? '' : 's'} added.`, 'success');
  }

  function removeSharedFolderUpload(index) {
    setLead((current) => {
      const report = { ...createEmptyComplianceReport(), ...(current.complianceHealthReport || {}) };
      return {
        ...current,
        complianceHealthReport: {
          ...report,
          sharedFolderUploads: (report.sharedFolderUploads || []).filter((_, itemIndex) => itemIndex !== index)
        }
      };
    });
  }

  function removeScreenshot(index) {
    setLead((current) => {
      const report = { ...createEmptyComplianceReport(), ...(current.complianceHealthReport || {}) };
      return {
        ...current,
        complianceHealthReport: {
          ...report,
          screenshotReferences: (report.screenshotReferences || []).filter((_, itemIndex) => itemIndex !== index)
        }
      };
    });
  }

  function resolveUserId(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const match = staff.find((user) => String(user.email || '').toLowerCase() === raw) ||
      staff.find((user) => String(user.name || '').toLowerCase() === raw);
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
        showToast('No sheet found in this file.', 'error');
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const parsed = rows
        .map((row) => mapExcelRowToLead(row, staff))
        .filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));

      if (!parsed.length) {
        showToast('Excel has no usable rows.', 'warning');
        return;
      }

      setExcelRows(parsed);
      setLead({ ...emptyLead, ...parsed[0], assignedTo: resolveUserId(parsed[0].assignedTo) || parsed[0].assignedTo });
      setActiveTab('basic');
      showToast(`Loaded ${parsed.length} lead${parsed.length === 1 ? '' : 's'} from Excel. First row applied to form.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Unable to read Excel file. Please upload a valid .xlsx file.', 'error');
    }
  }

  async function importExcelRows() {
    if (!excelRows.length) return;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const payload = excelRows.map((row) => {
        const assignedToText = row.assignedToText || row.assignedTo || '';
        return {
          ...row,
          assignedToText,
          existingClient: normalizeExistingClient(row.existingClient),
          assignedTo: resolveUserId(row.assignedTo || assignedToText) || '',
          workflowStatus: 'draft'
        };
      });
      const response = await apiService.leads.bulkImport(payload);
      const successCount = response.data.imported || 0;
      const failures = response.data.failures || [];
      const warnings = response.data.warnings || [];

      if (successCount) {
        setNotice(`${successCount} lead${successCount === 1 ? '' : 's'} imported as drafts.`);
        showToast(`${successCount} lead${successCount === 1 ? '' : 's'} imported.`, 'success');
        await loadPage();
      }
      if (failures.length) {
        const message = `${failures.length} row${failures.length === 1 ? '' : 's'} failed. First: row ${failures[0].row} (${failures[0].error})`;
        setError(message);
        showToast(message, 'error');
      } else if (warnings.length) {
        showToast(`${warnings.length} import warning${warnings.length === 1 ? '' : 's'}. First: row ${warnings[0].row} (${warnings[0].warning})`, 'warning');
      }
    } catch (err) {
      const failures = err?.response?.data?.failures || [];
      const message = failures.length
        ? `${failures.length} row${failures.length === 1 ? '' : 's'} failed. First: row ${failures[0].row} (${failures[0].error})`
        : getApiErrorMessage(err, 'Unable to import leads');
      setError(message);
      showToast(message, 'error');
    } finally {
      setImporting(false);
    }
  }

  async function saveLead(workflowStatus, reportOverride) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...lead,
        complianceHealthReport: reportOverride || lead.complianceHealthReport,
        workflowStatus
      };
      if (editingLeadId) await apiService.leads.update(editingLeadId, payload);
      else await apiService.leads.create(payload);
      setNotice(workflowStatus === 'submitted' ? 'Lead submitted successfully.' : 'Lead draft saved successfully.');
      showToast(workflowStatus === 'submitted' ? 'Lead submitted successfully.' : 'Lead draft saved successfully.', 'success');
      if (workflowStatus === 'submitted') setLead(emptyLead);
      setEditingLeadId('');
      setActiveTab('basic');
      await loadPage();
      if (workflowStatus === 'submitted') setViewMode('form');
      return true;
    } catch (err) {
      const message = getApiErrorMessage(err, 'Unable to save lead');
      setError(message);
      showToast(message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openSubmitPrompt() {
    setPlainSubmitConfirmed(false);
    setSubmitPromptOpen(true);
  }

  function continueToComplianceReport() {
    setSubmitPromptOpen(false);
    setPlainSubmitConfirmed(false);
    setReportReviewed(false);
    setViewMode('complianceReport');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitWithoutComplianceReport() {
    if (!plainSubmitConfirmed) return;
    setSubmitPromptOpen(false);
    await saveLead('submitted');
  }

  async function submitComplianceReport() {
    if (!reportReviewed) return;
    const report = {
      ...createEmptyComplianceReport(),
      ...(lead.complianceHealthReport || {}),
      reviewedConfirmation: true,
      submittedAt: new Date().toISOString()
    };
    const saved = await saveLead('submitted', report);
    if (saved) {
      setReportSubmitPromptOpen(false);
      setReportReviewed(false);
      setViewMode('form');
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
        <LeadDirectoryView
          leads={leads}
          staff={staff}
          loading={loading}
          onRefresh={loadPage}
          onAddNew={() => {
            setLead(emptyLead);
            setEditingLeadId('');
            setActiveTab('basic');
            setViewMode('form');
          }}
          onView={setViewLead}
          onEdit={(item) => {
            setLead({
              ...emptyLead,
              ...item,
              assignedTo: item.assignedTo?._id || item.assignedTo?.id || resolveUserId(item.assignedTo?.name || item.assignedToText) || '',
              closedBy: item.closedBy?._id || item.closedBy?.id || resolveUserId(item.closedBy?.name || item.closedByText) || ''
            });
            setEditingLeadId(item._id || item.id);
            setActiveTab('basic');
            setViewMode('form');
          }}
        />
        {profileOpen && <ProfileModal user={currentUser} saving={false} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onSave={() => {}} onUpdatePassword={() => {}} />}
        {viewLead && <LeadViewModal lead={viewLead} onClose={() => setViewLead(null)} />}
      </DashboardShell>
    );
  }

  if (viewMode === 'complianceReport') {
    const report = { ...createEmptyComplianceReport(), ...(lead.complianceHealthReport || {}) };
    return (
      <DashboardShell currentUser={currentUser} onOpenProfile={() => setProfileOpen(true)} onLogout={handleLogout}>
        {toast && (
          <div className="fixed right-5 top-24 z-[70] w-[min(360px,calc(100vw-40px))] animate-toast-in rounded-2xl border border-white/70 bg-white p-4 shadow-2xl shadow-slate-900/20">
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-3 w-3 rounded-full ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
              <p className="min-w-0 flex-1 text-sm font-black text-slate-800">{toast.message}</p>
              <button type="button" onClick={() => setToast(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <ComplianceHealthReportView
          lead={lead}
          report={report}
          saving={saving}
          onBack={() => setViewMode('form')}
          onUpdateField={updateReportField}
          onUpdateRow={updateReportRow}
          onAddRow={addReportRow}
          onRemoveRow={removeReportRow}
          onScreenshotUpload={handleScreenshotUpload}
          onRemoveScreenshot={removeScreenshot}
          onSharedFolderUpload={handleSharedFolderUpload}
          onRemoveSharedFolderUpload={removeSharedFolderUpload}
          onOpenSubmit={() => {
            setReportReviewed(false);
            setReportSubmitPromptOpen(true);
          }}
        />
        {reportSubmitPromptOpen && (
          <ReportSubmitPrompt
            checked={reportReviewed}
            saving={saving}
            onCheckedChange={setReportReviewed}
            onClose={() => setReportSubmitPromptOpen(false)}
            onSubmit={submitComplianceReport}
          />
        )}
        {profileOpen && <ProfileModal user={currentUser} saving={false} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onSave={() => {}} onUpdatePassword={() => {}} />}
      </DashboardShell>
    );
  }

  return (
    <DashboardShell currentUser={currentUser} onOpenProfile={() => setProfileOpen(true)} onLogout={handleLogout}>
      {toast && (
        <div className="fixed right-5 top-24 z-[70] w-[min(360px,calc(100vw-40px))] animate-toast-in rounded-2xl border border-white/70 bg-white p-4 shadow-2xl shadow-slate-900/20">
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 rounded-full ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
            <p className="min-w-0 flex-1 text-sm font-black text-slate-800">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-sm ring-1 ring-emerald-100 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => navigate('/dashboard')} className="btn-lift inline-flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-700 shadow-sm">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Sales</p>
                <h1 className="mt-1 text-3xl font-black text-slate-950">Lead Generator</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CrmConnectButton />
              <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Step {activeIndex + 1} of {tabs.length}</p>
                <p className="mt-1 font-black text-emerald-700">{isFirstStepReady ? 'Workflow unlocked' : 'Complete first step'}</p>
              </div>
            </div>
          </div>

          {canBulkImport && <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-950">Excel upload (Lead Import)</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Upload .xlsx with your headers: Company, Status, PIBO Category, Services Offered, Address, City, PIN, State, Contact Person.
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
          </div>}

          <section className="mt-6 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 p-3 shadow-lg shadow-emerald-900/5">
            <div className="grid gap-2 sm:grid-cols-4">
              {tabs.map((tab, index) => {
                const Icon = tab.icon;
                const locked = tab.id !== 'basic' && !isFirstStepReady;
                const active = activeTab === tab.id;
                const complete = index === 0 && isFirstStepReady;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => openTab(tab.id)}
                    aria-disabled={locked}
                    title={locked ? 'Complete first step to unlock this tab' : tab.label}
                    className={`group relative min-h-14 overflow-hidden rounded-xl px-4 font-black transition duration-300 ${
                      active
                        ? 'bg-[#30737B] text-white shadow-lg shadow-teal-900/15'
                        : locked
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                          : 'bg-white text-slate-600 hover:bg-teal-50 hover:text-[#30737B]'
                    }`}
                  >
                    <span className={`absolute inset-x-0 bottom-0 h-1 transition ${active ? 'bg-cyan-200' : 'bg-transparent'}`} />
                    <span className="relative flex items-center justify-center gap-2">
                      {complete ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Icon className="h-5 w-5" />}
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
          {notice && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {activeTab === 'basic' && (
              <div className="grid gap-7">
                <LeadSection title="Client Communication Mode">
                  <SelectLike label="Client Communication Mode" value={lead.communicationMode} options={options.communicationMode} onChange={(value) => updateField('communicationMode', value)} />
                  <SelectLike required label="Status" value={lead.status} options={options.status} onChange={(value) => updateField('status', value)} />
                </LeadSection>
                <LeadSection title="Company Information">
                  <Field label="Lead ID">
                    <input className="form-input bg-slate-50 text-slate-500" value={lead.leadCode || nextLeadCode} readOnly />
                  </Field>
                  <Field required label="Company"><input className="form-input" value={lead.company} onChange={(event) => updateField('company', event.target.value)} /></Field>
                  <SelectLike label="Industry Type" value={lead.industryType} options={options.industryType} onChange={(value) => updateField('industryType', value)} />
                  <SelectLike label="EPR Category" value={lead.eprCategory} options={options.eprCategory} onChange={(value) => updateField('eprCategory', value)} />
                  <SelectLike required label="Applicant Type" value={lead.piboParent} options={options.piboParent} placeholder="Select PIBO, SIMP or PWP" onChange={(value) => setLead((current) => ({ ...current, piboParent: value, piboCategory: '' }))} />
                  {lead.piboParent && <SelectLike required label={`${lead.piboParent} Category`} value={lead.piboCategory} options={options.piboCategory[lead.piboParent] || []} placeholder={`Select ${lead.piboParent} category`} onChange={(value) => updateField('piboCategory', value)} />}
                  <SelectLike required label="Services Offered" value={lead.servicesOffered} options={options.servicesOffered} onChange={(value) => updateField('servicesOffered', value)} />
                </LeadSection>
              </div>
            )}

            {activeTab === 'address' && (
              <LeadSection title="Address Information">
                <Field required label="Address Line 1"><input className="form-input" value={lead.addressLine1} onChange={(event) => updateField('addressLine1', event.target.value)} /></Field>
                <Field label="Address Line 2"><input className="form-input" value={lead.addressLine2} onChange={(event) => updateField('addressLine2', event.target.value)} /></Field>
                <Field label="Address Line 3"><input className="form-input" value={lead.addressLine3} onChange={(event) => updateField('addressLine3', event.target.value)} /></Field>
                <Field label="Landmark"><input className="form-input" value={lead.landmark} onChange={(event) => updateField('landmark', event.target.value)} /></Field>
                <SelectLike required label="State" value={lead.state} options={options.states} onChange={(value) => updateField('state', value)} />
                <SelectLike required label="City" value={lead.city} options={cityOptions} disabled={!lead.state} placeholder={lead.state ? 'Select or type to create new' : 'Select state first'} onChange={(value) => updateField('city', value)} />
                <Field required label="PIN Code"><input className="form-input" value={lead.pinCode} onChange={(event) => updateField('pinCode', event.target.value)} /></Field>
                <Field label="GST Number">
                  <input
                    className="form-input uppercase"
                    placeholder="Enter 15-character GST number"
                    maxLength={15}
                    value={lead.gstNumber}
                    onChange={(event) => updateField('gstNumber', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  />
                  <span className="mt-1 block text-right text-xs font-bold text-slate-400">{lead.gstNumber.length}/15</span>
                </Field>
                <Field label="Existing Client?"><select className="form-input" value={lead.existingClient} onChange={(event) => updateField('existingClient', event.target.value)}><option>No</option><option>Yes</option></select></Field>
                <Field label="Website"><input className="form-input" placeholder="https://example.com" value={lead.website} onChange={(event) => updateField('website', event.target.value)} /></Field>
              </LeadSection>
            )}

            {activeTab === 'contact' && (
              <div className="grid gap-7">
                <LeadSection title="Contact Information">
                  <SelectLike label="Salutation" value={lead.salutation} options={options.salutations} onChange={(value) => updateField('salutation', value)} />
                  <Field label="Contact Person"><input className="form-input" value={lead.contactPerson} onChange={(event) => updateField('contactPerson', event.target.value)} /></Field>
                  <SelectLike label="Designation" value={lead.designation} options={options.designation} onChange={(value) => updateField('designation', value)} />
                  <Field label="Email(s)"><input className="form-input" placeholder="email@example.com, email2@example.com" value={lead.emails} onChange={(event) => updateField('emails', event.target.value)} /></Field>
                  <Field label="Mobile No. 1"><input className="form-input" value={lead.mobileNo1} onChange={(event) => updateField('mobileNo1', event.target.value)} /></Field>
                  <Field label="Mobile No. 2"><input className="form-input" value={lead.mobileNo2} onChange={(event) => updateField('mobileNo2', event.target.value)} /></Field>
                  <Field label="Business Card">
                    <div className="grid gap-3">
                      <input className="form-input" placeholder="Business Card URL" value={lead.businessCardUrl} onChange={(event) => updateField('businessCardUrl', event.target.value)} />
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-lift inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-black text-slate-800 hover:bg-slate-50">
                          <Upload className="h-4 w-4" /> Upload
                          <input type="file" accept="image/*,.pdf" onChange={handleBusinessCard} className="sr-only" />
                        </label>
                        {lead.businessCardUrl && (
                          <button type="button" onClick={() => window.open(lead.businessCardUrl, '_blank', 'noopener,noreferrer')} className="btn-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 font-black text-emerald-700 hover:bg-emerald-100">
                            <Eye className="h-4 w-4" /> View
                          </button>
                        )}
                      </div>
                    </div>
                  </Field>
                </LeadSection>
                <LeadSection title="Additional Information" columns="lg:grid-cols-2">
                  <SelectLike label="Referred By" value={lead.referredBy} options={staffOptions.map((item) => item.label)} onChange={(value) => updateField('referredBy', value)} />
                  <SelectLike label="Source" value={lead.source} options={options.source} onChange={(value) => updateField('source', value)} />
                  <Field label="Emails Sent Count"><input className="form-input" value={lead.emailsSentCount} onChange={(event) => updateField('emailsSentCount', event.target.value)} /></Field>
                  <Field label="Last Email Sent"><input className="form-input" value={lead.lastEmailSent} onChange={(event) => updateField('lastEmailSent', event.target.value)} /></Field>
                  <Field label="Lead Date"><input className="form-input" value={lead.leadDate} onChange={(event) => updateField('leadDate', event.target.value)} /></Field>
                  <Field label="Next Follow-Up Date"><input className="form-input" value={lead.nextFollowUpDate} onChange={(event) => updateField('nextFollowUpDate', event.target.value)} /></Field>
                  <Field label="Next Follow-Up Time"><input className="form-input" value={lead.nextFollowUpTime} onChange={(event) => updateField('nextFollowUpTime', event.target.value)} /></Field>
                  <Field label="Follow-Up Remarks"><input className="form-input" value={lead.followUpRemarks} onChange={(event) => updateField('followUpRemarks', event.target.value)} /></Field>
                  <Field label="Notes" className="lg:col-span-2"><textarea className="form-input min-h-[120px] resize-y py-3" value={lead.notes} onChange={(event) => updateField('notes', event.target.value)} /></Field>
                </LeadSection>
              </div>
            )}

            {activeTab === 'assign' && (
              <LeadSection title="Assign Lead" columns="grid-cols-1">
                <UserSelect label="Assign To Staff" value={lead.assignedTo} options={staffOptions} onChange={(value) => updateField('assignedTo', value)} allowClear />
                <UserSelect label="Lead Closed By" value={lead.closedBy} options={staffOptions} onChange={(value) => updateField('closedBy', value)} allowClear />
              </LeadSection>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setLead(emptyLead); setEditingLeadId(''); setActiveTab('basic'); }} className="btn-lift min-h-11 rounded-xl border border-slate-200 px-8 font-black text-slate-700">Cancel</button>
              <button type="button" disabled={saving} onClick={() => saveLead('draft')} className="btn-lift min-h-11 rounded-xl border border-orange-200 px-8 font-black text-orange-600 hover:bg-orange-50">Save Draft</button>
              {activeTab === 'assign' ? (
                <button type="button" disabled={saving} onClick={openSubmitPrompt} className="btn-lift min-h-11 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 font-black text-white shadow-lg shadow-orange-600/20">Submit</button>
              ) : (
                <button type="button" onClick={nextTab} className="btn-lift min-h-11 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-8 font-black text-white shadow-lg shadow-emerald-700/20">Next Step</button>
              )}
            </div>
          </section>
        </div>
      </div>
      {submitPromptOpen && (
        <LeadSubmitPrompt
          confirmed={plainSubmitConfirmed}
          saving={saving}
          onConfirmChange={setPlainSubmitConfirmed}
          onClose={() => setSubmitPromptOpen(false)}
          onYes={continueToComplianceReport}
          onNoSubmit={submitWithoutComplianceReport}
        />
      )}
      {profileOpen && <ProfileModal user={currentUser} saving={false} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onSave={() => {}} onUpdatePassword={() => {}} />}
    </DashboardShell>
  );
}

function LeadSection({ title, children, columns = 'sm:grid-cols-2 xl:grid-cols-3' }) {
  return (
    <section>
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <div className={`mt-5 grid gap-5 ${columns}`}>{children}</div>
    </section>
  );
}

function pdfEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function generateComplianceReportPdf(lead, report) {
  const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!reportWindow) {
    window.alert('Please allow pop-ups, then click Download PDF again.');
    return;
  }
  const value = (input) => input ? pdfEscape(input) : '<span class="missing">Not provided</span>';
  const rows = (items, columns) => (items || []).length
    ? items.map((item) => `<tr>${columns.map(([key]) => `<td>${value(item[key])}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" class="missing">No records provided</td></tr>`;
  const observationColumns = [['srNo', 'Sr. No.'], ['area', 'Area / Section'], ['observation', 'Observation'], ['potentialRisk', 'Potential Risk'], ['screenshotReference', 'Evidence Reference']];
  const checklistColumns = [['srNo', 'Sr. No.'], ['part', 'Part'], ['complianceRequirement', 'Compliance Requirement'], ['status', 'Status'], ['remark', 'Remark']];
  const checklist = report.checklistReview || [];
  const compliant = checklist.filter((item) => /^(yes|complied|complete|available|ok)$/i.test(String(item.status || '').trim())).length;
  const reviewed = checklist.filter((item) => String(item.status || '').trim()).length;
  const score = checklist.length ? Math.round((compliant / checklist.length) * 100) : 0;
  const status = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Critical';
  const statusClass = score >= 80 ? 'healthy' : score >= 50 ? 'attention' : 'critical';
  const generated = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const evidence = [...(report.sharedFolderUploads || []), ...(report.screenshotReferences || [])];
  const finalNotes = report.finalNotes?.length ? report.finalNotes : [{ conclusion: report.conclusion, recommendations: report.recommendations }];
  const table = (title, columns, items) => `<section><h2>${title}</h2><table><thead><tr>${columns.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${rows(items, columns)}</tbody></table></section>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Compliance Health Report - ${pdfEscape(lead.company || 'Lead')}</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#17233b;font:11px Arial,sans-serif;line-height:1.45}.cover{background:#0f684f;color:white;padding:28px;border-radius:12px;border-bottom:7px solid #ff5108}.cover small{letter-spacing:2px;text-transform:uppercase;color:#a8dfcf;font-weight:bold}.cover h1{font-size:27px;margin:8px 0}.cover p{margin:3px 0;color:#def4ed}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.metric{border:1px solid #d8e4e0;border-radius:9px;padding:11px}.metric span{display:block;color:#687873;font-size:9px;text-transform:uppercase;font-weight:bold}.metric strong{font-size:18px}.healthy{color:#087443}.attention{color:#d97706}.critical{color:#c62828}section{margin-top:14px;break-inside:avoid}h2{margin:0;padding:8px 10px;background:#eaf6f2;border-left:4px solid #ff5108;color:#0f684f;font-size:14px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #dbe4e1;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f5f8f7;font-size:9px;text-transform:uppercase}.detail-grid{display:grid;grid-template-columns:1fr 1fr}.detail{border:1px solid #dbe4e1;padding:8px}.detail b{display:block;color:#60716c;font-size:9px;text-transform:uppercase}.text-block{white-space:pre-wrap;border:1px solid #dbe4e1;padding:10px;min-height:45px}.missing{color:#9b5c3b;font-style:italic}.evidence{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.evidence-card{border:1px solid #dbe4e1;padding:8px;border-radius:7px;break-inside:avoid}.evidence-card img{width:100%;max-height:250px;object-fit:contain}.footer{margin-top:18px;padding-top:8px;border-top:1px solid #cdd9d5;color:#66756f;font-size:9px}.action{position:fixed;right:18px;bottom:18px;background:#ff5108;color:#fff;border:0;border-radius:9px;padding:12px 18px;font-weight:bold}@media print{.action{display:none}.cover,h2{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><header class="cover"><small>CCP • Compliance Intelligence</small><h1>COMPLIANCE HEALTH REPORT</h1><p><strong>${value(lead.company)}</strong></p><p>EPR Category: ${value(lead.eprCategory)} • PIBO Category: ${value(lead.piboCategory)}</p><p>Generated: ${pdfEscape(generated)}</p></header>
  <div class="metrics"><div class="metric"><span>Health Score</span><strong class="${statusClass}">${score}%</strong></div><div class="metric"><span>Overall Status</span><strong class="${statusClass}">${status}</strong></div><div class="metric"><span>Checklist Reviewed</span><strong>${reviewed}/${checklist.length}</strong></div><div class="metric"><span>Evidence Files</span><strong>${evidence.length}</strong></div></div>
  <section><h2>1. Lead & Company Overview</h2><div class="detail-grid">${[
    ['Company', lead.company], ['Industry Type', lead.industryType], ['Contact Person', lead.contactPerson], ['Mobile', lead.mobileNo1], ['Email', lead.emails], ['Address', [lead.addressLine1, lead.addressLine2, lead.addressLine3, lead.city, lead.state, lead.pinCode].filter(Boolean).join(', ')],
    ['Year of Commencement', report.yearOfCommencement], ['Year of Establishment', report.establishmentDate], ['Organization Type', report.organizationType], ['Key Products / Brands', report.keyProductsBrands], ['Product Category', report.productCategory], ['EPR Registration Number', report.eprRegistrationNumber], ['Financial Year Reviewed', report.financialYearReviewed]
  ].map(([label, item]) => `<div class="detail"><b>${label}</b>${value(item)}</div>`).join('')}</div></section>
  <section><h2>2. Objective of Review</h2><div class="text-block">${value(report.objectiveReview)}</div></section>
  ${table('3.1 Key Compliance Observations', observationColumns, report.keyObservations)}
  ${table('3.2 Annual Return Observations', observationColumns, report.annualReturnObservations)}
  ${table('4. Compliance Checklist Review', checklistColumns, checklist)}
  <section><h2>5. Conclusion & Recommendations</h2>${finalNotes.map((note, index) => `<div class="detail-grid"><div class="detail"><b>Conclusion ${index + 1}</b>${value(note.conclusion)}</div><div class="detail"><b>Recommendations ${index + 1}</b>${value(note.recommendations)}</div></div>`).join('')}</section>
  <section><h2>6. Evidence & Supporting Documents</h2><div class="evidence">${evidence.length ? evidence.map((file, index) => { const source = typeof file === 'string' ? file : (file.dataUrl || file.url || file.preview || ''); const name = typeof file === 'string' ? `Evidence ${index + 1}` : (file.name || `Evidence ${index + 1}`); const image = /^data:image|\.(png|jpe?g|webp|gif)(\?|$)/i.test(source); return `<div class="evidence-card"><b>${pdfEscape(name)}</b>${image ? `<img src="${pdfEscape(source)}" alt="Evidence ${index + 1}">` : `<p>${source ? 'Supporting document attached in CCP.' : 'File reference recorded.'}</p>`}</div>`; }).join('') : '<p class="missing">No evidence uploaded.</p>'}</div></section>
  <footer class="footer">System-generated Compliance Health Report based on data entered in CCP. It supports internal review and does not replace a statutory/legal audit.</footer><button class="action" onclick="window.print()">Download / Save PDF</button><script>setTimeout(function(){window.print()},500)</script></body></html>`;
  reportWindow.document.open(); reportWindow.document.write(html); reportWindow.document.close();
}

function ComplianceHealthReportView({
  lead,
  report,
  saving,
  onBack,
  onUpdateField,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onScreenshotUpload,
  onRemoveScreenshot,
  onSharedFolderUpload,
  onRemoveSharedFolderUpload,
  onOpenSubmit
}) {
  const finalNoteRows = Array.isArray(report.finalNotes) && report.finalNotes.length
    ? report.finalNotes
    : [{ conclusion: report.conclusion || '', recommendations: report.recommendations || '' }];
  const frozenFinalNotesRef = useRef(null);
  if (frozenFinalNotesRef.current === null) {
    frozenFinalNotesRef.current = new Set(
      finalNoteRows
        .map((row, index) => ((row.conclusion || row.recommendations) ? index : null))
        .filter((index) => index !== null)
    );
  }

  function updateFinalNote(index, field, value) {
    if (frozenFinalNotesRef.current?.has(index)) return;
    const nextRows = finalNoteRows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row));
    onUpdateField('finalNotes', nextRows);
    if (index === 0) onUpdateField(field, value);
  }

  function addFinalNote() {
    onUpdateField('finalNotes', [...finalNoteRows, { conclusion: '', recommendations: '' }]);
  }

  function removeFinalNote(index) {
    const nextRows = finalNoteRows.length > 1
      ? finalNoteRows.filter((_, rowIndex) => rowIndex !== index)
      : [{ conclusion: '', recommendations: '' }];
    frozenFinalNotesRef.current = new Set(
      [...(frozenFinalNotesRef.current || [])]
        .filter((rowIndex) => rowIndex !== index)
        .map((rowIndex) => (rowIndex > index ? rowIndex - 1 : rowIndex))
    );
    onUpdateField('finalNotes', nextRows);
    onUpdateField('conclusion', nextRows[0]?.conclusion || '');
    onUpdateField('recommendations', nextRows[0]?.recommendations || '');
  }

  const reportStats = [
    { label: 'Overview Fields', value: '7' },
    { label: 'Observation Rows', value: String((report.keyObservations || []).length + (report.annualReturnObservations || []).length) },
    { label: 'Checklist Items', value: String((report.checklistReview || []).length) },
    { label: 'Screenshots', value: String(report.screenshotReferences?.length || 0) }
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-[24px] bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-sm ring-1 ring-emerald-100 sm:p-5 lg:p-6">
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onBack} className="btn-lift inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Compliance</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">COMPLIANCE HEALTH REPORT</h1>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-500">
                Fill the report-specific details below. Lead details already captured earlier are not repeated here.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => generateComplianceReportPdf(lead, report)} className="btn-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ff5108] px-5 font-black text-white shadow-lg shadow-orange-600/20">
              <Download className="h-5 w-5" /> Download Complete PDF
            </button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
            {reportStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-2xl font-black text-slate-950">{stat.value}</p>
                <p className="mt-1 text-[11px] font-black uppercase leading-4 text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
          </div>
        </div>
          <div className="grid border-t border-slate-100 bg-slate-50/70 text-sm font-black text-slate-600 md:grid-cols-4">
            {['1. Overview', '2. Objective', '3. Observations', '4. Evidence'].map((item) => (
              <div key={item} className="flex min-h-12 items-center gap-2 border-slate-100 px-5 py-3 md:border-r last:md:border-r-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ReportSectionTitle title="1. Company Overview" />
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <ReportTextField label="Year of Commencement of Operations" value={report.yearOfCommencement} onChange={(value) => onUpdateField('yearOfCommencement', value)} />
            <ReportTextField label="Year of Establishment" value={report.establishmentDate} onChange={(value) => onUpdateField('establishmentDate', value)} />
            <ReportTextField label="Type of Organization" value={report.organizationType} onChange={(value) => onUpdateField('organizationType', value)} />
            <ReportMultiSelectField
              label="Key Products / Brands"
              value={report.keyProductsBrands}
              options={keyProductBrandOptions}
              uploads={report.sharedFolderUploads || []}
              onChange={(value) => onUpdateField('keyProductsBrands', value)}
              onUpload={onSharedFolderUpload}
              onRemoveUpload={onRemoveSharedFolderUpload}
            />
            <ReportTextField label="Product Category" value={report.productCategory} onChange={(value) => onUpdateField('productCategory', value)} />
            <ReportTextField label="EPR Registration Number" value={report.eprRegistrationNumber} onChange={(value) => onUpdateField('eprRegistrationNumber', value)} />
            <ReportTextField label="Financial Year Reviewed" value={report.financialYearReviewed} onChange={(value) => onUpdateField('financialYearReviewed', value)} />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ReportSectionTitle title="2. Objective of Review" />
          <textarea className="form-input mt-5 min-h-[130px] resize-y py-3" value={report.objectiveReview} onChange={(event) => onUpdateField('objectiveReview', event.target.value)} />
        </section>

        <ObservationTable
          title="3.1 Key Compliance Observations"
          rows={report.keyObservations || []}
          defaultOpen
          onUpdate={(index, field, value) => onUpdateRow('keyObservations', index, field, value)}
          onUpload={onScreenshotUpload}
          onAdd={() => onAddRow('keyObservations', { srNo: String((report.keyObservations || []).length + 1), area: '', observation: '', potentialRisk: '', screenshotReference: '' })}
          onRemove={(index) => onRemoveRow('keyObservations', index)}
        />

        <ObservationTable
          title="3.2 Key Compliance Observations For Annual Return"
          rows={report.annualReturnObservations || []}
          defaultOpen={false}
          onUpdate={(index, field, value) => onUpdateRow('annualReturnObservations', index, field, value)}
          onUpload={onScreenshotUpload}
          onAdd={() => onAddRow('annualReturnObservations', { srNo: String((report.annualReturnObservations || []).length + 1), area: 'Annual Return', observation: '', potentialRisk: '', screenshotReference: '' })}
          onRemove={(index) => onRemoveRow('annualReturnObservations', index)}
        />

        <ChecklistReviewTable
          rows={report.checklistReview || []}
          defaultOpen={false}
          onUpdate={(index, field, value) => onUpdateRow('checklistReview', index, field, value)}
        />

        <ConclusionTermsSection
          rows={finalNoteRows}
          frozenRows={frozenFinalNotesRef.current}
          onUpdate={updateFinalNote}
          onAdd={addFinalNote}
          onRemove={removeFinalNote}
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onBack} className="btn-lift min-h-11 rounded-xl border border-slate-200 bg-white px-8 font-black text-slate-700">Back</button>
          <button type="button" onClick={() => generateComplianceReportPdf(lead, report)} className="btn-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-8 font-black text-orange-600"><Download className="h-4 w-4" /> Download PDF</button>
          <button type="button" disabled={saving} onClick={onOpenSubmit} className="btn-lift min-h-11 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 font-black text-white shadow-lg shadow-orange-600/20">
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportSectionTitle({ title }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-4 py-3">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <span className="h-2 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
    </div>
  );
}

function ReportTextField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input className="form-input text-center" value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function ReportMultiSelectField({ label, value, options = [], uploads = [], onChange, onUpload, onRemoveUpload }) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const wrapperRef = useRef(null);
  const selected = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function commit(nextSelected) {
    onChange(nextSelected.join(', '));
  }

  function toggleOption(option) {
    const exists = selected.includes(option);
    commit(exists ? selected.filter((item) => item !== option) : [...selected, option]);
  }
  const sharedFolderSelected = selected.includes('Uploaded in shared folder');

  return (
    <Field label={label}>
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left font-black text-slate-800 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {selected.length ? selected.map((item) => (
              <span key={item} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{item}</span>
              </span>
            )) : (
              <span className="text-sm font-black text-slate-400">Select multiple options</span>
            )}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-xl border border-emerald-100 bg-white p-2 shadow-2xl shadow-slate-900/18">
            {options.map((option) => {
              const active = selected.includes(option);
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => toggleOption(option)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm font-black transition ${
                    active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{option}</span>
                  <span className={`grid h-6 w-6 place-items-center rounded-lg border ${active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-transparent'}`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {sharedFolderSelected && (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-3 shadow-sm">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onUpload} />
            <input ref={folderInputRef} type="file" multiple webkitdirectory="true" directory="true" className="hidden" onChange={onUpload} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">Shared folder upload</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Upload files or choose a full folder. File names and folder paths are saved with this report.</p>
              </div>
              <span className="rounded-lg bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm">{uploads.length} files</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 font-black text-emerald-800 shadow-sm hover:bg-emerald-50"
              >
                <Upload className="h-4 w-4" />
                Choose Files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="btn-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white shadow-lg shadow-emerald-700/20 hover:bg-emerald-800"
              >
                <Upload className="h-4 w-4" />
                Choose Folder
              </button>
            </div>
            {uploads.length > 0 && (
              <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
                {uploads.map((file, index) => (
                  <div key={`${file.relativePath || file.name}-${index}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Upload className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-800">{file.name}</p>
                      <p className="truncate text-xs font-bold text-slate-500">{file.relativePath || file.type || 'Selected file'} - {formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveUpload(index)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

function formatFileSize(size = 0) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ConclusionTermsSection({ rows, frozenRows, onUpdate, onAdd, onRemove }) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Final Notes</p>
          <h2 className="text-2xl font-black text-slate-950">Conclusion & Next Steps</h2>
        </div>
        <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">{rows.length} {rows.length === 1 ? 'item' : 'items'}</span>
      </div>
      <div className="mt-5 grid gap-4">
        {rows.map((row, index) => (
          <div key={`final-note-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 shadow-sm ring-1 ring-white sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-sm font-black text-white shadow-lg shadow-emerald-700/20">
                {index + 1}
              </span>
              {frozenRows?.has(index) && (
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Frozen</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="btn-lift ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-white text-red-500 shadow-sm hover:bg-red-50"
                title="Remove note"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center font-black text-emerald-800">Conclusion</span>
                <input
                  className={`form-input min-h-12 rounded-xl text-center ${frozenRows?.has(index) ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                  value={row.conclusion || ''}
                  placeholder="Enter conclusion"
                  readOnly={frozenRows?.has(index)}
                  onChange={(event) => onUpdate(index, 'conclusion', event.target.value)}
                />
              </label>
              <label className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center font-black text-emerald-800">Recommendations</span>
                <input
                  className={`form-input min-h-12 rounded-xl text-center ${frozenRows?.has(index) ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                  value={row.recommendations || ''}
                  placeholder="Enter recommendations or next steps"
                  readOnly={frozenRows?.has(index)}
                  onChange={(event) => onUpdate(index, 'recommendations', event.target.value)}
                />
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="btn-lift inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/70 px-5 font-black text-emerald-800 hover:bg-emerald-100"
        >
          <Plus className="h-4 w-4" />
          Add Note
        </button>
      </div>
    </section>
  );
}

function ObservationTable({ title, rows, onUpdate, onUpload, onAdd, onRemove, defaultOpen = true }) {
  return (
    <details open={defaultOpen} className="group mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 transition hover:bg-emerald-50/40">
        <span className="font-black text-slate-950">{title}</span>
        <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{rows.length} rows</span>
      </summary>
      <div className="hidden-scrollbar max-h-[520px] overflow-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.06em] text-slate-500">
            <tr>
              <th className="w-24 border border-slate-200 px-3 py-3 text-center">Sr. No.</th>
              <th className="w-72 border border-slate-200 px-3 py-3 text-center">Area</th>
              <th className="border border-slate-200 px-3 py-3 text-center">Observation</th>
              <th className="border border-slate-200 px-3 py-3 text-center">Potential Risk</th>
              <th className="w-72 border border-slate-200 px-3 py-3 text-center">Screenshot Reference</th>
              <th className="w-20 border border-slate-200 px-3 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.srNo}-${index}`}>
                <td className="border border-slate-200 p-2 align-middle">
                  <input className="form-input min-h-12 rounded-lg text-center text-sm" value={row.srNo || ''} onChange={(event) => onUpdate(index, 'srNo', event.target.value)} />
                </td>
                <td className="border border-slate-200 p-2 align-middle">
                  <input className="form-input min-h-12 rounded-lg text-center text-sm font-black" value={row.area || ''} onChange={(event) => onUpdate(index, 'area', event.target.value)} />
                </td>
                <td className="border border-slate-200 p-2 align-middle">
                  <input className="form-input min-h-12 rounded-lg text-center text-sm" value={row.observation || ''} onChange={(event) => onUpdate(index, 'observation', event.target.value)} />
                </td>
                <td className="border border-slate-200 p-2 align-middle">
                  <input className="form-input min-h-12 rounded-lg text-center text-sm" value={row.potentialRisk || ''} onChange={(event) => onUpdate(index, 'potentialRisk', event.target.value)} />
                </td>
                <td className="border border-slate-200 p-2 align-middle">
                  <div className="grid gap-2">
                    <label className="btn-lift inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 hover:bg-emerald-100">
                      <Upload className="h-4 w-4" /> Choose Files
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        className="sr-only"
                        onChange={(event) => {
                          const names = Array.from(event.target.files || []).map((file) => file.name);
                          if (names.length) onUpdate(index, 'screenshotReference', names.join(', '));
                          onUpload?.(event);
                        }}
                      />
                    </label>
                    <input className="form-input min-h-10 rounded-lg text-center text-xs" value={row.screenshotReference || ''} placeholder="No file selected" onChange={(event) => onUpdate(index, 'screenshotReference', event.target.value)} />
                  </div>
                </td>
                <td className="border border-slate-200 p-2 align-middle text-center">
                  <button type="button" onClick={() => onRemove(index)} className="grid h-10 w-10 place-items-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50" title="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 p-4">
        <button type="button" onClick={onAdd} className="btn-lift inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white shadow-lg shadow-emerald-700/20">
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>
    </details>
  );
}

function ChecklistReviewTable({ rows, onUpdate, defaultOpen = false }) {
  const groupedRows = rows.reduce((groups, row, index) => {
    const key = row.part || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...row, originalIndex: index });
    return groups;
  }, {});

  return (
    <details open={defaultOpen} className="group mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 transition hover:bg-amber-50/40">
        <span className="font-black text-slate-950">4. Compliance Checklist Review</span>
        <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{rows.length} checks</span>
      </summary>
      <div className="hidden-scrollbar max-h-[560px] overflow-auto">
        <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.06em] text-slate-500">
            <tr>
              <th className="w-24 border border-slate-200 px-3 py-3 text-center">Sr. No.</th>
              <th className="border border-slate-200 px-3 py-3 text-center">Compliance Requirement</th>
              <th className="w-52 border border-slate-200 px-3 py-3 text-center">Status</th>
              <th className="w-64 border border-slate-200 px-3 py-3 text-center">Remark</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedRows).map(([part, items]) => (
              <React.Fragment key={part}>
                <tr>
                  <td colSpan={4} className="border border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <input
                        className="min-h-10 rounded-xl border border-emerald-100 bg-white px-4 text-center text-sm font-black text-emerald-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        value={part}
                        onChange={(event) => items.forEach((item) => onUpdate(item.originalIndex, 'part', event.target.value))}
                      />
                      <span className="rounded-lg bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-slate-500 ring-1 ring-slate-200">{items.length} items</span>
                    </div>
                  </td>
                </tr>
                {items.map((row) => (
                  <tr key={`${row.srNo}-${row.complianceRequirement}`}>
                    <td className="border border-slate-200 p-2 align-middle"><input className="form-input min-h-10 rounded-lg text-center" value={row.srNo || ''} onChange={(event) => onUpdate(row.originalIndex, 'srNo', event.target.value)} /></td>
                    <td className="border border-slate-200 p-2 align-middle"><input className="form-input min-h-10 rounded-lg text-center font-black" value={row.complianceRequirement || ''} onChange={(event) => onUpdate(row.originalIndex, 'complianceRequirement', event.target.value)} /></td>
                    <td className="border border-slate-200 p-2 align-middle">
                      <select className="form-input min-h-10 rounded-lg text-center" value={row.status || ''} onChange={(event) => onUpdate(row.originalIndex, 'status', event.target.value)}>
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                        <option>Mentioned</option>
                        <option>Uploaded</option>
                        <option>Not Uploaded</option>
                        <option>Not Mentioned</option>
                        <option>Not Applicable</option>
                      </select>
                    </td>
                    <td className="border border-slate-200 p-2 align-middle"><input className="form-input min-h-10 rounded-lg text-center" value={row.remark || ''} onChange={(event) => onUpdate(row.originalIndex, 'remark', event.target.value)} /></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ScreenshotReferencePanel({ files, onUpload, onRemove }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Evidence</p>
          <h2 className="text-2xl font-black text-slate-950">Screenshot Reference</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">{files.length} files</span>
          <label className="btn-lift inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-black text-white shadow-lg shadow-emerald-700/20">
            <Upload className="h-4 w-4" /> Bulk Upload
            <input type="file" multiple accept="image/*,.pdf" onChange={onUpload} className="sr-only" />
          </label>
        </div>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/70 p-5">
          <div>
            <p className="font-black text-slate-900">Bulk upload screenshots, PDFs, or supporting images</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Select many files at once. Images show previews and all files save with this report.</p>
          </div>
          <label className="btn-lift mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 font-black text-emerald-700 hover:bg-emerald-50">
            <Upload className="h-4 w-4" /> Choose Files
            <input type="file" multiple accept="image/*,.pdf" onChange={onUpload} className="sr-only" />
          </label>
        </div>
        <div className="hidden-scrollbar max-h-[360px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {files.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-4 font-black text-slate-500">No screenshots uploaded yet.</p>
            ) : files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="grid aspect-video place-items-center bg-slate-100">
                  {String(file.type || '').startsWith('image/') ? (
                    <img src={file.url || file.secureUrl || file.dataUrl} alt={file.name} className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-6 w-6 text-slate-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{file.name}</p>
                    <p className="text-xs font-bold text-slate-500">{Math.ceil((file.size || 0) / 1024)} KB</p>
                  </div>
                  <button type="button" onClick={() => onRemove(index)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50" title="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LeadSubmitPrompt({ confirmed, saving, onConfirmChange, onClose, onYes, onNoSubmit }) {
  const [noSelected, setNoSelected] = useState(false);

  return (
    <ConfirmationShell eyebrow="Lead submit" title="Do you want to process for COMPLIANCE HEALTH REPORT" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onYes} className="btn-lift min-h-14 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 px-5 font-black text-white shadow-xl shadow-emerald-700/20">Yes, open report</button>
        <button type="button" onClick={() => { setNoSelected(true); onConfirmChange(false); }} className="btn-lift min-h-14 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-700 shadow-sm hover:bg-slate-50">No, submit lead</button>
      </div>
      {noSelected && (
        <>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-inner">
            <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmChange(event.target.checked)} className="mt-1 h-5 w-5 rounded accent-emerald-700" />
            <span className="font-black text-slate-800">I have checked all the details I filled in, and they are correct.</span>
          </label>
          <div className="mt-5 flex justify-end">
            <button type="button" disabled={!confirmed || saving} onClick={onNoSubmit} className="btn-lift min-h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 font-black text-white shadow-lg shadow-orange-600/20 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </>
      )}
    </ConfirmationShell>
  );
}

function ReportSubmitPrompt({ checked, saving, onCheckedChange, onClose, onSubmit }) {
  return (
    <ConfirmationShell eyebrow="Final review" title="Submit COMPLIANCE HEALTH REPORT" onClose={onClose}>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-inner">
        <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} className="mt-1 h-5 w-5 rounded accent-emerald-700" />
        <span className="font-black text-slate-800">I have reviewed all the details I entered, and they are correct.</span>
      </label>
      <div className="mt-5 flex justify-end">
        <button type="button" disabled={!checked || saving} onClick={onSubmit} className="btn-lift min-h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 font-black text-white shadow-lg shadow-orange-600/20 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </ConfirmationShell>
  );
}

function ConfirmationShell({ eyebrow, title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-md">
      <section className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-2xl shadow-slate-950/25 animate-toast-in">
        <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-white via-emerald-50 to-sky-50 p-6">
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow-xl shadow-emerald-700/20">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
            {eyebrow && <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>}
            <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">{title}</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} className="btn-lift grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800" title="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="bg-white p-6">{children}</div>
      </section>
    </div>
  );
}

function LeadDirectoryView({ leads, staff, loading, onRefresh, onAddNew, onView, onEdit }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [metricFilter, setMetricFilter] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const filteredLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return leads.slice().sort(compareLeadCode).filter((item) => {
      const assignedId = item.assignedTo?._id || item.assignedTo?.id || item.assignedTo || '';
      const isExisting = item.existingClient === 'Yes' || item.status === 'Existing Client';
      const isNew = item.existingClient !== 'Yes' && item.status !== 'Existing Client';
      const haystack = [
        item.leadCode,
        item.company,
        item.addressLine1,
        item.city,
        item.pinCode,
        item.piboCategory,
        item.eprCategory,
        item.state,
        item.contactPerson,
        item.mobileNo1,
        item.emails,
        item.status
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const matchesStaff = !staffFilter || String(assignedId) === String(staffFilter);
      const matchesMetric =
        !metricFilter ||
        metricFilter === 'all' ||
        (metricFilter === 'converted' && item.status === 'Existing Client') ||
        (metricFilter === 'existing' && isExisting) ||
        (metricFilter === 'new' && isNew);
      return matchesSearch && matchesStatus && matchesStaff && matchesMetric;
    });
  }, [leads, metricFilter, query, staffFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [metricFilter, query, rowsPerPage, staffFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / rowsPerPage));
  const visibleLeads = filteredLeads.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const existingClients = leads.filter((item) => item.existingClient === 'Yes' || item.status === 'Existing Client').length;
  const newLeads = leads.filter((item) => item.existingClient !== 'Yes' && item.status !== 'Existing Client').length;
  const converted = leads.filter((item) => item.status === 'Existing Client').length;
  const metricStats = [
    { label: 'Total Leads', value: leads.length, note: 'Complete lead universe', icon: UsersRound, tone: 'emerald', filter: 'all' },
    { label: 'Converted to Sales', value: converted, note: 'Sales-ready conversions', icon: TrendingUp, tone: 'sky', filter: 'converted' },
    { label: 'Existing Clients', value: existingClients, note: 'Existing or converted clients', icon: CheckCircle2, tone: 'teal', filter: 'existing' },
    { label: 'New Leads', value: newLeads, note: 'Fresh non-client records', icon: UserPlus, tone: 'violet', filter: 'new' }
  ];
  const selectedMetric = metricStats.find((stat) => stat.filter === metricFilter);

  function exportExcel() {
    const rows = filteredLeads.map((item) => ({
      'Lead ID': item.leadCode || '',
      'Excel Lead ID': item.sourceLeadId || '',
      Company: item.company || '',
      Industry: item.industryType || '',
      Status: item.status || '',
      'PIBO Category': item.piboCategory || '',
      'EPR Category': item.eprCategory || '',
      'Services Offered': item.servicesOffered || '',
      Address: item.addressLine1 || '',
      City: item.city || '',
      PIN: item.pinCode || '',
      State: item.state || '',
      'Contact Person': item.contactPerson || '',
      Designation: item.designation || '',
      'Mobile 1': item.mobileNo1 || '',
      'Mobile 2': item.mobileNo2 || '',
      Email: item.emails || '',
      Website: item.website || '',
      'Emails Sent Count': item.emailsSentCount || '',
      'Last Email Sent': item.lastEmailSent || '',
      'Referred By': item.referredBy || '',
      Source: item.source || '',
      Notes: item.notes || '',
      'Assigned To': item.assignedTo?.name || item.assignedToText || '',
      'Assigned By': item.assignedBy || '',
      'Created By': item.importedCreatedBy || '',
      'Lead Date': item.leadDate || '',
      'Next Follow-Up Date': item.nextFollowUpDate || '',
      'Next Follow-Up Time': item.nextFollowUpTime || '',
      'Follow-Up Remarks': item.followUpRemarks || '',
      'Created At': item.importedCreatedAt || item.createdAt || '',
      'Updated At': item.importedUpdatedAt || item.updatedAt || '',
      'Business Card URL': item.businessCardUrl || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, 'leads.xlsx');
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-7">
        <LeadStoryStats
          activeFilter={metricFilter}
          onFilterChange={(filter) => setMetricFilter((current) => (current === filter ? '' : filter))}
          stats={metricStats} 
        />

        {selectedMetric && (
          <MetricOutputCard
            stat={selectedMetric}
            leads={filteredLeads}
            onClose={() => setMetricFilter('')}
            onExport={exportExcel}
          />
        )}

        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3 shadow-sm xl:grid-cols-[minmax(220px,1.1fr)_minmax(190px,0.9fr)_minmax(190px,0.9fr)_auto] xl:items-center">
          <div className="relative min-w-0">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="h-12 w-full rounded-lg border border-slate-200 bg-white px-5 pr-12 text-base font-black text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
            <Search className="pointer-events-none absolute right-6 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="form-input min-h-12 rounded-lg xl:max-w-none">
            <option value="">All Status</option>
            {options.status.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="form-input min-h-12 rounded-lg xl:max-w-none">
            <option value="">All Staff</option>
            {staff.map((user) => <option key={user._id || user.id} value={user._id || user.id}>{user.name || user.email}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:justify-end">
            <button type="button" onClick={onAddNew} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-600 px-4 text-sm font-black text-white shadow-lg shadow-orange-600/20"><UserPlus className="h-4 w-4" />Generate Lead</button>
            <button type="button" onClick={() => { setQuery(''); setStatusFilter(''); setStaffFilter(''); setMetricFilter(''); setPage(1); }} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" />Clear</button>
            <button type="button" onClick={onRefresh} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-orange-200 bg-white px-4 text-sm font-black text-orange-600 hover:bg-orange-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
            <button type="button" onClick={exportExcel} className="btn-lift inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20"><Download className="h-4 w-4" />Export</button>
          </div>
        </div>

        <DirectoryTableHeader showing={visibleLeads.length} total={filteredLeads.length} label="leads" rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} page={page} setPage={setPage} totalPages={totalPages} />
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden-scrollbar max-h-[520px] overflow-auto">
            <table className="crm-data-table w-full min-w-[1680px] table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-black uppercase tracking-[0.06em] text-slate-500 shadow-sm">
                <tr>
                  {[
                    ['Lead ID', 'w-[110px]'],
                    ['Company', 'w-[170px]'],
                    ['Address', 'w-[250px]'],
                    ['City', 'w-[130px]'],
                    ['PIN', 'w-[95px]'],
                    ['State', 'w-[130px]'],
                    ['PIBO Category', 'w-[150px]'],
                    ['EPR Category', 'w-[170px]'],
                    ['Contact Person', 'w-[170px]'],
                    ['Mobile 1', 'w-[130px]'],
                    ['Email', 'w-[210px]'],
                    ['Status', 'w-[140px]'],
                    ['Action', 'w-[110px]']
                  ].map(([header, width]) => <th key={header} className={`px-5 py-4 ${width}`}>{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleLeads.length === 0 ? (
                  <tr><td colSpan={13} className="px-5 py-12 text-center font-black text-slate-400">No leads found.</td></tr>
                ) : visibleLeads.map((item) => (
                  <tr key={item._id || item.id} className="transition hover:bg-orange-50/60">
                    <td className="px-5 py-4 font-black text-slate-900"><span className="cell-clip">{item.leadCode || '-'}</span></td>
                    <td className="px-5 py-4 font-black uppercase text-slate-600"><span className="cell-clamp">{item.company || '-'}</span></td>
                    <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clamp">{item.addressLine1 || '-'}</span></td>
                    <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clip">{item.city || '-'}</span></td>
                    <td className="px-5 py-4 font-black text-slate-500"><span className="cell-clip">{item.pinCode || '-'}</span></td>
                    <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clip">{item.state || '-'}</span></td>
                    <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clamp">{item.piboCategory || '-'}</span></td>
                    <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clamp">{item.eprCategory || '-'}</span></td>
                    <td className="px-5 py-4 font-black uppercase text-slate-500"><span className="cell-clamp">{item.contactPerson || '-'}</span></td>
                    <td className="px-5 py-4 font-black text-slate-500"><span className="cell-clip">{item.mobileNo1 || '-'}</span></td>
                    <td className="px-5 py-4 font-black text-slate-500"><span className="cell-clip normal-case">{item.emails || '-'}</span></td>
                    <td className="px-5 py-4"><span className="rounded-lg bg-lime-50 px-3 py-1 text-xs font-black text-lime-700 ring-1 ring-lime-200">{item.status || 'Draft'}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onView(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="View"><Eye className="h-4 w-4" /></button>
                        <button type="button" onClick={() => onEdit(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50" title="Edit"><Pencil className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-lift min-h-11 rounded-lg border border-slate-200 bg-white px-5 font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
          <span className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600">Page {page} of {totalPages}</span>
          <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="btn-lift min-h-11 rounded-lg border border-slate-200 bg-white px-5 font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-black text-slate-700">{label} {required && <span className="text-red-500">*</span>}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function UserSelect({ label, value, options = [], onChange, allowClear = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value));
  const matches = options.filter((option) => !query.trim() || String(option.search || `${option.label} ${option.secondary}`).includes(query.trim().toLowerCase())).slice(0, 100);

  useEffect(() => {
    function close(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <Field label={label}>
      <div ref={wrapperRef} className="relative">
        <button type="button" onClick={() => { setOpen((current) => !current); setQuery(''); }} className="form-input flex min-h-14 items-center gap-3 text-left">
          <UserCheck className="h-5 w-5 shrink-0 text-emerald-700" />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-black ${selected ? 'text-slate-900' : 'text-slate-400'}`}>{selected?.label || 'Search and select a user'}</span>
            {selected && <span className="block truncate text-xs font-bold text-slate-500">{selected.secondary}</span>}
          </span>
          <ChevronDown className={`h-5 w-5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[90] overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-emerald-400">
                <Search className="h-4 w-4 text-slate-400" />
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or team" className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
              </div>
            </div>
            <div className="max-h-72 overflow-auto p-2">
              {allowClear && value && <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="mb-1 w-full rounded-lg px-3 py-3 text-left text-sm font-black text-red-600 hover:bg-red-50">Clear selection</button>}
              {!matches.length ? <p className="px-3 py-5 text-center text-sm font-bold text-slate-400">No active user found</p> : matches.map((option) => (
                <button type="button" key={option.value} onClick={() => { onChange(option.value); setOpen(false); setQuery(''); }} className={`w-full rounded-lg px-3 py-3 text-left hover:bg-emerald-50 ${String(value) === String(option.value) ? 'bg-emerald-50' : ''}`}>
                  <span className="block font-black text-slate-900">{option.label}</span>
                  <span className="block text-xs font-bold text-slate-500">{option.secondary}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

function SelectLike({ label, required, value, options = [], onChange, disabled = false, placeholder = 'Select or type to create new' }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const normalized = Array.isArray(options)
    ? options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
    : [];
  const filtered = normalized
    .filter((option) => String(option.label || option.value || '').toLowerCase().includes(String(value || '').toLowerCase()))
    .slice(0, 80);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Field label={label} required={required}>
      <div ref={wrapperRef} className="relative">
        <input
          value={value}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="form-input pr-12 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
          title="Open options"
        >
          <ChevronDown className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && !disabled && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[85] overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-2xl shadow-slate-900/18">
            <div className="max-h-72 overflow-auto p-2">
              {filtered.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg px-3 py-3 text-left text-sm font-black text-slate-500 hover:bg-slate-50"
                >
                  Use "{value || placeholder}"
                </button>
              ) : filtered.map((option) => (
                <button
                  type="button"
                  key={`${option.value}-${option.label}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-3 text-left text-sm font-black transition hover:bg-emerald-50 hover:text-emerald-700 ${
                    String(value) === String(option.value) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
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
    const from = 0;
    const to = Number(value) || 0;
    let frameId;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, duration, value]);

  return displayValue;
}

function LeadStoryStats({ stats, activeFilter, onFilterChange }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    setVisibleCount(1);
    const timers = stats.slice(1).map((_, index) =>
      window.setTimeout(() => setVisibleCount(index + 2), 900 * (index + 1))
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [stats.length]);

  return (
    <section className="lead-story-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Lead Performance Flow</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Live lead movement</h2>
        </div>
        <p className="max-w-xl text-sm font-bold text-slate-500">
          Each number opens in sequence so the dashboard feels alive while still staying clear and scan-friendly.
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {stats.map((stat, index) => (
          <LeadStoryCard
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

function LeadStoryCard({ stat, index, active, selected, onSelect, showArrow, arrowActive }) {
  const Icon = stat.icon;
  const value = useCountUp(stat.value, active);
  const Component = onSelect ? 'button' : 'article';

  return (
    <Component type={onSelect ? 'button' : undefined} onClick={onSelect} className={`lead-story-card lead-story-${stat.tone} ${active ? 'lead-story-card-active' : ''} ${selected ? 'lead-story-card-selected' : ''}`} style={{ '--delay': `${index * 110}ms` }}>
      {showArrow && <span className={`lead-story-arrow ${arrowActive ? 'lead-story-arrow-active' : ''}`} />}
      <div className="lead-story-topline" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <span className="lead-story-icon">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[11px] font-black uppercase leading-4 text-slate-500">{stat.note}</p>
    </Component>
  );
}

function MetricOutputCard({ stat, leads, onClose, onExport }) {
  const Icon = stat.icon;
  const preview = leads.slice(0, 10);

  return (
    <section className={`metric-output-card lead-story-${stat.tone}`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="lead-story-icon">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Selected Output</p>
            <h3 className="truncate text-xl font-black text-slate-950">{stat.label}</h3>
          </div>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{leads.length} records</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onExport} className="btn-lift inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20">
            <Download className="h-4 w-4" /> Export
          </button>
          <button type="button" onClick={onClose} className="btn-lift inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </div>

      <div className="hidden-scrollbar max-h-[320px] overflow-auto">
        <table className="crm-data-table w-full min-w-[980px] table-fixed text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-black uppercase tracking-[0.06em] text-slate-500">
            <tr>
              {['Lead ID', 'Company', 'City', 'State', 'Contact', 'Mobile', 'Status'].map((header) => (
                <th key={header} className="px-4 py-3">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center font-black text-slate-400">No records found.</td></tr>
            ) : preview.map((item) => (
              <tr key={item._id || item.id} className="transition hover:bg-orange-50/60">
                <td className="px-4 py-3 font-black text-slate-900"><span className="cell-clip">{item.leadCode || '-'}</span></td>
                <td className="px-4 py-3 font-black uppercase text-slate-600"><span className="cell-clamp">{item.company || '-'}</span></td>
                <td className="px-4 py-3 font-black uppercase text-slate-500"><span className="cell-clip">{item.city || '-'}</span></td>
                <td className="px-4 py-3 font-black uppercase text-slate-500"><span className="cell-clip">{item.state || '-'}</span></td>
                <td className="px-4 py-3 font-black uppercase text-slate-500"><span className="cell-clip">{item.contactPerson || '-'}</span></td>
                <td className="px-4 py-3 font-black text-slate-500"><span className="cell-clip">{item.mobileNo1 || '-'}</span></td>
                <td className="px-4 py-3"><span className="rounded-lg bg-lime-50 px-3 py-1 text-xs font-black text-lime-700 ring-1 ring-lime-200">{item.status || 'Draft'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads.length > preview.length && (
        <p className="border-t border-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
          Showing first {preview.length} records here. Export includes all {leads.length} filtered records.
        </p>
      )}
    </section>
  );
}

function LeadViewModal({ lead, onClose }) {
  const personName = (value, fallback) => value?.name || fallback || '-';
  const dateTime = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-';
  const rows = [
    ['Lead ID', lead.leadCode],
    ['Company', lead.company],
    ['Status', lead.status],
    ['Address', lead.addressLine1],
    ['City', lead.city],
    ['State', lead.state],
    ['PIN', lead.pinCode],
    ['Contact', lead.contactPerson],
    ['Mobile', lead.mobileNo1],
    ['Email', lead.emails],
    ['PIBO', lead.piboCategory],
    ['EPR', lead.eprCategory]
  ];
  const auditRows = [
    ['Created By', personName(lead.createdBy, lead.createdByName || lead.importedCreatedBy), 'Created At', dateTime(lead.createdAt)],
    ['Last Updated By', personName(lead.updatedBy, lead.updatedByName), 'Updated At', dateTime(lead.updatedAt)],
    ['Assigned To', personName(lead.assignedTo, lead.assignedToText), 'Assigned By / At', `${lead.assignedBy || '-'} · ${dateTime(lead.assignedAt)}`],
    ['Lead Closed By', personName(lead.closedBy, lead.closedByText), 'Closed At', dateTime(lead.closedAt)]
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-4 py-6">
      <section className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Lead View</p>
            <h2 className="text-2xl font-black text-slate-950">{lead.company || 'Lead details'}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" title="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
              <p className="mt-1 break-words font-black text-slate-800">{value || '-'}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 bg-slate-50/70 p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-emerald-700">Audit & Ownership</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {auditRows.map(([leftLabel, leftValue, rightLabel, rightValue]) => (
              <div key={leftLabel} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{leftLabel}</p><p className="mt-1 font-black text-slate-800">{leftValue}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{rightLabel}</p><p className="mt-1 text-sm font-bold text-slate-700">{rightValue}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function DirectoryMetric({ label, value, note }) {
  return (
    <div className="min-h-32 rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      {note && <p className="mt-5 text-xs font-black uppercase text-slate-500">{note}</p>}
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
          {[5, 10, 25, 50, 100].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </div>
    </div>
  );
}

function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeExistingClient(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'No';
  if (raw === 'yes' || raw === 'y' || raw === 'true' || raw === '1') return 'Yes';
  return 'No';
}

function compareLeadCode(a, b) {
  const left = Number.parseInt(String(a.leadCode || '').replace(/\D/g, ''), 10) || 0;
  const right = Number.parseInt(String(b.leadCode || '').replace(/\D/g, ''), 10) || 0;
  if (left !== right) return left - right;
  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
}

function formatExcelValue(value, field) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const iso = value.toISOString();
    return field === 'nextFollowUpTime' ? iso.slice(11, 16) : iso.slice(0, 10);
  }
  if (typeof value === 'number' && ['lastEmailSent', 'leadDate', 'nextFollowUpDate', 'importedCreatedAt', 'importedUpdatedAt', 'assignedAt'].includes(field)) {
    return XLSX.SSF.format('yyyy-mm-dd', value);
  }
  if (typeof value === 'number' && field === 'nextFollowUpTime') {
    return XLSX.SSF.format('hh:mm', value);
  }
  return typeof value === 'string' ? value.trim() : value;
}

function mapExcelRowToLead(row, staff) {
  const mapping = {
    communicationmode: 'communicationMode',
    leadid: 'sourceLeadId',
    status: 'status',
    company: 'company',
    industry: 'industryType',
    industrytype: 'industryType',
    eprcategory: 'eprCategory',
    pibocategory: 'piboCategory',
    servicesoffered: 'servicesOffered',
    address: 'addressLine1',
    addressline1: 'addressLine1',
    address1: 'addressLine1',
    addressline2: 'addressLine2',
    address2: 'addressLine2',
    addressline3: 'addressLine3',
    address3: 'addressLine3',
    landmark: 'landmark',
    state: 'state',
    city: 'city',
    pincode: 'pinCode',
    pin: 'pinCode',
    existingclient: 'existingClient',
    website: 'website',
    salutation: 'salutation',
    contactperson: 'contactPerson',
    designation: 'designation',
    emails: 'emails',
    email: 'emails',
    emailssentcount: 'emailsSentCount',
    lastemailsent: 'lastEmailSent',
    mobileno1: 'mobileNo1',
    mobile1: 'mobileNo1',
    phone1: 'mobileNo1',
    mobileno2: 'mobileNo2',
    mobile2: 'mobileNo2',
    phone2: 'mobileNo2',
    businesscardurl: 'businessCardUrl',
    referredby: 'referredBy',
    source: 'source',
    notes: 'notes',
    assignedto: 'assignedToText',
    assignto: 'assignedToText',
    assignedtotext: 'assignedToText',
    assignedtoemail: 'assignedToEmail',
    assignedby: 'assignedBy',
    assignedbyname: 'assignedBy',
    assignedbyemail: 'assignedByEmail',
    createdby: 'importedCreatedBy',
    createdbyname: 'importedCreatedBy',
    createdbyemail: 'createdByEmail',
    leaddate: 'leadDate',
    nextfollowupdate: 'nextFollowUpDate',
    nextfollowuptime: 'nextFollowUpTime',
    followupremarks: 'followUpRemarks',
    createdat: 'importedCreatedAt',
    updatedat: 'importedUpdatedAt',
    assignedat: 'assignedAt'
  };

  const data = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    const normalized = normalizeHeaderKey(key);
    const field = mapping[normalized];
    if (!field) return;
    const clean = formatExcelValue(value, field);
    if (field === 'pinCode') data.pinCode = String(clean || '').trim();
    else if (field === 'emailsSentCount') data.emailsSentCount = Number(clean) || 0;
    else if (field === 'existingClient') data.existingClient = normalizeExistingClient(clean);
    else data[field] = clean === null || clean === undefined ? '' : clean;
  });

  if (data.assignedToText && Array.isArray(staff) && staff.length) {
    const raw = String(data.assignedToText).trim().toLowerCase();
    const match = staff.find((user) => String(user.email || '').toLowerCase() === raw) ||
      staff.find((user) => String(user.name || '').toLowerCase() === raw);
    if (match) data.assignedTo = match._id || match.id;
  }

  return data;
}
