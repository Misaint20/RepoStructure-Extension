export interface GraphNode {
    id: string | number;
    name: string;
    path?: string;
    project?: string;
    projectRoot?: string;
    type: string;
    content?: string;
    group: number;
    radius: number;
}

export interface GraphLink {
    source: string | number;
    target: string | number;
    value: number;
    type?: string;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export interface AnalyzerContext {
    nodes: GraphNode[];
    links: GraphLink[];
    processedFiles: Set<string>;
    sourceNode?: GraphNode;
    parentNode?: GraphNode;
    fileType: string;
    rootDir?: string;
}
