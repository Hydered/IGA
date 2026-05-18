function getApi() {
  return window.IGA_API || {};
}

let currentUser = null;
let meta = { statuses: [], priorities: [] };
let catalogs = {};
let currentDetailRequest = null;

const ROUTE_ERROR_MSG =
  'Выберите согласующих и нажмите «Сохранить маршрут».';

// --- Utils ---
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showRouteError(msg, isWarn = false) {
  const el = $('#detail-route-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden', 'warn', 'error', 'info');
  if (isWarn) el.classList.add('warn');
  else el.classList.add('error');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearRouteError() {
  const el = $('#detail-route-error');
  if (el) {
    el.textContent = '';
    el.classList.add('hidden');
    el.classList.remove('warn', 'error', 'info');
  }
}

function showDetailStatusNote(msg, type = 'info') {
  const el = $('#detail-status-note');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden', 'warn', 'error', 'info');
  if (type === 'warn') el.classList.add('warn');
  else if (type === 'error') el.classList.add('error');
  else el.classList.add('info');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearDetailStatusNote() {
  const el = $('#detail-status-note');
  if (el) {
    el.textContent = '';
    el.classList.add('hidden');
    el.classList.remove('warn', 'error', 'info');
  }
}

function hasApprovers(r) {
  return (r?.approvers || []).length > 0;
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function openApprovalDialog({ title, description, placeholder, submitLabel, required, onSubmit, onCancel }) {
  const modal = $('#approval-modal');
  const titleEl = $('#approval-modal-title');
  const descEl = $('#approval-modal-description');
  const commentEl = $('#approval-modal-comment');
  const errorEl = $('#approval-modal-error');
  const submitBtn = $('#approval-modal-submit');
  const cancelBtn = $('#approval-modal-cancel');

  if (!modal || !titleEl || !descEl || !commentEl || !errorEl || !submitBtn || !cancelBtn) {
    showToast('Ошибка интерфейса модального окна', 'error');
    return;
  }

  titleEl.textContent = title || 'Комментарий согласующего';
  descEl.textContent = description || '';
  commentEl.value = '';
  commentEl.placeholder = placeholder || 'Введите комментарий...';
  errorEl.textContent = '';
  submitBtn.textContent = submitLabel || 'Сохранить';

  submitBtn.onclick = async () => {
    const comment = commentEl.value.trim();
    if (required && !comment) {
      errorEl.textContent = 'Комментарий обязателен';
      commentEl.focus();
      return;
    }
    closeApprovalDialog();
    await onSubmit(comment);
  };

  cancelBtn.onclick = () => {
    closeApprovalDialog();
    if (typeof onCancel === 'function') onCancel();
  };

  modal.onclick = (event) => {
    if (event.target === modal) {
      closeApprovalDialog();
      if (typeof onCancel === 'function') onCancel();
    }
  };

  modal.classList.remove('hidden');
  commentEl.focus();
}

function closeApprovalDialog() {
  const modal = $('#approval-modal');
  if (modal) modal.classList.add('hidden');
}

function statusClass(s) {
  return `badge status-${s.replace(/\s+/g, '-')}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getLocalDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validateDateFields(from, until) {
  if (!from || !until) return 'Введите оба срока действия заявки';
  const fromDate = new Date(from);
  const untilDate = new Date(until);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(untilDate.getTime())) {
    return 'Введите корректные даты';
  }
  if (fromDate > untilDate) return 'Дата окончания не может быть раньше даты начала';
  return null;
}

function capitalizeFirst(text) {
  if (!text) return text;
  return String(text).charAt(0).toUpperCase() + String(text).slice(1);
}

function roleLabel(role) {
  const map = {
    applicant: 'Заявитель',
    approver: 'Согласующий',
    admin: 'Администратор',
    executor: 'Исполнитель',
  };
  return map[role] || role;
}

// --- Auth ---
async function handleLogin(e) {
  if (e) e.preventDefault();

  const { auth, setToken } = getApi();
  const loginInput = $('#login-input');
  const passwordInput = $('#password-input');
  const errEl = $('#login-error');
  const submitBtn = $('#login-submit') || $('#login-form button[type="submit"]');

  if (!loginInput || !passwordInput || !errEl) {
    alert('Ошибка интерфейса: обновите страницу (Ctrl+F5)');
    return;
  }

  const loginName = loginInput.value.trim();
  const password = passwordInput.value;
  errEl.textContent = '';

  if (!auth?.login) {
    errEl.textContent = 'Не загружен api.js. Обновите страницу (Ctrl+F5).';
    return;
  }

  if (!loginName || !password) {
    errEl.textContent = 'Введите логин и пароль';
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';
  }

  try {
    const data = await auth.login(loginName, password);
    if (!data?.token || !data?.user) {
      throw new Error('Некорректный ответ сервера');
    }
    setToken(data.token);
    currentUser = data.user;
    showApp();
    loadCatalogs()
      .then(() => {
        populateFilterSelects();
        loadRequests();
      })
      .catch((err) => showToast(err.message || 'Ошибка загрузки справочников', 'error'));
  } catch (err) {
    errEl.textContent = err.message || 'Ошибка входа';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Войти';
    }
  }
}

function logout() {
  const { setToken } = getApi();
  setToken(null);
  currentUser = null;
  const loginEl = $('#login-screen');
  const appEl = $('#app');
  if (loginEl) {
    loginEl.classList.remove('hidden');
    loginEl.style.display = '';
  }
  if (appEl) appEl.classList.add('hidden');
}

async function loadUser() {
  const { auth, getToken } = getApi();
  if (!getToken?.() || !auth?.me) return false;
  try {
    const data = await auth.me();
    currentUser = data.user;
    return true;
  } catch {
    getApi().setToken?.(null);
    return false;
  }
}

async function loadCatalogs() {
  const { catalog } = getApi();
  const [depts, res, at, appr, m] = await Promise.all([
    catalog.departments(),
    catalog.resources(),
    catalog.accessTypes(),
    catalog.approvers(),
    catalog.meta(),
  ]);
  catalogs = {
    departments: depts.departments,
    resources: res.resources,
    accessTypes: at.access_types,
    approvers: appr.approvers,
  };
  meta = m;
}

function showApp() {
  const loginEl = $('#login-screen');
  const appEl = $('#app');
  if (!appEl || !currentUser) {
    throw new Error('Не удалось открыть приложение');
  }

  if (loginEl) {
    loginEl.classList.add('hidden');
    loginEl.style.display = 'none';
  }
  appEl.classList.remove('hidden');
  appEl.style.display = 'block';

  const userName = $('#user-name');
  const userRole = $('#user-role');
  if (userName) userName.textContent = currentUser.full_name;
  if (userRole) userRole.textContent = roleLabel(currentUser.role);

  const navReports = $('#nav-reports');
  if (navReports) {
    // Показываем вкладку отчётов только тем, у кого есть право (can_view_reports),
    // при отсутствии поля оставляем прежнюю логику по ролям для совместимости.
    const canView = typeof currentUser.can_view_reports !== 'undefined'
      ? !!currentUser.can_view_reports
      : ['admin', 'executor', 'approver'].includes(currentUser.role);
    if (canView) navReports.classList.remove('hidden');
    else navReports.classList.add('hidden');
  }
  const filterAll = $('#filter-all-wrap');
  if (filterAll && (currentUser.role === 'approver' || currentUser.role === 'admin')) {
    filterAll.classList.remove('hidden');
  }

  // Скрыть кнопку "Новая заявка" для тех, кто не может создавать
  const navCreateBtn = document.querySelector('button[data-view="create"]');
  if (navCreateBtn) {
    if (currentUser.role === 'applicant' || currentUser.role === 'admin') {
      navCreateBtn.classList.remove('hidden');
    } else {
      navCreateBtn.classList.add('hidden');
    }
  }

  showView('list');
}

// --- Navigation ---
function showView(name, params = {}) {
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $$('.nav-btn').forEach((b) => b.classList.remove('active'));

  const viewMap = {
    list: '#view-list',
    create: '#view-create',
    detail: '#view-detail',
    reports: '#view-reports',
  };
  $(viewMap[name])?.classList.remove('hidden');
  $(`[data-view="${name}"]`)?.classList.add('active');

  if (name === 'list') loadRequests();
  if (name === 'create') initCreateForm();
  if (name === 'detail' && params.id) loadRequestDetail(params.id);
  if (name === 'reports') loadReport();
}

// --- Requests list ---
async function loadRequests() {
  const { requests } = getApi();
  const filters = {};
  const status = $('#filter-status').value;
  const priority = $('#filter-priority').value;
  const search = $('#filter-search').value.trim();
  const dateFrom = $('#filter-date-from').value;
  const dateTo = $('#filter-date-to').value;
  const all = $('#filter-all')?.checked;

  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (search) filters.search = search;
  if (dateFrom) filters.date_from = dateFrom;
  if (dateTo) filters.date_to = dateTo;
  if (all) filters.all = 'true';

  try {
    const data = await requests.list(filters);
    renderRequestsTable(data.requests);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderRequestsTable(items) {
  const tbody = $('#requests-tbody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Заявок не найдено</td></tr>';
    return;
  }
  tbody.innerHTML = items
    .map(
      (r) => `
    <tr class="clickable" data-id="${r.id}">
      <td><strong>${r.number}</strong></td>
      <td>${r.applicant_name}</td>
      <td>${r.resource_name}</td>
      <td>${r.access_type_name}</td>
      <td class="priority-${r.priority}">${r.priority}</td>
      <td><span class="${statusClass(r.status)}">${r.status}</span></td>
      <td>${formatDate(r.created_at)}</td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr.clickable').forEach((row) => {
    row.addEventListener('click', () => showView('detail', { id: row.dataset.id }));
  });
}

function populateFilterSelects() {
  const statusSel = $('#filter-status');
  const prioritySel = $('#filter-priority');
  if (!statusSel || !prioritySel) return;
  const statuses = meta?.statuses || [];
  const priorities = meta?.priorities || [];
  statusSel.innerHTML =
    '<option value="">Все статусы</option>' +
    statuses.map((s) => `<option value="${s}">${s}</option>`).join('');
  prioritySel.innerHTML =
    '<option value="">Все приоритеты</option>' +
    priorities.map((p) => `<option value="${p}">${p}</option>`).join('');
}

// --- Create form ---
function initCreateForm() {
  const resSel = $('#create-resource');
  const atSel = $('#create-access-type');
  const deptSel = $('#create-department');

  resSel.innerHTML = catalogs.resources
    .map((r) => `<option value="${r.id}">[${r.type}] ${r.name}</option>`)
    .join('');
  atSel.innerHTML = catalogs.accessTypes
    .map((a) => `<option value="${a.id}">${a.name}</option>`)
    .join('');
  deptSel.innerHTML = catalogs.departments
    .map((d) => `<option value="${d.id}" ${d.id === currentUser.department_id ? 'selected' : ''}>${d.name}</option>`)
    .join('');

  $('#create-form').reset();
  const today = getLocalDate();
  $('#create-valid-from').value = today;
  $('#create-valid-until').value = today;
}

async function handleCreate(e) {
  e.preventDefault();
  const { requests } = getApi();

  const validFrom = $('#create-valid-from').value;
  const validUntil = $('#create-valid-until').value;
  const dateError = validateDateFields(validFrom, validUntil);
  if (dateError) {
    showToast(dateError, 'error');
    return;
  }

  const data = {
    department_id: Number($('#create-department').value),
    resource_id: Number($('#create-resource').value),
    access_type_id: Number($('#create-access-type').value),
    justification: $('#create-justification').value,
    priority: $('#create-priority').value,
    valid_from: validFrom,
    valid_until: validUntil,
  };

  try {
    const result = await requests.create(data);
    showToast(`Заявка ${result.request.number} создана`, 'success');
    showView('detail', { id: result.request.id });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- Detail ---
async function loadRequestDetail(id) {
  const { requests } = getApi();
  try {
    const data = await requests.get(id);
    renderRequestDetail(data.request);
  } catch (err) {
    showToast(err.message, 'error');
    showView('list');
  }
}

function renderRequestDetail(r) {
  currentDetailRequest = r;
  clearRouteError();
  clearDetailStatusNote();

  $('#detail-number').textContent = r.number;
  $('#detail-status').className = statusClass(r.status);
  $('#detail-status').textContent = r.status;

  $('#detail-info').innerHTML = `
    <div class="detail-field"><div class="label">Заявитель</div><div class="value">${r.applicant_name}</div></div>
    <div class="detail-field"><div class="label">Подразделение</div><div class="value">${r.department_name}</div></div>
    <div class="detail-field"><div class="label">Ресурс</div><div class="value">[${r.resource_type}] ${r.resource_name}</div></div>
    <div class="detail-field"><div class="label">Тип доступа</div><div class="value">${r.access_type_name}</div></div>
    <div class="detail-field"><div class="label">Приоритет</div><div class="value priority-${r.priority}">${r.priority}</div></div>
    <div class="detail-field"><div class="label">Срок действия</div><div class="value">${r.valid_from || '—'} — ${r.valid_until || '—'}</div></div>
    <div class="detail-field"><div class="label">Обоснование</div><div class="value">${r.justification}</div></div>
    ${r.approval_comment ? `<div class="detail-field"><div class="label">Комментарий согласующего</div><div class="value">${escapeHtml(r.approval_comment)}</div></div>` : ''}
    <div class="detail-field"><div class="label">Создана</div><div class="value">${formatDate(r.created_at)}</div></div>
  `;

  renderRequestInfoEdit(r);

  if (r.status === 'новая' && !hasApprovers(r) && r.can_edit_approvers) {
    showRouteError(ROUTE_ERROR_MSG, true);
  }

  $('#detail-approvers').innerHTML = (r.approvers || [])
    .map((a) => {
      const isWaiting = !a.decision;
      return `
    <div class="approver-item ${isWaiting ? 'waiting' : 'decided'}">
      <span class="approver-name">${a.approver_name}</span>
      <span class="decision-${a.decision || ''}">${a.decision || 'ожидает'}</span>
    </div>`;
    })
    .join('') || '<p class="empty-state">Маршрут не задан</p>';

  renderApproversEdit(r);

  $('#detail-comments').innerHTML = (r.comments || [])
    .map(
      (c) => `
    <div class="comment">
      <div class="author">${c.user_name}</div>
      <div class="date">${formatDate(c.created_at)}</div>
      <p>${c.text}</p>
    </div>`
    )
    .join('') || '<p class="empty-state">Нет комментариев</p>';

  $('#detail-attachments').innerHTML = (r.attachments || [])
    .map(
      (a) =>
        `<a href="/api/files/${a.id}/download" target="_blank" onclick="event.preventDefault();downloadFile(${a.id},'${a.original_name}')">${a.original_name} (${Math.round(a.size / 1024)} КБ)</a>`
    )
    .join('') || '<p class="empty-state">Нет вложений</p>';

  if (r.status === 'требуется уточнение') {
    const comment = extractApprovalComment(r);
    const clarificationComment = comment
      ? `\nПричина: ${escapeHtml(comment)}.`
      : '\nПричина не указана.';
    if (currentUser.role === 'applicant' && currentUser.id === r.applicant_id) {
      showDetailStatusNote(
        `Согласующий запросил уточнение. Исправьте заявку и нажмите «Повторно отправить».` + clarificationComment,
        'warn'
      );
    } else {
      showDetailStatusNote(
        `Запрос уточнения отправлен заявителю.` + clarificationComment,
        'warn'
      );
    }
  } else if (r.status === 'отклонена') {
    const comment = extractApprovalComment(r);
    const rejectionComment = comment
      ? `\nПричина: ${escapeHtml(comment)}.`
      : '\nПричина не указана.';
    showDetailStatusNote(`Заявка отклонена.` + rejectionComment, 'error');
  } else if (r.status === 'согласована') {
    const approvedComment = extractApprovalComment(r) ? ` ${escapeHtml(extractApprovalComment(r))}` : '';
    showDetailStatusNote(`Заявка согласована.${approvedComment}`, 'info');
  } else if (r.status === 'выполнена') {
    const completedComment = extractApprovalComment(r) ? ` ${escapeHtml(extractApprovalComment(r))}` : '';
    showDetailStatusNote(`Заявка выполнена.${completedComment}`, 'info');
  }

  $('#detail-history').innerHTML = (r.history || [])
    .map((h) => {
      const parts = [];
      let actionLabel = h.action;

      let oldValue = h.old_value && h.old_value !== '—' ? h.old_value : null;
      let newValue = h.new_value && h.new_value !== '—' ? h.new_value : null;

      if (h.action === 'смена статуса') {
        oldValue = capitalizeFirst(oldValue);
        newValue = capitalizeFirst(newValue);
      }

      if (h.action === 'создание') {
        actionLabel = 'Заявка создана';
      }

      if (h.action === 'маршрут') {
        actionLabel = 'Маршрут согласования';
        if (newValue) {
          parts.push(`: ${newValue}`);
          if (oldValue && oldValue !== newValue) {
            parts.push('<div class="history-note">Изменено</div>');
          }
        } else if (oldValue) {
          parts.push(`: ${oldValue}`);
        }
      } else if (h.action !== 'создание') {
        // Для действий согласования делаем первую букву значения заглавной
        let displayOld = oldValue;
        let displayNew = newValue;
        if (h.action === 'согласование') {
          if (oldValue) displayOld = capitalizeFirst(oldValue);
          if (newValue) displayNew = capitalizeFirst(newValue);
        }
        if (displayOld && displayNew) {
          parts.push(`: ${displayOld === displayNew ? displayNew : `${displayOld} → ${displayNew}`}`);
        } else if (displayNew) {
          parts.push(`: ${displayNew}`);
        }
      }

      actionLabel = capitalizeFirst(actionLabel);

      if (h.details && h.action !== 'создание') {
        // details may contain multiple changes separated by '; '
        const items = String(h.details).split(/;\s*/).filter(Boolean);
        parts.push(`<ul class="history-details">${items.map((it) => `<li>${escapeHtml(it)}</li>`).join('')}</ul>`);
      }
      return `
    <li>
      <strong>${escapeHtml(actionLabel)}</strong>
      ${parts.join(' ')}
      <div class="time">${h.user_name || '—'} · ${formatDate(h.created_at)}</div>
    </li>`;
    })
    .join('');

  renderActions(r);
  $('#detail-id').value = r.id;
}

function renderRequestInfoEdit(r) {
  const editBox = $('#detail-info-edit');
  const infoBox = $('#detail-info');
  if (!editBox) return;

  if (!r.can_edit_request) {
    editBox.classList.add('hidden');
    editBox.innerHTML = '';
    infoBox?.classList.remove('hidden');
    return;
  }

  const deptOpts = (catalogs.departments || [])
    .map(
      (d) =>
        `<option value="${d.id}" ${d.id === r.department_id ? 'selected' : ''}>${d.name}</option>`
    )
    .join('');
  const resOpts = (catalogs.resources || [])
    .map(
      (res) =>
        `<option value="${res.id}" ${res.id === r.resource_id ? 'selected' : ''}>[${res.type}] ${res.name}</option>`
    )
    .join('');
  const atOpts = (catalogs.accessTypes || [])
    .map(
      (at) =>
        `<option value="${at.id}" ${at.id === r.access_type_id ? 'selected' : ''}>${at.name}</option>`
    )
    .join('');
  const priOpts = (meta.priorities || ['низкий', 'средний', 'высокий', 'критический'])
    .map((p) => `<option value="${p}" ${p === r.priority ? 'selected' : ''}>${p}</option>`)
    .join('');

  infoBox?.classList.remove('hidden');
  editBox.classList.add('hidden');
  editBox.innerHTML = `
    <div class="request-edit-panel">
      <div class="form-row">
        <div class="form-group">
          <label>Подразделение</label>
          <select id="edit-department">${deptOpts}</select>
        </div>
        <div class="form-group">
          <label>Приоритет</label>
          <select id="edit-priority">${priOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Ресурс</label>
          <select id="edit-resource">${resOpts}</select>
        </div>
        <div class="form-group">
          <label>Тип доступа</label>
          <select id="edit-access-type">${atOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Срок с</label>
          <input type="date" id="edit-valid-from" value="${r.valid_from || ''}">
        </div>
        <div class="form-group">
          <label>Срок по</label>
          <input type="date" id="edit-valid-until" value="${r.valid_until || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Обоснование</label>
        <textarea id="edit-justification" rows="4">${escapeHtml(r.justification)}</textarea>
      </div>
      <div class="btn-group">
        <button type="button" class="btn btn-primary btn-sm" id="btn-save-request-info">Сохранить</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-request-info">Отмена</button>
      </div>
    </div>`;

  $('#btn-save-request-info')?.addEventListener('click', saveRequestInfo);
  $('#btn-cancel-request-info')?.addEventListener('click', () => {
    editBox.classList.add('hidden');
    infoBox?.classList.remove('hidden');
  });
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text || '';
  return d.innerHTML;
}

function extractApprovalComment(r) {
  if (r.approval_comment) return r.approval_comment;
  if (!r.history?.length) return null;
  const statusComment = r.history.find(
    (h) =>
      h.action === 'смена статуса' &&
      (h.new_value === 'требуется уточнение' || h.new_value === 'отклонена') &&
      h.details
  );
  if (statusComment) return statusComment.details;
  const actionComment = r.history.find(
    (h) =>
      h.action === 'согласование' &&
      ['уточнение', 'отклонено'].includes(h.new_value) &&
      h.details
  );
  return actionComment ? actionComment.details : null;
}

function showRequestInfoEdit() {
  $('#detail-info')?.classList.add('hidden');
  $('#detail-info-edit')?.classList.remove('hidden');
}

async function saveRequestInfo() {
  const { requests } = getApi();
  const id = $('#detail-id').value;
  const validFrom = $('#edit-valid-from').value;
  const validUntil = $('#edit-valid-until').value;
  const dateError = validateDateFields(validFrom, validUntil);
  if (dateError) {
    showToast(dateError, 'error');
    return;
  }

  const data = {
    department_id: Number($('#edit-department').value),
    resource_id: Number($('#edit-resource').value),
    access_type_id: Number($('#edit-access-type').value),
    justification: $('#edit-justification').value,
    priority: $('#edit-priority').value,
    valid_from: validFrom,
    valid_until: validUntil,
  };

  if (!data.justification?.trim()) {
    showToast('Заполните обоснование', 'error');
    return;
  }

  try {
    const res = await requests.update(id, data);
    showToast('Данные заявки сохранены', 'success');
    await loadRequestDetail(id);
  } catch (err) {
    console.error('saveRequestInfo error', err);
    showToast(err.message || 'Ошибка сохранения — смотрите консоль', 'error');
  }
}

function renderApproversEdit(r) {
  const editBox = $('#detail-approvers-edit');
  if (!editBox) return;

  if (!r.can_edit_approvers) {
    editBox.classList.add('hidden');
    editBox.innerHTML = '';
    return;
  }

  const selectedIds = new Set((r.approvers || []).map((a) => a.approver_id));
  const listHtml = (catalogs.approvers || [])
    .map(
      (a) => `
    <label class="approver-check">
      <input type="checkbox" name="edit-approver" value="${a.id}" ${selectedIds.has(a.id) ? 'checked' : ''}>
      ${a.full_name} <span class="muted">(${a.department_name || '—'})</span>
    </label>`
    )
    .join('');

  const emptyRoute = !(r.approvers || []).length;
  if (emptyRoute) editBox.classList.remove('hidden');
  else editBox.classList.add('hidden');

  editBox.innerHTML = `
    <div class="approvers-edit-panel">
      <p class="edit-hint">Выберите согласующих по порядку (сверху вниз). Можно изменить, пока никто не принял решение.</p>
      <div class="approvers-checklist">${listHtml || '<p class="empty-state">Нет доступных согласующих</p>'}</div>
      <div class="btn-group" style="margin-top:0.75rem">
        <button type="button" class="btn btn-primary btn-sm" id="btn-save-approvers">Сохранить маршрут</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-approvers-edit">Скрыть</button>
      </div>
    </div>`;

  $('#btn-save-approvers')?.addEventListener('click', saveApproversRoute);
  $('#btn-cancel-approvers-edit')?.addEventListener('click', () => {
    editBox.classList.add('hidden');
  });
}

async function saveApproversRoute() {
  const { requests } = getApi();
  const id = $('#detail-id').value;
  const approverIds = [...$$('input[name="edit-approver"]:checked')].map((c) => Number(c.value));

  if (!approverIds.length) {
    showRouteError('Выберите хотя бы одного согласующего в маршруте.');
    showToast('Выберите хотя бы одного согласующего', 'error');
    return;
  }

  try {
    await requests.setApprovers(id, approverIds);
    clearRouteError();
    showToast('Маршрут согласования сохранён', 'success');
    loadRequestDetail(id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderActions(r) {
  const box = $('#detail-actions');
  box.innerHTML = '';
  const role = currentUser.role;
  const isOwner = r.applicant_id === currentUser.id;
  function addBtn(text, cls, handler) {
    const btn = document.createElement('button');
    btn.className = `${cls}`;
    btn.type = 'button';
    btn.textContent = text;
    btn.addEventListener('click', handler);
    box.appendChild(btn);
  }

  if (r.can_edit_request && (isOwner || role === 'admin')) {
    addBtn('Редактировать заявку', 'btn btn-secondary btn-sm', () => showRequestInfoEdit());
  }

  if (r.can_edit_approvers && (isOwner || role === 'admin')) {
    addBtn('Редактировать маршрут', 'btn btn-secondary btn-sm', () => showApproversEdit());
  }

  if (r.status === 'новая' && (isOwner || role === 'admin')) {
    addBtn('Отправить на согласование', 'btn btn-primary', () => submitRequest());
  }

  if (r.status === 'на согласовании') {
    const isApprover = r.approvers?.some((a) => a.approver_id === currentUser.id);
    // Показываем кнопки согласования только тем, кто указан в маршруте
    // (админ не видит кнопки, если он не в списке согласующих).
    if (isApprover) {
      addBtn('Согласовать', 'btn btn-success btn-sm', () => approveRequest('согласовано'));
      addBtn('Уточнение', 'btn btn-warning btn-sm', () => approveRequest('уточнение'));
      addBtn('Отклонить', 'btn btn-danger btn-sm', () => approveRequest('отклонено'));
    }
  }

  if (r.status === 'требуется уточнение' && (isOwner || role === 'admin')) {
    addBtn('Повторно отправить', 'btn btn-primary', () => resubmitRequest());
  }

  if (r.status === 'согласована' && (role === 'executor' || role === 'admin')) {
    addBtn('Выполнить (доступ выдан)', 'btn btn-success', () => completeRequest());
  }

  if (r.status === 'выполнена' && (role === 'executor' || role === 'admin')) {
    addBtn('Закрыть заявку', 'btn btn-secondary', () => closeRequest());
  }
}

async function submitRequest() {
  const { requests } = getApi();
  const id = $('#detail-id').value;
  const r = currentDetailRequest;

  if (!hasApprovers(r)) {
    showRouteError(ROUTE_ERROR_MSG);
    showApproversEdit();
    showToast(ROUTE_ERROR_MSG, 'error');
    return;
  }

  try {
    await requests.submit(id);
    clearRouteError();
    showToast('Отправлено на согласование', 'success');
    loadRequestDetail(id);
  } catch (err) {
    if (err.message.includes('маршрут') || err.message.includes('согласующ')) {
      showRouteError(err.message);
      showApproversEdit();
    }
    showToast(err.message, 'error');
  }
}

async function approveRequest(decision) {
  const normalized = String(decision || '').trim().toLowerCase();
  const id = $('#detail-id').value;
  const { requests } = getApi();

  const executeApproval = async (comment) => {
    try {
      await requests.approve(id, decision, comment);
      showToast('Решение сохранено', 'success');
      await loadRequestDetail(id);
    } catch (err) {
      console.error('approveRequest error', err);
      showToast(err.message || 'Ошибка согласования — смотрите консоль', 'error');
    }
  };

  if (normalized === 'согласовано') {
    await executeApproval('');
    return;
  }

  if (normalized === 'отклонено') {
    openApprovalDialog({
      title: 'Причина отклонения',
      description: 'Укажите, почему заявка отклонена.',
      placeholder: 'Введите причину отклонения...',
      submitLabel: 'Отклонить',
      required: true,
      onSubmit: executeApproval,
    });
    return;
  }

  if (normalized === 'уточнение') {
    openApprovalDialog({
      title: 'Причина запроса уточнения',
      description: 'Опишите, какую информацию нужно уточнить у заявителя.',
      placeholder: 'Введите причину запроса уточнения...',
      submitLabel: 'Запросить уточнение',
      required: true,
      onSubmit: executeApproval,
    });
    return;
  }

  openApprovalDialog({
    title: 'Комментарий согласующего',
    description: 'Добавьте комментарий по заявке.',
    placeholder: 'Комментарий (необязательно)...',
    submitLabel: 'Сохранить',
    required: false,
    onSubmit: executeApproval,
  });
}

async function resubmitRequest() {
  const { requests } = getApi();
  const id = $('#detail-id').value;
  const r = currentDetailRequest;

  if (!hasApprovers(r)) {
    showRouteError(ROUTE_ERROR_MSG);
    showApproversEdit();
    showToast(ROUTE_ERROR_MSG, 'error');
    return;
  }

  try {
    showToast('Отправка повторной отправки...', 'info');
    const res = await requests.resubmit(id);
    clearRouteError();
    showToast('Заявка повторно отправлена', 'success');
    await loadRequestDetail(id);
  } catch (err) {
    console.error('resubmitRequest error', err);
    if (err.message && (err.message.includes('маршрут') || err.message.includes('согласующ'))) {
      showRouteError(err.message);
      showApproversEdit();
    }
    showToast(err.message || 'Ошибка повторной отправки — смотрите консоль', 'error');
  }
}

async function completeRequest() {
  const { requests } = getApi();
  const id = $('#detail-id').value;
  try {
    showToast('Отправка завершения...', 'info');
    const res = await requests.complete(id);
    showToast('Заявка выполнена', 'success');
    await loadRequestDetail(id);
  } catch (err) {
    console.error('completeRequest error', err);
    showToast(err.message || 'Ошибка выполнения — смотрите консоль', 'error');
  }
}

async function closeRequest() {
  const { requests } = getApi();
  const id = $('#detail-id').value;
  try {
    await requests.close(id);
    showToast('Заявка закрыта', 'success');
    loadRequestDetail(id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addComment() {
  const { requests } = getApi();
  const id = $('#detail-id').value;
  const text = $('#comment-input').value.trim();
  if (!text) return;
  try {
    await requests.comment(id, text);
    $('#comment-input').value = '';
    loadRequestDetail(id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function uploadFile() {
  const { files } = getApi();
  const id = $('#detail-id').value;
  const input = $('#file-input');
  if (!input.files[0]) return;
  try {
    await files.upload(id, input.files[0]);
    input.value = '';
    showToast('Файл прикреплён', 'success');
    loadRequestDetail(id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function downloadFile(id, name) {
  const { getToken } = getApi();
  try {
    const res = await fetch(`/api/files/${id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    showToast('Ошибка загрузки файла', 'error');
  }
}

// --- Reports ---
async function loadReport() {
  const { reports } = getApi();
  const dateFrom = $('#report-date-from').value;
  const dateTo = $('#report-date-to').value;
  const params = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  try {
    const report = await reports.generate(params);
    renderReport(report);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderReport(report) {
  const s = report.summary;
  $('#report-stats').innerHTML = `
    <div class="stat-card"><div class="number">${s.total}</div><div class="label">Всего заявок</div></div>
    <div class="stat-card"><div class="number">${s.avgProcessingDays ? s.avgProcessingDays.toFixed(1) : '—'}</div><div class="label">Ср. дней обработки</div></div>
  `;

  const maxStatus = Math.max(...(s.byStatus?.map((x) => x.count) || [1]), 1);
  $('#report-by-status').innerHTML = (s.byStatus || [])
    .map(
      (x) => `
    <div class="chart-bar">
      <div class="bar-label"><span>${x.status}</span><span>${x.count}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(x.count / maxStatus) * 100}%"></div></div>
    </div>`
    )
    .join('');

  const maxDept = Math.max(...(s.byDepartment?.map((x) => x.count) || [1]), 1);
  $('#report-by-dept').innerHTML = (s.byDepartment || [])
    .map(
      (x) => `
    <div class="chart-bar">
      <div class="bar-label"><span>${x.department}</span><span>${x.count}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(x.count / maxDept) * 100}%"></div></div>
    </div>`
    )
    .join('');

  const tbody = $('#report-tbody');
  tbody.innerHTML = (report.requests || [])
    .map(
      (r) => `
    <tr>
      <td>${r.number}</td>
      <td>${r.applicant}</td>
      <td>${r.department}</td>
      <td>${r.resource}</td>
      <td><span class="${statusClass(r.status)}">${r.status}</span></td>
      <td>${formatDate(r.created_at)}</td>
    </tr>`
    )
    .join('');
}

function exportReport() {
  const table = $('#report-table');
  if (!table) return;
  const csv = [...table.querySelectorAll('tr')]
    .map((row) =>
      [...row.querySelectorAll('th,td')]
        .map((c) => `"${c.textContent.replace(/"/g, '""')}"`)
        .join(';')
    )
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `iga-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function bind(el, event, handler) {
  if (el) el.addEventListener(event, handler);
}

async function boot() {
  if (window.location.protocol === 'file:') {
    const errEl = $('#login-error');
    if (errEl) {
      errEl.textContent =
        'Откройте через сервер: http://localhost:3000';
    }
    return;
  }

  const loginForm = $('#login-form');
  bind(loginForm, 'submit', handleLogin);
  bind($('#logout-btn'), 'click', logout);
  bind($('#create-form'), 'submit', handleCreate);
  bind($('#btn-apply-filters'), 'click', loadRequests);
  bind($('#btn-add-comment'), 'click', addComment);
  bind($('#btn-upload-file'), 'click', uploadFile);
  bind($('#btn-generate-report'), 'click', loadReport);
  bind($('#btn-export-report'), 'click', exportReport);
  bind($('#btn-back'), 'click', () => showView('list'));

  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  try {
    if (await loadUser()) {
      await loadCatalogs();
      populateFilterSelects();
      showApp();
    }
  } catch (err) {
    console.error('IGA boot:', err);
    getApi().setToken?.(null);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Global handlers for inline onclick
function showApproversEdit() {
  const editBox = $('#detail-approvers-edit');
  if (editBox) {
    editBox.classList.remove('hidden');
    editBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

window.showApproversEdit = showApproversEdit;
window.showRequestInfoEdit = showRequestInfoEdit;
window.submitRequest = submitRequest;
window.approveRequest = approveRequest;
window.resubmitRequest = resubmitRequest;
window.completeRequest = completeRequest;
window.closeRequest = closeRequest;
window.downloadFile = downloadFile;
