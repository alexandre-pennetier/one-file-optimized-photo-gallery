# wails-gallery

A small desktop photo gallery. Drop your JPEGs in a folder, build, and you get **one app file**
that shows them in a fast, scrolling grid, grouped by the year they were taken.

- Photos are shrunk and re-compressed (AVIF) at build time, so the app stays small.
- Scrolling stays smooth with thousands of photos; the grid re-flows live when you resize the window.
- Click a photo to see it large (arrow keys / Esc work). A button in the top bar flips the order
  between _most recent first_ (default) and _oldest first_.
- Speaks English and French: it starts in your system language, and a dropdown in the top bar
  switches it.
- Built with [Wails v3](https://v3.wails.io) (Go) + React + TypeScript. Also runs on Android.

## Quick start: get a gallery in 5 minutes

**1. Install the tools once** (Windows, macOS or Linux):

| Tool | Why | Check it with |
| --- | --- | --- |
| [Go](https://go.dev/dl/) 1.25+ | compiles the app shell | `go version` |
| [Node.js](https://nodejs.org) 20+ | builds the web UI and optimizes photos | `node -v` |
| [pnpm](https://pnpm.io/installation) | installs the JS packages | `pnpm -v` |
| Wails 3 CLI | `go install github.com/wailsapp/wails/v3/cmd/wails3@latest` | `wails3 version` |

**2. Add your photos.** Copy `.jpg` / `.jpeg` files into the `photos/` folder at the root of
this repo. Only JPEGs are picked up; sub-folders are ignored.

**3. Run it.**

```bash
wails3 dev      # opens the app with live reload while you work
wails3 build    # makes the final app: bin/wails-gallery.exe (Windows)
```

The first run is the slowest (it optimizes every photo, roughly 1 second each). Later runs only
process new or changed photos, so they are quick.

**4. Done.** `bin/wails-gallery.exe` is a single file you can copy anywhere; the photos are
inside it. It needs the WebView2 runtime, which is already installed on current Windows 10/11.

Something not showing? See [Troubleshooting](#troubleshooting).

## What you see in the app

- **Top banner**: the language dropdown and the sort button on the left, the number of photos on
  the right.
- **Language**: English and French. The app starts in your system language (any other language
  falls back to English). Pick another one in the dropdown (it shows each language with its flag):
  everything, including dates and the window title, switches at once, and your choice is remembered for next time.
- **Sort button**: _Most recent first ↓_ (default) / _Oldest first ↑_. Clicking it re-orders
  everything and jumps back to the top.
- **Year headers**: every time the year changes, a big year label with a line is shown, so
  photos are visually grouped by the year they were **taken**.
- **"Taken" date**: read from the photo's EXIF data (`DateTimeOriginal`). If a photo has none
  (for example a screenshot), the file's modified date is used instead. Photos with the same
  date are ordered by file name.
- **Lightbox**: click a photo to open it large. The day, full date, time and position ("4 / 200")
  are shown in a caption at the bottom. `←` / `→` move between photos, `Esc` or a click on the
  background closes it.

## Run it on Android

The same app runs on Android through Wails. These steps were tested on **Windows 11** with the
Android emulator (x86_64). Building for physical phones (arm64) uses the same flow, see below.

### One-time setup

1. Install **Android Studio**. It provides the SDK, the emulator and a JDK.
2. In Android Studio's _SDK Manager_ install the **NDK (Side by side)** (tested with 28.2) and
   the _Android SDK Command-line Tools_.
3. Create an emulator (_Device Manager_), for example a Pixel with an x86_64 system image.
4. Use a **JDK 17-25** for Gradle. Android Studio's bundled JDK (`jbr`) is a good choice; the
   system-wide Java may be too new.

### Build and run

In a Git Bash terminal at the repo root (adjust the paths to your machine):

```bash
export ANDROID_HOME="C:/Users/<you>/AppData/Local/Android/Sdk"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export PATH="/c/Program Files/Android/Android Studio/jbr/bin:/c/Users/<you>/AppData/Local/Android/Sdk/platform-tools:$PATH"

wails3 task android:build                      # frontend + Go shared library (x86_64 for the emulator)
(cd build/android && ./gradlew assembleDebug)  # package the APK
```

Start the emulator (from Android Studio, or `emulator -avd <name>`), then:

```bash
adb install -r build/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.wails.app/.MainActivity
```

For a real phone use `wails3 task android:build ARCH=arm64` (or the `android:package` task for a
signed release APK in `bin/`), then install it with `adb install`.

### Android notes

- **Windows host fix**: the stock Wails `build/android/Taskfile.yml` only knew macOS/Linux. It is
  patched to use the NDK's `windows-x86_64` toolchain and `.cmd` compiler wrappers, and to find
  the SDK in `%LOCALAPPDATA%\Android\Sdk`.
- **Why the env vars**: the Task script's own NDK lookup did not work under Git Bash, so
  `ANDROID_NDK_HOME` is set explicitly. `wails3 task android:run` also fails its `adb`
  precondition on Windows, which is why the install/launch steps above are manual.
- **Status bar**: the UI is edge-to-edge, so the banner pads itself with
  `env(safe-area-inset-top)` and the grid with the bottom inset.
- **Not tested**: arm64 / physical devices and release signing.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Add JPEGs to the photos folder and rebuild" | `photos/` has no `.jpg`/`.jpeg`; add some and run `wails3 dev` or `wails3 build` again. |
| New photos don't appear in `pnpm dev` | Use `wails3 dev`; running `pnpm dev` directly skips photo optimization (or run `pnpm run optimize` in `frontend/` first). |
| Build fails on one photo | The error names the file (`failed to process photos/<name>`); the JPEG is corrupt, replace or remove it. |
| `exit status 143` when stopping `wails3 dev` | Normal: it is just the dev session being killed. |
| exe still shows the old icon | Windows icon cache: rename the exe or run `ie4uinit.exe -show`. |

## Commands cheat sheet

```bash
wails3 dev                    # dev server + app window (optimizes photos first)
wails3 build                  # production exe -> bin/wails-gallery.exe
wails3 task build:small       # build, then UPX-compress the exe (see "Tidbits")
wails3 task optimize:photos   # run only the photo pipeline
cd frontend && pnpm test      # unit tests (vitest); `pnpm typecheck` for tsc
cd frontend && pnpm format    # prettier (`pnpm format:check` to only check)
```

## How it works

### Stack

| Layer | Tech |
| --- | --- |
| Shell | Wails v3 (`v3.0.0-beta.x`), Go, `CGO_ENABLED=0` on Windows, WebView2 |
| Frontend | React 18, TypeScript, Vite 8, `@wailsio/runtime` |
| Package manager | **pnpm** (lockfile: `frontend/pnpm-lock.yaml`; default set in `Taskfile.yml`) |
| Image pipeline | `sharp` (libvips + libaom, prebuilt) run by Node at build time |
| Tests / format | vitest + Testing Library (jsdom), Prettier |
| Build orchestration | [Task](https://taskfile.dev) via `wails3 build` / `wails3 dev` / `wails3 task <name>` |

There are no Go services or bound methods: the Go side only creates the window and serves the
embedded `frontend/dist` (`main.go`). All logic lives in the frontend.

### Project layout

```
photos/                       input JPEGs (gitignored; only `put-photos-here` is tracked)
frontend/
  scripts/optimize-photos.mjs CLI entry (paths); logic in scripts/optimize-lib.mjs (tested)
  scripts/appicon.svg         source of build/appicon.png
  public/photos/              GENERATED, gitignored (AVIFs + manifest.json)
  src/App.tsx                 loads the manifest, holds sort order + lightbox state
  src/Banner.tsx              top bar: title, count, sort-order toggle
  src/LanguageSelect.tsx      accessible language dropdown with SVG flags
  src/Gallery.tsx             windowed grid of tiles + year headers
  src/Lightbox.tsx            full-size viewer (dialog, keyboard + buttons)
  src/useViewport.ts          rAF-throttled scroll/size tracking
  src/i18n.tsx                English/French messages, language detection + provider
  src/layout.ts               sorting, justified rows, year grouping (pure, unit-tested)
  src/*.test.ts(x)            vitest tests
  bindings/                   GENERATED by wails3 (no services, only runtime internals)
build/                        Wails platform build assets + Taskfiles
  appicon.png                 1024px source icon -> windows/icon.ico, darwin/icons.icns
  android/                    Gradle project + patched Taskfile for Android
main.go                       window + embed of frontend/dist
```

### Photo pipeline (`frontend/scripts/optimize-lib.mjs`)

Wired in as the Task `optimize:photos` (`build/Taskfile.yml`), a dependency of `build:frontend`
and `dev:frontend`. Task caches it on `photos/*.jp(e)g` + the scripts, so it is skipped when
nothing changed.

Per photo it produces, under `frontend/public/photos/` (copied into `dist`, then embedded):

- `<id>.avif`: full size, long edge 2000 px, q50, effort 6 (lightbox)
- `<id>-t.avif`: thumbnail, long edge 720 px, q45 (grid)
- a 16 px blurred WebP data URI (`lqip`) inlined in `manifest.json` as a placeholder
- `manifest.json`: `[{id, name, taken, w, h, thumb, full, lqip}]`, where `taken` is the capture
  time (EXIF `DateTimeOriginal`, else file mtime) stored as a "wall clock" UTC epoch in ms: the
  date and time exactly as the camera wrote them, with no timezone conversion. The UI formats it
  with `timeZone: 'UTC'`, so a photo shows the same time on every machine. It is recomputed every
  run, so it is never stale in the cache.

`id` is a SHA-1 prefix of the source bytes + encoder settings, so edits and setting changes are
detected, unchanged photos are skipped, and outputs for removed photos are deleted. EXIF
orientation is applied and metadata stripped. Quality/size constants are at the top of
`optimize-lib.mjs`. Identical files share an id and appear once.

Typical result: ~40 MB of JPEG -> ~2.7 MB for 22 photos. Encoding runs up to 4 photos in
parallel; measured on a 20-core machine this is already at the plateau (the encoder is
multi-threaded itself), and no GPU path exists in sharp.

### Gallery rendering

- **Justified rows** (`layout.ts#justify`): aspect ratios preserved, each row scaled to fill
  the width exactly; the last row of a group keeps the target height. O(n), rerun on every resize.
- **Year groups** (`layout.ts#layoutByYear`): photos are sorted by `taken` (`sortPhotos`, ties
  broken by file name) and a header block is inserted whenever the year changes; rows are laid
  out per year. EXIF has no timezone, so the year is the one the camera wrote (`yearOf` uses UTC getters on
  the wall-clock value).
- **Windowing**: only rows (and headers) within ~1200 px of the viewport are mounted
  (`firstRowAt` binary search). "Infinite scroll" here means the whole list is virtualized.
- **Cheap updates**: scroll and `ResizeObserver` events are coalesced to one state update per
  animation frame, and the scroll offset is snapped to 300 px, so the mounted set is recomputed
  rarely. Tiles are `memo`ized, positioned with `transform`, `contain: strict`; images use
  `decoding="async"` and a blurred LQIP background.
- **Responsive**: target row height follows window height (clamped 140-320 px), so resizing the
  window reflows the gallery live.
- **Lightbox**: dialog semantics, focus moves in and is restored on close, neighbours are
  preloaded.

### Tidbits

- **Languages** (`src/i18n.tsx`): a tiny built-in i18n, no library. `MESSAGES` holds one typed
  dictionary per language (a missing key is a compile error; plurals are functions). The start
  language comes from `navigator.languages` (the WebView follows the OS language), matching on the
  base subtag (`fr-CA` -> `fr`). The saved choice (`localStorage` key `gallery.lang`) wins over the
  system language. To add a language: add it to `LANGUAGES`, `LANGUAGE_NAMES` and `MESSAGES`.
  Dates use `Intl` with the active language. The native window title is changed through the
  Wails runtime (`Window.SetTitle`), and `<html lang>` / `document.title` follow too.
- **Flags are SVG, not emoji**: Windows has no flag glyphs and shows emoji flags as the letters
  "GB" / "FR", so the dropdown is a custom listbox (keyboard accessible) with inline SVG flags.
  Native `<select>` options cannot contain images.
- **pnpm**: `frontend/.npmrc` sets `minimum-release-age=10080` (7 days; honoured by pnpm).
  pnpm 10+ does not run `pre`/`post` scripts by default, which is why scripts chain commands
  explicitly. If the shared store is on another drive, pnpm warns and uses `D:\.pnpm-store`.
  `@wailsio/runtime` is pinned (not `latest`) for reproducible builds.
- **Icon pipeline**: edit `frontend/scripts/appicon.svg`, render to `build/appicon.png`
  (1024x1024, transparent), and the next build regenerates `.ico`/`.icns` and re-embeds the
  `.syso`. `build/appicon.icon` (macOS Icon Composer) is still the stock Wails logo.
- **Exe size**: production build is `-trimpath -ldflags="-w -s -H windowsgui"`. UPX is opt-in via
  `build:small` (~11 MB -> ~4 MB before photos); it can trip antivirus heuristics and slightly
  slows startup. AVIF does not compress further.
- **AVIF in the backend?** Deliberately not: no production pure-Go AVIF encoder exists; it
  would need cgo or an external binary and break the `CGO_ENABLED=0` / Docker cross-compile
  setup. sharp ships prebuilt encoders.
- **WebView2** is required at runtime on Windows (preinstalled on Windows 11 / current Windows 10).
- **Product metadata** (company, product name, identifier) lives in `build/config.yml`; after
  editing run `wails3 task common:update:build-assets`.
- **Generated and ignored**: `frontend/dist`, `frontend/public/photos`, `frontend/node_modules`,
  `bin/`, `.task/`, and the Android build output. `build/docker/Dockerfile.cross` installs pnpm
  for cross-compiles.
- **Line endings**: `.gitattributes` normalizes text files to LF.
