class DependencyNode {
    constructor(id, type, name, content) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.content = content;
        this.children = new Map();
        this.dependencies = new Set();
        this.parent = null;
    }

    addChild(node) {
        node.parent = this;
        this.children.set(node.id, node);
    }

    addDependency(dep) {
        this.dependencies.add(dep);
    }
}

class DependencyTree {
    constructor(projectType) {
        this.root = new DependencyNode('root', 'project', projectType);
        this.nodesMap = new Map();
        this.nodesMap.set('root', this.root);
    }

    addNode(id, type, name, content, parentId = 'root') {
        const node = new DependencyNode(id, type, name, content);
        this.nodesMap.set(id, node);
        const parent = this.nodesMap.get(parentId);
        if (parent) {
            parent.addChild(node);
        }
        return node;
    }

    // Convertir árbol a estructura plana para D3
    toGraphData() {
        const nodes = [];
        const links = [];
        const processedNodes = new Set();

        const addNode = (node, level = 0) => {
            if (processedNodes.has(node.id)) return;
            processedNodes.add(node.id);

            const graphNode = {
                id: node.id,
                name: node.name,
                type: node.type,
                content: node.content,
                group: this.getNodeGroup(node.type),
                radius: this.getNodeRadius(node.type),
                level
            };
            nodes.push(graphNode);

            // Agregar enlaces jerárquicos
            if (node.parent && node.parent.id !== 'root') {
                links.push({
                    source: node.id,
                    target: node.parent.id,
                    value: 1,
                    type: 'hierarchy'
                });
            }

            // Agregar enlaces de dependencia
            node.dependencies.forEach(depId => {
                if (this.nodesMap.has(depId)) {
                    links.push({
                        source: node.id,
                        target: depId,
                        value: 1,
                        type: 'dependency'
                    });
                }
            });

            // Procesar hijos
            node.children.forEach(child => addNode(child, level + 1));
        };

        addNode(this.root);
        return { nodes, links };
    }

    getNodeGroup(type) {
        const groups = {
            'project': 0,
            'server': 1,
            'client': 1,
            'page': 2,
            'layout': 3,
            'component': 4,
            'api': 5
        };
        return groups[type] || 6;
    }

    getNodeRadius(type) {
        const sizes = {
            'project': 30,
            'server': 25,
            'client': 25,
            'page': 15,
            'layout': 20,
            'component': 10,
            'api': 12
        };
        return sizes[type] || 10;
    }
}

module.exports = { DependencyTree };
