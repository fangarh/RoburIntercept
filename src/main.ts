import { ConstructionHelper } from './constructions';
import { IntersectionFinder3 } from './interceptor3';

import { DiagnosticSeverity, DwgType } from 'albatros/enums';

declare interface LayerDiagnostic extends Diagnostic {
    ctx: Context;
    layer: DwgLayer;
}
declare interface InterceptRuleProps {
  firstConstruction: string;
  secondConstruction: string;
  minDepth: number;
}


function activateDiagnostic(diagnostic: Diagnostic) {
    const ld = diagnostic as LayerDiagnostic;
    ld.ctx.manager.eval('ru.albatros.wdx/wdx:layers:activate', {
        layer: ld.layer,
    });
    ld.ctx.manager.broadcast('wdx:onView:layers:select' as Broadcast, {
        layers: [ld.layer],
        cadview: ld.ctx.cadview,
    });
}


export default {
  'property:minDepth': (e: Context & ManifestPropertyProvider): ObjectPropertyProvider => {
    return{
        getProperties(objects: InterceptRuleProps[]) {
    
          const field = e.field!;
          if (field === undefined) {
            return [];
          }
          return [
            {
              id: `minDepth-${field}`,
              label: e.label ?? "Минимальная глубина пересечения",
              description: e.description,
              value: ()=> { 
                
                return {
                
                label: (objects[0] as any)[field]?.toString() ?? "",
                suffix: "мм",
              }},
              editor: () => ({
                type: "editbox",
                commit: (val:any) => {
                  const number = parseFloat(val);
                  for (const object of objects) {
                    try {
                      (object as any)[field] = number;
                    } catch (e) {
                      console.error(e);
                    }
                  }
                },
                validate: (val:any) => {
                  return isNaN(parseFloat(val)) ? e.tr("Введите число") : undefined;
                },
              }),
            },
          ];
        }
      }
  },
  'interceptRuleCmd' : (ctx:Context): DiagnosticRule<InterceptRuleProps> =>  {
    return {
      async createRule() {
        return {
          firstConstruction: '',
          secondConstruction: '',
          minDepth: 5,
        };
      },

      async execute(app, rule, diagnostics, _progress) {
        diagnostics.clear()
        const drawing = app.model as Drawing;

        if (!drawing?.layouts?.model) return;

        const layersFirst = new Set(await ctx.eval('ru.albatros.wdx/property:filter:select', {
            filter: rule.firstConstruction,
        }) as DwgLayer[]);

        const layersSecond = new Set(await ctx.eval('ru.albatros.wdx/property:filter:select', {
            filter: rule.secondConstruction,
        }) as DwgLayer[]);

        const helper = new ConstructionHelper();

        const allModels: DwgModel3d[] = [];
        drawing.layouts.model.walk(obj => {
          if (obj.type === 'g') {
            allModels.push(obj as DwgModel3d);
          }
          return false;
        });

        helper.BuildConstructionTypes(allModels);
        const first = new Map<DwgLayer, DwgModel3d>();
        const second = new Map<DwgLayer, DwgModel3d>();

        drawing.layouts.model?.walk(e => {
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
        const finder = new IntersectionFinder3(ctx);
        const lengthNormal: vec3 = [0, 1, 0];
        const messages: Record<string, Diagnostic[]> = {};

        for (const [firstLayer, firstModel] of first.entries()) {
          for (const [secondLayer, secondModel] of second.entries()) {            
            if (firstModel.$path === secondModel.$path) continue;

            if (!helper.hasConstructionPairFromModels(firstModel, secondModel)) continue;

            const result = await finder.findIntersection2(firstModel, secondModel, helper, lengthNormal);
            const depth = result?.length?.projectedDistance ?? 0;
            
            if(old_percent  + 1 < Math.ceil(percent / total * 100.)){
                old_percent =  Math.ceil(percent / total * 100.)
                const promise = new Promise<void>((resolve) => {
                    setTimeout(() => { resolve() }, 0);
                });
                await promise;
            }

            _progress.percents = Math.ceil(percent / total * 100.);
            percent ++
            if (depth >= rule.minDepth) {
              const modelName = firstLayer.layer?.modelName ?? 'default';
              let list = messages[modelName];
              if (!list) messages[modelName] = list = [];

              list.push({
                message: ctx.tr('Пересечение между "{0}" и "{1}" глубиной {2} мм', firstModel.$id ?? 'obj1', secondModel.$id ?? 'obj2', depth.toFixed(2)),
                severity: DiagnosticSeverity.Warning,
                tooltip: ctx.tr('Глубина пересечения превышает минимальную'),
                source: `${firstLayer.layer?.name} -> ${secondLayer.layer?.name}`,
                ctx,
                layer: firstLayer,
                activation: activateDiagnostic
              });         
            }
          }
        }

        for (const uri in messages) {
          diagnostics.set(uri, messages[uri]);
        }
      }
    }
  }
}