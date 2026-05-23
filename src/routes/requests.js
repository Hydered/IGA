const express = require('express');
const requestService = require('../services/requestService');
const approvalService = require('../services/approvalService');
const { authenticate } = require('../middleware/auth');
const { sendServiceResult } = require('../utils/httpResult');

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
  sendServiceResult(res, requestService.createRequest(req.user, req.body), 201);
});

router.get('/:id', (req, res) => {
  sendServiceResult(res, requestService.getRequest(Number(req.params.id), req.user));
});

router.post('/:id/submit', (req, res) => {
  sendServiceResult(res, requestService.submitForApproval(Number(req.params.id), req.user));
});

router.post('/:id/comments', (req, res) => {
  sendServiceResult(
    res,
    requestService.addComment(Number(req.params.id), req.user, req.body.text),
    201
  );
});

router.put('/:id', (req, res) => {
  sendServiceResult(res, requestService.updateRequest(Number(req.params.id), req.body, req.user));
});

router.put('/:id/approvers', (req, res) => {
  sendServiceResult(
    res,
    requestService.setApprovers(
      Number(req.params.id),
      req.body.approver_ids || [],
      req.user
    )
  );
});

router.post('/:id/approve', (req, res) => {
  sendServiceResult(
    res,
    approvalService.processApproval(
      Number(req.params.id),
      req.user,
      req.body.decision,
      req.body.comment
    )
  );
});

router.post('/:id/resubmit', (req, res) => {
  sendServiceResult(
    res,
    approvalService.resubmitAfterClarification(Number(req.params.id), req.user)
  );
});

router.post('/:id/complete', (req, res) => {
  sendServiceResult(res, approvalService.completeRequest(Number(req.params.id), req.user));
});

router.post('/:id/close', (req, res) => {
  sendServiceResult(res, approvalService.closeRequest(Number(req.params.id), req.user));
});

module.exports = router;
