import { DiagnosticSeverity, DwgType } from 'albatros/enums';
import {InterceptRuleProps, LayerDiagnostic} from './helpers'
import { IntersectionFinder } from './interceptor';

function activateDiagnostic(diagnostic: Diagnostic) {
    const ld = diagnostic as LayerDiagnostic;

    ld.ctx.manager.eval('ru.albatros.wdx/wdx:layers:activate', {
        layer: ld.layer1,
    });

    ld.ctx.manager.broadcast('wdx:onView:layers:select' as Broadcast, {
        layers: [ld.layer1, ld.layer2],
        cadview: ld.ctx.cadview,
    });
}

function searchFilteredModels(rule: InterceptRuleProps, drawing: Drawing): [Map<DwgLayer, DwgModel3d> | undefined, Map<DwgLayer, DwgModel3d> | undefined] {
    const first = new Map<DwgLayer, DwgModel3d>();
    const second = new Map<DwgLayer, DwgModel3d>();

    const layersFirst = drawing.filterLayers( rule.firstConstruction, false);
    const layersSecond = drawing.filterLayers( rule.secondConstruction, false);

    const allModels: DwgModel3d[] = [];
    
    if (!drawing?.layouts?.model) return [undefined, undefined];   
    
    drawing.layouts.model.walk( obj => {
        if (obj.type === DwgType.model3d) {
            allModels.push(obj as DwgModel3d);
        }
        return false;
    });

    drawing.layouts.model.walk(e => {
        if ((e.type === DwgType.model3d) && (e.layer !== undefined)) {
                if (layersFirst.has(e.layer)) {     
                    const model = (e as DwgModel3d);
                    first.set(e.layer, model);
                } 

                if (layersSecond.has(e.layer)) {  
                    const model = (e as DwgModel3d);
                    second.set(e.layer, model);
                }
            }
            return false;
        });

    return [first, second];
}

async function searchInterceptions(firstSet: Map<DwgLayer, DwgModel3d>, secondSet: Map<DwgLayer, DwgModel3d>, ctx: Context, diagnostics: DiagnosticCollection, progress: WorkerProgress){
    var total = firstSet.size * secondSet.size;
    var percent = 0
    var old_percent = 0
    const finder = new IntersectionFinder();
    const messages: Record<string, Diagnostic[]> = {};

    for (const [firstLayer, firstModel] of firstSet.entries()) {
        for (const [secondLayer, secondModel] of secondSet.entries()) {    
            if (firstModel.$path === secondModel.$path) continue;

            const result = await finder.findIntersection(firstModel, secondModel);

            if(result !== undefined){
                const modelName = firstLayer.layer?.modelName ?? 'default';
                let list = messages[modelName];
                if (!list) messages[modelName] = list = [];

                list.push({
                    message: ctx.tr(`Пересечение между "${firstLayer.layer?.name}/${firstLayer.name}" и "${secondLayer.layer?.name}/${secondLayer.name}`), /// подстановка через фигурные скобки
                    severity: DiagnosticSeverity.Warning,
                    tooltip: ctx.tr('Найдено перпесечение'),
                    source: `${firstLayer.layer?.name} -> ${secondLayer.layer?.name}`,
                    ctx,
                    layer1: firstLayer,
                    layer2: secondLayer,
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

/// https://360-staging.topomatic.ru?extensionInstallPath=http%3A%2F%2Flocalhost%3A9093
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
                        layer1: drawing.layers.layer0!,
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