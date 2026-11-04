const cpfCheckDigit = (digits: number[]) => {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (digits.length + 1 - index),
    0,
  );
  const remainder = (sum * 10) % 11;

  return remainder === 10 ? 0 : remainder;
};

export const isValidCpf = (cpf: string) => {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = [...cpf].map(Number);
  const firstCheck = cpfCheckDigit(digits.slice(0, 9));
  const secondCheck = cpfCheckDigit(digits.slice(0, 10));

  return firstCheck === digits[9] && secondCheck === digits[10];
};
