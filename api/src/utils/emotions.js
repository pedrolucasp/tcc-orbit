// Emotion types enum
export const Emotions = {
  JOY: 'joy',
  TRUST: 'trust',
  FEAR: 'fear',
  SURPRISE: 'surprise',
  SAD: 'sad',
  DISGUST: 'disgust',
  ANGRY: 'angry',
  ANXIETY: 'anxiety'
};

// Valid emotion values for validation
export const VALID_EMOTIONS = Object.values(Emotions);

// Validate emotion type
export function isValidEmotion(emotion) {
  return VALID_EMOTIONS.includes(emotion?.toLowerCase());
}

// Validate intensity value
export function isValidIntensity(intensity) {
  const num = Number(intensity);
  return !isNaN(num) && num >= 1 && num <= 10;
}

// Validate rating value
export function isValidRating(rating) {
  const num = Number(rating);
  return !isNaN(num) && num >= 1 && num <= 10;
}

// Validate level values (stress, anxiety, energy)
export function isValidLevel(level) {
  const num = Number(level);
  return !isNaN(num) && num >= 1 && num <= 10;
}

// Validate mood components array
export function validateMoodComponents(components) {
  if (!Array.isArray(components)) {
    return { valid: false, error: 'Components must be an array' };
  }

  const emotions = new Set();

  for (const component of components) {
    if (!Object.hasOwn(component, 'emotion') || !Object.hasOwn(component, 'intensity')) {
      return { valid: false, error: 'Each component must have emotion and intensity' };
    }

    const emotionLower = component.emotion.toLowerCase();

    if (!isValidEmotion(emotionLower)) {
      return { valid: false, error: `Invalid emotion: ${component.emotion}` };
    }

    if (!isValidIntensity(component.intensity)) {
      return { valid: false, error: `Invalid intensity for ${component.emotion}: must be 1-10` };
    }

    if (emotions.has(emotionLower)) {
      return { valid: false, error: `Duplicate emotion: ${component.emotion}` };
    }

    emotions.add(emotionLower);
  }

  return { valid: true };
}

// Get emotion statistics
export function calculateEmotionStats(moodComponents) {
  const stats = {
    dominant: null,
    average: 0,
    breakdown: {}
  };

  if (!moodComponents || moodComponents.length === 0) {
    return stats;
  }

  let maxIntensity = 0;
  let totalIntensity = 0;

  moodComponents.forEach(component => {
    const intensity = Number(component.intensity);
    totalIntensity += intensity;

    stats.breakdown[component.emotion] = intensity;

    if (intensity > maxIntensity) {
      maxIntensity = intensity;
      stats.dominant = component.emotion;
    }
  });

  stats.average = totalIntensity / moodComponents.length;

  return stats;
}
