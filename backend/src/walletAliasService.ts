import { normalizeWalletAddress } from './walletUtils';

export interface WalletAliasIdentifier {
  alias: string;
  source: string;
}

export interface WalletAliasMapping {
  canonicalId: string;
  aliases: string[];
  sources: string[];
}

export class WalletAliasMappingService {
  private aliasToCanonical = new Map<string, string>();
  private aliasMetadata = new Map<string, { alias: string; source: string }>();
  private canonicalToAliases = new Map<string, Set<string>>();
  private canonicalToSources = new Map<string, Set<string>>();
  private canonicalIdCounter = 0;

  registerAlias(alias: string, source: string, canonicalId?: string): WalletAliasMapping {
    const normalizedSource = this.normalizeSource(source);
    const normalizedAlias = this.normalizeAlias(alias, normalizedSource);

    if (!normalizedAlias) {
      throw new Error('Alias value is required');
    }

    if (!normalizedSource) {
      throw new Error('Source value is required');
    }

    const aliasKey = this.buildAliasKey(normalizedAlias, normalizedSource);
    const existingCanonicalId = this.aliasToCanonical.get(aliasKey);
    const targetCanonicalId = canonicalId || existingCanonicalId || this.createCanonicalId();

    if (existingCanonicalId && existingCanonicalId !== targetCanonicalId) {
      this.mergeCanonicalMappings(existingCanonicalId, targetCanonicalId);
    }

    this.aliasToCanonical.set(aliasKey, targetCanonicalId);
    this.aliasMetadata.set(aliasKey, { alias: normalizedAlias, source: normalizedSource });

    this.ensureCanonicalEntry(targetCanonicalId, normalizedAlias, normalizedSource);

    return this.getIdentityLinks(targetCanonicalId) || this.createEmptyMapping(targetCanonicalId);
  }

  resolveAlias(alias: string, source: string): WalletAliasMapping | null {
    const normalizedSource = this.normalizeSource(source);
    const normalizedAlias = this.normalizeAlias(alias, normalizedSource);

    if (!normalizedAlias || !normalizedSource) {
      return null;
    }

    const canonicalId = this.aliasToCanonical.get(this.buildAliasKey(normalizedAlias, normalizedSource));

    if (!canonicalId) {
      return null;
    }

    return this.getIdentityLinks(canonicalId);
  }

  getIdentityLinks(canonicalId: string): WalletAliasMapping | null {
    const aliases = this.canonicalToAliases.get(canonicalId);
    const sources = this.canonicalToSources.get(canonicalId);

    if (!aliases || !sources) {
      return null;
    }

    return {
      canonicalId,
      aliases: Array.from(aliases),
      sources: Array.from(sources),
    };
  }

  private ensureCanonicalEntry(canonicalId: string, alias: string, source: string): void {
    const aliases = this.canonicalToAliases.get(canonicalId) || new Set<string>();
    const sources = this.canonicalToSources.get(canonicalId) || new Set<string>();

    aliases.add(alias);
    sources.add(source);

    this.canonicalToAliases.set(canonicalId, aliases);
    this.canonicalToSources.set(canonicalId, sources);
  }

  private mergeCanonicalMappings(existingCanonicalId: string, targetCanonicalId: string): void {
    const aliases = this.canonicalToAliases.get(existingCanonicalId);
    const sources = this.canonicalToSources.get(existingCanonicalId);

    if (aliases) {
      for (const alias of aliases) {
        for (const source of sources || []) {
          const aliasKey = this.buildAliasKey(alias, source);
          this.aliasToCanonical.set(aliasKey, targetCanonicalId);
          this.aliasMetadata.set(aliasKey, { alias, source });
        }
      }
    }

    const mergedAliases = this.canonicalToAliases.get(targetCanonicalId) || new Set<string>();
    const mergedSources = this.canonicalToSources.get(targetCanonicalId) || new Set<string>();

    for (const alias of aliases || []) {
      mergedAliases.add(alias);
    }

    for (const source of sources || []) {
      mergedSources.add(source);
    }

    this.canonicalToAliases.set(targetCanonicalId, mergedAliases);
    this.canonicalToSources.set(targetCanonicalId, mergedSources);
    this.canonicalToAliases.delete(existingCanonicalId);
    this.canonicalToSources.delete(existingCanonicalId);
  }

  private normalizeAlias(alias: string, source?: string): string {
    const trimmed = alias?.trim();

    if (!trimmed) {
      return '';
    }

    if (this.isStellarAddress(trimmed) || source === 'stellar') {
      return normalizeWalletAddress(trimmed);
    }

    return trimmed.toLowerCase();
  }

  private normalizeSource(source: string): string {
    const trimmed = source?.trim();

    if (!trimmed) {
      return '';
    }

    return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private buildAliasKey(alias: string, source: string): string {
    return `${source}:${alias}`;
  }

  private createCanonicalId(): string {
    this.canonicalIdCounter += 1;
    return `wallet-alias:${this.canonicalIdCounter}`;
  }

  private isStellarAddress(alias: string): boolean {
    return /^G[A-Z0-9]{55,63}$/i.test(alias);
  }

  private createEmptyMapping(canonicalId: string): WalletAliasMapping {
    return {
      canonicalId,
      aliases: [],
      sources: [],
    };
  }
}

export const walletAliasMappingService = new WalletAliasMappingService();
