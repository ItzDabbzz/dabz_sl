type InvitationTemplateInput = {
    username?: string;
    invitedByUsername?: string;
    invitedByEmail?: string;
    teamName?: string;
    inviteLink: string;
};

export function buildInvitationEmailHtml({
    username,
    invitedByUsername,
    invitedByEmail,
    teamName,
    inviteLink,
}: InvitationTemplateInput) {
    const safeInviter = invitedByUsername || "A team member";
    const safeTeamName = teamName || "your team";
    const safeTarget = username || "you";
    const inviterEmailText = invitedByEmail
        ? ` (${invitedByEmail})`
        : "";

    return `
<div style="background:#ffffff;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
  <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 16px 0;font-size:22px;">You're invited</h1>
    <p style="margin:0 0 12px 0;">Hello ${safeTarget},</p>
    <p style="margin:0 0 20px 0;">${safeInviter}${inviterEmailText} invited you to join <strong>${safeTeamName}</strong>.</p>
    <p style="margin:0 0 20px 0;">
      <a href="${inviteLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Accept Invitation</a>
    </p>
    <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">Or open this link:</p>
    <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${inviteLink}">${inviteLink}</a></p>
  </div>
</div>`.trim();
}
