function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function isStrongPassword(pwd) {
  if (typeof pwd !== 'string' || pwd.length < 6) return false;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  return hasUpper && hasDigit;
}

module.exports = { isValidEmail, isStrongPassword };
