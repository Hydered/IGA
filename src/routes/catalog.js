const express = require('express');
const catalogRepository = require('../repositories/catalogRepository');
const userRepository = require('../repositories/userRepository');
const { authenticate } = require('../middleware/auth');
const { PRIORITIES, STATUSES } = require('../constants/statuses');

const router = express.Router();

router.use(authenticate);

router.get('/departments', (_req, res) => {
  res.json({ departments: catalogRepository.getDepartments() });
});

router.get('/resources', (_req, res) => {
  res.json({ resources: catalogRepository.getResources() });
});

router.get('/access-types', (_req, res) => {
  res.json({ access_types: catalogRepository.getAccessTypes() });
});

router.get('/approvers', (_req, res) => {
  res.json({ approvers: userRepository.findApprovers() });
});

router.get('/meta', (_req, res) => {
  res.json({ statuses: Object.values(STATUSES), priorities: PRIORITIES });
});

module.exports = router;
