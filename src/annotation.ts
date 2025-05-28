import { LineSegmentProcessor } from "./centroid";

export type ProjectionLength = {
    pointA: vec3; 
    pointB: vec3; 
    projectedDistance: number
}

export type InterceptData = {
    model1: DwgModel3d; 
    model2: DwgModel3d;
    interceptionBxo : box3;
    interception: { a: vec3; b: vec3 }[];
    length : ProjectionLength | undefined;
}
declare interface InterceptAnnotation extends AnnotationSimple{
    intercept: InterceptData;
    ctx:Context;
}

export class AnnotationHelper{
    private interceptions: InterceptData [];
    private context: Context;
    private material1 : UuidMaterial;
    private material2 : UuidMaterial;
    constructor  (interceptions: InterceptData[], context: Context, m1: UuidMaterial, m2:UuidMaterial){
        this.interceptions = interceptions;
        this.context = context;
        this.material1 = m1;
        this.material2 = m2;
        
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
                dynamicPaint : this.dynamicPaint,
                activateCommand: (ann : AnnotationBase)=>{ 
                    //const position = annotation.position;
                    //this.context.cadview?.camera.focus(position, undefined);
                    this.context.cadview?.layer.clearSelected()
                    
                     this.context.cadview?.layer.selectObjects((obj)=>{
                      
                        if( obj.$path == intercept.model1.$path || obj.$path == intercept.model2.$path){
                            
                            return false;
                        }
                        return false
                    }, true)
 
                }
            };

            const layer = this.context.cadview?.annotations.standard!; 
            layer.add(annotation);
            this.context.cadview?.invalidate(); 
        }
    }

    private async dynamicPaint(annotation: Annotation | any, dc: DeviceContext, frustum: ViewFrustum, active: boolean){
        if(!active) return;

        dc.pushMatrix();
        const intAnn = annotation as InterceptAnnotation;
        const model1 = intAnn.intercept.model1; 
        const model2 = intAnn.intercept.model2; 

        dc.multMatrix(model1.matrix);
        dc.rasterizer.material = this.material1
        for (const mesh of Object.values(model1.meshes)){          
            if(mesh.geometry){
                dc.mesh(mesh.geometry)
            }
        }

        dc.popMatrix()
        dc.rasterizer.flush();
        dc.rasterizer.material = this.material2
        dc.multMatrix(model2.matrix)
        for (const mesh of Object.values(model2.meshes)){
            if(mesh.geometry)
                
                dc.mesh(mesh.geometry)
        }
        dc.popMatrix();
        dc.rasterizer.flush();
    }
}