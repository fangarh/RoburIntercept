

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

export const interceptRule: DiagnosticRule<InterceptRuleProps> = {
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
    const ctx = app.ctx;
    const drawing = app.model as Drawing;

    if (!drawing?.layouts?.model) return;

    const helper = new ConstructionHelper();

    const allModels: DwgModel3d[] = [];
    drawing.layouts.model.walk(obj => {
      if (obj.type === 'g') {
        allModels.push(obj as DwgModel3d);
      }
      return false;
    });

    helper.BuildConstructionTypes(allModels);

    const first = helper.getConstructions().find(c =>
      c.name === rule.firstConstruction
    );
    const second = helper.getConstructions().find(c =>
      c.name === rule.secondConstruction
    );

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

    const models1 = allModels.filter(m =>
      m.layer?.typed?.$id === first.id &&
      m.layer?.typed?.name === first.name
    );
    const models2 = allModels.filter(m =>
      m.layer?.typed?.$id === second.id &&
      m.layer?.typed?.name === second.name
    );

    const finder = new IntersectionFinder3(ctx);
    const lengthNormal: vec3 = [0, 1, 0];
    const messages: Record<string, Diagnostic[]> = {};

    for (const a of models1) {
      for (const b of models2) {
        if (a.$path === b.$path) continue;

        if (!helper.hasConstructionPairFromModels(a, b)) continue;

        const result = await finder.findIntersection2(a, b, helper, lengthNormal);
        const depth = result?.length?.projectedDistance ?? 0;

        if (depth >= rule.minDepth) {
          const modelName = a.layer?.modelName ?? 'default';
          let list = messages[modelName];
          if (!list) messages[modelName] = list = [];

          list.push({
            message: ctx.tr('Пересечение между "{0}" и "{1}" глубиной {2} мм', a.$id ?? 'obj1', b.$id ?? 'obj2', depth.toFixed(2)),
            severity: DiagnosticSeverity.Warning,
            tooltip: ctx.tr('Глубина пересечения превышает минимальную'),
            source: `${a.layer?.name} -> ${b.layer?.name}`,
            ctx,
            layer: a.layer,
            activation: activateDiagnostic
          });
        }
      }
    }

    for (const uri in messages) {
      diagnostics.set(uri, messages[uri]);
    }
  }
};
