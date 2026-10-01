function validateInitialPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128
    && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}
module.exports = { validateInitialPassword };
