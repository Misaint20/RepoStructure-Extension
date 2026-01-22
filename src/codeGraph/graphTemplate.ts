import { GraphData } from './types';

export function getGraphHTML(data: GraphData): string {
    if (!data || !data.nodes || !data.links || data.nodes.length === 0) {
        return `
            <!DOCTYPE html>
            <html>
                <body>
                    <div style="text-align: center; padding: 20px;">
                        <h3>No dependencies found to visualize</h3>
                    </div>
                </body>
            </html>
        `;
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://d3js.org 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:;">
            <script src="https://d3js.org/d3.v7.min.js"></script>
            <style>
                body {
                    margin: 0;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                }
                .node { cursor: pointer; }
                .node circle {
                    stroke: var(--vscode-editor-foreground);
                    stroke-width: 2px;
                    transition: all 0.3s ease;
                }
                .node text {
                    fill: var(--vscode-editor-foreground);
                    font-size: 12px;
                    font-weight: 500;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .node:hover circle {
                    stroke-width: 3px;
                    filter: brightness(1.2);
                }
                .link {
                    stroke: var(--vscode-textLink-foreground);
                    stroke-opacity: 0.4;
                    stroke-width: 1.5px;
                    transition: all 0.3s ease;
                }
                .link:hover {
                    stroke-opacity: 1;
                    stroke-width: 2px;
                }
                #code-preview {
                    position: fixed;
                    right: 20px;
                    top: 20px;
                    width: 400px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                    padding: 15px;
                    border-radius: 6px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    display: none;
                    z-index: 1000;
                }
                #code-preview h3 {
                    margin: 0 0 10px 0;
                    color: var(--vscode-symbolIcon-methodForeground);
                }
                #preview-content {
                    margin: 0;
                    white-space: pre-wrap;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 12px;
                    max-height: 300px;
                    overflow-y: auto;
                }
            </style>
        </head>
        <body>
            <div id="graph-container"></div>
            <div id="code-preview">
                <h3 id="preview-title"></h3>
                <pre><code id="preview-content"></code></pre>
            </div>
            <script>
                const data = ${JSON.stringify(data)};
                const width = window.innerWidth;
                const height = window.innerHeight;

                const fileColors = {
                    application: '#4CAF50', layout: '#2196F3', page: '#FFC107',
                    component: '#9C27B0', route: '#FF5722', js: '#F7DF1E',
                    jsx: '#61DAFB', ts: '#3178C6', tsx: '#61DAFB',
                    default: '#90A4AE', server: '#f44336', model: '#607d8b',
                    controller: '#795548', middleware: '#009688', utility: '#ff9800',
                    config: '#9e9e9e', database: '#3f51b5', helper: '#8bc34a',
                    type: '#e91e63', endpoint: '#03a9f4'
                };

                function drag(simulation) {
                    return d3.drag()
                        .on("start", (event) => {
                            if (!event.active) simulation.alphaTarget(0.3).restart();
                            event.subject.fx = event.subject.x;
                            event.subject.fy = event.subject.y;
                        })
                        .on("drag", (event) => {
                            event.subject.fx = event.x;
                            event.subject.fy = event.y;
                        })
                        .on("end", (event) => {
                            if (!event.active) simulation.alphaTarget(0);
                        });
                }

                const svg = d3.select("#graph-container").append("svg")
                    .attr("width", width).attr("height", height);
                const g = svg.append("g");

                svg.append("defs").append("marker")
                    .attr("id", "arrowhead").attr("viewBox", "-10 -10 20 20")
                    .attr("refX", 20).attr("refY", 0)
                    .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
                    .append("path").attr("d", "M-6,-6L0,0L-6,6")
                    .style("fill", "var(--vscode-textLink-foreground)");

                const simulation = d3.forceSimulation(data.nodes)
                    .force("link", d3.forceLink(data.links).id(d => d.id)
                        .distance(d => {
                            if (d.source.type === 'application' || d.target.type === 'application') return 400;
                            if (d.source.type === 'layout' || d.target.type === 'layout') return 300;
                            return 200;
                        }).strength(0.5))
                    .force("charge", d3.forceManyBody().strength(d => d.type === 'application' ? -4000 : -2000))
                    .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
                    .force("collision", d3.forceCollide().radius(d => d.radius * 4).strength(1));

                const link = g.append("g").selectAll("path").data(data.links).join("path")
                    .attr("class", "link").attr("marker-end", "url(#arrowhead)");

                const node = g.append("g").selectAll(".node").data(data.nodes).join("g")
                    .attr("class", "node").call(drag(simulation));

                node.append("circle").attr("r", d => d.radius)
                    .style("fill", d => fileColors[d.type] || fileColors.default);
                node.append("text").attr("dx", d => d.radius + 5).attr("dy", ".35em").text(d => d.name);

                function ticked() {
                    link.attr("d", d => {
                        const dx = d.target.x - d.source.x;
                        const dy = d.target.y - d.source.y;
                        const dr = Math.sqrt(dx * dx + dy * dy) * 2;
                        return \`M\${d.source.x},\${d.source.y}A\${dr},\${dr} 0 0,1 \${d.target.x},\${d.target.y}\`;
                    });
                    node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
                }
                simulation.on("tick", ticked);

                const zoom = d3.zoom().scaleExtent([0.1, 8])
                    .on("zoom", event => g.attr("transform", event.transform));
                svg.call(zoom);

                node.on("mouseover", (event, d) => {
                    const preview = document.getElementById("code-preview");
                    preview.style.display = "block";
                    document.getElementById("preview-title").textContent = d.name + ' (' + d.type + ')';
                    document.getElementById("preview-content").textContent = d.content || 'No content available';
                }).on("mouseout", () => {
                    document.getElementById("code-preview").style.display = "none";
                }).on("dblclick", (event, d) => {
                    d.fx = null; d.fy = null;
                    simulation.alpha(0.3).restart();
                });
            </script>
        </body>
        </html>
    `;
}
