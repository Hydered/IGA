const { BASIS_MAX, JUSTIFICATION_MAX, COMMENT_MAX } = require('../constants/limits');

function trimField(value, maxLen, fieldLabel) {
  const text = value?.trim();
  if (!text) {
    return { success: false, error: `Заполните поле «${fieldLabel}»` };
  }
  if (text.length > maxLen) {
    return {
      success: false,
      error: `Поле «${fieldLabel}» не должно превышать ${maxLen} символов`,
    };
  }
  return { success: true, value: text };
}

function validateRequestText(data) {
  const basis = trimField(data.basis, BASIS_MAX, 'основание');
  if (!basis.success) return basis;
  const justification = trimField(data.justification, JUSTIFICATION_MAX, 'обоснование');
  if (!justification.success) return justification;
  return {
    success: true,
    basis: basis.value,
    justification: justification.value,
  };
}

function validateCommentText(text) {
  return trimField(text, COMMENT_MAX, 'комментарий');
}

module.exports = { validateRequestText, validateCommentText };
