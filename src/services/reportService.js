const requestRepository = require('../repositories/requestRepository');
const logger = require('./loggerService');

function generateReport(filters, user) {
  const stats = requestRepository.getReportStats(filters);
  const requests = requestRepository.findAll({
    ...filters,
    limit: filters.limit || 500,
  });

  logger.info('reports', 'Сформирован отчёт', user?.id);

  return {
    generated_at: new Date().toISOString(),
    filters,
    summary: stats,
    requests: requests.map((r) => ({
      number: r.number,
      applicant: r.applicant_name,
      department: r.department_name,
      resource: r.resource_name,
      access_type: r.access_type_name,
      priority: r.priority,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  };
}

module.exports = { generateReport };
