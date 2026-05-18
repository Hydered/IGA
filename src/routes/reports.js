const express = require('express');
const reportService = require('../services/reportService');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRoles('admin', 'executor', 'approver'), (req, res) => {
  const filters = {
    date_from: req.query.date_from,
    date_to: req.query.date_to,
    status: req.query.status,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };
  const report = reportService.generateReport(filters, req.user);
  res.json(report);
});

module.exports = router;
