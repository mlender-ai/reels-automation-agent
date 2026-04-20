import AppKit
import Foundation

enum RenderError: Error {
    case missingArguments
    case failedToEncode
}

let arguments = CommandLine.arguments

guard arguments.count >= 8 else {
    throw RenderError.missingArguments
}

let output = arguments[1]
let text = arguments[2]
let width = CGFloat(Double(arguments[3]) ?? 980)
let height = CGFloat(Double(arguments[4]) ?? 220)
let fontSize = CGFloat(Double(arguments[5]) ?? 54)
let horizontalPadding = CGFloat(Double(arguments[6]) ?? 48)
let verticalPadding = CGFloat(Double(arguments[7]) ?? 34)

let image = NSImage(size: NSSize(width: width, height: height))
image.lockFocus()

NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()

let background = NSBezierPath(
    roundedRect: NSRect(x: 0, y: 0, width: width, height: height),
    xRadius: 30,
    yRadius: 30
)
NSColor(calibratedWhite: 0.02, alpha: 0.76).setFill()
background.fill()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
paragraph.lineBreakMode = .byWordWrapping

let shadow = NSShadow()
shadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.4)
shadow.shadowBlurRadius = 8
shadow.shadowOffset = NSSize(width: 0, height: -2)

let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: fontSize, weight: .bold),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
    .shadow: shadow,
]

let rect = NSRect(
    x: horizontalPadding,
    y: verticalPadding,
    width: width - horizontalPadding * 2,
    height: height - verticalPadding * 2
)

(text as NSString).draw(in: rect, withAttributes: attributes)
image.unlockFocus()

guard
    let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let png = bitmap.representation(using: .png, properties: [:])
else {
    throw RenderError.failedToEncode
}

try png.write(to: URL(fileURLWithPath: output))
