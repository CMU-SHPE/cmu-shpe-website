import { describe, expect, it } from 'vitest'
import { isSafeSvg, isSafeSvgFile } from './svg-safety'

const svg = (body: string, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${attributes}>${body}</svg>`

describe('isSafeSvg', () => {
  it.each([
    [
      'an exported logo with a declaration, comments, styles and gradients',
      `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Illustrator -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
${svg(`<defs><linearGradient id="g"><stop offset="0" stop-color="#d22030"/></linearGradient>
  <style><![CDATA[.a{fill:url(#g)}]]></style></defs>
  <path class="a" d="M0 0h10v10z"/><text x="1" y="9">SHPE &amp; Co</text>`, ' viewBox="0 0 10 10"')}`,
    ],
    ['the SVG 1.0 DOCTYPE', `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN"\n  "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">${svg('')}`],
    ['a UTF-8 declaration in any case', `<?xml version='1.0' encoding='utf-8' standalone='no'?>${svg('')}`],
    ['an internal <use> reference', svg('<path id="p" d="M0 0"/><use xlink:href="#p"/><use href = "#p" />')],
    ['attribute values containing > and <', svg(`<text aria-label='a > b'>x</text>`)],
    ['an id that merely ends in data:', svg('<rect id="metadata:1"/>')],
    ['a title mentioning script in text', svg('<title>Online script tutoring</title>')],
  ])('accepts %s', (_, text) => {
    expect(isSafeSvg(text)).toBe(true)
  })

  it.each([
    ['a script element', svg('<script>alert(1)</script>')],
    ['a script element with odd casing and whitespace', svg('<ScRiPt\n type="text/javascript">alert(1)</ScRiPt >')],
    ['a namespaced script element', svg('<svg:script>alert(1)</svg:script>')],
    ['a stray closing script tag', svg('</SCRIPT>')],
    ['an onload attribute', svg('', ' onload="alert(1)"')],
    ['an event attribute with odd casing and spacing', svg('<rect\n\tOnClick\n=\n"alert(1)"/>')],
    ['an unquoted event attribute', svg('<rect onmouseover=alert(1) />')],
    ['a javascript: link', svg('<a href="javascript:alert(1)"><rect/></a>')],
    ['a javascript: link split by whitespace and casing', svg('<a xlink:href=" Java\nScript:alert(1)"><rect/></a>')],
    ['a javascript: link hidden behind character references', svg('<a href="&#106;avascript&#x3A;alert(1)">x</a>')],
    ['a data: URL in href', svg('<image href="data:image/svg+xml;base64,PHN2Zz4="/>')],
    ['an XLINK:HREF with odd casing', svg('<image XLINK:HREF="data:text/html,x"/>')],
    ['an external <use>', svg('<use href="https://evil.example/sprite.svg#icon"/>')],
    ['an external <image>', svg('<image xlink:href="//evil.example/x.png"/>')],
    ['a foreignObject', svg('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>')],
    ['a foreignObject with odd casing', svg('<FOREIGNOBJECT width="1"/>')],
    ['an iframe', svg('<iframe src="https://evil.example"/>')],
    ['a data: URL inside a style attribute', svg('<rect style="fill:url(data:image/png;base64,AAAA)"/>')],
    ['an animation that sets href to javascript:', svg('<a><set attributeName="href" to="javascript:alert(1)"/>x</a>')],
    ['a DOCTYPE literal hiding a comment open before a script', `<!DOCTYPE svg SYSTEM "><!--">${svg('<script>alert(1)</script>')}<!-- -->`],
    ['a DOCTYPE literal hiding a comment open before onload', `<!DOCTYPE svg SYSTEM "><!--">${svg('', ' onload="alert(1)"')}<!-- -->`],
    ['a DOCTYPE literal hiding a CDATA open', `<!DOCTYPE svg SYSTEM "><![CDATA[">${svg('', ' onload="alert(1)"')}<!-- ]]> -->`],
    ['a DTD default onload attribute', `<!DOCTYPE svg SYSTEM "x>" [<!ATTLIST svg onload CDATA "alert(1)">]>${svg('')}`],
    ['a bare DOCTYPE', `<!DOCTYPE svg>${svg('')}`],
    ['the SVG 1.1 DOCTYPE with an internal subset', `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [<!ENTITY a "b">]>${svg('')}`],
    ['the ISO-2022-JP quote-eating payload', `<?xml version="1.0" encoding="ISO-2022-JP"?>${svg('', ` a="\u001b$B" b= '\u001b(B" onload="alert(1)" c='`)}`],
    ['any other declared encoding', `<?xml version="1.0" encoding="UTF-16"?>${svg('')}`],
    ['an unquoted encoding', `<?xml version="1.0" encoding=latin1?>${svg('')}`],
    ['an entity declaration', `<!DOCTYPE svg [<!ENTITY x "&#60;script&#62;alert(1)&#60;/script&#62;">]>${svg('&x;')}`],
    ['an xml-stylesheet instruction', `<?xml-stylesheet type="text/xsl" href="https://evil.example/x.xsl"?>${svg('')}`],
    ['an unterminated attribute value', svg('<rect fill="red/>')],
    ['an unterminated tag', '<svg xmlns="http://www.w3.org/2000/svg"'],
    ['an unterminated comment that might hide markup', `${svg('')}<!-- <script>`],
    ['a NUL byte', svg('<rect/>\u0000')],
  ])('rejects %s', (_, text) => {
    expect(isSafeSvg(text)).toBe(false)
  })
})

describe('isSafeSvgFile', () => {
  it('reads a UTF-8 file', async () => {
    await expect(isSafeSvgFile(new Blob([svg('<rect/>')]))).resolves.toBe(true)
    await expect(isSafeSvgFile(new Blob([svg('<script>alert(1)</script>')]))).resolves.toBe(false)
  })

  it('rejects text that is not UTF-8, such as UTF-16 hiding a script', async () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...[...svg('<script/>')].flatMap((c) => [c.charCodeAt(0), 0])])
    await expect(isSafeSvgFile(new Blob([utf16]))).resolves.toBe(false)
  })
})
