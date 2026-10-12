export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

export class CircuitBreakerOpenError extends Error {
  public constructor() {
    super("Circuit breaker is open");
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private stateValue: CircuitBreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private probeInProgress = false;

  public constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;

    if (!Number.isInteger(this.failureThreshold) || this.failureThreshold < 1) {
      throw new Error("failureThreshold must be a positive integer");
    }
    if (!Number.isFinite(this.cooldownMs) || this.cooldownMs < 0) {
      throw new Error("cooldownMs must be a non-negative number");
    }
  }

  public get state(): CircuitBreakerState {
    return this.stateValue;
  }

  public get failureCount(): number {
    return this.consecutiveFailures;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    const isProbe = this.beginRequest();

    try {
      const result = await operation();
      this.handleSuccess(isProbe);
      return result;
    } catch (error) {
      this.handleFailure(isProbe);
      throw error;
    }
  }

  private beginRequest(): boolean {
    if (this.stateValue === "OPEN") {
      if (this.now() - this.openedAt < this.cooldownMs) {
        throw new CircuitBreakerOpenError();
      }
      this.stateValue = "HALF_OPEN";
    }

    if (this.stateValue === "HALF_OPEN") {
      if (this.probeInProgress) {
        throw new CircuitBreakerOpenError();
      }
      this.probeInProgress = true;
      return true;
    }

    return false;
  }

  private handleSuccess(isProbe: boolean): void {
    this.consecutiveFailures = 0;
    if (isProbe) {
      this.probeInProgress = false;
      this.stateValue = "CLOSED";
    }
  }

  private handleFailure(isProbe: boolean): void {
    if (isProbe) {
      this.probeInProgress = false;
      this.openCircuit();
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openCircuit();
    }
  }

  private openCircuit(): void {
    this.stateValue = "OPEN";
    this.openedAt = this.now();
    this.consecutiveFailures = this.failureThreshold;
  }
}
