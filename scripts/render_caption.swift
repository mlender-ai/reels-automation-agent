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
let style = arguments.count > 12 ? arguments[12] : "box"
let eyebrow = arguments.count > 13 ? arguments[13] : ""
let accentHex = arguments.count > 14 ? arguments[14] : foregroundHex

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

func drawBorder(in rect: NSRect, radius: CGFloat) {
    let border = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    border.lineWidth = 1
    NSColor(calibratedWhite: 1.0, alpha: 0.08).setStroke()
    border.stroke()
}

switch style {
case "shorts-punch-title":
    let cardRect = NSRect(x: 0, y: 0, width: width, height: height)
    let card = NSBezierPath(roundedRect: cardRect, xRadius: cornerRadius, yRadius: cornerRadius)
    color(from: backgroundHex, alpha: backgroundAlpha).setFill()
    card.fill()

    let parts = text.components(separatedBy: "||")
    let primary = parts.first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? text
    let secondary = parts.count > 1 ? parts[1].trimmingCharacters(in: .whitespacesAndNewlines) : ""

    let eyebrowParagraph = NSMutableParagraphStyle()
    eyebrowParagraph.alignment = .center
    let eyebrowText = eyebrow.isEmpty ? "지금 이 장면" : eyebrow
    let eyebrowAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 17, weight: .semibold),
        .foregroundColor: NSColor(calibratedWhite: 0.88, alpha: 0.9),
        .paragraphStyle: eyebrowParagraph,
    ]
    (eyebrowText as NSString).draw(
        in: NSRect(x: 24, y: height - 50, width: width - 48, height: 20),
        withAttributes: eyebrowAttributes
    )

    let primaryParagraph = NSMutableParagraphStyle()
    primaryParagraph.alignment = .center
    primaryParagraph.lineBreakMode = .byWordWrapping
    let primaryShadow = NSShadow()
    primaryShadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.96)
    primaryShadow.shadowBlurRadius = 10
    primaryShadow.shadowOffset = NSSize(width: 0, height: -2)
    let primaryAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .black),
        .foregroundColor: NSColor.white,
        .paragraphStyle: primaryParagraph,
        .shadow: primaryShadow,
    ]
    (primary as NSString).draw(
        in: NSRect(x: horizontalPadding, y: 104, width: width - horizontalPadding * 2, height: 66),
        withAttributes: primaryAttributes
    )

    let secondaryParagraph = NSMutableParagraphStyle()
    secondaryParagraph.alignment = .center
    secondaryParagraph.lineBreakMode = .byWordWrapping
    let secondaryShadow = NSShadow()
    secondaryShadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.96)
    secondaryShadow.shadowBlurRadius = 12
    secondaryShadow.shadowOffset = NSSize(width: 0, height: -2)
    let secondaryAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize + 2, weight: .black),
        .foregroundColor: color(from: accentHex, alpha: 1.0),
        .paragraphStyle: secondaryParagraph,
        .shadow: secondaryShadow,
    ]
    (secondary as NSString).draw(
        in: NSRect(x: horizontalPadding, y: 32, width: width - horizontalPadding * 2, height: 72),
        withAttributes: secondaryAttributes
    )

case "shorts-punch-subtitle":
    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = .center
    paragraphStyle.lineBreakMode = .byWordWrapping
    paragraphStyle.lineSpacing = 1

    let subtitleShadow = NSShadow()
    subtitleShadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.98)
    subtitleShadow.shadowBlurRadius = 14
    subtitleShadow.shadowOffset = NSSize(width: 0, height: -3)

    let subtitleAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .black),
        .foregroundColor: color(from: accentHex, alpha: 1.0),
        .paragraphStyle: paragraphStyle,
        .shadow: subtitleShadow,
        .strokeColor: NSColor(calibratedWhite: 0.0, alpha: 0.95),
        .strokeWidth: -3.0,
    ]
    (text as NSString).draw(
        in: NSRect(x: horizontalPadding, y: verticalPadding, width: width - horizontalPadding * 2, height: height - verticalPadding * 2),
        withAttributes: subtitleAttributes
    )

case "shorts-fixed-title":
    let chipRect = NSRect(x: 0, y: 0, width: width, height: height)
    let chip = NSBezierPath(roundedRect: chipRect, xRadius: cornerRadius, yRadius: cornerRadius)
    color(from: backgroundHex, alpha: backgroundAlpha).setFill()
    chip.fill()
    drawBorder(in: chipRect.insetBy(dx: 0.5, dy: 0.5), radius: cornerRadius)

    let titleParagraph = NSMutableParagraphStyle()
    titleParagraph.alignment = .center
    titleParagraph.lineBreakMode = .byWordWrapping
    titleParagraph.lineSpacing = -1

    let punchShadow = NSShadow()
    punchShadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.88)
    punchShadow.shadowBlurRadius = 18
    punchShadow.shadowOffset = NSSize(width: 0, height: -3)

    let titleAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .black),
        .foregroundColor: NSColor.white,
        .paragraphStyle: titleParagraph,
        .shadow: punchShadow,
        .strokeColor: NSColor(calibratedWhite: 0.0, alpha: 0.9),
        .strokeWidth: -5.0,
    ]
    let titleRect = NSRect(
        x: horizontalPadding,
        y: verticalPadding,
        width: width - horizontalPadding * 2,
        height: height - verticalPadding * 2
    )
    (text as NSString).draw(in: titleRect, withAttributes: titleAttributes)

case "shorts-subtitle":
    let cardRect = NSRect(x: 0, y: 0, width: width, height: height)
    let card = NSBezierPath(roundedRect: cardRect, xRadius: cornerRadius, yRadius: cornerRadius)
    color(from: backgroundHex, alpha: backgroundAlpha).setFill()
    card.fill()

    let captionParagraph = NSMutableParagraphStyle()
    captionParagraph.alignment = .center
    captionParagraph.lineBreakMode = .byWordWrapping
    captionParagraph.lineSpacing = 2

    let captionShadow = NSShadow()
    captionShadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.75)
    captionShadow.shadowBlurRadius = 10
    captionShadow.shadowOffset = NSSize(width: 0, height: -2)

    let captionAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .bold),
        .foregroundColor: NSColor.white,
        .paragraphStyle: captionParagraph,
        .shadow: captionShadow,
    ]
    let captionRect = NSRect(
        x: horizontalPadding,
        y: verticalPadding,
        width: width - horizontalPadding * 2,
        height: height - verticalPadding * 2
    )
    (text as NSString).draw(in: captionRect, withAttributes: captionAttributes)

case "shorts-title":
    let titleParagraph = NSMutableParagraphStyle()
    titleParagraph.alignment = .center
    titleParagraph.lineBreakMode = .byWordWrapping
    titleParagraph.lineSpacing = -2

    let punchShadow = NSShadow()
    punchShadow.shadowColor = NSColor(calibratedWhite: 0.0, alpha: 0.92)
    punchShadow.shadowBlurRadius = 20
    punchShadow.shadowOffset = NSSize(width: 0, height: -4)

    let titleAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .black),
        .foregroundColor: NSColor.white,
        .paragraphStyle: titleParagraph,
        .shadow: punchShadow,
        .strokeColor: NSColor(calibratedWhite: 0.0, alpha: 0.96),
        .strokeWidth: -8.0,
    ]
    let titleRect = NSRect(
        x: horizontalPadding,
        y: verticalPadding,
        width: width - horizontalPadding * 2,
        height: height - verticalPadding * 2
    )
    (text as NSString).draw(in: titleRect, withAttributes: titleAttributes)

case "micro-title":
    let chipWidth = min(width - 18, max(320, width * 0.9))
    let chipHeight = min(height - 8, max(74, height * 0.84))
    let chipRect = NSRect(x: (width - chipWidth) / 2, y: (height - chipHeight) / 2, width: chipWidth, height: chipHeight)
    let chip = NSBezierPath(roundedRect: chipRect, xRadius: cornerRadius, yRadius: cornerRadius)
    color(from: backgroundHex, alpha: max(backgroundAlpha, 0.42)).setFill()
    chip.fill()
    drawBorder(in: chipRect.insetBy(dx: 0.5, dy: 0.5), radius: cornerRadius)

    let accentRect = NSRect(x: chipRect.minX + 28, y: chipRect.maxY - 14, width: 86, height: 2)
    let accent = NSBezierPath(roundedRect: accentRect, xRadius: 1.5, yRadius: 1.5)
    NSColor(calibratedWhite: 1.0, alpha: 0.82).setFill()
    accent.fill()

    let eyebrowParagraph = NSMutableParagraphStyle()
    eyebrowParagraph.alignment = .center
    eyebrowParagraph.lineBreakMode = .byTruncatingTail
    if !eyebrow.isEmpty {
        let eyebrowAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: max(fontSize * 0.34, 14), weight: .semibold),
            .foregroundColor: NSColor(calibratedWhite: 1.0, alpha: 0.82),
            .paragraphStyle: eyebrowParagraph,
        ]
        let eyebrowRect = NSRect(x: chipRect.minX + 18, y: chipRect.midY + 12, width: chipRect.width - 36, height: 18)
        (eyebrow as NSString).draw(in: eyebrowRect, withAttributes: eyebrowAttributes)
    }

    let titleParagraph = NSMutableParagraphStyle()
    titleParagraph.alignment = .center
    titleParagraph.lineBreakMode = .byWordWrapping
    let titleAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .bold),
        .foregroundColor: color(from: foregroundHex, alpha: 1.0),
        .paragraphStyle: titleParagraph,
    ]
    let titleRect = NSRect(
        x: chipRect.minX + horizontalPadding,
        y: chipRect.minY + verticalPadding - 2,
        width: chipRect.width - horizontalPadding * 2,
        height: chipRect.height - verticalPadding * 2
    )
    (text as NSString).draw(in: titleRect, withAttributes: titleAttributes)

case "premium-title":
    let backgroundRect = NSRect(x: 0, y: 0, width: width, height: height)
    let card = NSBezierPath(roundedRect: backgroundRect, xRadius: cornerRadius, yRadius: cornerRadius)
    card.addClip()
    let gradient = NSGradient(colors: [
        color(from: backgroundHex, alpha: backgroundAlpha),
        color(from: backgroundHex, alpha: max(backgroundAlpha * 0.68, 0.18)),
    ])
    gradient?.draw(in: backgroundRect, angle: 0)
    drawBorder(in: backgroundRect.insetBy(dx: 0.5, dy: 0.5), radius: cornerRadius)

    let accentRect = NSRect(x: 28, y: height - 28, width: 78, height: 6)
    let accent = NSBezierPath(roundedRect: accentRect, xRadius: 3, yRadius: 3)
    color(from: accentHex, alpha: 0.98).setFill()
    accent.fill()

    if !eyebrow.isEmpty {
        let eyebrowParagraph = NSMutableParagraphStyle()
        eyebrowParagraph.alignment = .left
        let eyebrowAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 19, weight: .semibold),
            .foregroundColor: color(from: accentHex, alpha: 0.98),
            .paragraphStyle: eyebrowParagraph,
        ]
        let eyebrowRect = NSRect(x: 28, y: height - 76, width: width - 56, height: 24)
        (eyebrow as NSString).draw(in: eyebrowRect, withAttributes: eyebrowAttributes)
    }

    let titleParagraph = NSMutableParagraphStyle()
    titleParagraph.alignment = .left
    titleParagraph.lineBreakMode = .byWordWrapping
    titleParagraph.lineSpacing = 2
    let titleAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .heavy),
        .foregroundColor: color(from: foregroundHex, alpha: 1.0),
        .paragraphStyle: titleParagraph,
        .shadow: shadow,
    ]
    let titleRect = NSRect(
        x: horizontalPadding,
        y: verticalPadding,
        width: width - horizontalPadding * 2,
        height: height - verticalPadding * 2 - (eyebrow.isEmpty ? 0 : 30)
    )
    (text as NSString).draw(in: titleRect, withAttributes: titleAttributes)

case "premium-caption":
    let backgroundRect = NSRect(x: 0, y: 0, width: width, height: height)
    let card = NSBezierPath(roundedRect: backgroundRect, xRadius: cornerRadius, yRadius: cornerRadius)
    color(from: backgroundHex, alpha: backgroundAlpha).setFill()
    card.fill()
    drawBorder(in: backgroundRect.insetBy(dx: 0.5, dy: 0.5), radius: cornerRadius)

    let accentRect = NSRect(x: 24, y: height - 18, width: width - 48, height: 2)
    let accent = NSBezierPath(roundedRect: accentRect, xRadius: 1, yRadius: 1)
    color(from: accentHex, alpha: 0.28).setFill()
    accent.fill()

    let captionParagraph = NSMutableParagraphStyle()
    captionParagraph.alignment = .center
    captionParagraph.lineBreakMode = .byWordWrapping
    captionParagraph.lineSpacing = 3

    let captionAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .semibold),
        .foregroundColor: color(from: foregroundHex, alpha: 1.0),
        .paragraphStyle: captionParagraph,
        .shadow: shadow,
        .strokeColor: NSColor(calibratedWhite: 0.0, alpha: 0.28),
        .strokeWidth: -1.5,
    ]

    let captionRect = NSRect(
        x: horizontalPadding,
        y: verticalPadding - 2,
        width: width - horizontalPadding * 2,
        height: height - verticalPadding * 2
    )
    (text as NSString).draw(in: captionRect, withAttributes: captionAttributes)

default:
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
}
image.unlockFocus()

guard
    let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let png = bitmap.representation(using: .png, properties: [:])
else {
    throw RenderError.failedToEncode
}

try png.write(to: URL(fileURLWithPath: output))
