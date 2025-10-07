import { DiagnosticSeverity, DwgType } from 'albatros/enums';
import {InterceptRuleProps, LayerDiagnostic, InterceptAnnotation} from './helpers'
import { IntersectionFinder } from './interceptor';

function dynamicPaint(annotation: Annotation | any, dc: DeviceContext, camera: Camera, active: boolean){
    console.log("1")
    const intAnn = annotation as InterceptAnnotation;       
    const model1 = intAnn.model;     
    if(model1 == undefined)
        return;

    console.log("1")

    dc.color = 1;
    for (const mesh of Object.values(model1.meshes)){          
        if(mesh.geometry){
            dc.mesh(mesh.geometry)
        }
    }

    dc.rasterizer.flush();            
}

function prepareAnnotation(context: Context, layer : AnnotationLayer, model : DwgModel3d ){
    layer.clear();
    const annotationId = "ru.topomatic.intersection.annotation.intersection_annotation";
    const annotation : InterceptAnnotation = {
            id:  annotationId,
            position : model.normal,
            model : model,
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

    prepareAnnotation(ld.ctx, layer!, ld.model1);
    
    console.log(layer)

    ld.ctx.manager.eval('ru.albatros.wdx/wdx:layers:activate', {
        layer: ld.model1.layer,
    });
    
    ld.ctx.manager.broadcast('wdx:onView:layers:select' as Broadcast, {
        layers: [ld.model1.layer!, ld.model2.layer],
        cadview: ld.ctx.cadview,
    });

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