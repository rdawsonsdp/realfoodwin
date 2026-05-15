// Branded magic-link email for Real Food Win.
// Inline-CSS, table-based layout for broad email-client support
// (Gmail/Outlook/iOS Mail/Yahoo all strip <style> blocks aggressively).

const PALETTE = {
  sunrise: "#F39B47",
  sunriseDeep: "#DD7E2A",
  honey: "#FFD56B",
  cream: "#FFF3D6",
  paper: "#FAF6EF",
  ink: "#1A1A2E",
  inkSoft: "#4A4A5E",
  inkMuted: "#7A7A8E",
};

export function magicLinkSubject(isReturning: boolean, firstName?: string | null): string {
  if (isReturning) {
    return firstName ? `Welcome back, ${firstName}` : "Your Real Food Win sign-in link";
  }
  return firstName
    ? `Welcome to Real Food Win, ${firstName}`
    : "Welcome to Real Food Win — let's sign you in";
}

export function magicLinkHtml({
  url,
  isReturning,
  firstName,
}: {
  url: string;
  isReturning: boolean;
  firstName?: string | null;
}): string {
  const greeting = firstName ? `${firstName}` : isReturning ? "" : "real-food friend";
  const headline = isReturning
    ? firstName
      ? `Welcome back, ${firstName}.`
      : "Welcome back."
    : firstName
      ? `Welcome to Real Food Win, ${firstName}.`
      : "Welcome to Real Food Win.";
  void greeting;
  const lede = isReturning
    ? "Tap the button below to sign in. The link is good for one hour."
    : "Tap the button below to sign in. Then we'll ask you 5 quick questions so the AI food coach knows your kitchen.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Real Food Win</title>
</head>
<body style="margin:0;padding:0;background:${PALETTE.paper};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${PALETTE.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${
    isReturning ? "Sign in to Real Food Win — your real-food coach is ready." : "Welcome to Real Food Win — your personalized real-food coach is one tap away."
  }</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PALETTE.paper};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${PALETTE.sunrise};width:40px;height:40px;border-radius:12px;color:#ffffff;font-size:20px;font-weight:bold;text-align:center;line-height:40px;">◯</td>
                  <td style="padding-left:10px;font-size:18px;font-weight:700;color:${PALETTE.ink};letter-spacing:-0.01em;">Real Food Win</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero card -->
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:48px 40px;box-shadow:0 2px 8px rgba(26,26,46,0.06);">

              <!-- Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:rgba(243,155,71,0.10);border:1px solid rgba(243,155,71,0.30);color:${PALETTE.sunriseDeep};font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;padding:6px 12px;border-radius:999px;">
                    ${isReturning ? "Sign-in link" : "You're in"}
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 12px 0;font-size:32px;line-height:1.15;font-weight:800;color:${PALETTE.ink};letter-spacing:-0.02em;">
                ${headline}
              </h1>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:${PALETTE.inkSoft};">
                ${lede}
              </p>
              ${
                isReturning
                  ? ""
                  : `<p style="margin:0 0 32px 0;font-size:16px;line-height:1.6;color:${PALETTE.inkSoft};">
                You're joining a community building real-food kitchens, family by family — replacing ultra-processed packaged food with whole-food versions of the meals you already love.
              </p>`
              }

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:999px;background:${PALETTE.sunrise};box-shadow:0 8px 24px -8px rgba(243,155,71,0.40);">
                    <a href="${url}" style="display:inline-block;padding:16px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">
                      Sign in to Real Food Win →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0;font-size:13px;color:${PALETTE.inkMuted};">
                Or paste this link into your browser:<br>
                <a href="${url}" style="color:${PALETTE.sunriseDeep};word-break:break-all;">${url}</a>
              </p>

              ${
                isReturning
                  ? ""
                  : `
              <!-- Divider -->
              <div style="height:1px;background:rgba(26,26,46,0.08);margin:36px 0;"></div>

              <!-- Welcome to the community -->
              <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:${PALETTE.ink};">
                🌿 Welcome to the table.
              </h2>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:${PALETTE.inkSoft};">
                Real Food Win is a growing community of home cooks finding real-food versions of the snacks, dinners, and weeknight rescues they actually eat. Every save you make and every recipe you rate helps the AI coach get sharper — for you and for the next person to type the same craving in.
              </p>

              <h2 style="margin:0 0 16px 0;font-size:13px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:${PALETTE.sunriseDeep};">
                Here's what's waiting
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" width="32" style="font-size:18px;color:${PALETTE.sunrise};">→</td>
                        <td style="font-size:15px;line-height:1.5;color:${PALETTE.ink};">
                          <strong style="color:${PALETTE.ink};">A real-food coach that learns your kitchen.</strong>
                          <span style="color:${PALETTE.inkSoft};display:block;margin-top:2px;">Tell us your allergies, household, time budget, and goal once. Every swap from then on is tuned to you.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" width="32" style="font-size:18px;color:${PALETTE.sunrise};">→</td>
                        <td style="font-size:15px;line-height:1.5;color:${PALETTE.ink};">
                          <strong style="color:${PALETTE.ink};">Real-food swaps for the junk you already eat.</strong>
                          <span style="color:${PALETTE.inkSoft};display:block;margin-top:2px;">Type Snickers, Doritos, Pop-Tarts — get a complete recipe with whole-food ingredients, nutrition comparison, and what's wrong with the original.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" width="32" style="font-size:18px;color:${PALETTE.sunrise};">→</td>
                        <td style="font-size:15px;line-height:1.5;color:${PALETTE.ink};">
                          <strong style="color:${PALETTE.ink};">A recipe you can iterate.</strong>
                          <span style="color:${PALETTE.inkSoft};display:block;margin-top:2px;">"Make it dairy-free," "scale to 6," "make it kid-friendlier," or freehand — every change keeps the spirit of the recipe.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" width="32" style="font-size:18px;color:${PALETTE.sunrise};">→</td>
                        <td style="font-size:15px;line-height:1.5;color:${PALETTE.ink};">
                          <strong style="color:${PALETTE.ink};">My Kitchen — your evolving cookbook.</strong>
                          <span style="color:${PALETTE.inkSoft};display:block;margin-top:2px;">Save what works. Add notes. We organize it by meal type and recency so it stays useful as it grows.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" width="32" style="font-size:18px;color:${PALETTE.sunrise};">→</td>
                        <td style="font-size:15px;line-height:1.5;color:${PALETTE.ink};">
                          <strong style="color:${PALETTE.ink};">Your data never leaves the platform.</strong>
                          <span style="color:${PALETTE.inkSoft};display:block;margin-top:2px;">We don't sell, share, or monetize what you tell us. No ad tracking. No third-party analytics that sees your kitchen. Ever.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              `
              }

            </td>
          </tr>

          <!-- Mission line -->
          <tr>
            <td align="center" style="padding:32px 20px 8px 20px;">
              <p style="margin:0;font-size:14px;font-style:italic;color:${PALETTE.inkSoft};">
                Replace ultra-processed food with real food, family by family.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 20px 0 20px;">
              <p style="margin:0;font-size:12px;color:${PALETTE.inkMuted};line-height:1.6;">
                If you didn't request this, you can safely ignore this email. The link expires in one hour.<br>
                Real Food Win · realfoodwin.org
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function magicLinkText({
  url,
  isReturning,
  firstName,
}: {
  url: string;
  isReturning: boolean;
  firstName?: string | null;
}): string {
  if (isReturning) {
    const opener = firstName ? `Welcome back, ${firstName}.` : "Sign in to Real Food Win";
    return `${opener}\n\n${url}\n\nThis link expires in one hour. If you didn't request it, ignore this email.\n\n— Real Food Win\nReplace ultra-processed food with real food, family by family.`;
  }
  const opener = firstName
    ? `Welcome to Real Food Win, ${firstName}.`
    : "Welcome to Real Food Win.";
  return `${opener}\n\nYou're joining a community building real-food kitchens, family by family.\n\nTap this link to sign in:\n${url}\n\nWhat's waiting:\n→ A real-food coach that learns your kitchen — allergies, household, time budget, goals.\n→ Real-food swaps for the junk you already eat (Snickers, Doritos, Pop-Tarts…). Complete recipes, nutrition comparison, ingredient analysis.\n→ Iterate any recipe: "make it dairy-free," "scale to 6," or freehand.\n→ My Kitchen — your evolving cookbook with notes and smart collections.\n→ Your data never leaves the platform. We don't sell, share, or monetize it. No ad tracking.\n\nThe link expires in one hour. Didn't request this? Ignore it.\n\n— Real Food Win\nReplace ultra-processed food with real food, family by family.`;
}
