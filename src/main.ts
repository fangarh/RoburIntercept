import { ConstructionHelper } from './constructions';
import { IntersectionFinder } from './interceptor';
import { DiagnosticSeverity, DwgType } from 'albatros/enums';

declare interface LayerDiagnostic extends Diagnostic {
    ctx: Context;
    layer: DwgLayer;
    layer2: DwgLayer;
}

declare interface InterceptRuleProps {
  firstConstruction: string;
  secondConstruction: string;
}


function activateDiagnostic(diagnostic: Diagnostic) {
    const ld = diagnostic as LayerDiagnostic;
    ld.ctx.manager.eval('ru.albatros.wdx/wdx:layers:activate', {
        layer: ld.layer,
    });
    ld.ctx.manager.broadcast('wdx:onView:layers:select' as Broadcast, {
        layers: [ld.layer, ld.layer2],
        cadview: ld.ctx.cadview,
    });
}

function searchLayer(layers:Set<DwgLayer>, l: DwgLayer): boolean{
  let curL : DwgLayer | undefined;
  curL = l;
  do{
    if(layers.has(curL))
      return true;
    
    curL = curL.layer
  }while(curL != undefined)

  return false;
}

export default {
  'interceptRuleCmd' : (ctx:Context): DiagnosticRule<InterceptRuleProps> =>  {
    return {
      async createRule() {
        return {
          firstConstruction: '',
          secondConstruction: ''
        };
      },

      async execute(app, rule, diagnostics, _progress) {     
        diagnostics.clear()
        const drawing = app.model as Drawing;

        if (!drawing?.layouts?.model) return;
//drawing.filterLayers( rule.firstConstruction, false) //строгий - только соответствующий, не строгий так-же дочерние
        const layersFirst = drawing.filterLayers( rule.firstConstruction, false) ;

        const layersSecond = drawing.filterLayers( rule.secondConstruction, false) ;

        const helper = new ConstructionHelper();

        const allModels: DwgModel3d[] = [];
        drawing.layouts.model.walk( obj => {
          if (obj.type === DwgType.model3d) {
            allModels.push(obj as DwgModel3d);
          }
          return false;
        } );

        helper.BuildConstructionTypes(allModels);
        const first = new Map<DwgLayer, DwgModel3d>();
        const second = new Map<DwgLayer, DwgModel3d>();
console.log(layersFirst, layersSecond)

        drawing.layouts.model?.walk(e => {
          // Рекурсивно подняться по слоям 
            console.log(e.layer?.$id)
            //Везде использовать Model3d
            if ((e.type === DwgType.model3d) && (e.layer !== undefined)) {
                if (searchLayer(layersFirst, e.layer)) {     
                    const model = (e as DwgModel3d);

                    first.set(e.layer, model);
                } 
                if (searchLayer(layersSecond, e.layer)) {  
                    const model = (e as DwgModel3d);
                    second.set(e.layer, model);
                }
            }
            return false;
        });

        if (!first || !second) {
          diagnostics.set('global', [{
            message: ctx.tr('Не удалось найти выбранные конструкции'),
            severity: DiagnosticSeverity.Warning,
            layer: drawing.layers.layer0!,
            ctx,
            activation: activateDiagnostic
          }]);
          return;
        }

        var total = first.size * second.size;
        var percent = 0
        var old_percent = 0
        const finder = new IntersectionFinder(ctx);
        const lengthNormal: vec3 = [0, 1, 0];
        const messages: Record<string, Diagnostic[]> = {};
console.log(first, second)

        for (const [firstLayer, firstModel] of first.entries()) {
          for (const [secondLayer, secondModel] of second.entries()) {            
            console.log("Searching ...")
            if (firstModel.$path === secondModel.$path) continue;
// убрать
            if (!helper.hasConstructionPairFromModels(firstModel, secondModel)) continue;

            const result = await finder.findIntersection2(firstModel, secondModel, helper, lengthNormal);

            
            if(old_percent  + 1 < Math.ceil(percent / total * 100.)){
                old_percent =  Math.ceil(percent / total * 100.)
                const promise = new Promise<void>((resolve) => {
                    setTimeout(() => { resolve() }, 0);
                });
                await promise;
            }

            _progress.percents = Math.ceil(percent / total * 100.);
            percent ++
            
            const modelName = firstLayer.layer?.modelName ?? 'default';
            let list = messages[modelName];
            if (!list) messages[modelName] = list = [];
console.log(result)
if(result !== undefined)
            list.push({
              message: ctx.tr(`Пересечение между "${firstLayer.layer?.name}/${firstLayer.name}" и "${secondLayer.layer?.name}/${secondLayer.name}`), /// подстановка через фигурные скобки
              severity: DiagnosticSeverity.Warning,
              tooltip: ctx.tr('Найдено перпесечение'),
              source: `${firstLayer.layer?.name} -> ${secondLayer.layer?.name}`,
              ctx,
              layer: firstLayer,
              layer2: secondLayer,
              activation: activateDiagnostic
            });                     
          }
        }

        for (const uri in messages) {
          diagnostics.set(uri, messages[uri]);
        }
      }
    }
  }
}