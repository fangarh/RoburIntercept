export type InterceptData = {
    model1: DwgModel3d; 
    model2: DwgModel3d;
    interceptionBxo : box3;
    interception: { a: vec3; b: vec3 }[];
}

export type MeshTriangle = { mesh: DwgMesh; triangleIndex: number };

export interface LayerDiagnostic extends Diagnostic {
    ctx: Context;
    layer1: DwgLayer;
    layer2: DwgLayer;
}

export interface InterceptRuleProps {
  firstConstruction: string;
  secondConstruction: string;
}
