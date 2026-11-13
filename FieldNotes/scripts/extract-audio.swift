import AVFoundation
import Foundation

guard CommandLine.arguments.count == 3 else {
    FileHandle.standardError.write(Data("用法：swift scripts/extract-audio.swift 输入视频.mp4 输出音频.m4a\n".utf8))
    exit(2)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let asset = AVURLAsset(url: input)

do {
    guard output.pathExtension.lowercased() == "m4a" else {
        throw CocoaError(.fileWriteInvalidFileName)
    }
    guard !FileManager.default.fileExists(atPath: output.path) else {
        throw CocoaError(.fileWriteFileExists)
    }
    guard try await !asset.loadTracks(withMediaType: .audio).isEmpty,
          let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
        throw CocoaError(.fileReadCorruptFile, userInfo: [NSLocalizedDescriptionKey: "视频没有可导出的音轨。"])
    }
    try await exporter.export(to: output, as: .m4a)
    print(output.path)
} catch {
    FileHandle.standardError.write(Data("提取音频失败：\(error.localizedDescription)\n".utf8))
    exit(1)
}
