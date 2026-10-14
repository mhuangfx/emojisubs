# Platform Development Learnings - Emojisubs v3

**Date:** 2025-01-31
**Context:** Encountered major export performance issues on Linux due to platform API differences

---

## The Problem

### What Happened
- Built entire app on Linux assuming web APIs would work consistently across platforms
- Export functionality using Canvas+FFmpeg hybrid was **extremely slow** (>1 hour per video)
- Root cause: **MediaRecorder API unavailable on Linux's WebKitGTK webview**
- Only discovered after full implementation

### Impact
- Wasted 2+ weeks building workarounds (Canvas+FFmpeg, pure Rust rendering)
- All workarounds were fundamentally slower than MediaRecorder
- Had to switch to Windows development environment mid-project

---

## Root Causes

### 1. **Platform Assumptions**
```
Assumption: "It's web tech, it works everywhere"
Reality: Tauri uses platform-specific webviews with different capabilities
```

**Webview Implementations:**
- Windows: WebView2 (Chromium-based) ✅ Full API support
- macOS: WKWebView (WebKit) ✅ Good API support
- Linux: WebKitGTK (older WebKit) ❌ Limited API support

### 2. **Late Platform Testing**
- Developed entirely on Linux for 3+ weeks
- Never tested on Windows/Mac until export issues appeared
- Critical API availability not verified upfront

### 3. **Architecture Not Platform-Aware**
- Single export implementation assumed consistent APIs
- No abstraction layer for platform differences
- No fallback strategies designed in

---

## What We Should Have Done

### 1. **Test Critical APIs Immediately (Week 1)**

```typescript
// platformCheck.ts - Run on first app load
export async function checkPlatformCapabilities() {
  const platform = await invoke('get_platform');

  const capabilities = {
    platform,
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webCodecs: typeof VideoEncoder !== 'undefined',
  };

  console.warn('Platform Capabilities:', capabilities);

  // Show warning to developer
  if (!capabilities.mediaRecorder) {
    console.error(`⚠️ MediaRecorder unavailable on ${platform}!`);
    console.error('Export will be slow. Consider developing on Windows/Mac.');
  }

  return capabilities;
}
```

**Action:** Call this in App.tsx on mount during development.

---

### 2. **Design Platform-Abstracted Architecture**

```typescript
// export/IVideoExporter.ts
export interface IVideoExporter {
  export(config: ExportConfig): Promise<void>;
  isSupported(): boolean;
  estimatedSpeed(): 'fast' | 'medium' | 'slow';
}

// export/MediaRecorderExporter.ts
export class MediaRecorderExporter implements IVideoExporter {
  isSupported() {
    return typeof MediaRecorder !== 'undefined';
  }

  estimatedSpeed() {
    return 'fast'; // Real-time or near real-time
  }

  async export(config: ExportConfig) {
    // Fast Canvas + MediaRecorder approach
  }
}

// export/FFmpegExporter.ts
export class FFmpegExporter implements IVideoExporter {
  isSupported() {
    return true; // Works everywhere but slow
  }

  estimatedSpeed() {
    return 'slow'; // 10-20x slower than real-time
  }

  async export(config: ExportConfig) {
    // Canvas + FFmpeg frame-by-frame
  }
}

// export/factory.ts
export function getVideoExporter(): IVideoExporter {
  // Try fast method first
  if (new MediaRecorderExporter().isSupported()) {
    return new MediaRecorderExporter();
  }

  // Fallback to universal but slow method
  console.warn('Using slow FFmpeg export (MediaRecorder unavailable)');
  return new FFmpegExporter();
}
```

**Benefits:**
- Clear abstraction - easy to add new exporters
- Auto-selects best available method per platform
- User sees warning if slow method required
- Can be swapped without changing calling code

---

### 3. **Document Platform Differences**

Create `docs/PLATFORM_SUPPORT.md`:

```markdown
## Platform API Support Matrix

| Feature | Windows | macOS | Linux | Notes |
|---------|---------|-------|-------|-------|
| MediaRecorder | ✅ Yes | ✅ Yes | ❌ No | Primary export method |
| OffscreenCanvas | ✅ Yes | ✅ Yes | ⚠️ Partial | Performance boost |
| WebCodecs | ✅ Yes | ⚠️ Partial | ❌ No | Future enhancement |
| Export Speed | Fast | Fast | Slow | 10-20x difference |

## Export Performance

### Windows/Mac (MediaRecorder)
- Real-time or near real-time
- 30-second video exports in ~30-60 seconds

### Linux (Canvas+FFmpeg)
- Frame-by-frame processing
- 30-second video exports in ~10-15 minutes
- Recommend developing on Windows/Mac for this feature

## Development Recommendations

1. **Primary Development:** Windows or macOS
2. **Linux Testing:** Functional testing only, not performance-critical features
3. **User Guidance:** Inform Linux users of slower export times
```

---

### 4. **Use Cargo Feature Flags for Platform Code**

```toml
# Cargo.toml
[features]
default = []
linux-workarounds = ["ffmpeg-next", "image", "imageproc"]

[target.'cfg(target_os = "linux")'.dependencies]
ffmpeg-next = { version = "7.0", optional = true }
image = { version = "0.25", optional = true }
imageproc = { version = "0.25", optional = true }
```

```rust
// lib.rs
#[cfg(target_os = "linux")]
mod linux_export {
    // Linux-specific slow export implementation
}

#[cfg(not(target_os = "linux"))]
mod standard_export {
    // Fast MediaRecorder-based export
}
```

**Benefits:**
- Conditional compilation - no bloat on Windows/Mac
- Clear separation of platform-specific code
- Easier to maintain

---

### 5. **CI/CD Multi-Platform Testing**

```yaml
# .github/workflows/ci.yml
name: Cross-Platform Tests

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run tauri build
      - name: Test export capabilities
        run: npm run test:export
```

**Catches platform issues before they become problems.**

---

### 6. **Consider Electron for Media Apps**

| Framework | Pros | Cons | Best For |
|-----------|------|------|----------|
| **Tauri** | Small size (5-10MB)<br>Native performance<br>Rust backend | Platform webview differences<br>API inconsistencies | Utilities, CRUD apps, tools |
| **Electron** | Consistent Chromium everywhere<br>Full API support<br>No surprises | Large size (100-150MB)<br>More memory usage | Media apps, creative tools, complex web APIs |

**For media-heavy apps (video, audio, canvas):** Electron's consistency may be worth the size trade-off.

---

## Best Practices for Future Projects

### ✅ Do This:

1. **Test on all target platforms in Week 1**
   - Set up VMs or CI for Windows/Mac/Linux
   - Verify critical APIs work on each platform
   - Document any differences immediately

2. **Design platform abstraction layers early**
   - Don't assume APIs work everywhere
   - Create interfaces with multiple implementations
   - Use factory pattern to select best available

3. **Monitor performance across platforms**
   - What's fast on Windows might be slow on Linux
   - Set performance budgets per platform
   - Test with real-world data sizes

4. **Document platform limitations**
   - Be transparent in README
   - Set user expectations
   - Provide workarounds or alternatives

5. **Choose the right framework**
   - Tauri: Great for most apps, but check API support
   - Electron: Better for media/creative apps needing consistency
   - Don't choose based on size alone

### ❌ Don't Do This:

1. **Don't assume "web = universal"**
   - Tauri webviews are NOT browsers
   - APIs vary significantly by platform
   - Always verify, never assume

2. **Don't develop on one platform exclusively**
   - Test on all targets regularly
   - Use CI/CD to catch issues early
   - Don't wait until "almost done" to test elsewhere

3. **Don't build single-path implementations**
   - Always have fallbacks
   - Design for platform differences
   - Accept that some features may differ per platform

4. **Don't ignore early warning signs**
   - If something seems slow in dev, it'll be slower in prod
   - Performance issues compound with scale
   - Address architecture problems early

---

## Specific Lessons for This Project

### What Went Wrong
1. Developed on Linux without checking MediaRecorder support
2. Built entire export flow assuming Canvas APIs would be fast everywhere
3. Only discovered Linux limitations after full implementation
4. Spent weeks building workarounds that were fundamentally slower

### What We Learned
1. **MediaRecorder is 10-20x faster** than frame-by-frame Canvas processing
2. **WebKitGTK lacks modern APIs** that Chromium-based webviews have
3. **Linux is not ideal for Tauri media app development** (at least not with current WebKitGTK)
4. **Platform testing early saves weeks of refactoring**

### Solution Implemented
- Switched to Windows development environment (KVM VM)
- Will use MediaRecorder for fast exports on Windows/Mac
- Linux users will either:
  - Accept slower exports, OR
  - We document Windows/Mac as primary platforms

---

## Recommendations for Next Project

### Project Start Checklist

- [ ] List all critical APIs/features needed
- [ ] Test each API on all target platforms (Week 1)
- [ ] Document platform support matrix
- [ ] Design abstraction layers for any platform-specific features
- [ ] Set up CI/CD for multi-platform builds
- [ ] Choose framework based on API requirements, not just size
- [ ] Create fallback strategies for unsupported features
- [ ] Document platform recommendations in README

### During Development

- [ ] Test on all platforms monthly (minimum)
- [ ] Monitor performance across platforms
- [ ] Update platform support docs as you learn
- [ ] Communicate limitations to users early
- [ ] Don't optimize for one platform at the expense of others

---

## Tools & Resources

### Testing Platform APIs
```javascript
// Quick test harness
const testAPIs = () => {
  console.log({
    MediaRecorder: typeof MediaRecorder !== 'undefined',
    OffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    WebCodecs: typeof VideoEncoder !== 'undefined',
    WebGL2: !!document.createElement('canvas').getContext('webgl2'),
    WebGPU: 'gpu' in navigator,
  });
};
```

### Recommended VM Setup
- **VirtualBox/KVM:** Free, good for basic testing
- **Parallels (Mac):** Best performance for Windows on Mac
- **GitHub Actions:** Free CI/CD for all platforms

### Platform-Specific Testing
- **Windows:** Essential for Tauri apps (WebView2 is most capable)
- **macOS:** Important (large user base, good API support)
- **Linux:** Test but don't rely on as primary dev platform for media apps

---

## Final Thoughts

**The key insight:** Web technology in desktop apps is NOT universally consistent. Tauri's use of platform webviews means each OS has different capabilities.

**For future projects:**
- Test early and often on all platforms
- Design for platform differences from day one
- Choose the right tool for the job (Tauri vs Electron)
- Document everything

**This experience taught us that premature optimization (choosing Tauri for small size) can lead to late-stage architecture problems when platform differences appear.**

---

## References

- [Tauri Platform Support](https://tauri.app/v1/references/webview-versions/)
- [WebView2 vs WebKitGTK API Differences](https://caniuse.com/)
- [Electron vs Tauri Comparison](https://tauri.app/v1/references/benchmarks/)

---

*Created: January 31, 2025*
*Project: Emojisubs v3*
*Team: Development learnings for future reference*
