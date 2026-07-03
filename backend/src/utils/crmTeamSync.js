const { crmHeaders, getCrmBackendUrl, joinUrl, requestJson } = require('./crmHttp');

function idOf(value) {
  return value?._id ? String(value._id) : String(value || '');
}

function teamPayload(action, team) {
  return {
    action,
    ccpTeamId: team.ccpTeamId || String(team._id),
    crmTeamId: team.crmTeamId || '',
    name: team.name || '',
    description: team.description || '',
    managerId: idOf(team.manager),
    operationHeadId: team.operationHead ? idOf(team.operationHead) : '',
    members: (team.members || []).map(idOf).filter(Boolean),
    source: 'ccp'
  };
}

async function syncTeamToCrm(action, team) {
  const baseUrl = getCrmBackendUrl();
  if (!baseUrl) return { skipped: true, reason: 'CRM_BACKEND_URL not configured' };

  const response = await requestJson(joinUrl(baseUrl, '/teams/ccp/sync'), {
    method: 'POST',
    payload: teamPayload(action, team),
    headers: crmHeaders()
  });

  const crmTeamId = response.data?.crmTeamId || response.data?.team?.crmTeamId || response.data?.team?._id;
  if (crmTeamId && !team.crmTeamId) {
    team.crmTeamId = String(crmTeamId);
    await team.save();
  }

  return { ok: true, statusCode: response.statusCode, data: response.data };
}

module.exports = { syncTeamToCrm };
