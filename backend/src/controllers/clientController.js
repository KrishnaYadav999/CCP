const Client = require('../models/Client');

exports.listClients = async (req, res) => {
  const clients = await Client.find()
    .populate('selectedLead', 'company status emails mobileNo1')
    .populate('adminControls.assignedTo', 'name email role avatarUrl')
    .sort({ createdAt: -1 });
  res.json({ ok: true, clients });
};

exports.createClient = async (req, res) => {
  const workflowStatus = req.body.workflowStatus === 'submitted' ? 'submitted' : 'draft';
  const data = req.body.data || {};
  const selectedLead = req.body.selectedLead || undefined;
  const adminControls = { ...(req.body.adminControls || {}) };
  if (!adminControls.assignedTo) delete adminControls.assignedTo;

  if (workflowStatus === 'submitted' && !data?.basic?.clientLegalName) {
    return res.status(400).json({ error: 'Client Legal Name is required before submit' });
  }

  const client = await Client.create({
    selectedLead,
    adminControls,
    data,
    workflowStatus,
    createdBy: req.user?._id
  });

  res.status(201).json({ ok: true, client });
};
