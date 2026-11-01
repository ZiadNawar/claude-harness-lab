// CRC-32 (IEEE 802.3), table driven.

const TABLE = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  TABLE[n] = c;
}

/** Pass the previous result as `seed` to continue a running checksum. */
export function crc32(bytes, seed = 0) {
  let c = ~seed;
  for (let i = 0; i < bytes.length; i += 1) {
    c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return ~c >>> 0;
}
