import { encrypt, decrypt } from "./encryption";

export type ShopifyCredentials = {
  platform: "shopify";
  shop_domain: string;
  access_token: string;
  client_id?: string;
  client_secret?: string;
};

export function decryptCredentials(encrypted: string): ShopifyCredentials {
  return JSON.parse(decrypt(encrypted)) as ShopifyCredentials;
}

export function encryptCredentials(creds: ShopifyCredentials): string {
  return encrypt(JSON.stringify(creds));
}
