import { Readable } from 'stream';

export interface RealTimeStreamItem {
  entityId: string;
  timestamp: Date;
}

export class RealTimeStream extends Readable {
  private intervalId: NodeJS.Timeout | null = null;
  private entityIndex: number = 0;
  private readonly entityIds: string[];
  private readonly intervalMs: number;
  private isRunning: boolean = false;

  constructor(entityIds: string[], intervalMs: number) {
    super({ objectMode: true });
    this.entityIds = entityIds;
    this.intervalMs = intervalMs;
  }

  _read() {
    if (!this.intervalId && !this.isRunning) {
      this.startRealTimeGeneration();
    }
  }

  private startRealTimeGeneration() {
    this.isRunning = true;
    
    const generateBatch = () => {
      const timestamp = new Date();
      
      // Push all entities for current timestamp
      for (const entityId of this.entityIds) {
        const item: RealTimeStreamItem = {
          entityId,
          timestamp: new Date(timestamp)
        };
        
        // Check if stream is still readable before pushing
        if (!this.destroyed) {
          this.push(item);
        }
      }
      
      console.log(`Generated real-time metrics for ${this.entityIds.length} entities at ${timestamp.toISOString()}`);
    };

    // Initial batch
    generateBatch();
    
    // Schedule recurring batches
    this.intervalId = setInterval(() => {
      if (!this.destroyed) {
        generateBatch();
      }
    }, this.intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    this.stop();
    callback(error);
  }
}