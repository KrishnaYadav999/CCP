require('dotenv').config();
const app = require('./app');
const { startPendingApprovalDigest } = require('./utils/pendingApprovalDigest');

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection', err);
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPendingApprovalDigest();
});
