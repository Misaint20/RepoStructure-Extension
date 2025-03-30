function getGraphHTML(data) {
    // Validar datos
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
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://d3js.org 'unsafe-inline'; style-src 'unsafe-inline';">
            <script src="https://d3js.org/d3.v7.min.js"></script>
            <style>
                body {
                    margin: 0;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                }
                .node {
                    cursor: pointer;
                }
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

                // Colores por tipo de nodo
                const fileColors = {
                    application: '#4CAF50',  // Verde para nodos de aplicación
                    layout: '#2196F3',       // Azul para layouts
                    page: '#FFC107',         // Amarillo para páginas
                    component: '#9C27B0',    // Morado para componentes
                    route: '#FF5722',        // Naranja para rutas
                    js: '#F7DF1E',          // Javascript
                    jsx: '#61DAFB',         // React
                    ts: '#3178C6',          // TypeScript
                    tsx: '#61DAFB',         // React TS
                    default: '#90A4AE'      // Default
                };

                // Función de arrastre
                function drag(simulation) {
                    return d3.drag()
                        .on("start", (event) => {
                            if (!event.active) simulation.alphaTarget(0.3).restart();
                            event.subject.fx = event.subject.x;
                            event.subject.fy = event.subject.y;
                        })
                        .on("drag", (event) => {
                            // Permitir arrastre sin restricciones
                            event.subject.fx = event.x;
                            event.subject.fy = event.y;
                        })
                        .on("end", (event) => {
                            if (!event.active) simulation.alphaTarget(0);
                            // Mantener la posición después del arrastre
                            // event.subject.fx = null;
                            // event.subject.fy = null;
                        });
                }

                // Crear SVG y configurar zoom
                const svg = d3.select("#graph-container")
                    .append("svg")
                    .attr("width", width)
                    .attr("height", height);

                const g = svg.append("g");

                // Definir marcador de flecha
                svg.append("defs")
                    .append("marker")
                    .attr("id", "arrowhead")
                    .attr("viewBox", "-10 -10 20 20")
                    .attr("refX", 20)
                    .attr("refY", 0)
                    .attr("markerWidth", 6)
                    .attr("markerHeight", 6)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M-6,-6L0,0L-6,6")
                    .style("fill", "var(--vscode-textLink-foreground)");

                // Configurar simulación
                const simulation = d3.forceSimulation(data.nodes)
                    .force("link", d3.forceLink(data.links)
                        .id(d => d.id)
                        .distance(d => {
                            // Aumentar distancias base
                            if (d.source.type === 'application' || d.target.type === 'application') return 400;
                            if (d.source.type === 'layout' || d.target.type === 'layout') return 300;
                            if (d.source.type === 'screen' || d.target.type === 'screen') return 250;
                            return 200;
                        })
                        .strength(0.5)) // Reducir fuerza de enlaces para más flexibilidad
                    .force("charge", d3.forceManyBody()
                        .strength(d => d.type === 'application' ? -3000 : 
                                    d.type === 'layout' ? -2000 : 
                                    d.type === 'page' ? -1500 : 
                                    d.type === 'screen' ? -1500 : -1000)
                        .distanceMax(1000)) // Limitar la distancia máxima de repulsión
                    .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1)) // Reducir fuerza al centro
                    .force("x", d3.forceX(width / 2).strength(0.02)) // Reducir fuerza de posicionamiento X
                    .force("y", d3.forceY(height / 2).strength(0.02)) // Reducir fuerza de posicionamiento Y
                    .force("collision", d3.forceCollide().radius(d => d.radius * 3).strength(0.8)); // Aumentar radio de colisión

                // Crear enlaces
                const link = g.append("g")
                    .selectAll("path")
                    .data(data.links)
                    .join("path")
                    .attr("class", "link")
                    .attr("marker-end", "url(#arrowhead)");

                // Crear nodos
                const node = g.append("g")
                    .selectAll(".node")
                    .data(data.nodes)
                    .join("g")
                    .attr("class", "node")
                    .call(drag(simulation));

                // Añadir círculos a los nodos
                node.append("circle")
                    .attr("r", d => d.radius)
                    .style("fill", d => fileColors[d.type] || fileColors.default);

                // Añadir etiquetas
                node.append("text")
                    .attr("dx", d => d.radius + 5)
                    .attr("dy", ".35em")
                    .text(d => d.name);

                // Función de actualización
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

                // Configurar zoom con más libertad
                const zoom = d3.zoom()
                    .scaleExtent([0.1, 8]) // Permitir más zoom out y zoom in
                    .on("zoom", event => g.attr("transform", event.transform));

                // Inicializar con un zoom que muestre todo el grafo
                svg.call(zoom);

                // Ajuste inicial del zoom más amplio
                const bounds = g.node().getBBox();
                const scale = 0.7 / Math.max( // Reducir escala inicial para ver más contexto
                    bounds.width / width,
                    bounds.height / height
                );
                const centerX = bounds.x + bounds.width / 2;
                const centerY = bounds.y + bounds.height / 2;

                svg.call(zoom.transform, d3.zoomIdentity
                    .translate(width / 2 - scale * centerX, height / 2 - scale * centerY)
                    .scale(scale));

                // Eventos de interacción
                node.on("mouseover", (event, d) => {
                    const preview = document.getElementById("code-preview");
                    preview.style.display = "block";
                    document.getElementById("preview-title").textContent = d.name;
                    document.getElementById("preview-content").textContent = d.content || 'No content available';
                });

                node.on("mouseout", () => {
                    document.getElementById("code-preview").style.display = "none";
                });

                // Añadir doble clic para liberar nodo
                node.on("dblclick", (event, d) => {
                    d.fx = null;
                    d.fy = null;
                    simulation.alpha(0.3).restart();
                });
            </script>
        </body>
        </html>
    `;
}

module.exports = { getGraphHTML };
