function sendServiceResult(res, result, successStatus = 200) {
  if (!result.success) {
    return res.status(result.httpStatus || 400).json({ error: result.error });
  }
  return res.status(successStatus).json(result);
}

module.exports = { sendServiceResult };
