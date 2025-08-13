
import {
  Context,
  ManifestPropertyProvider,DiagnosticRule,
  ObjectPropertyProvider,
  PropertyItem,
  PropertySequenceUpdate,
} from "albatros";
import { DwgType, DiagnosticSeverity } from "../../node_modules/albatros/enums";
import { ConstructionHelper } from './../constructions';
import { IntersectionFinder3 } from './../interceptor3';

declare interface LayerDiagnostic extends Diagnostic {
    ctx: Context;
    layer: DwgLayer;
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

export interface InterceptRuleProps {
  firstConstruction: string;
  secondConstruction: string;
  minDepth: number;
}

export function
    interceptRule(ctx:Context): DiagnosticRule<InterceptRuleProps>  {
        return {
  id: 'interceptRule',
  label: 'Пересечения конструкций',

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
console.log(ctx)
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

    var i = 0;



    const finder = new IntersectionFinder3(ctx);
    const lengthNormal: vec3 = [0, 1, 0];
    const messages: Record<string, Diagnostic[]> = {};

    for (const [aKey, aVal] of first.entries()) {
      for (const [bKey, bVal] of second.entries()) {
        let a= aVal; 
        let b = bVal;
console.log(aVal)
console.log(bVal)

        if (a.$path === b.$path) continue;

        if (!helper.hasConstructionPairFromModels(a, b)) continue;

        const result = await finder.findIntersection2(a, b, helper, lengthNormal);
        const depth = result?.length?.projectedDistance ?? 0;

        if (depth >= rule.minDepth) {
          const modelName = aKey.layer?.modelName ?? 'default';
          let list = messages[modelName];
          if (!list) messages[modelName] = list = [];

i ++;
          list.push({
            message: ctx.tr('Пересечение между "{0}" и "{1}" глубиной {2} мм', a.$id ?? 'obj1', b.$id ?? 'obj2', depth.toFixed(2)),
            severity: DiagnosticSeverity.Warning,
            tooltip: ctx.tr('Глубина пересечения превышает минимальную'),
            source: `${aKey.layer?.name} -> ${bKey.layer?.name}`,
            ctx,
            layer: aKey,
            activation: activateDiagnostic
          });
         
        }

      }
    }

    for (const uri in messages) {
      diagnostics.set(uri, messages[uri]);
    }
  }}
}
