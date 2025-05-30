import { DwgType } from "albatros/enums";
export class Selector{
    constructor (private readonly context:Context){}

    private isDwgEntity(obj: any): obj is DwgEntity {        
        return obj && typeof obj.qbounds === 'function' && typeof obj.paint === 'function';
    }

    public async getSelectedDwgEntities  (all: boolean) : Promise<DwgModel3d[]> {
        try {
            const cadViewContext = this.context.cadview;
    
            if (!cadViewContext) {
                console.error('CadViewContext is not available.');
                return [];
            }
    
            const layer = cadViewContext.layer;
    
            if (!layer) {
                console.error('Layer is not available.');
                return [];
            }
    
            var selectedObjects = Array.from(layer.selectedObjects(undefined, obj => this.isDwgModel3d(obj))).map(obj => obj as DwgModel3d);                
            
            if(selectedObjects.length < 1){
                selectedObjects = await this.selectDwgEntities("Выберите объекты", all)
            }

            return selectedObjects;
        } catch (error) {
            console.error('Failed to get selected entities:', error);
            return [];
        }
    }

    public async selectDwgEntities  (text: string, canAll : boolean = true) : Promise<DwgModel3d[]> {
        var selectedObjects : Array<DwgModel3d> = [];
        try {
            const cadViewContext = this.context.cadview;
    
            if (!cadViewContext) {
                console.error('CadViewContext is not available.');
                return [];
            }
    
            const layer = cadViewContext.layer;
    
            if (!layer) {
                console.error('Layer is not available.');
                return [];
            }
            layer.clearSelected();
            //await layer.selectObject(undefined, true);
            //await layer.selectObjects( obj => this.isDwgModel3d(obj), true);

            var obj : any;

            const chois:AlternativeCommands = canAll?{"end":"Завершить выбор", "all":"Выбрать все"}:{"end":"Завершить выбор"};
            while(true){
                obj = await cadViewContext.getobject(text, chois, (obj) => obj.type === DwgType.model3d);
                console.log(obj)
                if(obj == "all"){
                    await layer.selectObjects(obj => this.isDwgModel3d(obj), true);
                    selectedObjects = Array.from(layer.selectedObjects(undefined, obj => this.isDwgModel3d(obj))).map(obj => obj as DwgModel3d);
                    
                    return selectedObjects;
                }
                if(obj == "end"){
                    return selectedObjects;
                }
                if(selectedObjects.find(elm=>elm.$id === (obj.value as DwgModel3d).$id) == undefined){
                    //var mesh = obj.value as DwgModel3d;
                    //console.log(mesh.meshes[0].material)
                    selectedObjects.push(obj.value as DwgModel3d);
                }
            }
        } catch (error) {
            console.error('Failed to get selected entities:', error);
            return selectedObjects;
        }
    }

    public async selectAll(): Promise<DwgModel3d[]>{
        const cadViewContext = this.context.cadview;
        var selectedObjects : Array<DwgModel3d> = [];
        if (!cadViewContext) {
            console.error('CadViewContext is not available.');
            return selectedObjects;
        }
        const layer = cadViewContext.layer;
        await layer.selectObjects(obj => this.isDwgModel3d(obj), true);
        selectedObjects = Array.from(layer.selectedObjects(undefined, obj => this.isDwgModel3d(obj))).map(obj => obj as DwgModel3d);

        layer.clearSelected();

        return selectedObjects;
    }


    private isDwgModel3d(entity: DwgEntity): boolean {
        return 'meshes' in entity && entity.meshes !== undefined;
    }

    public getPolygonsFromSelectedEntities(entities: DwgEntity[]): DwgMesh[] {
        const polygons: DwgMesh[] = [];
    
        entities.forEach(entity => {
            
            if (this.isDwgModel3d(entity)) {
                const model3d = entity as DwgModel3d;
    
                Object.values(model3d.meshes).forEach(mesh => {
                    polygons.push(mesh);
                });
            }
        });
    
        return polygons;
    }

    public convertToVec3Array(floatArray: Float32Array): vec3[] {
        const vec3Array: vec3[] = [];
        for (let i = 0; i < floatArray.length; i += 3) {
            vec3Array.push([floatArray[i], floatArray[i + 1], floatArray[i + 2]]);
        }
        return vec3Array;
    }

    public getTrianglesFromModel3d(model3d: DwgModel3d): vec3[][] {
        const triangles: vec3[][] = [];

        Object.values(model3d.meshes).forEach(mesh => {
            
            if (mesh.geometry) {
                const vertices = mesh.geometry.vertices;
                const indices = mesh.geometry.indices;

                const vec3Vertices = this.convertToVec3Array(vertices);

                for (let i = 0; i < indices.length; i += 3) {
                    const triangle = [
                        vec3Vertices[indices[i]],     
                        vec3Vertices[indices[i + 1]], 
                        vec3Vertices[indices[i + 2]], 
                    ];

                    triangles.push(triangle);
                }            
            }
        });

        return triangles;
    }

    public getTrianglesFromEntity(entity: DwgEntity): vec3[][] {
        const allTriangles: vec3[][] = [];
    
        if (this.isDwgModel3d(entity)) {
            const model3d = entity as DwgModel3d;
            const triangles = this.getTrianglesFromModel3d(model3d);
            allTriangles.push(...triangles);
        }
              
        return allTriangles;
    }
}