import { DiagnosticSeverity, DwgType } from 'albatros/enums';
import {InterceptRuleProps, LayerDiagnostic, InterceptAnnotation} from './helpers'
import { IntersectionFinder } from './interceptor';

async function dynamicPaint(annotation: Annotation | any, dc: DeviceContext, camera: Camera, active: boolean){
    const intAnn = annotation as InterceptAnnotation;       
    const model1 = intAnn.model;     
    if(model1 == undefined)
        return;

    const matrix = model1.matrix;
    const rasterizer = dc.rasterizer;
    dc.pushMatrix();
    dc.multMatrix(matrix);
    
    dc.color = intAnn.color;

    for (const id in model1.meshes) {
        const mesh = model1.meshes[id];
        const geometry = mesh.geometry;

        if (geometry) {            
            
            rasterizer.material = mesh.material?.material;
            dc.mesh(geometry);
        } else {
            console.warn('geometry is not defined');
        }
    }
    dc.popMatrix();
}

function getBoxCenter(box: box3): [number, number, number] {
  const [x1, y1, z1, x2, y2, z2] = box;
  
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const centerZ = (z1 + z2) / 2;
  
  return [centerX, centerY, centerZ];
}


function prepareAnnotation(context: Context, layer : AnnotationLayer, model : DwgModel3d, color : number, id : number ){
    var box: box3 = Math3d.box3.alloc();
    model.viewBounds(box);

    const annotationId = "ru.topomatic.intersection.annotation.intersection_annotation_" + id;
    const annotation : InterceptAnnotation = {
            id:  annotationId,
            position : getBoxCenter(box),
            model : model,
            color:color,
            type: 'simple',               
            attachment: 'center', 
            ctx: context,
            dynamicPaint : dynamicPaint,                
        };
    
    layer.add(annotation);
}


function activateDiagnostic(diagnostic: Diagnostic) {    
    const annotationLayerId = "ru.topomatic.intersection.annotation.intersection_annotation_layer";
    const ld = diagnostic as LayerDiagnostic;

    var layer = ld.ctx.cadview?.annotations.get(annotationLayerId);
    if(layer === undefined)
        layer = ld.ctx.cadview?.annotations.create(annotationLayerId, 1);
        
    
    if(ld.model1 == undefined || ld.model2 == undefined) return;

    ld.ctx.manager.eval('ru.albatros.wdx/wdx:layers:activate', {
        layer: ld.model1.layer,
    });

    layer?.clear();
    prepareAnnotation(ld.ctx, layer!, ld.model1, 0xFF00FF00, 1);
    prepareAnnotation(ld.ctx, layer!, ld.model2, 0xFF0000FF, 2);
    
    ld.ctx.cadview?.invalidate(true);
}

function searchFilteredModels(rule: InterceptRuleProps, drawing: Drawing): [Array<DwgModel3d>, Array<DwgModel3d>] {
    const filteredFirst = drawing.filterEntities( rule.firstConstruction, (entity=>entity.type == DwgType.model3d ? true: false), false);
    const filteredSecond = drawing.filterEntities( rule.secondConstruction, (entity=>entity.type == DwgType.model3d ? true: false), false);

    return [filteredFirst.map(val => val as DwgModel3d), filteredSecond.map(val=> val as DwgModel3d)];
}

async function searchInterceptions(firstSet: Array<DwgModel3d>, secondSet: Array<DwgModel3d>, ctx: Context, 
                                   diagnostics: DiagnosticCollection, progress: WorkerProgress){
    var total = firstSet.length * secondSet.length;
    var percent = 0
    var old_percent = 0
    const finder = new IntersectionFinder();
    const messages: Record<string, Diagnostic[]> = {};

    for (const [,firstModel] of firstSet.entries()) {
        for (const [,secondModel] of secondSet.entries()) {    
            if(firstModel === secondModel) continue;

            const result = await finder.findIntersection(firstModel, secondModel);
            
            if(result !== undefined){
                const firstLayer = firstModel.layer!;
                const secondLayer = secondModel.layer!;

                const messageKey = firstLayer.layer?.modelName ?? 'default';
                let list = messages[messageKey];
                if (!list) messages[messageKey] = list = [];

                list.push({
                    message: ctx.tr(`Пересечение объектов`), 
                    severity: DiagnosticSeverity.Warning,                    
                    source: `${firstLayer.layer?.name}/${firstLayer.name} -> ${secondLayer.layer?.name}/${secondLayer.name}`,
                    ctx,
                    model1: firstModel,
                    model2: secondModel,
                    activation: activateDiagnostic
                });
            }

            if(old_percent  + 1 < Math.ceil(percent / total * 100.)){
                old_percent =  Math.ceil(percent / total * 100.)
                const promise = new Promise<void>((resolve) => {
                    setTimeout(() => { resolve() }, 0);
                });
                await promise;
            }

            progress.percents = Math.ceil(percent / total * 100.);
            percent ++
        }
    }

    for (const uri in messages) {
        diagnostics.set(uri, messages[uri]);
    }
}

/// https://360-staging.topomatic.ru?extensionInstallPath=http%3A%2F%2Flocalhost%3A9091
export default{
    'interceptRuleCmd' : (ctx:Context): DiagnosticRule<InterceptRuleProps> => {
        return {
            async createRule() {
                return {
                    firstConstruction : '',
                    secondConstruction : ''
                }
            },
            async execute(app, rule, diagnostics, _progress) {                         
                diagnostics.clear();

                const drawing = app.model as Drawing;
                const [first, second] = searchFilteredModels(rule, drawing);

                if (!first || !second) {
                    diagnostics.set('global', [{
                        message: ctx.tr('Не удалось найти выбранные конструкции'),
                        severity: DiagnosticSeverity.Warning,
                        model1: undefined,
                        model2: undefined,
                        ctx,
                        activation: activateDiagnostic
                    } as LayerDiagnostic]);
                    return;
                }
 
                await searchInterceptions(first, second, ctx, diagnostics, _progress);
            }
        }
    }
}