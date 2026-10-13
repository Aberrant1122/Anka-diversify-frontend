type ExtractionState = {
  status?: "PENDING" | "PROCESSING" | "READY" | "FAILED" | null;
  registrationStatus?: "NOT_PROCESSED" | "PROCESSING" | "FAILED" | "REGISTERED";
};

type Timer = ReturnType<typeof setTimeout>;
type Clock = {
  setTimeout: (callback: () => void, delay: number) => Timer;
  clearTimeout: (timer: Timer) => void;
};

/** One active status loop per mounted file card. A terminal state ends the loop. */
export function createDocumentEvidencePoller<T extends ExtractionState>(
  fetchStatus: () => Promise<T>,
  onStatus: (status: T) => void,
  onError: (error: unknown) => void,
  intervalMs = 2000,
  clock: Clock = {
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timer) => clearTimeout(timer),
  },
) {
  let generation = 0;
  let timer: Timer | null = null;

  function stop() {
    generation++;
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  }

  async function check(currentGeneration: number): Promise<void> {
    try {
      const summary = await fetchStatus();
      if (currentGeneration !== generation) return;
      onStatus(summary);
      if (summary.status === "PENDING" || summary.status === "PROCESSING" ||
          (!summary.status && summary.registrationStatus === "PROCESSING")) {
        timer = clock.setTimeout(() => { void check(currentGeneration); }, intervalMs);
      }
    } catch (error) {
      if (currentGeneration === generation) onError(error);
    }
  }

  function start() {
    stop();
    void check(generation);
  }

  return { start, stop };
}
