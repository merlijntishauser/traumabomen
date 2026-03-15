const MAILPIT_URL = process.env.E2E_MAILPIT_URL || "http://localhost:8025";

interface MailpitMessage {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
}

interface MailpitResponse {
  messages: MailpitMessage[];
}

export async function fetchVerificationEmail(
  email: string,
  maxRetries = 10,
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=10`);
    const data: MailpitResponse = await response.json();

    const message = data.messages.find((m) =>
      m.To.some((to) => to.Address === email),
    );

    if (message) {
      const htmlResponse = await fetch(
        `${MAILPIT_URL}/api/v1/message/${message.ID}`,
      );
      const detail = await htmlResponse.json();
      const body: string = detail.HTML || detail.Text || "";
      const linkMatch = body.match(/href="([^"]*verify[^"]*)"/);
      if (linkMatch) return linkMatch[1];
    }

    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No verification email found for ${email}`);
}

export async function fetchPasswordResetEmail(
  email: string,
  maxRetries = 10,
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=10`);
    const data: MailpitResponse = await response.json();

    const message = data.messages.find(
      (m) =>
        m.To.some((to) => to.Address === email) &&
        m.Subject.toLowerCase().includes("reset"),
    );

    if (message) {
      const htmlResponse = await fetch(
        `${MAILPIT_URL}/api/v1/message/${message.ID}`,
      );
      const detail = await htmlResponse.json();
      const body: string = detail.HTML || detail.Text || "";
      const linkMatch = body.match(/href="([^"]*reset-password[^"]*)"/);
      if (linkMatch) return linkMatch[1];
    }

    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No password reset email found for ${email}`);
}

export async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}
