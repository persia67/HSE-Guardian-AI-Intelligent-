/**
 * Performance Monitor
 * 
 * Utility for monitoring application performance and preventing memory leaks.
 */

interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  fps: number;
  timestamp: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100; // Keep last 100 metrics
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private fpsInterval: number | null = null;
  private memoryCheckInterval: number | null = null;
  private onWarning?: (warning: string) => void;

  // ==================== THRESHOLDS ====================
  private readonly MEMORY_WARNING_MB = 500;
  private readonly MEMORY_CRITICAL_MB = 800;
  private readonly FPS_WARNING = 20;
  private readonly FPS_CRITICAL = 10;

  constructor(onWarning?: (warning: string) => void) {
    this.onWarning = onWarning;
  }

  // ==================== START MONITORING ====================
  start(): void {
    console.log('📊 Performance monitoring started');

    // FPS Monitoring
    this.startFPSMonitoring();

    // Memory Monitoring
    this.startMemoryMonitoring();

    // Performance Observer
    if ('PerformanceObserver' in window) {
      this.startPerformanceObserver();
    }
  }

  // ==================== STOP MONITORING ====================
  stop(): void {
    if (this.fpsInterval) {
      cancelAnimationFrame(this.fpsInterval);
      this.fpsInterval = null;
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    console.log('📊 Performance monitoring stopped');
  }

  // ==================== FPS MONITORING ====================
  private startFPSMonitoring(): void {
    const measureFPS = () => {
      this.frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - this.lastFrameTime;

      if (elapsed >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / elapsed);
        this.recordMetric({ fps });
        
        // Warning if FPS is low
        if (fps < this.FPS_CRITICAL) {
          this.warn(`⚠️ Critical: FPS very low (${fps})`);
        } else if (fps < this.FPS_WARNING) {
          this.warn(`⚠️ Warning: FPS low (${fps})`);
        }

        this.frameCount = 0;
        this.lastFrameTime = currentTime;
      }

      this.fpsInterval = requestAnimationFrame(measureFPS);
    };

    measureFPS();
  }

  // ==================== MEMORY MONITORING ====================
  private startMemoryMonitoring(): void {
    const checkMemory = () => {
      const memory = this.getMemoryUsage();
      if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        this.recordMetric({ memoryUsage: usedMB });

        if (usedMB > this.MEMORY_CRITICAL_MB) {
          this.warn(`🔴 CRITICAL: Memory usage ${usedMB}MB`);
          this.suggestGarbageCollection();
        } else if (usedMB > this.MEMORY_WARNING_MB) {
          this.warn(`⚠️ WARNING: Memory usage ${usedMB}MB`);
        }
      }
    };

    // Check every 30 seconds
    this.memoryCheckInterval = window.setInterval(checkMemory, 30000);
    checkMemory(); // Initial check
  }

  // ==================== PERFORMANCE OBSERVER ====================
  private startPerformanceObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Long Tasks (> 50ms)
          if (entry.duration > 50) {
            console.warn(`🐌 Long task detected: ${entry.name} (${Math.round(entry.duration)}ms)`);
          }
        }
      });

      observer.observe({ entryTypes: ['measure', 'navigation'] });
    } catch (error) {
      console.warn('PerformanceObserver not available:', error);
    }
  }

  // ==================== GET MEMORY INFO ====================
  getMemoryUsage(): MemoryInfo | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  // ==================== SUGGEST GARBAGE COLLECTION ====================
  private suggestGarbageCollection(): void {
    // In Node.js (Electron) environment we can force GC if exposed
    if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
      console.log('🧹 Forcing garbage collection...');
      (globalThis as any).gc();
    } else {
      console.log('💡 Consider reloading the app to free memory');
    }
  }

  // ==================== RECORD METRIC ====================
  private recordMetric(metric: Partial<PerformanceMetrics>): void {
    const latest = this.metrics[this.metrics.length - 1] || {
      memoryUsage: 0,
      cpuUsage: 0,
      fps: 0,
      timestamp: Date.now()
    };

    const newMetric: PerformanceMetrics = {
      memoryUsage: metric.memoryUsage ?? latest.memoryUsage,
      cpuUsage: metric.cpuUsage ?? latest.cpuUsage,
      fps: metric.fps ?? latest.fps,
      timestamp: Date.now()
    };

    this.metrics.push(newMetric);

    // Limit metrics history
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  // ==================== GET CURRENT METRICS ====================
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  // ==================== GET ALL METRICS ====================
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // ==================== GET AVERAGE ====================
  getAverageMetrics(lastN: number = 10): Partial<PerformanceMetrics> {
    const recent = this.metrics.slice(-lastN);
    if (recent.length === 0) return {};

    return {
      memoryUsage: Math.round(
        recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length
      ),
      fps: Math.round(
        recent.reduce((sum, m) => sum + m.fps, 0) / recent.length
      ),
      cpuUsage: Math.round(
        recent.reduce((sum, m) => sum + m.cpuUsage, 0) / recent.length
      )
    };
  }

  // ==================== WARNING HANDLER ====================
  private warn(message: string): void {
    console.warn(message);
    if (this.onWarning) {
      this.onWarning(message);
    }
  }

  // ==================== GET HEALTH STATUS ====================
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  } {
    const current = this.getCurrentMetrics();
    if (!current) {
      return { status: 'healthy', issues: [] };
    }

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check memory
    if (current.memoryUsage > this.MEMORY_CRITICAL_MB) {
      status = 'critical';
      issues.push(`Memory usage critical: ${current.memoryUsage}MB`);
    } else if (current.memoryUsage > this.MEMORY_WARNING_MB) {
      status = 'warning';
      issues.push(`Memory usage high: ${current.memoryUsage}MB`);
    }

    // Check FPS
    if (current.fps < this.FPS_CRITICAL) {
      status = 'critical';
      issues.push(`FPS critical: ${current.fps}`);
    } else if (current.fps < this.FPS_WARNING) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`FPS low: ${current.fps}`);
    }

    return { status, issues };
  }

  // ==================== EXPORT METRICS ====================
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      average: this.getAverageMetrics(),
      health: this.getHealthStatus(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  // ==================== MEASURE FUNCTION ====================
  static async measureFunction<T>(
    name: string,
    fn: () => T | Promise<T>
  ): Promise<T> {
    performance.mark(`${name}-start`);
    
    try {
      const result = await fn();
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name)[0];
      if (measure) {
        // console.log(`⏱️ ${name}: ${Math.round(measure.duration)}ms`);
      }
      
      return result;
    } finally {
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(name);
    }
  }
}

// ==================== SINGLETON ====================
export const performanceMonitor = new PerformanceMonitor((warning) => {
  console.warn('Performance Warning:', warning);
});

export default performanceMonitor;