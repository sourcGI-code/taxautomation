const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber,
        VerticalAlign } = require('docx');
const fs = require('fs');
const path = require('path');

// US Letter content width with 0.75" margins: 12240 - 2160 = 10080
const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN = 1080; // 0.75"
const CONTENT_W = PAGE_W - MARGIN * 2; // 10080

const COLORS = {
  navy: "0B1F3A",
  accent: "1B4F72",
  teal: "0E7490",
  light: "E8F1F8",
  soft: "F4F7FA",
  muted: "5A6A7A",
  dark: "1A1A1A",
  white: "FFFFFF",
  line: "C5D4E0",
  gold: "B8860B",
};

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.line },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.line },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.line },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.line },
};

const accentBottom = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.SINGLE, size: 18, color: COLORS.accent },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 360, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.accent, space: 4 },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: "Arial",
        size: 22,
        color: COLORS.navy,
        characterSpacing: 60,
      }),
    ],
  });
}

function subHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        font: "Arial",
        size: 22,
        color: COLORS.accent,
      }),
    ],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 20,
        color: COLORS.dark,
      }),
    ],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 20,
        color: COLORS.dark,
      }),
    ],
  });
}

function jobHeader(title, company, location, dates) {
  return [
    new Paragraph({
      spacing: { before: 200, after: 20 },
      tabStops: [{ type: "right", position: CONTENT_W }],
      children: [
        new TextRun({ text: title, bold: true, font: "Arial", size: 21, color: COLORS.navy }),
        new TextRun({ text: "\t" }),
        new TextRun({ text: dates, font: "Arial", size: 18, color: COLORS.muted, italics: true }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: company, font: "Arial", size: 19, color: COLORS.accent, bold: true }),
        new TextRun({ text: `  |  ${location}`, font: "Arial", size: 18, color: COLORS.muted }),
      ],
    }),
  ];
}

function metricCell(label, value, width) {
  return new TableCell({
    borders: thinBorder,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLORS.soft, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: value, bold: true, font: "Arial", size: 22, color: COLORS.navy }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: label, font: "Arial", size: 15, color: COLORS.muted }),
        ],
      }),
    ],
  });
}

function skillCard(title, items, width) {
  return new TableCell({
    borders: thinBorder,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLORS.white, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: title, bold: true, font: "Arial", size: 18, color: COLORS.accent }),
        ],
      }),
      ...items.map(
        (item) =>
          new Paragraph({
            spacing: { before: 30, after: 30 },
            children: [
              new TextRun({ text: "▸  ", font: "Arial", size: 16, color: COLORS.teal }),
              new TextRun({ text: item, font: "Arial", size: 16, color: COLORS.dark }),
            ],
          })
      ),
    ],
  });
}

function assetRow(label, detail) {
  return new TableRow({
    children: [
      new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        width: { size: 2800, type: WidthType.DXA },
        shading: { fill: COLORS.light, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 100 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, font: "Arial", size: 17, color: COLORS.navy }),
            ],
          }),
        ],
      }),
      new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
        },
        width: { size: 7280, type: WidthType.DXA },
        shading: { fill: COLORS.white, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: detail, font: "Arial", size: 17, color: COLORS.dark }),
            ],
          }),
        ],
      }),
    ],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 20, color: COLORS.dark },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: COLORS.navy },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: COLORS.accent },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "project-bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "build-bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "exp1",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "exp2",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "exp3",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "coursework",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.line, space: 6 },
              },
              spacing: { after: 80 },
              tabStops: [{ type: "right", position: CONTENT_W }],
              children: [
                new TextRun({
                  text: "JAXON McCOLLUM  ·  TECHNICAL PORTFOLIO",
                  font: "Arial",
                  size: 14,
                  color: COLORS.muted,
                  characterSpacing: 40,
                }),
                new TextRun({ text: "\t" }),
                new TextRun({
                  text: "Robotics  ·  Edge AI  ·  Cybersecurity",
                  font: "Arial",
                  size: 14,
                  color: COLORS.muted,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: {
                top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.line, space: 8 },
              },
              spacing: { before: 80 },
              tabStops: [{ type: "right", position: CONTENT_W }],
              children: [
                new TextRun({
                  text: "jaxonraymccollum@gmail.com  ·  linkedin.com/in/jaxonmccollum",
                  font: "Arial",
                  size: 14,
                  color: COLORS.muted,
                }),
                new TextRun({ text: "\t" }),
                new TextRun({
                  text: "Page ",
                  font: "Arial",
                  size: 14,
                  color: COLORS.muted,
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Arial",
                  size: 14,
                  color: COLORS.muted,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ========== HERO ==========
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [CONTENT_W],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorder,
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: COLORS.navy, type: ShadingType.CLEAR },
                  margins: { top: 280, bottom: 280, left: 320, right: 320 },
                  children: [
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: "JAXON McCOLLUM",
                          bold: true,
                          font: "Arial",
                          size: 44,
                          color: COLORS.white,
                          characterSpacing: 80,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 140 },
                      children: [
                        new TextRun({
                          text: "Robotics Engineer  ·  Edge AI & Computer Vision  ·  Cybersecurity Foundations",
                          font: "Arial",
                          size: 18,
                          color: "A8C5D8",
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [
                        new TextRun({
                          text: "jaxonraymccollum@gmail.com",
                          font: "Arial",
                          size: 16,
                          color: COLORS.white,
                        }),
                        new TextRun({
                          text: "   ·   ",
                          font: "Arial",
                          size: 16,
                          color: "6B8FA8",
                        }),
                        new TextRun({
                          text: "+1 (260) 330-3999",
                          font: "Arial",
                          size: 16,
                          color: COLORS.white,
                        }),
                        new TextRun({
                          text: "   ·   ",
                          font: "Arial",
                          size: 16,
                          color: "6B8FA8",
                        }),
                        new TextRun({
                          text: "Wabash, Indiana",
                          font: "Arial",
                          size: 16,
                          color: COLORS.white,
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "linkedin.com/in/jaxonmccollum",
                          font: "Arial",
                          size: 16,
                          color: "7EB8D4",
                        }),
                        new TextRun({
                          text: "   ·   ",
                          font: "Arial",
                          size: 16,
                          color: "6B8FA8",
                        }),
                        new TextRun({
                          text: "721 Centennial St, Wabash, IN",
                          font: "Arial",
                          size: 16,
                          color: COLORS.white,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ========== PROFILE ==========
        sectionHeading("Professional Profile"),
        body(
          "Robotics Engineer at Marvel Labs focused on edge AI, computer vision, and multi-sensor robotics systems. Day-to-day work covers perception pipelines, industrial sensor integration, and on-device inference using NVIDIA Jetson AGX Thor, custom vision cameras, SICK LiDAR/multiscan arrays, and a local Titan 18 HX development rig (RTX 5090, 96 GB RAM). Parallel track in cybersecurity and networking (CompTIA Tech+, CIW Network Technology Associate, Cisco Academy coursework) with hands-on community IT support experience."
        ),
        body(
          "Comfortable spanning hardware, edge inference, sensor fusion, networking, and full-stack software. Actively coordinating with industrial partners and research-level contacts, with compute access channels tied to national-lab-class infrastructure."
        ),

        // ========== METRICS STRIP ==========
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2520, 2520, 2520, 2520],
          rows: [
            new TableRow({
              children: [
                metricCell("Current Role", "Robotics Engineer", 2520),
                metricCell("Edge Platform", "Jetson AGX Thor", 2520),
                metricCell("Local Compute", "RTX 5090 · 96 GB", 2520),
                metricCell("Industry Sensors", "SICK Vision + LiDAR", 2520),
              ],
            }),
          ],
        }),

        // ========== MARVEL LABS WORK ==========
        sectionHeading("Robotics Engineer — Marvel Labs"),
        new Paragraph({
          spacing: { before: 40, after: 100 },
          children: [
            new TextRun({
              text: "Marion, Indiana  ·  January 2026 – Present",
              font: "Arial",
              size: 17,
              color: COLORS.muted,
              italics: true,
            }),
          ],
        }),
        body(
          "As Robotics Engineer at Marvel Labs, work is owned end-to-end across sensing, edge compute, vision, and development workflow. Below is what that role actually covers — broken into the technical parts delivered for the team."
        ),

        subHeading("Sensor Fusion"),
        body(
          "Built and maintained perception pipelines that combine camera feeds with industrial LiDAR/multiscan data so the system can reason about its surroundings in real time. Integrated SICK Visionary and Multiscan165 arrays with custom vision hardware, aligning different sensor streams into a usable fused view for downstream logic."
        ),

        subHeading("Edge AI Deployment"),
        body(
          "Deployed AI workloads on NVIDIA Jetson AGX Thor for on-device inference rather than relying only on the cloud. Responsible for getting models onto the edge module, keeping inference practical under field constraints, and supporting iterative on-device learning loops as the system improves."
        ),

        subHeading("Computer Vision & Camera Systems"),
        body(
          "Worked with custom vision cameras and camera-to-vision transforms — calibration, geometric mapping, and reliability under changing lighting and environment. Focused on turning raw camera output into stable vision inputs the rest of the robotics stack can trust."
        ),

        subHeading("Development Hardware & Training Rig"),
        body(
          "Used a localized Titan 18 HX development workstation with an RTX 5090 and 96 GB of RAM for model work, experimentation, and rapid iteration. Kept the local train–test–deploy loop tight so hardware bring-up and software changes could move together without long turnaround."
        ),

        subHeading("Industrial Sensor Integration (SICK)"),
        body(
          "Direct integration with SICK industrial sensing hardware, including Visionary vision systems and Multiscan165 arrays. Bridged enterprise-grade sensors into the robotics software path rather than treating them as standalone tools."
        ),

        subHeading("Workflow Optimization"),
        body(
          "Analyzed bottlenecks between hardware setup, software changes, and validation cycles. Designed cleaner workflows so development time stayed focused on high-impact technical work instead of repeated setup friction."
        ),

        // ========== WHAT I CAN BUILD ==========
        sectionHeading("What I Can Build"),
        body(
          "Capabilities span robotics systems, edge intelligence, secure networking, and production web applications — demonstrated on industrial hardware and in shipping software."
        ),
        bullet("Multi-sensor perception systems (vision + LiDAR/multiscan) with edge-deployed AI models", "build-bullets"),
        bullet("Edge AI applications on NVIDIA Jetson-class modules: inference pipelines, camera integration, and on-device processing", "build-bullets"),
        bullet("Full-stack web platforms (Next.js, TypeScript, Supabase) — client portals, booking systems, document workflows, admin dashboards, and automated notifications (email/SMS)", "build-bullets"),
        bullet("Secure-by-design application layers: authentication, rate limiting, encrypted document handling, and role-based access patterns", "build-bullets"),
        bullet("Network design and troubleshooting: TCP/IP configuration, Packet Tracer simulation, hardware/software diagnostics, and user-facing tech support", "build-bullets"),
        bullet("Operational tooling and documentation that reduce repeat support load and accelerate team adoption", "build-bullets"),

        // ========== TECHNICAL ASSETS ==========
        sectionHeading("Technical Assets & Infrastructure"),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2800, 7280],
          rows: [
            assetRow("Supercomputing", "Active network/compute access pathway to the El Capitan supercomputer"),
            assetRow("Edge Computing", "Hands-on development with NVIDIA Jetson AGX Thor modules"),
            assetRow("Dev Workstation", "Localized Titan 18 HX rig — RTX 5090 GPU, 96 GB system RAM"),
            assetRow("Vision Hardware", "Custom vision cameras with calibrated transforms for robotics perception"),
            assetRow("Industrial Sensors", "Direct integration with SICK sensor systems (Visionary + Multiscan165 arrays)"),
            assetRow("National Lab Links", "Communication/access channels with Lawrence Livermore National Laboratory and BioPacific MIP"),
            assetRow("Expert Network", "Active coordination and professional meetings with PhD-level research faculty"),
            assetRow("Mobility", "Personal vehicle for site visits, field testing, and partner meetings"),
          ],
        }),

        // ========== SKILLS ==========
        sectionHeading("Technical Skills"),
        new Paragraph({ spacing: { before: 80, after: 60 }, children: [] }),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [3360, 3360, 3360],
          rows: [
            new TableRow({
              children: [
                skillCard("Robotics & AI Vision", [
                  "Sensor fusion (vision + LiDAR)",
                  "Edge AI model deployment",
                  "Camera-to-vision transforms",
                  "Industrial sensor integration",
                  "On-device inference loops",
                  "Hardware/software iteration",
                ], 3360),
                skillCard("Cybersecurity & Networking", [
                  "Network administration",
                  "Vulnerability assessment basics",
                  "Security protocols",
                  "TCP/IP configuration",
                  "Cisco Packet Tracer",
                  "Hardware/software troubleshooting",
                ], 3360),
                skillCard("Software & Systems", [
                  "Python (Essentials 1)",
                  "Full-stack web (Next.js/TS)",
                  "Database & auth patterns",
                  "API design & webhooks",
                  "Workflow optimization",
                  "Technical documentation",
                ], 3360),
              ],
            }),
          ],
        }),

        // ========== CERTIFICATIONS ==========
        sectionHeading("Certifications"),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [6500, 3580],
          rows: [
            ...[
              ["CompTIA Tech+", "May 2026"],
              ["CIW Network Technology Associate", "August 2025"],
              ["CIW ICT Computing Essentials", "February 2025"],
              ["Python Essentials 1", "Completed"],
            ].map(
              ([name, date], i) =>
                new TableRow({
                  children: [
                    new TableCell({
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
                        bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
                        left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                      },
                      width: { size: 6500, type: WidthType.DXA },
                      shading: {
                        fill: i % 2 === 0 ? COLORS.soft : COLORS.white,
                        type: ShadingType.CLEAR,
                      },
                      margins: { top: 70, bottom: 70, left: 140, right: 100 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: name,
                              bold: true,
                              font: "Arial",
                              size: 18,
                              color: COLORS.navy,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
                        bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.line },
                      },
                      width: { size: 3580, type: WidthType.DXA },
                      shading: {
                        fill: i % 2 === 0 ? COLORS.soft : COLORS.white,
                        type: ShadingType.CLEAR,
                      },
                      margins: { top: 70, bottom: 70, left: 100, right: 140 },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: date,
                              font: "Arial",
                              size: 17,
                              color: COLORS.muted,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                })
            ),
          ],
        }),

        // ========== EXPERIENCE ==========
        sectionHeading("Professional Experience"),

        ...jobHeader(
          "Robotics Engineer",
          "Marvel Labs",
          "Marion, Indiana",
          "January 2026 – Present"
        ),
        bullet("Own robotics software and systems work across perception, edge AI, and sensor integration for Marvel Labs engineering efforts", "exp1"),
        bullet("Integrate industrial sensing (SICK Visionary / Multiscan165) with custom vision cameras and NVIDIA Jetson AGX Thor edge compute", "exp1"),
        bullet("Develop and refine camera-to-vision transforms, sensor fusion paths, and on-device inference workflows", "exp1"),
        bullet("Use a high-end local training/dev rig (RTX 5090, 96 GB RAM) to keep model iteration and hardware validation cycles efficient", "exp1"),
        bullet("Coordinate with industrial partners and research contacts on sensing, infrastructure, and system design constraints", "exp1"),

        ...jobHeader(
          "Technology Support Volunteer",
          "Wabash Senior Center",
          "Wabash, Indiana",
          "September 2025 – December 2025"
        ),
        bullet("Diagnosed and resolved 25+ technical issues weekly for senior citizens — email, smartphone setup, and software troubleshooting", "exp2"),
        bullet("Created simplified quick-reference guides for common technology tasks, adopted by 50+ center members", "exp2"),
        bullet("Reduced repeat support requests by 40% through patient instruction and structured follow-up assistance", "exp2"),
        bullet("Provided real-time technical support during community technology workshops with 15–20 attendees", "exp2"),

        ...jobHeader(
          "Dietary Aide & Housekeeping",
          "Rolling Meadows Senior Living",
          "La Fontaine, Indiana",
          "April 2025 – May 2026"
        ),
        bullet("Maintained sanitation standards across 40+ resident rooms daily while adhering to healthcare safety regulations", "exp3"),
        bullet("Implemented an efficient cleaning workflow that reduced room turnover time by 20%", "exp3"),
        bullet("Coordinated with nursing staff to accommodate 15+ dietary restrictions and special meal requirements", "exp3"),
        bullet("Ensured 100% compliance with food safety protocols through consistent temperature monitoring and documentation", "exp3"),

        // ========== EDUCATION ==========
        sectionHeading("Education & Coursework"),
        new Paragraph({
          spacing: { before: 120, after: 40 },
          tabStops: [{ type: "right", position: CONTENT_W }],
          children: [
            new TextRun({
              text: "Heartland Career Center",
              bold: true,
              font: "Arial",
              size: 21,
              color: COLORS.navy,
            }),
            new TextRun({ text: "\t" }),
            new TextRun({
              text: "Wabash, Indiana",
              font: "Arial",
              size: 18,
              color: COLORS.muted,
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 100 },
          children: [
            new TextRun({
              text: "Cisco Networking Academy Coursework",
              font: "Arial",
              size: 18,
              color: COLORS.accent,
              bold: true,
            }),
          ],
        }),
        bullet("Introduction to Cybersecurity — September 2024", "coursework"),
        bullet("IT Customer Support Basics — September 2024", "coursework"),
        bullet("Hardware and Upgrade Support — September 2024", "coursework"),
        bullet("Introduction to Packet Tracer — September 2024", "coursework"),
        bullet("Computer Hardware Basics — August 2024", "coursework"),

        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({
              text: "College-Level Preparatory Coursework (High School)",
              bold: true,
              font: "Arial",
              size: 18,
              color: COLORS.navy,
            }),
          ],
        }),
        body(
          "Economics · Government · Communication 101 · Engineering Capstone. Strong personal interest in macro/microeconomics, market mechanics, and asset management — applied as systems thinking that transfers to product, operations, and technology decisions."
        ),

        // ========== NETWORK ==========
        sectionHeading("Institutional Network & Partners"),
        body(
          "Building professional channels that connect hands-on robotics work with industrial sensing, national-scale compute, and academic research:"
        ),
        bullet("Lawrence Livermore National Laboratory — established communication and access channels", "bullets"),
        bullet("BioPacific MIP — institutional connection supporting advanced materials/process collaboration pathways", "bullets"),
        bullet("SICK industrial sensing — direct integration work with Visionary and Multiscan165 sensor arrays", "bullets"),
        bullet("PhD-level research professors — ongoing professional meetings and technical coordination", "bullets"),
        bullet("El Capitan supercomputing pathway — network/compute access for high-performance workloads", "bullets"),

        // ========== REFERENCES ==========
        sectionHeading("References"),
        new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [3360, 3360, 3360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: thinBorder,
                  width: { size: 3360, type: WidthType.DXA },
                  shading: { fill: COLORS.soft, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 140, right: 140 },
                  children: [
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: "Belinda Key",
                          bold: true,
                          font: "Arial",
                          size: 18,
                          color: COLORS.navy,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [
                        new TextRun({
                          text: "Professional Reference",
                          font: "Arial",
                          size: 15,
                          color: COLORS.muted,
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "(765) 506-4305",
                          font: "Arial",
                          size: 16,
                          color: COLORS.dark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  borders: thinBorder,
                  width: { size: 3360, type: WidthType.DXA },
                  shading: { fill: COLORS.soft, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 140, right: 140 },
                  children: [
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: "Jake Miller",
                          bold: true,
                          font: "Arial",
                          size: 18,
                          color: COLORS.navy,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [
                        new TextRun({
                          text: "Marvel Labs",
                          font: "Arial",
                          size: 15,
                          color: COLORS.muted,
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "jake.miller@marvellabs.com",
                          font: "Arial",
                          size: 15,
                          color: COLORS.dark,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  borders: thinBorder,
                  width: { size: 3360, type: WidthType.DXA },
                  shading: { fill: COLORS.soft, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 140, right: 140 },
                  children: [
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: "Vickie Houlihan",
                          bold: true,
                          font: "Arial",
                          size: 18,
                          color: COLORS.navy,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [
                        new TextRun({
                          text: "Heartland Career Center",
                          font: "Arial",
                          size: 15,
                          color: COLORS.muted,
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "vhoulihan@hcc.k12.in.us",
                          font: "Arial",
                          size: 15,
                          color: COLORS.dark,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // ========== CLOSING ==========
        new Paragraph({ spacing: { before: 400, after: 80 }, children: [] }),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [CONTENT_W],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 8, color: COLORS.accent },
                    bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.accent },
                    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  },
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: COLORS.light, type: ShadingType.CLEAR },
                  margins: { top: 160, bottom: 160, left: 200, right: 200 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: "Open to opportunities in robotics, edge AI, computer vision,",
                          font: "Arial",
                          size: 18,
                          color: COLORS.navy,
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: "cybersecurity, and technical product roles.",
                          font: "Arial",
                          size: 18,
                          color: COLORS.navy,
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Available for internships, research collaborations, and engineering engagements.",
                          font: "Arial",
                          size: 16,
                          color: COLORS.muted,
                          italics: true,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    },
  ],
});

const outPath = path.join(
  "/Users/jaxonmccollum/Documents/Taxautomation",
  "Jaxon_McCollum_Technical_Portfolio.docx"
);

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("Created:", outPath);
  console.log("Size:", buffer.length, "bytes");
});
