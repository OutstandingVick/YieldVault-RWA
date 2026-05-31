/**
 * Normalizes a Stellar wallet address to a canonical format.
 * Stellar addresses are case-insensitive, but traditionally displayed in uppercase.
 * This utility trims whitespace and converts to uppercase.
 */
export function normalizeWalletAddress(address: string | undefined | null): string {
  if (!address) {
    return '';
  }
  return address.trim().toUpperCase();
}

/**
 * Validates if a string looks like a valid Stellar public key (starts with G, 56 characters).
 * Note: This is a basic structural check, not a full cryptographic checksum validation.
 */
export function isValidStellarAddress(address: string | undefined | null): boolean {
  if (!address) return false;
  const normalized = normalizeWalletAddress(address);
  return /^G[A-Z0-9]{55,63}$/.test(normalized);
}
