// أدوار النظام + مساعد بسيط
const ROLES = ['job_seeker', 'company', 'admin'];

function isRole(role, ...allowed) {
  return allowed.includes(role);
}

module.exports = { ROLES, isRole };
