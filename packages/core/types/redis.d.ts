declare module "redis" {
  export interface RedisClientType {
    isOpen: boolean;
    connect(): Promise<void>;
    incr(key: string): Promise<number>;
    pExpire(key: string, ms: number): Promise<number | boolean>;
    pTTL(key: string): Promise<number>;
    set(key: string, value: string, options?: any): Promise<"OK" | null>;
  }
  export function createClient(opts: { url: string }): RedisClientType;
}
