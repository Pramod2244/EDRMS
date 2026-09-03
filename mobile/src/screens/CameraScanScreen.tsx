import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { EdgeDetectionService } from "../services/EdgeDetectionService";

export default function CameraScanScreen() {
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = () => {
    setIsCapturing(true);
    setTimeout(() => {
      setCapturedPages((prev) => [...prev, `page_${prev.length + 1}.jpg`]);
      setIsCapturing(false);
    }, 400);
  };

  return (
    <View style={styles.container}>
      {/* Viewfinder Viewport */}
      <View style={styles.cameraViewport}>
        <View style={styles.documentTargetQuad}>
          <Text style={styles.guideText}>Align document inside the frame</Text>
        </View>
      </View>

      {/* Capture Bottom Bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.pageCountText}>{capturedPages.length} Pages Scanned</Text>
        <TouchableOpacity
          onPress={handleCapture}
          disabled={isCapturing}
          style={styles.shutterButton}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>
        {capturedPages.length > 0 && (
          <TouchableOpacity style={styles.finishButton}>
            <Text style={styles.finishButtonText}>Review & Upload</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraViewport: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  documentTargetQuad: {
    width: "100%",
    height: "80%",
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderRadius: 12,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  guideText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  bottomBar: {
    height: 120,
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  pageCountText: {
    color: "#aaa",
    fontSize: 13,
  },
  shutterButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
  },
  finishButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  finishButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
