import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { ENV, type Env } from './env';
import { PrismaService } from './prisma.service';

type Handler = (payload: any) => Promise<void>;

export interface EnqueueOptions {
  delayMs?: number;
  /** Verhindert doppelte Jobs mit derselben Kennung */
  jobId?: string;
}

/**
 * Hintergrundverarbeitung.
 *  - `bullmq`: Jobs über Redis, mit Wiederholungen und wiederkehrenden Jobs.
 *  - `inline`: Jobs laufen direkt im API-Prozess (Tests, Minimalbetrieb ohne Redis).
 *    Wiederkehrende Jobs werden dann per Intervall ausgelöst.
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Queue');
  private readonly handlers = new Map<string, Handler>();
  private readonly recurring: Array<{ name: string; everyMs: number }> = [];
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: IORedis | null = null;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  get driver(): 'bullmq' | 'inline' {
    return this.env.QUEUE_DRIVER;
  }

  register(name: string, handler: Handler): void {
    this.handlers.set(name, handler);
  }

  registerRecurring(name: string, everyMs: number, handler: Handler): void {
    this.register(name, handler);
    this.recurring.push({ name, everyMs });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.driver === 'inline') {
      if (this.env.NODE_ENV !== 'test') {
        for (const job of this.recurring) {
          const timer = setInterval(() => void this.run(job.name, {}), job.everyMs);
          timer.unref();
          this.timers.push(timer);
        }
      }
      return;
    }
    this.connection = new IORedis(this.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const connection = this.connection as unknown as ConnectionOptions;
    this.queue = new Queue('tably', { connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 500, removeOnFail: 2000 } });
    this.worker = new Worker('tably', async (job) => this.execute(job.name, job.data), { connection, concurrency: 8 });
    this.worker.on('failed', (job, err) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void this.recordFailure(job.name, err);
    });
    for (const job of this.recurring) {
      await this.queue.upsertJobScheduler(job.name, { every: job.everyMs }, { name: job.name, data: {} });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.timers.forEach(clearInterval);
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit().catch(() => undefined);
  }

  async enqueue(name: string, payload: unknown, opts: EnqueueOptions = {}): Promise<void> {
    if (this.queue) {
      await this.queue.add(name, payload, { delay: opts.delayMs, jobId: opts.jobId });
      return;
    }
    if (opts.delayMs && this.env.NODE_ENV !== 'test') {
      const timer = setTimeout(() => void this.run(name, payload), opts.delayMs);
      timer.unref();
      return;
    }
    await this.run(name, payload);
  }

  /** Führt einen Job sofort aus und fängt Fehler ab (inline-Modus, Tests, manuelles Auslösen). */
  async run(name: string, payload: unknown): Promise<void> {
    try {
      await this.execute(name, payload);
    } catch (err) {
      await this.recordFailure(name, err as Error);
    }
  }

  private async execute(name: string, payload: unknown): Promise<void> {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`Kein Handler für Job „${name}“ registriert.`);
    await handler(payload);
  }

  private async recordFailure(name: string, err: Error): Promise<void> {
    this.logger.error(`Job ${name} fehlgeschlagen: ${err.message}`);
    await this.prisma.systemError
      .create({ data: { source: `queue:${name}`, message: err.message.slice(0, 1000), stack: err.stack?.slice(0, 4000) } })
      .catch(() => undefined);
  }
}
