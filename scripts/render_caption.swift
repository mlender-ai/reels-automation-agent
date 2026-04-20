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

func color(from hex: String, alpha: CGFloat) -> NSColor {
    let cleaned = hex
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: "#", with: "")
        .uppercased()
    guard cleaned.count == 6 else {
        return NSColor(calibratedWhite: 1.0, alpha: alpha)
    }

    var rawValue: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&rawValue)

    let red = CGFloat((rawValue & 0xFF0000) >> 16) / 255.0
    let green = CGFloat((rawValue & 0x00FF00) >> 8) / 255.0
    let blue = CGFloat(rawValue & 0x0000FF) / 255.0
    return NSColor(calibratedRed: red, green: green, blue: blue, alpha: alpha)
}

let output = arguments[1]
let text = arguments[2]
let width = CGFloat(Double(arguments[3]) ?? 980)
let height = CGFloat(Double(arguments[4]) ?? 220)
let fontSize = CGFloat(Double(arguments[5]) ?? 54)
let horizontalPadding = CGFloat(Double(arguments[6]) ?? 48)
let verticalPadding = CGFloat(Double(arguments[7]) ?? 34)
let backgroundHex = arguments.count > 8 ? arguments[8] : "050505"
let backgroundAlpha = CGFloat(Double(arguments[9]) ?? 0.76)
let foregroundHex = arguments.count > 10 ? arguments[10] : "FFFFFF"
let cornerRadius = CGFloat(Double(arguments[11]) ?? 30)

let image = NSImage(size: NSSize(width: width, height: height))
image.lockFocus()

NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()

let background = NSBezierPath(
    roundedRect: NSRect(x: 0, y: 0, width: width, height: height),
    xRadius: cornerRadius,
    yRadius: cornerRadius
)
color(from: backgroundHex, alpha: backgroundAlpha).setFill()
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
    .foregroundColor: color(from: foregroundHex, alpha: 1.0),
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
