import { Readable } from 'stream';

export interface BackfillStreamItem {
  entityId: string;
  timestamp: Date;
}

export class BackfillStream extends Readable {
  private currentTime: Date;
  private readonly endTime: Date;
  private readonly entityIds: string[];
  private readonly intervalMs: number;
  private entityIndex: number = 0;
  private totalItems: number = 0;

  constructor(startTime: Date, endTime: Date, entityIds: string[], intervalMs: number) {
    super({ objectMode: true });
    this.currentTime = new Date(startTime);
    this.endTime = endTime;
    this.entityIds = entityIds;
    this.intervalMs = intervalMs;
  }

  _read() {
    if (this.currentTime >= this.endTime) {
      this.push(null); // End stream
      return;
    }

    // Push current entity + timestamp combination
    const item: BackfillStreamItem = {
      entityId: this.entityIds[this.entityIndex],
      timestamp: new Date(this.currentTime)
    };

    this.push(item);
    this.totalItems++;

    // Move to next entity or next timestamp
    this.entityIndex++;
    if (this.entityIndex >= this.entityIds.length) {
      this.entityIndex = 0;
      this.currentTime.setTime(this.currentTime.getTime() + this.intervalMs);
      
      // Log progress occasionally
      if (this.totalItems % 100 === 0) {
        console.log(`Backfill progress: ${this.totalItems} items, current time: ${this.currentTime.toISOString()}`);
      }
    }
  }

  getTotalItemsProcessed(): number {
    return this.totalItems;
  }
}