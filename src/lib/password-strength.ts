export function validatePassword(password: string): { valid: boolean; errors: string[]; score: number } {
  const rules = [
    { test: (pw: string) => pw.length >= 8, error: 'Pelo menos 8 caracteres' },
    { test: (pw: string) => /[A-Z]/.test(pw), error: 'Pelo menos 1 maiúscula' },
    { test: (pw: string) => /[a-z]/.test(pw), error: 'Pelo menos 1 minúscula' },
    { test: (pw: string) => /[0-9]/.test(pw), error: 'Pelo menos 1 número' },
    { test: (pw: string) => /[!@#$%^&*()_+\-=\[\]{};'\":\\|,.<>\/?\`~]/.test(pw), error: 'Pelo menos 1 especial' },
  ];
  const errors: string[] = [];
  let score = 0;
  for (const rule of rules) {
    if (!rule.test(password)) errors.push(rule.error);
    else score++;
  }
  return { valid: errors.length === 0, errors, score };
}

const COMMON_PASSWORDS = new Set([
  'Password1!', 'Passw0rd!', 'Qwerty1!', 'Admin123!', 'Letmein1!',
  'Welcome1!', 'Mysql1!', 'P@ssw0rd', 'P@ssword1', 'Aa123456!',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password);
}
