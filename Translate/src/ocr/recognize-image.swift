import Foundation
import ImageIO
import Vision

enum ImageError: Error {
    case invalidDimensions
}

func recognize(_ data: Data) throws -> [String] {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int,
          (1...2400).contains(width), (1...2400).contains(height),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw ImageError.invalidDimensions
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: image)
    try handler.perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
}

do {
    let image = FileHandle.standardInput.readDataToEndOfFile()
    let lines = try recognize(image)
    FileHandle.standardOutput.write(try JSONEncoder().encode(lines))
} catch {
    exit(EXIT_FAILURE)
}
