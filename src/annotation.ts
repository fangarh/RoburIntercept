import { LineSegmentProcessor } from "./centroid";

export type InterceptData = {
    model1: DwgModel3d; 
    model2: DwgModel3d;
    interception: { a: vec3; b: vec3 }[];
}
declare interface InterceptAnnotation extends AnnotationSimple{
    intercept: InterceptData;
    ctx:Context;
}

export class AnnotationHelper{
    private interceptions: InterceptData [];
    private context: Context;

    constructor (interceptions: InterceptData[], context: Context){
        this.interceptions = interceptions;
        this.context = context;
    }

    public async setAnnotations(){
        for(var i = 0; i < this.interceptions.length; i ++){
            const intercept = this.interceptions[i];
            //const intersectionGeometry: Geometry3d = this.createGeometryFromIntersectionLines(intercept.interception);
            //const uuidGeometry: UuidGeometry3d = await Math3d.geometry.createUuidGeometry3d(intersectionGeometry);

            const processor = new LineSegmentProcessor(intercept.interception);
            const result = processor.findCenterOrNearestPoint();

            const annotation: AnnotationInit<InterceptAnnotation> = {
                type: 'simple',
                position: result,
                text: intercept.model1.layer?.getx("name") + "\n " + intercept.model2.layer?.getx("name") ,
                intercept: intercept,
                attachment: 'center', 
                ctx: this.context,
                dynamicPaint : this.dynamicPaint
            };

            const layer = this.context.cadview?.annotations.standard!; 
            layer.add(annotation);
            this.context.cadview?.invalidate(); 
        }
    }

    private async dynamicPaint(annotation: Annotation | any, dc: DeviceContext, frustum: ViewFrustum, active: boolean){
        if(!active) return;
        
        dc.reset()
        const intAnn = annotation as InterceptAnnotation;
        const model1 = intAnn.intercept.model1; 
        const model2 = intAnn.intercept.model2; 

        intAnn.ctx.cadview?.layer.clearSelected();

        for (const mesh of Object.values(model1.meshes)){
            dc.color = 7;
            
            if(mesh.geometry)
                dc.mesh(await Math3d.geometry.createUuidGeometry3d(mesh.geometry))
        }

        for (const mesh of Object.values(model2.meshes)){
            dc.color = 8;

            if(mesh.geometry)
                dc.mesh(await Math3d.geometry.createUuidGeometry3d(mesh.geometry))
        }
    }
/*
    private createGeometryFromIntersectionLines(lines: { a: vec3; b: vec3 }[]): Geometry3d {
        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexIndex: number = 0;

        for (const line of lines) {
            vertices.push(line.a[0], line.a[1], line.a[2], line.b[0], line.b[1], line.b[2]);
            indices.push(vertexIndex, vertexIndex + 1);
            vertexIndex += 2;
        }

        const geometry: Geometry3d = {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(vertices.length),
            indices: new Uint32Array(indices),
        };
        Math3d.geometry.calculateNormals(geometry);
        return geometry;
    }*/
}