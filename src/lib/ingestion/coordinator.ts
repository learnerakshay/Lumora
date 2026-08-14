import { logger } from '../logger';
import { recoverStaleProcessingAttempts } from '../source-store';
import { IngestionOptions, processSourcePipeline } from './pipeline';
import { commitUsage, discardUsage } from '../usage/service';

interface CoordinatorDependencies {
  process?: typeof processSourcePipeline;
  recover?: typeof recoverStaleProcessingAttempts;
  commitUsage?: typeof commitUsage;
  discardUsage?: typeof discardUsage;
}

export class IngestionCoordinator {
  private readonly active = new Set<string>();
  private recoverySweepActive = false;
  private readonly process: typeof processSourcePipeline;
  private readonly recover: typeof recoverStaleProcessingAttempts;
  private readonly commitUsage: typeof commitUsage;
  private readonly discardUsage: typeof discardUsage;

  constructor(dependencies: CoordinatorDependencies = {}) {
    this.process = dependencies.process || processSourcePipeline;
    this.recover = dependencies.recover || recoverStaleProcessingAttempts;
    this.commitUsage = dependencies.commitUsage || commitUsage;
    this.discardUsage = dependencies.discardUsage || discardUsage;
  }

  dispatch(options: IngestionOptions): boolean {
    if (!options.version) {
      throw new Error('Ingestion dispatch requires an explicit source version');
    }
    const key = `${options.sourceId}:${options.version}`;
    if (this.active.has(key)) return false;
    this.active.add(key);

    void this.process(options)
      .then(async (result) => {
        if (!options.usageEventId) return;
        if (result.success) {
          await this.commitUsage(options.usageEventId, {
            provider: result.provider,
            model: result.model,
            inputTokens: result.inputTokens,
          });
        } else {
          await this.discardUsage(options.usageEventId);
        }
      })
      .catch((error) => {
        if (options.usageEventId) {
          void this.discardUsage(options.usageEventId).catch((discardError) => {
            logger.error('Failed to discard ingestion usage reservation', discardError, {
              sourceId: options.sourceId,
              usageEventId: options.usageEventId,
            });
          });
        }
        logger.error('Unexpected ingestion coordinator failure', error, {
          sourceId: options.sourceId,
          version: options.version,
          sourceType: options.type,
        });
      })
      .finally(() => {
        this.active.delete(key);
      });
    return true;
  }

  async recoverStale(input: {
    staleAfterMs: number;
    maxAutomaticRecoveries: number;
  }): Promise<number> {
    if (this.recoverySweepActive) return 0;
    this.recoverySweepActive = true;
    try {
      const recovered = await this.recover({
        staleBefore: new Date(Date.now() - input.staleAfterMs),
        maxAutomaticRecoveries: input.maxAutomaticRecoveries,
      });
      for (const attempt of recovered) {
        this.dispatch(attempt);
      }
      if (recovered.length > 0) {
        logger.warn('Recovered stale ingestion attempts', {
          recoveredCount: recovered.length,
        });
      }
      return recovered.length;
    } catch (error) {
      logger.error('Ingestion recovery sweep failed', error);
      return 0;
    } finally {
      this.recoverySweepActive = false;
    }
  }

  startRecoveryLoop(input: {
    staleAfterMs: number;
    intervalMs: number;
    maxAutomaticRecoveries: number;
  }): () => void {
    const run = () => {
      void this.recoverStale(input);
    };
    run();
    const timer = setInterval(run, input.intervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }
}

export const ingestionCoordinator = new IngestionCoordinator();
