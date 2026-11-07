import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Register the native AudioBridgePlugin instance for background audio and lock screen controls
        let audioBridge = AudioBridgePlugin()
        bridge?.registerPluginInstance(audioBridge)
    }
}
