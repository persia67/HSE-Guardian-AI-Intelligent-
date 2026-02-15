
/**
 * Performance Monitor
 * 
 * High-performance utility for monitoring application health without thread blocking.
 */

interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  fps: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 60; 
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private fpsInterval: number | null = null;
  private memoryCheckInterval: number | null = null;
  private startTime = Date.now();
  
  // Smoothing factor for exponential moving average
  private smoothedFps = 60;
  private alpha = 0.2;

  // ==================== THRESHOLDS ====================
  private readonly MEMORY_WARNING_MB = 1000;
  private readonly FPS_WARNING = 10; 
  private readonly FPS_CRITICAL = 3;

  constructor() {}

  start(): void {
    this.startFPSMonitoring();
    this.startMemoryMonitoring();
  }

  stop(): void {
    if (this.fpsInterval) cancelAnimationFrame(this.fpsInterval);
    if (this.memoryCheckInterval) clearInterval(this.memoryCheckInterval);
  }

  private startFPSMonitoring(): void {
    const measureFPS = () => {
      this.frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - this.lastFrameTime;

      if (elapsed >= 1000) {
        const rawFps = Math.round((this.frameCount * 1000) / elapsed);
        
        // Exponential moving average for stability
        this.smoothedFps = (this.alpha * rawFps) + ((1 - this.alpha) * this.smoothedFps);
        
        this.recordMetric({ fps: Math.round(this.smoothedFps) });
        
        // Silence warnings for first 10 seconds (initialization period)
        if (Date.now() - this.startTime > 10000) {
          if (this.smoothedFps < this.FPS_CRITICAL) {
            console.warn(`Critical Performance: ${rawFps} FPS`);
          }
        }

        this.frameCount = 0;
        this.lastFrameTime = currentTime;
      }
      this.fpsInterval = requestAnimationFrame(measureFPS);
    };
    measureFPS();
  }

  private startMemoryMonitoring(): void {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        this.recordMetric({ memoryUsage: usedMB });
        
        if (usedMB > this.MEMORY_WARNING_MB) {
          console.warn(`High memory usage: ${usedMB}MB`);
        }
      }
    };
    this.memoryCheckInterval = window.setInterval(checkMemory, 10000);
  }

  private recordMetric(metric: Partial<PerformanceMetrics>): void {
    const latest = this.metrics[this.metrics.length - 1] || {
      memoryUsage: 0,
      cpuUsage: 0,
      fps: 60,
      timestamp: Date.now()
    };

    this.metrics.push({
      memoryUsage: metric.memoryUsage ?? latest.memoryUsage,
      cpuUsage: metric.cpuUsage ?? latest.cpuUsage,
      fps: metric.fps ?? latest.fps,
      timestamp: Date.now()
    });

    if (this.metrics.length > this.maxMetrics) this.metrics.shift();
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getHealthStatus(): { status: 'healthy' | 'warning' | 'critical' } {
    const current = this.getCurrentMetrics();
    if (!current || Date.now() - this.startTime < 5000) return { status: 'healthy' };

    if (current.fps < this.FPS_CRITICAL || current.memoryUsage > 1500) return { status: 'critical' };
    if (current.fps < this.FPS_WARNING || current.memoryUsage > this.MEMORY_WARNING_MB) return { status: 'warning' };
    return { status: 'healthy' };
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
