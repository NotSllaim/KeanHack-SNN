export async function analyzeReadingAudio(blob, transcript, micCalibration = null) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  const audioContext = new AudioContextClass();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const samples = mixToMono(audioBuffer);
    const durationSeconds = audioBuffer.duration;
    const windowSeconds = 0.12;
    const windowSize = Math.max(1, Math.floor(audioBuffer.sampleRate * windowSeconds));
    const rmsWindows = [];

    for (let start = 0; start < samples.length; start += windowSize) {
      const end = Math.min(samples.length, start + windowSize);
      rmsWindows.push(calculateRms(samples, start, end));
    }

    const averageRms = average(rmsWindows);
    const maxRms = Math.max(...rmsWindows, 0);
    const silenceThreshold = Math.max(0.012, averageRms * 0.42, maxRms * 0.08);
    const pauses = findPauses(rmsWindows, windowSeconds, silenceThreshold);
    const activeWindows = rmsWindows.filter((value) => value > silenceThreshold);
    const activeRmsAverage = average(activeWindows);
    const variation = standardDeviation(activeWindows, activeRmsAverage);
    const wordCount = countWords(transcript);
    const speakingTimeSeconds = activeWindows.length * windowSeconds;
    const wordsPerMinute = durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;
    const speakingWordsPerMinute = speakingTimeSeconds > 0 ? Math.round((wordCount / speakingTimeSeconds) * 60) : 0;

    return applyMicCalibration({
      durationSeconds: round(durationSeconds, 1),
      speakingTimeSeconds: round(speakingTimeSeconds, 1),
      wordCount,
      wordsPerMinute,
      speakingWordsPerMinute,
      averageVolumePercent: toPercent(activeRmsAverage),
      peakVolumePercent: toPercent(maxRms),
      volumeVariationPercent: toPercent(variation),
      pauseCount: pauses.length,
      longestPauseSeconds: round(Math.max(...pauses, 0), 1)
    }, micCalibration);
  } finally {
    audioContext.close?.();
  }
}

export function applyMicCalibration(metrics, micCalibration) {
  const baseline = Number(micCalibration?.averageVolumePercent || 0);
  const target = Number(micCalibration?.targetVolumePercent || 60);

  if (!metrics || !baseline || baseline <= 0) {
    return metrics;
  }

  const factor = target / baseline;
  return {
    ...metrics,
    micCalibration: {
      averageVolumePercent: baseline,
      targetVolumePercent: target,
      volumeAdjustmentFactor: round(factor, 2)
    },
    normalizedAverageVolumePercent: clampPercent(Math.round(metrics.averageVolumePercent * factor)),
    normalizedPeakVolumePercent: clampPercent(Math.round(metrics.peakVolumePercent * factor)),
    normalizedVolumeVariationPercent: clampPercent(Math.round(metrics.volumeVariationPercent * factor))
  };
}

function mixToMono(audioBuffer) {
  const length = audioBuffer.length;
  const channelCount = audioBuffer.numberOfChannels;
  const mono = new Float32Array(length);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mono[index] += data[index] / channelCount;
    }
  }

  return mono;
}

function calculateRms(samples, start, end) {
  let sum = 0;
  for (let index = start; index < end; index += 1) {
    sum += samples[index] * samples[index];
  }

  return Math.sqrt(sum / Math.max(1, end - start));
}

function findPauses(rmsWindows, windowSeconds, threshold) {
  const minimumPauseSeconds = 0.55;
  const pauses = [];
  let currentPause = 0;

  for (const value of rmsWindows) {
    if (value <= threshold) {
      currentPause += windowSeconds;
    } else if (currentPause >= minimumPauseSeconds) {
      pauses.push(currentPause);
      currentPause = 0;
    } else {
      currentPause = 0;
    }
  }

  if (currentPause >= minimumPauseSeconds) {
    pauses.push(currentPause);
  }

  return pauses;
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values, mean) {
  if (!values.length) {
    return 0;
  }

  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function toPercent(value) {
  return Math.round(Math.min(100, Math.max(0, value * 280)));
}

function clampPercent(value) {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

