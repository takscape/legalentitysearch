import { CsvParseStream } from "@std/csv";
import { LegalEntity, LegalEntityColumns } from "./legalentity.ts";

function streamToAsyncIterableIterator<T>(
  stream: ReadableStream<T>,
  onDone?: () => void | Promise<void>,
): AsyncIterableIterator<T> {
  const reader = stream.getReader();

  const iterator: AsyncIterableIterator<T> = {
    async next() {
      const result = await reader.read();
      if (result.done) {
        await onDone?.();
        return { done: true, value: undefined as unknown as T };
      }
      return { done: false, value: result.value };
    },
    async return(value?: T) {
      try {
        await reader.cancel();
      } finally {
        await onDone?.();
      }
      return { done: true, value: value as T };
    },
    async throw(e?: unknown) {
      try {
        await reader.cancel(e);
      } finally {
        await onDone?.();
      }
      throw e;
    },
    [Symbol.asyncIterator]() {
      return iterator;
    },
  };

  return iterator;
}

/**
 * CSVストリームからLegalEntityを読み取るイテレータ。
 */
export class LegalEntityCsvReader
  implements AsyncIterableIterator<LegalEntity> {
  readonly stream: ReadableStream<LegalEntity>;
  readonly iter: AsyncIterableIterator<LegalEntity>;

  constructor(reader: ReadableStream<string>) {
    this.stream = reader.pipeThrough(
      new CsvParseStream({
        skipFirstRow: false,
        columns: LegalEntityColumns,
      }),
    ) as ReadableStream<LegalEntity>;
    this.iter = streamToAsyncIterableIterator(this.stream);
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<LegalEntity> {
    return this;
  }

  async next(): Promise<IteratorResult<LegalEntity>> {
    return await this.iter.next();
  }

  async return(value?: LegalEntity): Promise<IteratorResult<LegalEntity>> {
    if (this.iter.return) return await this.iter.return(value);
    return { done: true, value: value as LegalEntity };
  }

  async throw(e?: unknown): Promise<IteratorResult<LegalEntity>> {
    if (this.iter.throw) return await this.iter.throw(e);
    throw e;
  }
}
