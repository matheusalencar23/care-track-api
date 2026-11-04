export const messages = {
  INVALID_REGISTRATION_CREDENTIALS:
    "Informações de cadastro inválidas. Entre em contato com o suporte!",

  INVALID_CREDENTIALS: "Credenciais inválidas!",

  PATIENT_NOT_FOUND: "Paciente não encontrado!",

  PATIENT_ARCHIVED:
    "Este paciente está arquivado. Reative-o para alterar os dados.",

  PATIENT_ALREADY_ARCHIVED: "Este paciente já está arquivado.",

  PATIENT_NOT_ARCHIVED: "Este paciente não está arquivado.",

  CONSENT_NOT_FOUND: "Consentimento não encontrado!",

  CONSENT_ALREADY_ACTIVE:
    "Já existe um consentimento ativo deste tipo para o paciente.",

  CONSENT_ALREADY_REVOKED: "Este consentimento já foi revogado.",

  CONSENT_REQUIRES_REPRESENTATIVE:
    "O paciente é menor de idade: o consentimento deve ser dado pelo responsável legal.",

  RECORD_NOT_FOUND: "Registro não encontrado!",

  RECORD_VOIDED: "Este registro foi anulado e não pode ser alterado.",

  RECORD_ALREADY_VOIDED: "Este registro já foi anulado.",

  RECORD_VERSION_OUTDATED:
    "Este registro foi alterado depois que você o abriu. Recarregue-o e tente novamente.",

  RECORD_CONTENT_UNCHANGED:
    "O conteúdo informado é igual ao da versão atual do registro.",

  INVALID_LINK_TOKEN: "Link inválido ou expirado!",

  EMAIL_ALREADY_VERIFIED: "Este e-mail já foi confirmado!",

  USER_NOT_FOUND: "Usuário não encontrado!",

  CONFIRMATION_EMAIL_COOLDOWN:
    "O e-mail de confirmação foi enviado há pouco. Aguarde um minuto e tente novamente.",

  UNAUTHORIZED: "Sessão inválida ou expirada. Faça login novamente.",

  VALIDATION_FAILED: "Dados inválidos. Verifique os campos e tente novamente.",

  CONFLICT: "Este registro já existe.",

  TOO_MANY_REQUESTS:
    "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",

  INTERNAL_SERVER_ERROR:
    "Ocorreu um erro inesperado. Tente novamente mais tarde.",
} as const;
