import CryptoJS from 'crypto-js';

const SECRET_KEY = "nebula-vps-super-secret-key-v1"; 

export const Security = {
  encrypt: (data: any): string => {
    try {
      const jsonString = JSON.stringify(data);
      return CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
    } catch (e) { return ""; }
  },

  decrypt: (cipherText: string | null): any => {
    if (!cipherText) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      if (!originalText) return null;
      return JSON.parse(originalText);
    } catch (e) { return null; }
  }
};