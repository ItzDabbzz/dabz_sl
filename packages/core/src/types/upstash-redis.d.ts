declare module "@upstash/redis" {
  export class Redis<T = any> {
    constructor(opts: { url: string; token: string });
    incr(key: string): Promise<number>;
    pexpire(key: string, ms: number): Promise<unknown>;
    pttl(key: string): Promise<number>;
    set(key: string, value: string, opts?: { nx?: boolean; px?: number }): Promise<"OK" | null>;
  }
}
