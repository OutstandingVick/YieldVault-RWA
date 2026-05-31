declare module '@stellar/stellar-sdk' {
  export const BASE_FEE: string;

  export class Keypair {
    static fromSecret(secret: string): Keypair;
    publicKey(): string;
  }

  export class Contract {
    constructor(contractId: string);
    call(method: string, ...args: unknown[]): unknown;
  }

  export namespace SorobanRpc {
    function isSimulationError(input: unknown): boolean;
    function isSimulationRestore(input: unknown): boolean;
    function assembleTransaction(tx: unknown, sim: unknown): { build(): unknown };

    class Server {
      constructor(url: string);
      getAccount(accountId: string): Promise<any>;
      simulateTransaction(tx: unknown): Promise<any>;
      sendTransaction(tx: unknown): Promise<any>;
      getTransaction(hash: string): Promise<any>;
    }
  }

  export function nativeToScVal(value: unknown, options?: unknown): unknown;

  export namespace StrKey {
    function isValidEd25519PublicKey(value: string): boolean;
  }

  export class TransactionBuilder {
    constructor(source: unknown, opts: unknown);
    addOperation(op: unknown): TransactionBuilder;
    setTimeout(timeout: number): TransactionBuilder;
    build(): unknown;
  }
}
