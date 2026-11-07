import Foundation
import Capacitor
import AVFoundation
import MediaPlayer

@objc(AudioBridgePlugin)
public class AudioBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioBridgePlugin"
    public let jsName = "AudioBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configureAudioSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNowPlayingInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updatePlaybackState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearNowPlayingInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginBackgroundTask", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endBackgroundTask", returnType: CAPPluginReturnPromise)
    ]

    private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid
    private var backgroundTaskCleanupWorkItem: DispatchWorkItem?
    private let artworkCache = NSCache<NSString, UIImage>()
    private var activeArtworkId: String?
    private var remoteCommandsConfigured: Bool = false

    @objc override public func load() {
        super.load()
        artworkCache.countLimit = 30
        artworkCache.totalCostLimit = 50 * 1024 * 1024 // 50MB
        setupAudioSessionObservers()
        setupRemoteCommands()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        endCurrentBackgroundTask()
    }

    private func endCurrentBackgroundTask() {
        backgroundTaskCleanupWorkItem?.cancel()
        backgroundTaskCleanupWorkItem = nil
        if backgroundTaskId != .invalid {
            let taskId = backgroundTaskId
            backgroundTaskId = .invalid
            UIApplication.shared.endBackgroundTask(taskId)
        }
    }

    private func stableArtworkKey(from str: String) -> NSString {
        if str.hasPrefix("data:image") {
            var hasher = Hasher()
            hasher.combine(str.prefix(512))
            hasher.combine(str.count)
            return NSString(string: "art_b64_\(hasher.finalize())")
        }
        return NSString(string: str)
    }

    // MARK: - Audio Session Configuration
    @objc func configureAudioSession(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, policy: .longFormAudio, options: [])
            try session.setActive(true)
            DispatchQueue.main.async {
                UIApplication.shared.beginReceivingRemoteControlEvents()
            }
            setupRemoteCommands()
            call.resolve(["configured": true])
        } catch {
            call.reject("Failed to configure audio session: \(error.localizedDescription)")
        }
    }

    // MARK: - Now Playing Info & Lock Screen
    @objc func setNowPlayingInfo(_ call: CAPPluginCall) {
        guard let title = call.getString("title") else {
            call.reject("Missing required field: title")
            return
        }

        let artist = call.getString("artist") ?? "Unknown Artist"
        let album = call.getString("album") ?? "btmu"
        let duration = call.getDouble("duration") ?? 0.0
        let currentTime = call.getDouble("currentTime") ?? 0.0
        let playbackRate = call.getDouble("playbackRate") ?? 1.0
        let artworkUrl = call.getString("artworkUrl")

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: album,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: playbackRate,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0
        ]

        if let artStr = artworkUrl, !artStr.isEmpty {
            activeArtworkId = artStr
            let cacheKey = stableArtworkKey(from: artStr)

            if let cached = artworkCache.object(forKey: cacheKey) {
                info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: cached.size) { _ in return cached }
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
                call.resolve(["success": true])
                return
            }

            if artStr.hasPrefix("data:image"), let commaIdx = artStr.firstIndex(of: ",") {
                let base64Str = String(artStr[artStr.index(after: commaIdx)...])
                if let data = Data(base64Encoded: base64Str), let image = UIImage(data: data) {
                    let cost = Int(image.size.width * image.size.height * 4)
                    artworkCache.setObject(image, forKey: cacheKey, cost: cost)
                    info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in return image }
                }
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
                call.resolve(["success": true])
                return
            }

            if let url = URL(string: artStr), url.scheme == "http" || url.scheme == "https" {
                // Apply current info with fallback first
                if let appLogo = UIImage(named: "AppIcon") ?? UIImage(contentsOfFile: Bundle.main.path(forResource: "public/app-logo", ofType: "png") ?? "") {
                    info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: appLogo.size) { _ in return appLogo }
                }
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
                call.resolve(["success": true])

                let targetArtworkId = artStr
                URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                    guard let self = self, let d = data, let img = UIImage(data: d) else { return }
                    let cost = Int(img.size.width * img.size.height * 4)
                    self.artworkCache.setObject(img, forKey: cacheKey, cost: cost)
                    DispatchQueue.main.async {
                        // Guard against race conditions: only update if active artwork is still this track
                        guard self.activeArtworkId == targetArtworkId else { return }
                        var updated = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                        updated[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: img.size) { _ in return img }
                        MPNowPlayingInfoCenter.default().nowPlayingInfo = updated
                    }
                }.resume()
                return
            }

            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            call.resolve(["success": true])
        } else {
            activeArtworkId = nil
            // Default app logo if available
            if let appLogo = UIImage(named: "AppIcon") ?? UIImage(contentsOfFile: Bundle.main.path(forResource: "public/app-logo", ofType: "png") ?? "") {
                info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: appLogo.size) { _ in return appLogo }
            }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            call.resolve(["success": true])
        }
    }

    // MARK: - Lightweight Playback State Updates
    @objc func updatePlaybackState(_ call: CAPPluginCall) {
        let currentTime = call.getDouble("currentTime")
        let playbackRate = call.getDouble("playbackRate") ?? 1.0

        DispatchQueue.main.async {
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            if let ct = currentTime {
                info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = ct
            }
            info[MPNowPlayingInfoPropertyPlaybackRate] = playbackRate
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
        call.resolve(["success": true])
    }

    @objc func clearNowPlayingInfo(_ call: CAPPluginCall) {
        activeArtworkId = nil
        DispatchQueue.main.async {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        }
        call.resolve(["success": true])
    }

    // MARK: - Native Background Tasks for Seamless Track Transition
    @objc func beginBackgroundTask(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.endCurrentBackgroundTask()

            var localTaskId: UIBackgroundTaskIdentifier = .invalid
            localTaskId = UIApplication.shared.beginBackgroundTask(withName: "btmu-track-transition") { [weak self] in
                guard let self = self else { return }
                DispatchQueue.main.async {
                    if self.backgroundTaskId == localTaskId {
                        self.endCurrentBackgroundTask()
                    }
                }
            }
            self.backgroundTaskId = localTaskId

            // Safety timeout: automatically end task after 15 seconds if JS never called endBackgroundTask
            let cleanup = DispatchWorkItem { [weak self] in
                guard let self = self else { return }
                if self.backgroundTaskId == localTaskId {
                    self.endCurrentBackgroundTask()
                }
            }
            self.backgroundTaskCleanupWorkItem = cleanup
            DispatchQueue.main.asyncAfter(deadline: .now() + 15.0, execute: cleanup)

            call.resolve(["taskId": localTaskId.rawValue])
        }
    }

    @objc func endBackgroundTask(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.endCurrentBackgroundTask()
            call.resolve(["ended": true])
        }
    }

    // MARK: - Remote Commands (Lock Screen, Control Center, AirPods)
    private func setupRemoteCommands() {
        guard !remoteCommandsConfigured else { return }
        remoteCommandsConfigured = true

        let commandCenter = MPRemoteCommandCenter.shared()

        // 1. Play
        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "play"])
            return .success
        }

        // 2. Pause
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "pause"])
            return .success
        }

        // 3. Toggle Play/Pause (AirPods single-click)
        commandCenter.togglePlayPauseMusicCommand.isEnabled = true
        commandCenter.togglePlayPauseMusicCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "togglePlayPause"])
            return .success
        }

        // 4. Next Track (AirPods double-click)
        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "nextTrack"])
            return .success
        }

        // 5. Previous Track (AirPods triple-click)
        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "previousTrack"])
            return .success
        }

        // 6. Lock Screen Scrubber Seeking
        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let posEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self?.notifyListeners("remoteCommand", data: [
                "command": "seekTo",
                "position": posEvent.positionTime
            ])
            return .success
        }

        // Disable 15s skip buttons so iOS Lock Screen shows Next/Prev skip buttons exclusively
        commandCenter.skipForwardCommand.isEnabled = false
        commandCenter.skipBackwardCommand.isEnabled = false
        commandCenter.seekForwardCommand.isEnabled = false
        commandCenter.seekBackwardCommand.isEnabled = false
    }

    // MARK: - Audio Session Notifications
    private func setupAudioSessionObservers() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(handleAudioInterruption(_:)), name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(self, selector: #selector(handleAudioRouteChange(_:)), name: AVAudioSession.routeChangeNotification, object: nil)
    }

    @objc private func handleAudioInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

        if type == .began {
            notifyListeners("audioInterruption", data: ["type": "began"])
        } else if type == .ended {
            var shouldResume = false
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                shouldResume = options.contains(.shouldResume)
            }
            notifyListeners("audioInterruption", data: ["type": "ended", "shouldResume": shouldResume])
        }
    }

    @objc private func handleAudioRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }

        if reason == .oldDeviceUnavailable {
            // AirPods or headphone disconnected: pause playback gracefully
            notifyListeners("routeChange", data: ["reason": "oldDeviceUnavailable"])
        }
    }
}
