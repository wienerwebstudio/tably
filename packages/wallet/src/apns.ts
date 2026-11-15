import http2 from 'node:http2';

export interface ApnsConfig {
  passTypeIdentifier: string;
  certificatePem: string;
  privateKeyPem: string;
  privateKeyPassphrase?: string;
  /** Standard: Produktions-APNs. Wallet-Pässe verwenden immer die Produktionsumgebung. */
  host?: string;
}

export interface ApnsResult {
  pushToken: string;
  ok: boolean;
  status: number;
  /** true = Token ist dauerhaft ungültig und sollte gelöscht werden */
  unregistered: boolean;
  reason?: string;
}

/**
 * Sendet leere Push-Mitteilungen an Wallet. Das Gerät fragt daraufhin den
 * Webservice nach geänderten Pässen. Authentifizierung per mTLS mit dem
 * Pass-Type-ID-Zertifikat.
 */
export async function pushPassUpdate(config: ApnsConfig, pushTokens: string[]): Promise<ApnsResult[]> {
  if (pushTokens.length === 0) return [];
  const client = http2.connect(config.host ?? 'https://api.push.apple.com', {
    cert: config.certificatePem,
    key: config.privateKeyPem,
    passphrase: config.privateKeyPassphrase,
  });
  const connectionError = new Promise<never>((_, reject) => client.once('error', reject));
  try {
    const sendOne = (pushToken: string) =>
      new Promise<ApnsResult>((resolve) => {
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${pushToken}`,
          'apns-topic': config.passTypeIdentifier,
          'apns-push-type': 'background',
          'apns-priority': '5',
          'content-type': 'application/json',
        });
        let status = 0;
        let body = '';
        req.setTimeout(10_000, () => req.close());
        req.on('response', (headers) => {
          status = Number(headers[':status'] ?? 0);
        });
        req.on('data', (d) => (body += d));
        req.on('error', (err) => resolve({ pushToken, ok: false, status: 0, unregistered: false, reason: err.message }));
        req.on('close', () => {
          let reason: string | undefined;
          try {
            reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined;
          } catch {
            reason = body.slice(0, 200);
          }
          resolve({
            pushToken,
            ok: status === 200,
            status,
            unregistered: status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered',
            reason,
          });
        });
        req.end('{}');
      });
    return await Promise.race([Promise.all(pushTokens.map(sendOne)), connectionError]);
  } finally {
    client.close();
  }
}
