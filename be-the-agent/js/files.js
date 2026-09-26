/*
 * Be the Agent — build real .xlsx and .docx files in the browser, with no outside libraries.
 *
 * Both formats are ZIP archives of XML files (Office Open XML). We write the XML by hand and
 * pack it in a ZIP using the "stored" (uncompressed) method, which every ZIP reader accepts.
 * Works in the browser (window.BTA.Files) and in Node (module.exports) for tests.
 */
(function (root) {
  "use strict";

  /* ---------- ZIP (stored, no compression) ---------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function utf8(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    return new Uint8Array(Buffer.from(str, "utf8")); // Node fallback
  }
  /* files: [{ name, data (string) }]  ->  Uint8Array of a .zip */
  function zip(files) {
    var parts = [], central = [], offset = 0;
    // A fixed DOS date/time (2026-01-01 00:00) keeps output identical between runs.
    var dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      var cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true); cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true); cen.setUint16(30, 0, true); cen.setUint16(32, 0, true);
      cen.setUint16(34, 0, true); cen.setUint16(36, 0, true); cen.setUint32(38, 0, true); cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cenSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]);
    var total = all.reduce(function (a, b) { return a + b.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  }
  var XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  /* ---------- .xlsx ---------- */
  function colName(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  /*
   * sheets: [{ name, rows: [[cell, ...], ...], bold: number of header rows (default 1), widths: [chars] }]
   * cell: number -> number cell; { pct: 0.4 } -> percent cell; { f: "SUM(B2:B7)", v: 21445 } -> formula with its
 * cached value (so Excel doesn't ask to save on close); string starting "=" -> formula without a value; other -> text
   */
  function xlsx(sheets) {
    var files = [];
    files.push({ name: "[Content_Types].xml", data: XML +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") +
      '</Types>' });
    files.push({ name: "_rels/.rels", data: XML +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>' });
    files.push({ name: "xl/workbook.xml", data: XML +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + '</sheets>' +
      '</workbook>' });
    files.push({ name: "xl/_rels/workbook.xml.rels", data: XML +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' });
    // style 0 = normal, 1 = bold, 2 = number with thousands separator, 3 = percent (0.00%)
    files.push({ name: "xl/styles.xml", data: XML +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>' });
    sheets.forEach(function (s, si) {
      var bold = s.bold === undefined ? 1 : s.bold;
      var cols = s.widths ? '<cols>' + s.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + '</cols>' : "";
      var rows = s.rows.map(function (row, r) {
        return '<row r="' + (r + 1) + '">' + row.map(function (v, c) {
          var ref = colName(c) + (r + 1);
          var style = r < bold ? ' s="1"' : "";
          if (v === null || v === undefined || v === "") return "";
          if (v && typeof v === "object" && typeof v.f === "string") return '<c r="' + ref + '"' + (style || ' s="2"') + '><f>' + esc(v.f) + '</f>' + (typeof v.v === "number" ? '<v>' + v.v + '</v>' : '') + '</c>';
          if (v && typeof v === "object" && typeof v.pct === "number") return '<c r="' + ref + '" s="3"><v>' + v.pct + '</v></c>';
          if (typeof v === "number" && isFinite(v)) return '<c r="' + ref + '"' + (style || ' s="2"') + '><v>' + v + '</v></c>';
          if (typeof v === "string" && v.charAt(0) === "=") return '<c r="' + ref + '"' + (style || ' s="2"') + '><f>' + esc(v.slice(1)) + '</f></c>';
          return '<c r="' + ref + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
        }).join("") + '</row>';
      }).join("");
      files.push({ name: "xl/worksheets/sheet" + (si + 1) + ".xml", data: XML +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + rows + '</sheetData></worksheet>' });
    });
    return zip(files);
  }

  /* ---------- .docx ---------- */
  /* blocks: [{ h1: text } | { h2: text } | { p: text } | { bullet: text } | { table: [[cell, ...], ...] }] (first table row = header) */
  function docx(blocks) {
    function run(text, bold) { return '<w:r>' + (bold ? '<w:rPr><w:b/></w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>'; }
    function para(text, style) { return '<w:p>' + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '') + run(text) + '</w:p>'; }
    var body = blocks.map(function (b) {
      if (b.h1 !== undefined) return para(b.h1, "Heading1");
      if (b.h2 !== undefined) return para(b.h2, "Heading2");
      if (b.bullet !== undefined) return '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:ind w:left="720" w:hanging="360"/></w:pPr>' + run("\u2022") + '<w:r><w:tab/></w:r>' + run(b.bullet) + '</w:p>';
      if (b.table) {
        var cols = b.table[0].length;
        var w = Math.floor(9000 / cols);
        return '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>' +
          '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>' +
          '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>' +
          '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tblBorders></w:tblPr>' +
          '<w:tblGrid>' + b.table[0].map(function () { return '<w:gridCol w:w="' + w + '"/>'; }).join("") + '</w:tblGrid>' +
          b.table.map(function (row, r) {
            return '<w:tr>' + row.map(function (cell) {
              return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/></w:tcPr><w:p>' + run(String(cell), r === 0) + '</w:p></w:tc>';
            }).join("") + '</w:tr>';
          }).join("") + '</w:tbl><w:p/>';
      }
      return para(b.p === undefined ? "" : b.p);
    }).join("");
    var files = [];
    files.push({ name: "[Content_Types].xml", data: XML +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>' });
    files.push({ name: "_rels/.rels", data: XML +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>' });
    files.push({ name: "word/_rels/document.xml.rels", data: XML +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' });
    files.push({ name: "word/styles.xml", data: XML +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F5FBF"/><w:sz w:val="32"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>' +
      '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>' +
      '</w:styles>' });
    files.push({ name: "word/document.xml", data: XML +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>' });
    return zip(files);
  }

  /* Browser: offer bytes as a download. */
  function download(bytes, filename, mime) {
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 60000);
  }

  var api = {
    zip: zip, crc32: crc32, xlsx: xlsx, docx: docx, download: download,
    XLSX_MIME: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    DOCX_MIME: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BTA = root.BTA || {};
  root.BTA.Files = api;
})(typeof window !== "undefined" ? window : globalThis);
