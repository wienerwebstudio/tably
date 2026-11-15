import { createCipheriv } from 'node:crypto';

const BLOCK = 16;
const ZERO = Buffer.alloc(BLOCK);

function aesEcbEncryptBlock(key: Buffer, block: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

function leftShiftOne(input: Buffer): Buffer {
  const out = Buffer.alloc(input.length);
  let carry = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const byte = input[i]!;
    out[i] = ((byte << 1) & 0xff) | carry;
    carry = (byte & 0x80) >>> 7;
  }
  return out;
}

function xor(a: Buffer, b: Buffer): Buffer {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! ^ b[i]!;
  return out;
}

function subkeys(key: Buffer): { k1: Buffer; k2: Buffer } {
  const l = aesEcbEncryptBlock(key, ZERO);
  let k1 = leftShiftOne(l);
  if (l[0]! & 0x80) k1[BLOCK - 1] = k1[BLOCK - 1]! ^ 0x87;
  let k2 = leftShiftOne(k1);
  if (k1[0]! & 0x80) k2[BLOCK - 1] = k2[BLOCK - 1]! ^ 0x87;
  return { k1, k2 };
}

/** AES-128-CMAC nach RFC 4493 / NIST SP 800-38B. */
export function aesCmac(key: Buffer, message: Buffer): Buffer {
  if (key.length !== BLOCK) throw new Error('AES-CMAC erwartet einen 16-Byte-Schlüssel');
  const { k1, k2 } = subkeys(key);
  const blockCount = Math.max(1, Math.ceil(message.length / BLOCK));
  const lastComplete = message.length > 0 && message.length % BLOCK === 0;

  let last: Buffer;
  const lastStart = (blockCount - 1) * BLOCK;
  if (lastComplete) {
    last = xor(message.subarray(lastStart, lastStart + BLOCK), k1);
  } else {
    const padded = Buffer.alloc(BLOCK);
    message.copy(padded, 0, lastStart);
    padded[message.length - lastStart] = 0x80;
    last = xor(padded, k2);
  }

  let x: Buffer = ZERO;
  for (let i = 0; i < blockCount - 1; i++) {
    x = aesEcbEncryptBlock(key, xor(x, message.subarray(i * BLOCK, (i + 1) * BLOCK)));
  }
  return aesEcbEncryptBlock(key, xor(x, last));
}
