export interface AiClient {
  generateAnswer(sanitizedMessage: string): Promise<string>;
}

export interface MockAiClientOptions {
  /** Defaults to the assessment-required two-second simulated request. */
  delayMs?: number;
  /** Injectable test control; it is never exposed through an HTTP endpoint. */
  shouldFail?: () => boolean;
}

export class MockAiClient implements AiClient {
  private readonly delayMs: number;
  private readonly shouldFail: () => boolean;

  public constructor(options: MockAiClientOptions = {}) {
    this.delayMs = options.delayMs ?? 2_000;
    this.shouldFail = options.shouldFail ?? (() => false);
  }

  public async generateAnswer(sanitizedMessage: string): Promise<string> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));

    if (this.shouldFail()) {
      throw new Error("Mock AI request failed");
    }

    return `Mock AI response: ${sanitizedMessage}`;
  }
}
