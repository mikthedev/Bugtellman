/**
 * Performance Behavior Detector - Type definitions
 */

export interface PerformanceMetric {
  name: string;
  type: 'click' | 'navigation' | 'form_submit';
  durationMs: number;
  selector?: string;
  url?: string;
  success: boolean;
}
