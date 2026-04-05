type ResetPasswordTemplateInput = {
    username?: string;
    resetLink: string;
};

export function buildResetPasswordEmailHtml({
    username,
    resetLink,
}: ResetPasswordTemplateInput) {
    const safeUser = username || "there";

    return `
<div style="background:#ffffff;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
  <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 16px 0;font-size:22px;">Reset your password</h1>
    <p style="margin:0 0 12px 0;">Hello ${safeUser},</p>
    <p style="margin:0 0 20px 0;">We received a request to reset your password. If you did not request this, you can safely ignore this email.</p>
    <p style="margin:0 0 20px 0;">
      <a href="${resetLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Reset Password</a>
    </p>
    <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">Or open this link:</p>
    <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${resetLink}">${resetLink}</a></p>
  </div>
</div>`.trim();
}
