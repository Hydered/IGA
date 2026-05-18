const express = require('express');
const requestService = require('../services/requestService');
const approvalService = require('../services/approvalService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => {
  const filters = {
    status: req.query.status,
    priority: req.query.priority,
    department_id: req.query.department_id,
    resource_id: req.query.resource_id,
    search: req.query.search,
    date_from: req.query.date_from,
    date_to: req.query.date_to,
    all: req.query.all === 'true',
  };
  const result = requestService.listRequests(req.user, filters);
  res.json(result);
});

router.post('/', (req, res) => {
  const result = requestService.createRequest(req.user, req.body);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

router.get('/:id', (req, res) => {
  const result = requestService.getRequest(Number(req.params.id), req.user);
  if (!result.success) return res.status(404).json({ error: result.error });
  res.json(result);
});

router.post('/:id/submit', (req, res) => {
  const result = requestService.submitForApproval(Number(req.params.id), req.user);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.post('/:id/comments', (req, res) => {
  const result = requestService.addComment(Number(req.params.id), req.user, req.body.text);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

router.put('/:id', (req, res) => {
  const result = requestService.updateRequest(Number(req.params.id), req.body, req.user);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.put('/:id/approvers', (req, res) => {
  const result = requestService.setApprovers(
    Number(req.params.id),
    req.body.approver_ids || [],
    req.user
  );
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.post('/:id/approve', (req, res) => {
  const result = approvalService.processApproval(
    Number(req.params.id),
    req.user,
    req.body.decision,
    req.body.comment
  );
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.post('/:id/resubmit', (req, res) => {
  const result = approvalService.resubmitAfterClarification(Number(req.params.id), req.user);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.post('/:id/complete', (req, res) => {
  const result = approvalService.completeRequest(Number(req.params.id), req.user);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.post('/:id/close', (req, res) => {
  const result = approvalService.closeRequest(Number(req.params.id), req.user);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

module.exports = router;
