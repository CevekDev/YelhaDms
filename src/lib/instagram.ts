const GRAPH_API = 'https://graph.facebook.com/v19.0';

export async function sendInstagramMessage(
  accessToken: string,
  recipientIgsid: string,
  text: string
): Promise<void> {
  const res = await fetch(`${GRAPH_API}/me/messages?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      message: { text },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Instagram send failed: ${err}`);
  }
}

export async function getInstagramBusinessAccount(
  accessToken: string
): Promise<{ id: string; username: string }> {
  const res = await fetch(
    `${GRAPH_API}/me?fields=id,username&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Invalid Instagram access token');
  const data = await res.json();
  if (!data.id) throw new Error('Could not retrieve Instagram account info');
  return { id: data.id, username: data.username ?? '' };
}
