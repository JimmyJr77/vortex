import AppKit
import Foundation
import ImageIO
import Vision

guard CommandLine.arguments.count > 1 else {
  fputs("usage: swift scripts/ocr-image.swift IMAGE...\n", stderr)
  exit(2)
}

for imagePath in CommandLine.arguments.dropFirst() {
  let imageURL = URL(fileURLWithPath: imagePath) as CFURL
  guard
    let source = CGImageSourceCreateWithURL(imageURL, nil),
    let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    fputs("unable to read \(imagePath)\n", stderr)
    continue
  }

  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  request.minimumTextHeight = 0.004

  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  do {
    try handler.perform([request])
  } catch {
    fputs("OCR failed for \(imagePath): \(error)\n", stderr)
    continue
  }

  print("FILE \(imagePath)")
  let observations = (request.results ?? []).sorted {
    let firstY = $0.boundingBox.midY
    let secondY = $1.boundingBox.midY
    if abs(firstY - secondY) > 0.004 {
      return firstY > secondY
    }
    return $0.boundingBox.minX < $1.boundingBox.minX
  }

  for observation in observations {
    guard let candidate = observation.topCandidates(1).first else { continue }
    let box = observation.boundingBox
    print(
      String(
        format: "%.4f\t%.4f\t%.4f\t%.4f\t%@",
        box.minX,
        box.minY,
        box.width,
        box.height,
        candidate.string
      )
    )
  }
}
