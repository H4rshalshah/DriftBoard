import { QueueItem, SchemaPayload } from '../types';

export class Queue {
  private items: QueueItem[] = [];
  private maxSize: number;
  private overflowCallback?: (items: QueueItem[]) => void;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  enqueue(payload: SchemaPayload): boolean {
    if (this.items.length >= this.maxSize) {
      const removed = this.items.shift();
      if (this.overflowCallback && removed) {
        this.overflowCallback([removed]);
      }
    }

    const item: QueueItem = {
      id: this.generateId(),
      payload,
      timestamp: Date.now(),
      retries: 0
    };

    this.items.push(item);
    return true;
  }

  dequeue(): QueueItem | undefined {
    return this.items.shift();
  }

  peek(): QueueItem | undefined {
    return this.items[0];
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  toArray(): SchemaPayload[] {
    return this.items.map(item => item.payload);
  }

  getItems(count: number): QueueItem[] {
    return this.items.splice(0, count);
  }

  updateRetries(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.retries += 1;
    }
  }

  setOverflowHandler(callback: (items: QueueItem[]) => void): void {
    this.overflowCallback = callback;
  }
}