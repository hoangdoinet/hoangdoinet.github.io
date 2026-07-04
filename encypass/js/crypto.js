export const SecureCrypto = {
  ITERATIONS: 600000, SALT_LEN: 16, IV_LEN: 12,
  
  bufferToBase64: (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))),
  base64ToBuffer: (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)),
  
  getRawKey: async (password) => window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]),
  deriveKey: async (passwordKey, salt) => window.crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: SecureCrypto.ITERATIONS, hash: "SHA-256" }, passwordKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
  
  encrypt: async (text, password) => {
    if (!text || !password) return null;
    const salt = window.crypto.getRandomValues(new Uint8Array(SecureCrypto.SALT_LEN)), iv = window.crypto.getRandomValues(new Uint8Array(SecureCrypto.IV_LEN));
    const aesKey = await SecureCrypto.deriveKey(await SecureCrypto.getRawKey(password), salt);
    const cipher = new Uint8Array(await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, new TextEncoder().encode(String(text))));
    const payload = new Uint8Array(salt.length + iv.length + cipher.length); payload.set(salt, 0); payload.set(iv, salt.length); payload.set(cipher, salt.length + iv.length);
    return SecureCrypto.bufferToBase64(payload);
  },
  
  decryptSafe: async (cipherB64, password) => {
    if (!cipherB64 || !password) return null;
    try {
      const payload = SecureCrypto.base64ToBuffer(cipherB64), salt = payload.slice(0, SecureCrypto.SALT_LEN), iv = payload.slice(SecureCrypto.SALT_LEN, SecureCrypto.SALT_LEN + SecureCrypto.IV_LEN), ciphertext = payload.slice(SecureCrypto.SALT_LEN + SecureCrypto.IV_LEN);
      const aesKey = await SecureCrypto.deriveKey(await SecureCrypto.getRawKey(password), salt);
      return new TextDecoder().decode(await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, aesKey, ciphertext));
    } catch (e) { return null; }
  },

  generateDEK: () => {
    const raw = window.crypto.getRandomValues(new Uint8Array(32));
    return SecureCrypto.bufferToBase64(raw);
  },
  
  importDEK: async (dekBase64) => {
    const raw = SecureCrypto.base64ToBuffer(dekBase64);
    return window.crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  },
  
  encryptWithDEK: async (text, cryptoKey) => {
    if (!text || !cryptoKey) return null;
    const iv = window.crypto.getRandomValues(new Uint8Array(SecureCrypto.IV_LEN));
    const cipher = new Uint8Array(await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cryptoKey, new TextEncoder().encode(String(text))));
    const payload = new Uint8Array(iv.length + cipher.length);
    payload.set(iv, 0); payload.set(cipher, iv.length);
    return SecureCrypto.bufferToBase64(payload);
  },
  
  decryptWithDEK: async (cipherB64, cryptoKey) => {
    if (!cipherB64 || !cryptoKey) return null;
    try {
      const payload = SecureCrypto.base64ToBuffer(cipherB64);
      const iv = payload.slice(0, SecureCrypto.IV_LEN);
      const ciphertext = payload.slice(SecureCrypto.IV_LEN);
      return new TextDecoder().decode(await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, cryptoKey, ciphertext));
    } catch (e) { return null; }
  }
};