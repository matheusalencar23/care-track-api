import { Resend } from "resend";
import { RESEND_API_KEY, RESEND_EMAIL_ORIGIN } from "../../config/secrets.js";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { AppLogger } from "../../shared/appLogger.js";

const resend = new Resend(RESEND_API_KEY);

const getEmailTemplate = async (template: string) => {
  const templatePath = resolve(
    process.cwd(),
    `src/services/email/templates/${template}.html`,
  );

  return await readFile(templatePath, "utf-8");
};

export const sendConfirmationEmail = async (
  to: string,
  name: string,
  confirmationUrl: string,
) => {
  AppLogger.info(`Sending confirmation email to ${to}`);

  let html = await getEmailTemplate("confirm-registration");
  html = html
    .replaceAll("{{name}}", name)
    .replaceAll("{{confirmationUrl}}", confirmationUrl);

  await resend.emails.send({
    from: RESEND_EMAIL_ORIGIN,
    to,
    subject: "Confirme seu cadastro",
    html,
  });

  AppLogger.info(`Email sent`);
};
